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
  wrapper.className = 'w-full my-3 select-none pointer-events-none'
  wrapper.setAttribute('data-upload-placeholder-id', id)
  wrapper.innerHTML = `
    <div class="w-full aspect-video min-h-[180px] max-h-[360px] rounded-lg bg-black/[0.03] dark:bg-white/[0.04] backdrop-blur-md animate-pulse flex flex-col items-center justify-center border border-dashed border-[color-mix(in_srgb,var(--editor-primary)_35%,transparent)] gap-2.5 p-6 z-[2]" style="border-color: color-mix(in srgb, var(--editor-primary, #faaf2d) 35%, transparent)">
      <div class="w-10 h-10 rounded-full bg-[color-mix(in_srgb,var(--editor-primary)_15%,transparent)] dark:bg-[color-mix(in_srgb,var(--editor-primary)_20%,transparent)] flex items-center justify-center">
        <svg class="w-5 h-5 text-[var(--editor-primary)] animate-spin" style="color: var(--editor-primary, #faaf2d)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
      </div>
      <div class="flex flex-col items-center gap-0.5 text-center">
        <span data-upload-stage="true" class="text-xs font-semibold text-zinc-700 dark:text-zinc-200">이미지 최적화 및 업로드 준비 중...</span>
        <span data-upload-subtext="true" class="text-[11px] text-zinc-400 dark:text-zinc-500">잠시만 기다려주세요</span>
      </div>
    </div>
  `
  return wrapper
}

const isImageUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url.trim())
    return /\.(png|jpe?g|gif|webp|svg|bmp|avif|ico|tiff)(\?.*)?$/i.test(parsed.pathname)
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
  imageProxyUrl?: (url: string) => string
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    imageUpload: {
      uploadImageByUrl: (attributes: { url: string; pos?: number }) => ReturnType
      uploadImageByBase64: (attributes: { base64: string; pos?: number }) => ReturnType
      uploadImageByHtml: (attributes: { html: string; pos?: number }) => ReturnType
      uploadImages: (attributes: { files: File[]; pos?: number }) => ReturnType
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
      imageProxyUrl: undefined,
    }
  },

  addCommands() {
    return {
      uploadImageByUrl:
        ({ url, pos }) =>
        ({ editor }) => {
          if (!url || url.trim().length === 0) return false
          if (!this.options.onUpload) return false

          const cleanUrl = url.trim()
          try {
            const parsed = new URL(cleanUrl)
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
              return false
            }
          } catch {
            return false
          }

          const currentEmbeds = countEmbedNodes(editor)
          const remainingEmbeds =
            this.options.maxEmbeddings != null
              ? Math.max(0, this.options.maxEmbeddings - currentEmbeds)
              : 1

          if (remainingEmbeds === 0) {
            alert('Embedding limit reached')
            return false
          }

          const targetPos = pos ?? editor.state.selection.from

          // Enqueue directly with sourceUrl so the skeleton placeholder widget mounts at 0ms synchronously
          uploadImageQueue.setEditor(editor)
          uploadImageQueue.add({
            sourceUrl: cleanUrl,
            pos: targetPos,
            upload: this.options.onUpload,
            maxSize: this.options.maxSize,
            forceReduceSize: true,
            imageProxyUrl: this.options.imageProxyUrl,
          })

          return true
        },

      uploadImageByBase64:
        ({ base64, pos }) =>
        ({ editor }) => {
          if (!base64 || base64.trim().length === 0) return false
          if (!this.options.onUpload) return false

          const cleanBase64 = base64.trim()
          if (!cleanBase64.startsWith('data:image/') || !cleanBase64.includes(';base64,')) {
            return false
          }

          const currentEmbeds = countEmbedNodes(editor)
          const remainingEmbeds =
            this.options.maxEmbeddings != null
              ? Math.max(0, this.options.maxEmbeddings - currentEmbeds)
              : 1

          if (remainingEmbeds === 0) {
            alert('Embedding limit reached')
            return false
          }

          const targetPos = pos ?? editor.state.selection.from

          // Enqueue directly with base64Source so the skeleton placeholder widget mounts at 0ms synchronously
          uploadImageQueue.setEditor(editor)
          uploadImageQueue.add({
            base64Source: cleanBase64,
            pos: targetPos,
            upload: this.options.onUpload,
            maxSize: this.options.maxSize,
            forceReduceSize: true,
          })

          return true
        },

      uploadImageByHtml:
        ({ html, pos }) =>
        ({ editor }) => {
          if (!html || html.length === 0) return false

          const img = html.match(/<img[^>]+src="([^"]+)"/)
          if (img) {
            const src = img[1]
            if (editor.commands.uploadImageByBase64({ base64: src, pos })) {
              return true
            }

            if (this.editor.commands.uploadImageByUrl({ url: src, pos })) {
              return true
            }
          }
          return false
        },

      uploadImages:
        ({ files, pos }) =>
        ({ editor }) => {
          if (!this.options.onUpload) {
            return false
          }

          const _pos = pos ?? editor.state.selection.from
          const currentEmbeds = countEmbedNodes(editor)

          const remainingEmbeds =
            this.options.maxEmbeddings != null
              ? Math.max(0, this.options.maxEmbeddings - currentEmbeds)
              : files.length

          if (remainingEmbeds === 0) {
            alert('Embedding limit reached')
            return false
          }

          const imageFiles = files.filter(file => {
            if (!this.options.accept) return file.type.startsWith('image/')
            return file.type.match(new RegExp(this.options.accept.replace('*', '.*')))
          })
          if (imageFiles.length === 0) return false

          const maxPerAction = this.options.maxImagesPerAction ?? imageFiles.length
          const limitedFiles = imageFiles.slice(0, Math.min(remainingEmbeds, maxPerAction))

          uploadImageQueue.setEditor(editor)
          limitedFiles.forEach(file => {
            uploadImageQueue.add({
              file,
              pos: _pos,
              upload: this.options.onUpload,
              maxSize: this.options.maxSize,
              forceReduceSize: true,
            })
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
              // Mount widget OUTSIDE any hidden nodeDeco (at replaceRange.from) so display:none on empty <p> never hides the skeleton widget
              const widgetPos = action.add.replaceRange
                ? action.add.replaceRange.from
                : action.add.pos
              const widget = Decoration.widget(
                widgetPos,
                () => createPlaceholderWidget(action.add!.id),
                { id: action.add.id, key: action.add.id, side: -1, stopEvent: () => true },
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
            const clipboard = (event as ClipboardEvent).clipboardData
            if (!clipboard) return false

            const items = clipboard.items
            const text = clipboard.getData('text')
            const html = clipboard.getData('text/html')

            if (items?.length > 0) {
              const files = Array.from(items)
                .map(item => item.getAsFile())
                .filter((file): file is File => file !== null)

              if (files.length > 0) {
                this.editor.commands.uploadImages({ files })
                return true
              }
            }

            if (this.editor.commands.uploadImageByBase64({ base64: text })) {
              return true
            }

            if (this.editor.commands.uploadImageByHtml({ html })) {
              return true
            }

            return false
          },
          handleDrop: (view, event, _slice, moved) => {
            if (moved) return false
            const coords = view.posAtCoords({ left: event.clientX, top: event.clientY }) || {
              pos: 0,
            }

            const files = Array.from(event.dataTransfer?.files || [])
            if (files.length > 0) {
              this.editor.commands.uploadImages({ files, pos: coords.pos })
              return true
            }

            const text = event.dataTransfer?.getData('text')
            const html = event.dataTransfer?.getData('text/html')

            if (text) {
              if (this.editor.commands.uploadImageByBase64({ base64: text, pos: coords.pos })) {
                return true
              }

              if (
                isImageUrl(text) &&
                this.editor.commands.uploadImageByUrl({ url: text, pos: coords.pos })
              ) {
                return true
              }
            }

            if (html && this.editor.commands.uploadImageByHtml({ html, pos: coords.pos })) {
              return true
            }

            return false
          },
        },
      }),
    ]
  },
})
