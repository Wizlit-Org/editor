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
  maxSize?: number
  maxEmbeddings?: number
  maxCharacters?: number
  className?: string
  key?: string
} & Partial<Omit<EditorOptions, 'extensions'>>) => {
  const editor = useEditor(
    {
      ...editorOptions,
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
        editable: editorOptions.editable, 
        limit: maxCharacters,
        onUploadImage,
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
          const text = clipboard.getData('text');
          
          // 1) Handle YouTube URLs
          const url = (() => {
            try {
              return new URL(text);
            } catch {
              return null;
            }
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

            } else {
              // Handle valid image URLs
              const img = new Image();
              img.onload = () => {
                const pos = editor.state.selection.from;
                editor.commands.setImageBlockAt({ src: text, pos });
              };
              img.onerror = () => {
                // If image fails to load, let Tiptap handle the paste
                editor.commands.insertContent(text);
              };
              img.src = text;
              return true;
            }
          }
        
          // 2) Handle Base64 data URIs
          const base64Match = text.match(
            /^data:image\/(png|jpe?g|gif|webp);base64,([A-Za-z0-9+/]+=*)$/
          );
          if (base64Match) {
            event.preventDefault();
            const [, type, b64] = base64Match;
            const byteString = atob(b64);
            const array = new Uint8Array(byteString.length);
            for (let i = 0; i < byteString.length; i++) {
              array[i] = byteString.charCodeAt(i);
            }
            const blob = new Blob([array], { type: `image/${type}` });
            const file = new File([blob], `pasted.${type}`, { type: blob.type });
            editor.commands.uploadImages({ files: [file] });
            return true;
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

  // Only set window.editor if editor is initialized
  if (editor) {
    window.editor = editor;
  }
  
  return {editor, uploadDialog}
}