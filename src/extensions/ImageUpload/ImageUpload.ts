import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, EditorState } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { uploadImageQueue } from '@/hooks/useBlockEditor'
import { countEmbedNodes } from '@/lib/utils/isCustomNodeSelected'

export const uploadPluginKey = new PluginKey('uploadPlaceholder')

export interface UploadPlaceholderAction {
  add?: {
    id: string
    pos: number
    replaceRange?: { from: number; to: number }
  }
  remove?: { id: string }
}

export interface PlaceholderInfo {
  pos: number
  replaceRange?: { from: number; to: number }
}

export function findPlaceholder(state: EditorState, id: string): PlaceholderInfo | null {
  const decos = uploadPluginKey.getState(state) as DecorationSet | undefined
  if (!decos) return null
  const found = decos.find(undefined, undefined, spec => spec.id === id)
  if (!found || found.length === 0) return null

  const widget = found.find(d => (d as any).spec?.key === id)
  const nodeDeco = found.find(d => (d as any).spec?.key === `${id}-node`)

  const pos = widget ? widget.from : found[0].from
  const replaceRange = nodeDeco ? { from: nodeDeco.from, to: nodeDeco.to } : undefined

  return { pos, replaceRange }
}

const createPlaceholderWidget = (id: string) => {
  const wrapper = document.createElement('div')
  wrapper.className = 'w-full my-4 select-none'
  wrapper.setAttribute('data-upload-placeholder-id', id)
  wrapper.innerHTML = `
    <div class="w-full aspect-video min-h-[180px] max-h-[360px] rounded-lg bg-black/[0.03] dark:bg-white/[0.04] backdrop-blur-md animate-pulse flex flex-col items-center justify-center border border-dashed border-black/10 dark:border-white/10 gap-2 p-6 z-[2]">
      <svg class="w-8 h-8 text-zinc-400 dark:text-zinc-500 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
        <circle cx="9" cy="9" r="2"/>
        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
      </svg>
      <div class="flex flex-col items-center gap-0.5 text-center">
        <span class="text-xs font-medium text-zinc-600 dark:text-zinc-300">이미지 업로드 중...</span>
        <span class="text-[11px] text-zinc-400 dark:text-zinc-500">잠시만 기다려주세요</span>
      </div>
    </div>
  `
  return wrapper
}

const isImageUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url.trim())
    return /\.(png|jpe?g|gif|webp|svg|bmp|avif|ico)(\?.*)?$/i.test(parsed.pathname)
  } catch {
    return false
  }
}

export interface ImageUploadOptions {
  onUpload: (file: File) => Promise<string>
  maxSize?: number
  maxImagesPerAction?: number
  accept?: string
  maxEmbeddings?: number
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    imageUpload: {
      uploadImageByUrl: (attributes: { url: string, pos?: number }) => ReturnType
      uploadImageByBase64: (attributes: { base64: string, pos?: number }) => ReturnType
      uploadImageByHtml: (attributes: { html: string, pos?: number }) => ReturnType
      uploadImages: (attributes: { files: File[], pos?: number }) => ReturnType
      retryImageUpload: (localUrl: string) => ReturnType
    }
  }
}

export const ImageUpload = Extension.create<ImageUploadOptions>({
  name: 'imageUpload',

  addOptions() {
    return {
      onUpload: () => Promise.reject('No upload handler provided'),
      maxSize: 5 * 1024 * 1024, // 5MB
      maxImages: 3,
      accept: 'image/*',
    }
  },

  addCommands() {
    return {
      uploadImageByUrl: ({ url, pos }) => ({ editor }) => {
        if (!url || url.length === 0) return false

        // URL 형식 및 이미지 확장자 검증
        try {
          const parsed = new URL(url.trim())
          const isImageExt = /\.(png|jpe?g|gif|webp|svg|bmp|avif|ico)(\?.*)?$/i.test(parsed.pathname)
          if (!isImageExt) {
            return false
          }
        } catch {
          return false
        }

        const fallbackToImageBlock = () => {
          if (pos !== undefined) {
            editor.commands.setTextSelection(pos)
          }
          editor.chain().focus().setImageBlock({ src: url }).run()
        }

        // 1) Direct fetch with Blob conversion
        fetch(url, { mode: 'cors' })
          .then(async res => {
            if (!res.ok) throw new Error('Fetch failed')
            const blob = await res.blob()
            const mimeType = blob.type || 'image/png'
            const ext = mimeType.split('/')[1] || 'png'
            const file = new File([blob], `pasted.${ext}`, { type: mimeType })
            editor.commands.uploadImages({ files: [file], pos })
          })
          .catch(() => {
            // 2) Fallback to Canvas drawImage
            const img = document.createElement('img')
            img.crossOrigin = 'anonymous'
            img.src = url

            img.onload = () => {
              try {
                const canvas = document.createElement('canvas')
                canvas.width = img.naturalWidth
                canvas.height = img.naturalHeight
                const ctx = canvas.getContext('2d')
                if (!ctx) throw new Error('No 2D context')
                ctx.drawImage(img, 0, 0)
                canvas.toBlob(blob => {
                  if (!blob) {
                    fallbackToImageBlock()
                    return
                  }
                  const file = new File([blob], 'pasted.png', { type: blob.type })
                  editor.commands.uploadImages({ files: [file], pos })
                }, 'image/png')
              } catch {
                fallbackToImageBlock()
              }
            }

            img.onerror = () => {
              // 3) Never fallback to plain text: insert as ImageBlock!
              fallbackToImageBlock()
            }
          })

        return true
      },
      uploadImageByBase64: ({ base64, pos }) => ({ editor }) => {
        if (!base64 || base64.length === 0) return false;

        const dataUriRegex = /^data:([a-z]+\/[a-z0-9.+-]+)(?:;[a-z0-9-]+=.*?)*;base64,([A-Za-z0-9+/]+=*)$/i;
        const base64Match = base64.match(dataUriRegex);

        if (base64Match) {
          const [, type, b64] = base64Match;
          const byteString = atob(b64);
          const array = new Uint8Array(byteString.length);
          for (let i = 0; i < byteString.length; i++) {
            array[i] = byteString.charCodeAt(i);
          }
          const blob = new Blob([array], { type: `image/${type}` });
          const file = new File([blob], `pasted.${type}`, { type: blob.type });
          editor.commands.uploadImages({ files: [file], pos });
          return true;
        }

        return false;
      },
      uploadImageByHtml: ({ html, pos }) => ({ editor }) => {
        if (!html || html.length === 0) return false;

        const img = html.match(/<img[^>]+src="([^"]+)"/);
        if (img) {
          const src = img[1];
          if (editor.commands.uploadImageByBase64({ base64: src, pos })) {
            return true;
          }

          if (this.editor.commands.uploadImageByUrl({ url: src, pos })) {
            return true;
          }
        }
        return false;
      },
      uploadImages: ({ files, pos }) => ({ editor }) => {
        if (!this.options.onUpload) {
          return false
        }

        const _pos = pos ?? editor.state.selection.from
        let currentEmbeds = countEmbedNodes(editor)

        // 2) Compute how many more we can embed
        const remainingEmbeds = this.options.maxEmbeddings != null
          ? Math.max(0, this.options.maxEmbeddings - currentEmbeds)
          : files.length
        
        if (remainingEmbeds === 0) {
          alert('Embedding limit reached')
          return false
        }

        // 3) Filter and accept only image files
        const imageFiles = files.filter(file => {
          if (!this.options.accept) return file.type.startsWith('image/');
          return file.type.match(new RegExp(this.options.accept.replace('*', '.*')));
        });
        if (imageFiles.length === 0) return false;

        // 4) Slice to the lesser of remainingEmbeds or maxImagesPerAction
        const maxPerAction = this.options.maxImagesPerAction ?? imageFiles.length
        const limitedFiles = imageFiles.slice(0, Math.min(remainingEmbeds, maxPerAction))
        
        uploadImageQueue.setEditor(editor)
        limitedFiles.forEach(file => {
          setTimeout(() => {
            uploadImageQueue.add({
              file,
              pos: _pos,
              upload: this.options.onUpload,
              maxSize: this.options.maxSize,
              forceReduceSize: true,
            })
          }, 0)
        })

        return true
      },
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: uploadPluginKey,
        state: {
          init() {
            return DecorationSet.empty
          },
          apply(tr, set) {
            set = set.map(tr.mapping, tr.doc)
            const action = tr.getMeta(uploadPluginKey) as UploadPlaceholderAction | undefined
            if (action?.add) {
              const widget = Decoration.widget(
                action.add.pos,
                () => createPlaceholderWidget(action.add!.id),
                { id: action.add.id, key: action.add.id, stopEvent: () => true },
              )
              const decos = [widget]
              if (action.add.replaceRange) {
                const nodeDeco = Decoration.node(
                  action.add.replaceRange.from,
                  action.add.replaceRange.to,
                  { class: '!hidden', style: 'display: none !important;' },
                  { id: action.add.id, key: `${action.add.id}-node` },
                )
                decos.push(nodeDeco)
              }
              set = set.add(tr.doc, decos)
            } else if (action?.remove) {
              const found = set.find(undefined, undefined, spec => spec.id === action.remove!.id)
              if (found.length) {
                set = set.remove(found)
              }
            }
            return set
          },
        },
        props: {
          decorations(state) {
            return uploadPluginKey.getState(state)
          },
        },
      }),
      new Plugin({
        key: new PluginKey('imageUpload'),
        props: {
          handlePaste: (_view, event) => {
            const clipboard = (event as ClipboardEvent).clipboardData;
            if (!clipboard) return false;

            const items = clipboard.items;
            const text = clipboard.getData('text');
            const html = clipboard.getData('text/html');

            if (items?.length > 0) {
              const files = Array.from(items)
                .map(item => item.getAsFile())
                .filter((file): file is File => file !== null)

              if (files.length > 0) {
                this.editor.commands.uploadImages({ files });
                return true;
              }
            }
            
            if (this.editor.commands.uploadImageByBase64({ base64: text })) {
              return true;
            }

            if (this.editor.commands.uploadImageByHtml({ html })) {
              return true;
            }

            return false;
          },
          handleDrop: (view, event, _slice, moved) => {
            if (moved) return false
            const coords = view.posAtCoords({ left: event.clientX, top: event.clientY }) || { pos: 0 };

            const files = Array.from(event.dataTransfer?.files || []);
            if (files.length > 0) {
              this.editor.commands.uploadImages({ files, pos: coords.pos });
              return true;
            }

            // Handle text/URL
            const text = event.dataTransfer?.getData('text');
            const html = event.dataTransfer?.getData('text/html');

            if (text) {
              if (this.editor.commands.uploadImageByBase64({ base64: text, pos: coords.pos })) {
                return true;
              }

              if (isImageUrl(text) && this.editor.commands.uploadImageByUrl({ url: text, pos: coords.pos })) {
                return true;
              }
            }
            
            if (html && this.editor.commands.uploadImageByHtml({ html, pos: coords.pos })) {
              return true;
            }

            return false;
          },
        },
      }),
    ]
  },
}) 