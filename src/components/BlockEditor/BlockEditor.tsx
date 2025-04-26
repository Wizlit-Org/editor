import '@/styles/globals.css'
import '@/styles/index.css'

import { useBlockEditor } from '@/hooks/useBlockEditor'

import { EditorContent, useEditorState } from '@tiptap/react'
import React, { useRef, useEffect, useCallback } from 'react'

import ImageBlockMenu from '@/extensions/ImageBlock/components/ImageBlockMenu'
import { ColumnsMenu } from '@/extensions/MultiColumn/menus'
import { TableColumnMenu, TableRowMenu } from '@/extensions/Table/menus'
import { TextMenu } from '@/components/menus/TextMenu'
// import { ContentItemMenu } from '@/components/menus/ContentItemMenu'
import { LinkMenu } from '@/components/menus/LinkMenu'
import { EditorState } from '@tiptap/pm/state'

export interface BlockEditorProps {
  content?: string
  onChange?: (content: string, stats: { characters: number; words: number; percentage: number }) => void
  className?: string
  readOnly?: boolean
  onUploadImage?: (file: File) => Promise<string>
  maxSize?: number // Maximum file size in bytes (default: 5MB)
  maxImages?: number // Maximum number of images (default: 3)
  maxCharacters?: number // Maximum number of characters (default: 5000)
  showDebug?: boolean
}

const defaultUploadImage = async (): Promise<string> => {
  console.warn(
    'Image upload is disabled in the demo… implement your API.uploadImage'
  );
  await new Promise((r) =>
    setTimeout(r, Math.floor(Math.random() * 5000) + 1000)
  );
  return `https://picsum.photos/${
    Math.floor(Math.random() * 300) + 100
  }/${Math.floor(Math.random() * 200) + 100}`;
};

export const BlockEditor: React.FC<BlockEditorProps> = ({
  content = '',
  onChange,
  className = '',
  readOnly,
  onUploadImage = defaultUploadImage,
  maxSize = 5 * 1024 * 1024, // Default 5MB
  maxImages = 3, // Default maximum number of images
  maxCharacters, // Default maximum number of characters
  showDebug = false,
}) => {
  const menuContainerRef = useRef(null)

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

  const { editor } = useBlockEditor({
    // aiToken,
    editable: !readOnly,
    content,
    onUpdate: ({ editor }) => {
      const characters = editor.storage.characterCount.characters()
      const words = editor.storage.characterCount.words()
      const percentage = maxCharacters ? Math.round((100 / maxCharacters) * characters) : 0
      
      onChange?.(editor.getHTML(), { characters, words, percentage })
    },
    onUploadImage,
    maxSize,
    maxImages,
    className,
    maxCharacters,
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

  const handleEditable = useCallback((_editable = !editor.isEditable) => {
    editor.setEditable(_editable);
    
    const { state, view } = editor;
    const freshState = EditorState.create({
      schema: state.schema,
      plugins: state.plugins,
      doc: state.doc,
    });
    view.updateState(freshState);
  }, [editor]);

  useEffect(() => {
    handleEditable(!readOnly)
  }, [readOnly])

  if (!editor) {
    return null
  }

  return (
    <div className="flex h-full" ref={menuContainerRef}>
      <div className="relative flex flex-col flex-1 h-full overflow-hidden">
        {/* <EditorHeader
          editor={editor}
          // collabState={collabState}
          // users={users}
        /> */}
        <EditorContent editor={editor} className="flex-1 overflow-y-auto" />
        {/* <ContentItemMenu editor={editor} isEditable={isEditable} /> */}
        <LinkMenu editor={editor} appendTo={menuContainerRef} />
        <TextMenu editor={editor} />
        <ColumnsMenu editor={editor} appendTo={menuContainerRef} />
        <TableRowMenu editor={editor} appendTo={menuContainerRef} />
        <TableColumnMenu editor={editor} appendTo={menuContainerRef} />
        <ImageBlockMenu editor={editor} appendTo={menuContainerRef} />
      </div>

      {showDebug && (
        <div className="absolute top-0 left-0 p-4 bg-white/80 rounded-lg shadow-lg">
          <button onClick={() => handleEditable()} className="bg-blue-500 text-white px-3 py-2 rounded-md mb-2 text-sm">
            {editor.isEditable ? 'Editable' : 'Read Only'}
          </button>
          <div className="space-y-1">
            <p className="text-xs">Characters: {characters}</p>
            <p className="text-xs">Words: {words}</p>
            {maxCharacters && (
              <p className="text-xs">
                Progress: {percentage}% ({characters}/{maxCharacters})
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default BlockEditor 