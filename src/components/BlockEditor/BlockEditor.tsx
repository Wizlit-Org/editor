'use client'

import '@/styles/index.css'

import 'cal-sans'

import '@fontsource/inter/100.css'
import '@fontsource/inter/200.css'
import '@fontsource/inter/300.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import { useBlockEditor } from '@/hooks/useBlockEditor'

import { EditorContent } from '@tiptap/react'
import React, { useRef, useEffect } from 'react'

import ImageBlockMenu from '@/extensions/ImageBlock/components/ImageBlockMenu'
import { ColumnsMenu } from '@/extensions/MultiColumn/menus'
import { TableColumnMenu, TableRowMenu } from '@/extensions/Table/menus'
import { TextMenu } from '@/components/menus/TextMenu'
// import { ContentItemMenu } from '@/components/menus/ContentItemMenu'
import { LinkMenu } from '@/components/menus/LinkMenu'

export interface EditorProps {
  content?: string
  onChange?: (content: string) => void
  className?: string
  readOnly?: boolean
  onUploadImage: (file: File) => Promise<string>
  maxSize?: number // Maximum file size in bytes (default: 5MB)
  maxImages?: number // Maximum number of images (default: 3)
}

export const BlockEditor: React.FC<EditorProps> = ({
  content = '',
  onChange,
  className = '',
  readOnly,
  onUploadImage,
  maxSize = 5 * 1024 * 1024, // Default 5MB
  maxImages = 3, // Default maximum number of images
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
      onChange?.(editor.getHTML())
    },
    onUploadImage,
    maxSize,
    maxImages,
    className,
  })

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
    </div>
  )
}

export default BlockEditor 