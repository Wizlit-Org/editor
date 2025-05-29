import { useEditor, useEditorState } from '@tiptap/react'
import type { AnyExtension, Editor, EditorOptions } from '@tiptap/core'
// import Collaboration from '@tiptap/extension-collaboration'
// import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
// import { TiptapCollabProvider, WebSocketStatus } from '@hocuspocus/provider'
// import type { Doc as YDoc } from 'yjs'

import { ExtensionKit } from '@/extensions/extension-kit'
import { UploadQueue } from '@/extensions/ImageUpload/ImageUploadQueue'
import { useEffect, useMemo } from 'react'
import { useState } from 'react'
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
      immediatelyRender: true,
      // shouldRerenderOnTransaction: false,
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
        handlePaste: (view, event) => {
          const clipboard = (event as ClipboardEvent).clipboardData;
          if (!clipboard) return false;
          console.log('handlePaste', clipboard);
          
          const text = clipboard.getData('text');
          
          // 1) Handle YouTube URLs
          const url = (() => {
            try { return new URL(text); }
            catch { return null; }
          })();
          if (url) {
            event.preventDefault();

            const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
            const isYoutube = text.match(youtubeRegex);

            if (isYoutube) {
              const videoId = isYoutube[1];
              editor.commands.setYoutubeVideo({
                src: `https://www.youtube.com/embed/${videoId}`,
              });
              return true;
            }
          }
        
          // 4) Default: let Tiptap handle the paste normally
          return false;
        },
      },
      content,
    },
    [maxSize, maxEmbeddings],
    // [ydoc, provider],
  )

  const [uploadItems, setUploadItems] = useState<UploadListItem[]>([]);
  
  const uploadDialog = useMemo<UploadListDialogProps>(
    () => ({
      items: uploadItems,
      onRetry: (id: string) => uploadImageQueue.retry(id),
      onRemove: (id: string) => uploadImageQueue.remove(id),
    }),
    [uploadItems]
  );

  useEffect(() => {
    uploadImageQueue.onStatusChange(items => {
      setUploadItems(items);
    });
  }, []);

  useEffect(() => {
    uploadImageQueue.clear();
  }, [key, editable]);

  // Only set window.editor if editor is initialized
  if (editor) {
    window.editor = editor;
  }
  
  return {editor, uploadDialog}
}