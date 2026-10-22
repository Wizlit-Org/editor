import '@/styles/globals.css'
import '@/styles/index.css'

import { useBlockEditor } from '@/hooks/useBlockEditor'
import { useEditorEscGuard } from '@/hooks/useEditorEscGuard'

import { EditorContent, useEditorState } from '@tiptap/react'
import React, { useRef, useEffect, useCallback, useState } from 'react'

import ImageBlockMenu from '@/extensions/ImageBlock/components/ImageBlockMenu'
import YoutubeBlockMenu from '@/extensions/YoutubeBlock/components/YoutubeBlockMenu'
import { TableColumnMenu, TableRowMenu, TableCellMenu } from '@/extensions/Table/menus'
import { TableAddButtons } from '@/extensions/Table/components/TableAddButtons'
import { TableScrollIndicator } from '@/extensions/Table/components/TableScrollIndicator'
import { TextMenu } from '@/components/menus/TextMenu'
import { ContentItemMenu } from '@/components/menus/ContentItemMenu'
import { LinkMenu } from '@/components/menus/LinkMenu'
import { PastePreviewDialog } from '@/components/menus/PastePreviewDialog'
import { TableOfContents } from '../TableOfContents'
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
  theme?: 'light' | 'dark'

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
  theme = 'light',
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
  const [systemDark, setSystemDark] = useState<boolean>(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark') || document.body.classList.contains('dark')
    }
    return false
  })

  useEffect(() => {
    if (typeof document === 'undefined') return

    const updateDark = () => {
      const isDarkClass = document.documentElement.classList.contains('dark') || document.body.classList.contains('dark')
      setSystemDark(isDarkClass)
    }

    updateDark()
    const observer = new MutationObserver(updateDark)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])
  
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
      if (readOnly) return;
      
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

  // Global Escape guard for editor popovers & selections
  useEditorEscGuard(editor)

  // Anchor jump smooth scroll on mount and hashchange
  useEffect(() => {
    if (typeof window === 'undefined' || !editor) return

    const scrollToAnchor = () => {
      const hash = window.location.hash?.slice(1)
      if (!hash) return

      setTimeout(() => {
        const target =
          document.getElementById(hash) ||
          document.querySelector(`[data-id="${hash}"], [data-toc-id="${hash}"]`)
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 100)
    }

    scrollToAnchor()
    window.addEventListener('hashchange', scrollToAnchor)
    return () => window.removeEventListener('hashchange', scrollToAnchor)
  }, [editor])


  const { characters = 0, words = 0 } = useEditorState({
    editor,
    selector: (ctx): { characters: number; words: number } => {
      const { characters, words } = ctx.editor?.storage.characterCount || { characters: () => 0, words: () => 0 }
      return { characters: characters(), words: words() }
    },
  }) || {}

  const percentage = editor && maxCharacters
    ? Math.round((100 / maxCharacters) * editor.storage.characterCount.characters())
    : 0

  const handleEditable = useCallback((_editable = !editor?.isEditable) => {
    if (!editor) return;
    
    try {
      editor.setEditable(_editable);
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
      if (editor.isEditable) return;
      editor.commands.setContent(content, { emitUpdate: true });
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

  const isDark = theme === 'dark' || (theme === undefined && systemDark)
  const themeClass = isDark ? 'dark theme-dark notion-dark-canvas' : 'theme-light notion-light-canvas'

  return (
    <>
      <div className={`relative flex min-h-full h-auto flex-[1_0_auto] overflow-x-clip [overflow-x:clip] [container-type:inline-size] ${themeClass} ${className}`.trim()} ref={menuContainerRef}>
        <div className="relative flex flex-col flex-[1_0_auto] h-auto min-h-full">
          {/* <EditorHeader
            editor={editor}
            // collabState={collabState}
            // users={users}
          /> */}
          {/* Sticky Table of Contents & Table Scroll Indicators (Client-only, works in both Edit and Read-only modes) */}
          <TableOfContents editor={editor} />
          <TableScrollIndicator editor={editor} />
          <EditorContent editor={editor} className="flex-1 focus:outline-none" />
          <ContentItemMenu editor={editor} isEditable={!readOnly} />
          <LinkMenu
            editor={editor}
            disableDefaultAction={link?.disableDefaultAction}
            onLinkClick={link?.onClick}
          />
          {!readOnly && (
            <>
              <TextMenu editor={editor} />
              <TableRowMenu editor={editor} />
              <TableColumnMenu editor={editor} />
              <TableCellMenu editor={editor} />
              <TableAddButtons editor={editor} />
              <ImageBlockMenu editor={editor} appendTo={menuContainerRef} />
              <YoutubeBlockMenu editor={editor} appendTo={menuContainerRef} />
              <PastePreviewDialog editor={editor} />
            </>
          )}
        </div>
      </div>

      {showDebug && (
        <div className="absolute top-0 left-0 p-4 glass-panel z-50">
          <button onClick={() => handleEditable()} className="bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 px-3 py-2 rounded-md mb-2 text-sm border border-black/5 dark:border-white/10 transition-colors">
            {editor.isEditable ? 'Editable' : 'Read Only'}
          </button>
          <div className="space-y-1">
            <p className="text-xs opacity-60">Characters: <span className="opacity-100 font-medium">{altCharacterCounter ? characters : stats.characters}</span></p>
            <p className="text-xs opacity-60">Words: <span className="opacity-100 font-medium">{altCharacterCounter ? words : stats.words}</span></p>
            {maxCharacters && (
              <p className="text-xs opacity-60">
                Progress: <span className="opacity-100 font-medium">{altCharacterCounter ? percentage : Math.round((100 / maxCharacters) * (stats.characters || 0))}%</span> 
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
