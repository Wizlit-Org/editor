import '@/styles/globals.css'
import '@/styles/index.css'

import { useBlockEditor } from '@/hooks/useBlockEditor'

import { EditorContent, useEditorState } from '@tiptap/react'
import React, { useRef, useEffect, useCallback, useState } from 'react'

import ImageBlockMenu from '@/extensions/ImageBlock/components/ImageBlockMenu'
import { ColumnsMenu } from '@/extensions/MultiColumn/menus'
import { TableColumnMenu, TableRowMenu } from '@/extensions/Table/menus'
import { TextMenu } from '@/components/menus/TextMenu'
// import { ContentItemMenu } from '@/components/menus/ContentItemMenu'
import { LinkMenu } from '@/components/menus/LinkMenu'
import { EditorState } from '@tiptap/pm/state'
import { UploadListDialog, UploadListDialogProps, UploadListItem } from '../../extensions/ImageUpload/components/UploadListDialog.tsx'
import { compareDocs, getStats } from '@/lib/utils/getStats'
import { ConvertSrc, OnImageClick } from '@/extensions/ImageBlock/components/ImageBlockView'

export interface EditorStats {
  characters?: number;
  words?: number;
  percentage?: number;
  embedCount?: number;
  embedList?: string[];
  plainText?: string;
}

export interface BlockEditorProps {
  key?: string // Unique key for multiple editor instances
  content?: string
  onChange?: (content: string, isChanged: { isChanged: boolean, isStrictChanged: boolean }, stats: EditorStats) => void
  className?: string
  readOnly?: boolean
  showDebug?: boolean | { altCharacterCounter?: boolean }

  maxCharacters?: number // Maximum number of characters (default: 5000)
  altCharacterCounter?: boolean

  maxEmbeddings?: number // Maximum number of embeds (default: 3)
  image?: {
    maxSize?: number // Maximum file size in bytes (default: 5MB)
    disableBuiltInUploadDialog?: boolean
    convertSrc?: ConvertSrc
    onUploadImage?: (file: File) => Promise<string>
    getUploadDialogProps?: (props: UploadListDialogProps) => void
    onClick?: OnImageClick
    onLoadingChange?: (hasUploading: boolean) => void
  },

  link?: {
    disableDefaultAction?: boolean | ((url: string) => boolean)
    onClick?: (url: string) => void
  }
}

const defaultUploadImage = async (): Promise<string> => {
  console.warn(
    'Image upload is disabled in the demo… implement your API.uploadImage'
  );
  await new Promise((r) =>
    setTimeout(r, Math.floor(Math.random() * 5000) + 1000)
  );
  if (Math.random() < 0.5) {
    throw new Error('Demo upload failed');
  }
  return `https://picsum.photos/${
    Math.floor(Math.random() * 300) + 100
  }/${Math.floor(Math.random() * 200) + 100}`;
};

export const BlockEditor: React.FC<BlockEditorProps> = ({
  content = '',
  onChange,
  className = '',
  readOnly,
  maxEmbeddings = 3, // Default maximum number of images
  maxCharacters, // Default maximum number of characters
  showDebug = false,
  altCharacterCounter = false,
  key,
  image,
  link,
}) => {
  const {
    maxSize = 5 * 1024 * 1024, // Default 5MB
    onUploadImage = defaultUploadImage,
  } = image || {}
  
  const menuContainerRef = useRef(null)
  const [stats, setStats] = useState<EditorStats>({})
  
  useEffect(() => {
    const preventDefault = (e: DragEvent) => {
      e.preventDefault()
    }

    // Prevent default behavior for drag events
    window.addEventListener('dragover', preventDefault)
    window.addEventListener('drop', preventDefault)

    return () => {
      window.removeEventListener('dragover', preventDefault)
      window.removeEventListener('drop', preventDefault)
    }
  }, [])

  const { editor, uploadDialog } = useBlockEditor({
    // aiToken,
    editable: !readOnly,
    content,
    onUpdate: ({ editor }) => {
      const { isChanged, isStrictChanged, compareHTML } = compareDocs(content, editor.getHTML())
      const stats = getStats(editor, maxCharacters, altCharacterCounter)

      setStats(stats)
      onChange?.(compareHTML, { isChanged, isStrictChanged }, stats)
    },
    onUploadImage,
    convertSrc: image?.convertSrc,
    onImageClick: image?.onClick,
    maxSize,
    maxEmbeddings,
    className,
    maxCharacters,
    key,
  })

  const { characters, words } = useEditorState({
    editor,
    selector: (ctx): { characters: number; words: number } => {
      const { characters, words } = ctx.editor?.storage.characterCount || { characters: () => 0, words: () => 0 }
      return { characters: characters(), words: words() }
    },
  })

  const percentage = editor && maxCharacters
    ? Math.round((100 / maxCharacters) * editor.storage.characterCount.characters())
    : 0

  const handleEditable = useCallback((_editable = !editor?.isEditable) => {
    if (!editor) return;
    
    try {
      editor.setEditable(_editable);
      
      // Only update state if the editor is properly initialized
      if (editor.isDestroyed) return;
      
      const { state, view } = editor;
      if (!state || !view) return;
      
      const freshState = EditorState.create({
        schema: state.schema,
        plugins: state.plugins,
        doc: state.doc,
      });
      
      if (view.isDestroyed) return;
      view.updateState(freshState);
    } catch (error) {
      console.error('Error updating editor state:', error);
    }
  }, [editor]);

  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      handleEditable(!readOnly);
    }
  }, [readOnly, editor, handleEditable]);

  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      editor.commands.setContent(content, true);
    }
  }, [content, editor]);

  
  const prevUploadDialogRef = useRef<{
    items: UploadListItem[];
    onRetry: (id: string) => void;
    onRemove: (id: string) => void;
    onLoadingChange?: (hasUploading: boolean) => void;
  } | null>(null)
  
  useEffect(() => {
    if (editor && image?.getUploadDialogProps) {
      const currentProps = {
        items: uploadDialog.items,
        onRetry: uploadDialog.onRetry,
        onRemove: uploadDialog.onRemove,
        onLoadingChange: image.onLoadingChange
      };

      // Only call if values actually changed
      if (JSON.stringify(prevUploadDialogRef.current) !== JSON.stringify(currentProps)) {
        image.getUploadDialogProps(currentProps);
        prevUploadDialogRef.current = currentProps;
      }
    }
  }, [editor, image?.getUploadDialogProps, image?.onLoadingChange, uploadDialog.items]);

  if (!editor) {
    return null
  }

  return (
    <>
      <div className="flex" ref={menuContainerRef}>
        <div className="relative flex flex-col flex-1 overflow-hidden">
          {/* <EditorHeader
            editor={editor}
            // collabState={collabState}
            // users={users}
          /> */}
          <EditorContent editor={editor} className="flex-1" />
          {/* <ContentItemMenu editor={editor} isEditable={isEditable} /> */}
          <LinkMenu
            editor={editor}
            appendTo={menuContainerRef}
            disableDefaultAction={link?.disableDefaultAction}
            onLinkClick={link?.onClick}
          />
          <TextMenu editor={editor} />
          <ColumnsMenu editor={editor} appendTo={menuContainerRef} />
          <TableRowMenu editor={editor} appendTo={menuContainerRef} />
          <TableColumnMenu editor={editor} appendTo={menuContainerRef} />
          <ImageBlockMenu editor={editor} appendTo={menuContainerRef} />
        </div>
      </div>

      {showDebug && (
        <div className="absolute top-0 left-0 p-4 bg-white/80 rounded-lg shadow-lg">
          <button onClick={() => handleEditable()} className="bg-blue-500 text-white px-3 py-2 rounded-md mb-2 text-sm">
            {editor.isEditable ? 'Editable' : 'Read Only'}
          </button>
          <div className="space-y-1">
            <p className="text-xs">Characters: {altCharacterCounter ? characters : stats.characters}</p>
            <p className="text-xs">Words: {altCharacterCounter ? words : stats.words}</p>
            {maxCharacters && (
              <p className="text-xs">
                Progress: {altCharacterCounter ? percentage : Math.round((100 / maxCharacters) * (stats.characters || 0))}% 
                ({altCharacterCounter ? characters : stats.characters}/{maxCharacters})
              </p>
            )}
          </div>
        </div>
      )}

      {!image?.disableBuiltInUploadDialog && !readOnly && (
        <UploadListDialog
          {...uploadDialog}
          className="fixed bottom-4 right-4"
        />
      )}
    </>
  )
}

export default BlockEditor 