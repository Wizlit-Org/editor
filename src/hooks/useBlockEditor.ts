import { useEditor, useEditorState } from '@tiptap/react'
import type { AnyExtension, Editor, EditorOptions } from '@tiptap/core'
// import Collaboration from '@tiptap/extension-collaboration'
// import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
// import { TiptapCollabProvider, WebSocketStatus } from '@hocuspocus/provider'
// import type { Doc as YDoc } from 'yjs'

import { ExtensionKit } from '@/extensions/extension-kit'
import { UploadQueue } from '@/extensions/ImageUpload/ImageUploadQueue'
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
  content,
  onUploadImage,
  maxSize,
  maxImages,
  maxCharacters,
  className = '',
  // ydoc,
  // provider,
  ...editorOptions
}: {
  // ydoc: YDoc | null
  // provider?: TiptapCollabProvider | null | undefined
  onUploadImage?: (file: File) => Promise<string>
  maxSize?: number
  maxImages?: number
  maxCharacters?: number
  className?: string
} & Partial<Omit<EditorOptions, 'extensions'>>) => {
  const editor = useEditor(
    {
      ...editorOptions,
      immediatelyRender: true,
      shouldRerenderOnTransaction: false,
      autofocus: true,
      // onCreate: ctx => {
      //   if (provider && !provider.isSynced) {
      //     provider.on('synced', () => {
      //       setTimeout(() => {
      //         if (ctx.editor.isEmpty) {
      //           ctx.editor.commands.setContent(initialContent)
      //         }
      //       }, 0)
      //     })
      //   } else if (ctx.editor.isEmpty) {
      //     ctx.editor.commands.setContent(initialContent)
      //     ctx.editor.commands.focus('start', { scrollIntoView: true })
      //   }
      // },
      extensions: ExtensionKit({ 
        editable: editorOptions.editable, 
        limit: maxCharacters,
        onUploadImage,
        maxSize,
        maxImages,
      }),
      editorProps: {
        attributes: {
          autocomplete: 'off',
          autocorrect: 'off',
          autocapitalize: 'off',
          class: `min-h-full ${className}`,
        },
      },
      content,
      onPaste: async (event) => {
        // Check for YouTube links in text content
        const textContent = (event as ClipboardEvent).clipboardData?.getData('text');
        if (textContent) {
          const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
          const match = textContent.match(youtubeRegex);
          if (match) {
            const videoId = match[1];
            editor.commands.setYoutubeVideo({
              src: `https://www.youtube.com/embed/${videoId}`,
            });
            return;
          }
        }
      },
    },
    [content, maxSize, maxImages, editorOptions.editable],
    // [ydoc, provider],
  )

  window.editor = editor

  return { editor }
}