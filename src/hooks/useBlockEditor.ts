import { useEditor } from '@tiptap/react'
import type { Editor, EditorOptions } from '@tiptap/core'
// import Collaboration from '@tiptap/extension-collaboration'
// import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
// import { TiptapCollabProvider, WebSocketStatus } from '@hocuspocus/provider'
// import type { Doc as YDoc } from 'yjs'

import { ExtensionKit } from '@/extensions/extension-kit'
import { UploadQueue } from '@/extensions/ImageUpload/ImageUploadQueue'
import { useEffect, useMemo, useState } from 'react'
import { UploadListDialogProps, UploadListItem } from '@/extensions/ImageUpload/components/UploadListDialog.tsx'
import { ConvertSrc, OnImageClick } from '@/extensions/ImageBlock/components/ImageBlockView'
import { detectPasteType } from '@/components/menus/SmartPasteMenu'
// import { userColors, userNames } from '../lib/constants'
// import { randomElement } from '../lib/utils'
// import type { EditorUser } from '../components/BlockEditor/types'
// import { initialContent } from '@/lib/data/initialContent'
// import { Ai } from '@/extensions/Ai'
// import { AiImage, AiWriter } from '@/extensions'

declare global {
  interface Window {
    editor: Editor | null
  }
}

export const uploadImageQueue = new UploadQueue()

export const useBlockEditor = ({
  key,
  editable,
  content,
  onUploadImage,
  convertSrc,
  onImageClick,
  maxSize,
  maxEmbeddings,
  maxCharacters,
  className = '',
  // ydoc,
  // provider,
  ...editorOptions
}: {
  // ydoc: YDoc | null
  // provider?: TiptapCollabProvider | null | undefined
  onUploadImage?: (file: File) => Promise<string>
  convertSrc?: ConvertSrc
  onImageClick?: OnImageClick
  maxSize?: number
  maxEmbeddings?: number
  maxCharacters?: number
  className?: string
  key?: string
} & Partial<Omit<EditorOptions, 'extensions'>>) => {
  const editor = useEditor(
    {
      ...editorOptions,
      editable,
      immediatelyRender: false,
      shouldRerenderOnTransaction: false,
      autofocus: true,
      extensions: ExtensionKit({ 
        limit: maxCharacters,
        onUploadImage,
        convertSrc,
        onImageClick,
        maxSize,
        maxEmbeddings,
      }),
      editorProps: {
        attributes: {
          autocomplete: 'off',
          autocorrect: 'off',
          autocapitalize: 'off',
          class: `min-h-full ${className}`,
        },
        handlePaste: (_view, event) => {
          const clipboard = (event as ClipboardEvent).clipboardData
          if (!clipboard) return false

          // 1) Clipboard Image Files (e.g. screenshot or copied image files)
          const files = Array.from(clipboard.files || []).filter(f => f.type.startsWith('image/'))
          if (files.length > 0) {
            event.preventDefault()
            editor?.commands.uploadImages({ files })
            return true
          }

          const rawText = clipboard.getData('text/plain')
          const text = rawText ? rawText.trim() : ''
          if (!text) return false

          // 2) Base64 Data URL detection
          if (text.startsWith('data:image/') && text.includes(';base64,')) {
            event.preventDefault()
            editor?.chain().focus().setImageBlock({ src: text }).run()
            return true
          }

          // 3) Smart Paste Detection (Image URL, YouTube, Web URL, Code snippet, Markdown list)
          const detected = detectPasteType(text)
          if (detected && _view) {
            event.preventDefault()
            const pos = _view.state.selection.from
            const coords = _view.coordsAtPos(pos)
            window.dispatchEvent(
              new CustomEvent('tiptap:smart-paste', {
                detail: {
                  text,
                  type: detected.type,
                  meta: detected.meta,
                  coords: {
                    top: coords.top,
                    left: coords.left,
                    bottom: coords.bottom,
                  },
                  selection: {
                    from: _view.state.selection.from,
                    to: _view.state.selection.to,
                  },
                },
              }),
            )
            return true
          }

          // Default: let standard TipTap paste handlers run
          return false
        },
      },
      content,
    },
    [maxSize, maxEmbeddings],
  )

  const [uploadItems, setUploadItems] = useState<UploadListItem[]>([])
  
  const uploadDialog = useMemo<UploadListDialogProps>(
    () => ({
      items: uploadItems,
      onRetry: (id: string) => uploadImageQueue.retry(id),
      onRemove: (id: string) => uploadImageQueue.remove(id),
    }),
    [uploadItems],
  )

  useEffect(() => {
    uploadImageQueue.onStatusChange(items => {
      setUploadItems(items)
    })
  }, [])

  useEffect(() => {
    uploadImageQueue.clear()
  }, [key, editable])

  // Only set window.editor if editor is initialized
  if (editor) {
    window.editor = editor
  }
  
  return { editor, uploadDialog }
}
