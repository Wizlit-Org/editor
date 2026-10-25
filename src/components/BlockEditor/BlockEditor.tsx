import '@/styles/globals.css'
import '@/styles/index.css'

import { useBlockEditor } from '@/hooks/useBlockEditor'
import { useEditorEscGuard } from '@/hooks/useEditorEscGuard'

import { EditorContent, useEditorState } from '@tiptap/react'
import React, { useRef, useEffect, useCallback, useState } from 'react'

import ImageBlockMenu from '@/extensions/ImageBlock/components/ImageBlockMenu'
import YoutubeBlockMenu from '@/extensions/YoutubeBlock/components/YoutubeBlockMenu'
import YoutubeDialog from '@/extensions/YoutubeBlock/components/YoutubeDialog'
import { TableColumnMenu, TableRowMenu, TableCellMenu } from '@/extensions/Table/menus'
import { TableAddButtons } from '@/extensions/Table/components/TableAddButtons'
import { TableScrollIndicator } from '@/extensions/Table/components/TableScrollIndicator'
import { TextMenu } from '@/components/menus/TextMenu'
import { ContentItemMenu } from '@/components/menus/ContentItemMenu'
import { LinkMenu } from '@/components/menus/LinkMenu'
import { PastePreviewDialog } from '@/components/menus/PastePreviewDialog'
import { TableOfContents } from '../TableOfContents'
import { UploadListDialog, UploadListDialogProps, UploadListItem } from '../../extensions/ImageUpload/components/UploadListDialog.tsx'
import { compareDocs, getStats, trimHTML } from '@/lib/utils/getStats'
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
    imageProxyUrl?: (url: string) => string
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
  const baselineHTMLRef = useRef<string | null>(null)
  const lastPropContentRef = useRef<string>(content)
  const isTogglingEditableRef = useRef<boolean>(false)
  const isReadyForUpdateRef = useRef<boolean>(false)
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

  // Global scroll listener: Auto-close all popover menus on page scroll (0ms delay)
  // Ignores scroll events originating from inputs, textareas, contenteditables, and active popovers
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement | null
      if (target) {
        if (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.closest?.(
            '.glass-menu, [role="dialog"], [role="menu"], [data-paste-preview-dialog="true"], [data-bottom-text-menu="true"], [data-radix-popper-content-wrapper], .link-editor-panel, .link-preview-panel'
          )
        ) {
          return
        }
      }
      window.dispatchEvent(new CustomEvent('tiptap:close-menus', { detail: 'scroll' }))
    }

    window.addEventListener('scroll', handleScroll, { capture: true, passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true })
    }
  }, [])

  const { editor, uploadDialog } = useBlockEditor({
    // aiToken,
    editable: !readOnly,
    content,
    onCreate: ({ editor }) => {
      baselineHTMLRef.current = editor.getHTML()
      lastPropContentRef.current = content
      isReadyForUpdateRef.current = true
      setStats(getStats(editor, maxCharacters, altCharacterCounter))
    },
    onUpdate: ({ editor, transaction }) => {
      if (transaction?.getMeta('preventUpdate') || !isReadyForUpdateRef.current) {
        baselineHTMLRef.current = editor.getHTML()
        return
      }
      if (readOnly) return;
      
      if (isTogglingEditableRef.current || readOnly) {
        baselineHTMLRef.current = editor.getHTML()
        return
      }
      if (baselineHTMLRef.current === null) {
        baselineHTMLRef.current = editor.getHTML()
      }
      const currentHTML = editor.getHTML()
      const baselineHTML = baselineHTMLRef.current ?? content
      const { isChanged, isStrictChanged } = compareDocs(baselineHTML, currentHTML)
      const stats = getStats(editor, maxCharacters, altCharacterCounter)

      if (!isChanged) baselineHTMLRef.current = currentHTML
      setStats(stats)
      onChange?.(trimHTML(currentHTML), { isChanged, isStrictChanged }, stats)
    },
    onUploadImage,
    convertSrc: image?.convertSrc,
    onImageClick: image?.onClick,
    imageProxyUrl: image?.imageProxyUrl,
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
      isTogglingEditableRef.current = true
      editor.setEditable(_editable, false)
      if (baselineHTMLRef.current === null) {
        baselineHTMLRef.current = editor.getHTML()
      }
      isTogglingEditableRef.current = false
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
      if (editor.isEditable) {
        if (lastPropContentRef.current !== content) {
          lastPropContentRef.current = content
      isReadyForUpdateRef.current = true
          const { isChanged } = compareDocs(content, editor.getHTML())
          if (!isChanged) {
            baselineHTMLRef.current = editor.getHTML()
          }
        }
        return
      }
      if (lastPropContentRef.current === content && baselineHTMLRef.current !== null) {
        return
      }
      lastPropContentRef.current = content
      isReadyForUpdateRef.current = true
      isTogglingEditableRef.current = true
      editor.commands.setContent(content, { emitUpdate: false })
      baselineHTMLRef.current = editor.getHTML()
      isTogglingEditableRef.current = false
      const nextStats = getStats(editor, maxCharacters, altCharacterCounter)
      setStats(nextStats)
    }
  }, [content, editor]);

  
  const prevUploadDialogRef = useRef<{
    items: UploadListItem[];
    onRetry: (id: string) => void;
    onRemove: (id: string) => void;
    onLoadingChange?: (hasUploading: boolean) => void;
  } | null>(null)
  
  useEffect(() => {
    if (!editor) return
    const hasUploading = uploadDialog.items.some(
      i => i.status === 'compressing' || i.status === 'uploading' || i.status === 'validating',
    )
    image?.onLoadingChange?.(hasUploading)

    if (image?.getUploadDialogProps) {
      const currentProps = {
        items: uploadDialog.items,
        onRetry: uploadDialog.onRetry,
        onRemove: uploadDialog.onRemove,
        onLoadingChange: image.onLoadingChange,
      }

      if (JSON.stringify(prevUploadDialogRef.current) !== JSON.stringify(currentProps)) {
        image.getUploadDialogProps(currentProps)
        prevUploadDialogRef.current = currentProps
      }
    }
  }, [editor, image?.getUploadDialogProps, image?.onLoadingChange, uploadDialog.items])

  if (!editor) {
    return null
  }

  const isDark = theme === 'dark' || (theme === undefined && systemDark)
  const themeClass = isDark ? 'dark theme-dark notion-dark-canvas' : 'theme-light notion-light-canvas'

  return (
    <>
      <div className={`relative flex min-h-full h-auto flex-[1_0_auto] overflow-x-clip [overflow-x:clip] ${themeClass} ${className}`.trim()} ref={menuContainerRef}>
        <div className="relative flex flex-col flex-[1_0_auto] h-auto min-h-full">
          {/* <EditorHeader
            editor={editor}
            // collabState={collabState}
            // users={users}
          /> */}
          {/* Sticky Table of Contents & Table Scroll Indicators (Client-only, works in both Edit and Read-only modes) */}
          <TableOfContents editor={editor} />
          <TableScrollIndicator editor={editor} appendTo={menuContainerRef} />
          <EditorContent
            editor={editor}
            className={`flex-1 focus:outline-none ${!readOnly ? 'pb-16' : ''}`.trim()}
          />
          <ContentItemMenu editor={editor} isEditable={!readOnly} appendTo={menuContainerRef} />
          <LinkMenu
            editor={editor}
            appendTo={menuContainerRef}
            disableDefaultAction={link?.disableDefaultAction}
            onLinkClick={link?.onClick}
          />
          {!readOnly && (
            <>
              <TextMenu editor={editor} appendTo={menuContainerRef} />
              <TableRowMenu editor={editor} appendTo={menuContainerRef} />
              <TableColumnMenu editor={editor} appendTo={menuContainerRef} />
              <TableCellMenu editor={editor} appendTo={menuContainerRef} />
              <TableAddButtons editor={editor} appendTo={menuContainerRef} />
              <ImageBlockMenu editor={editor} appendTo={menuContainerRef} />
              <YoutubeBlockMenu editor={editor} appendTo={menuContainerRef} />
              <YoutubeDialog editor={editor} appendTo={menuContainerRef} />
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

      {image?.disableBuiltInUploadDialog === false && !readOnly && (
        <UploadListDialog
          {...uploadDialog}
          className="fixed bottom-4 right-4"
        />
      )}
    </>
  )
}

export default BlockEditor
