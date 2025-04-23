import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import React from 'react'
import '../../styles/globals.css'

export interface EditorProps {
  content?: string
  onChange?: (content: string) => void
  className?: string
  placeholder?: string
  readOnly?: boolean
}

export const Editor: React.FC<EditorProps> = ({
  content = '',
  onChange,
  className = '',
  placeholder = 'Start writing...',
  readOnly,
}) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    editorProps: {
      attributes: {
        class: `wizlit-editor-content prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none ${className}`,
      },
    },
    autofocus: true,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML())
    },
  })

  return (
    <div className="wizlit-editor">
      <div className="wizlit-editor-toolbar">
        <button
          onClick={() => editor?.chain().focus().toggleBold().run()}
          className={`wizlit-toolbar-button ${editor?.isActive('bold') ? 'bg-gray-200' : ''}`}
        >
          Bold
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          className={`wizlit-toolbar-button ${editor?.isActive('italic') ? 'bg-gray-200' : ''}`}
        >
          Italic
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`wizlit-toolbar-button ${editor?.isActive('heading', { level: 1 }) ? 'bg-gray-200' : ''}`}
        >
          H1
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          className={`wizlit-toolbar-button ${editor?.isActive('bulletList') ? 'bg-gray-200' : ''}`}
        >
          Bullet List
        </button>
      </div>
      <EditorContent editor={editor} />
      {!editor?.isEmpty && (
        <div className="text-gray-400 text-sm mt-2 px-4 pb-2">
          {editor?.storage?.characterCount?.characters()} characters
        </div>
      )}
    </div>
  )
}

export default Editor 