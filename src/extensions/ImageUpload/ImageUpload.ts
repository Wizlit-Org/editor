import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { uploadImageQueue } from '@/hooks/useBlockEditor'

export interface ImageUploadOptions {
  onUpload: (file: File) => Promise<string>
  maxSize?: number
  maxImages?: number
  accept?: string
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    imageUpload: {
      uploadImages: (attributes: { files: File[], pos?: number }) => ReturnType
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
      uploadImages: ({ files, pos }) => ({ editor, state, dispatch }) => {
        if (!this.options.onUpload) {
          return false
        }

        const _pos = pos || state.selection.from

        const imageFiles = files.filter(file => {
          if (!this.options.accept) return file.type.startsWith('image/');
          return file.type.match(new RegExp(this.options.accept.replace('*', '.*')));
        });
        if (imageFiles.length === 0) return false;
        const limitedFiles = imageFiles.slice(0, this.options.maxImages)

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
            const items = (event as ClipboardEvent).clipboardData?.items
            if (!items || items.length === 0) return false
            
            const files = Array.from(items)
              .map(item => item.getAsFile())
              .filter((file): file is File => file !== null)
            if (files.length === 0) return false

            this.editor.commands.uploadImages({ files });
            return true
          },
          handleDrop: (view, event, slice, moved) => {
            if (moved) return false

            const files = Array.from(event.dataTransfer?.files || []);
            if (!files.length) return false

            const coords = view.posAtCoords({ left: event.clientX, top: event.clientY }) || { pos: 0 };
            this.editor.commands.uploadImages({ files, pos: coords.pos });
            return true
          },
        },
      }),
    ]
  },
}) 