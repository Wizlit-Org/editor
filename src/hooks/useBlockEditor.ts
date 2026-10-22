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

          // 3) URL detection
          const url = (() => {
            try {
              if (text.startsWith('http://') || text.startsWith('https://')) {
                return new URL(text)
              }
              return null
            } catch {
              return null
            }
          })()

          if (url) {
            // 3-a) YouTube URL detection (watch, embed, shorts, youtu.be)
            const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
            const ytMatch = text.match(youtubeRegex)
            if (ytMatch) {
              event.preventDefault()
              const videoId = ytMatch[1]
              editor?.chain().focus().setYoutubeVideo({
                src: `https://www.youtube.com/embed/${videoId}`,
              }).run()
              return true
            }

            // 3-b) Image URL detection (.png, .jpg, .jpeg, .gif, .webp, .svg)
            const isImageUrl = /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(url.pathname)
            if (isImageUrl) {
              event.preventDefault()
              editor?.chain().focus().setImageBlock({ src: text }).run()
              return true
            }

            // 3-c) General Web URL: Convert to Hyperlink!
            event.preventDefault()
            if (editor && !editor.state.selection.empty) {
              // Selection exists: wrap selected text with link mark
              editor.chain().focus().setLink({ href: text }).run()
            } else if (editor) {
              // Cursor only: insert hyperlinked text
              editor
                .chain()
                .focus()
                .insertContent({
                  type: 'text',
                  text,
                  marks: [{ type: 'link', attrs: { href: text } }],
                })
                .run()
            }
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
