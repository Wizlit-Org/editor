import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { uploadImageQueue } from '@/hooks/useBlockEditor'
import { countEmbedNodes } from '@/lib/utils/isCustomNodeSelected'

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
      uploadImageByUrl: ({ url, pos }) => ({ editor, state, dispatch }) => {
        if (!url || url.length === 0) return false;
        
        // URL 형식 검증
        try { new URL(url) } catch { return false }

        const img = document.createElement('img');
        img.crossOrigin = 'anonymous';  
        img.src = url;

        const onError = (e: Error | string | Event | unknown) => {
          console.error('onerror', e)
          // If image fails to load, let Tiptap handle the paste
          if (pos !== undefined) {
            editor.commands.setTextSelection(pos);
          }
          editor.commands.insertContent(url);
        }
        
        img.onload = async () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width  = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              onError('Canvas 2D 컨텍스트를 가져올 수 없습니다.')
              return;
            }
            ctx.drawImage(img, 0, 0);
        
            // 3) 캔버스를 Blob으로 변환
            canvas.toBlob((blob) => {
              if (!blob) {
                onError('Blob 생성 실패')
                return;
              }
              // 4) File 객체로 래핑 및 업로드 명령 실행
              const file = new File([blob], 'pasted.png', { type: blob.type });
              editor.commands.uploadImages({ files: [file], pos });
            }, 'image/png'); 
          } catch (e) {
            onError(e)
          }
        };
        img.onerror = (e) => {
          onError(e)
        };
        return true;
      },
      uploadImageByBase64: ({ base64, pos }) => ({ editor, state, dispatch }) => {
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
      uploadImageByHtml: ({ html, pos }) => ({ editor, state, dispatch }) => {
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
      uploadImages: ({ files, pos }) => ({ editor, state, dispatch }) => {
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
        key: new PluginKey('imageUpload'),
        props: {
          handlePaste: (view, event) => {
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

            if (this.editor.commands.uploadImageByUrl({ url: text })) {
              return true;
            }

            if (this.editor.commands.uploadImageByHtml({ html })) {
              return true;
            }

            return false;
          },
          handleDrop: (view, event, slice, moved) => {
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

              if (this.editor.commands.uploadImageByUrl({ url: text, pos: coords.pos })) {
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