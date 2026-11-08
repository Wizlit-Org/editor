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
import { UploadListDialog, UploadListItem } from '../../extensions/ImageUpload/components/UploadListDialog.tsx'
import { compareDocs, getStats, trimHTML } from '@/lib/utils/getStats'

import { EditorStats, BlockEditorProps } from './types'
export type { EditorStats, BlockEditorProps } from './types'

const defaultUploadImage = async (): Promise<string> => {
  console.warn('Image upload is disabled in the demo… implement your API.uploadImage')
  await new Promise(r => setTimeout(r, Math.floor(Math.random() * 5000) + 1000))
  if (Math.random() < 0.5) throw new Error('Demo upload failed')
  return `https://picsum.photos/${Math.floor(Math.random() * 300) + 100}/${Math.floor(Math.random() * 200) + 100}`
}

export const BlockEditor: React.FC<BlockEditorProps> = ({
  content = '',
  onChange,
  className = '',
  readOnly,
  theme = 'light',
  themeColor = '#faaf2d',
  maxEmbeddings = 3,
  maxCharacters,
  showDebug = false,
  altCharacterCounter = false,
  key,
  image,
  link,
  anchorOffset = 88,
  bottomMenuOffset = 68,
  scrollContainerSelector = '.memo-scroll-surface, [class*="overflow-auto"]',
  scrollBehavior = 'smooth',
  highlightDuration = 1600,
  disableSlashCommand = false,
  showToc = true,
  initialTocExpanded = true,
  tocStickyOffset = 8,
  tocScrollSpy = true,
  topScrollThreshold = 60,
  autofocus = true,
  placeholder = '',
  editorPaddingBottom = 'pb-6',
  showTableScrollIndicator = true,
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

  
  useEffect(() => {
    const preventDefault = (e: DragEvent) => e.preventDefault()
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
    onCreate: ({ editor }) => {
      const currentHTML = editor.getHTML()
      baselineHTMLRef.current = currentHTML
      lastPropContentRef.current = content
      isReadyForUpdateRef.current = true
      const initialStats = getStats(editor, maxCharacters, altCharacterCounter)
      setStats(initialStats)
      if (!readOnly) {
        onChange?.(trimHTML(currentHTML), { isChanged: false, isStrictChanged: false }, initialStats)
      }
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
    autofocus,
    placeholder,
    disableSlashCommand,
  })

  // Global Escape guard for editor popovers & selections
  useEditorEscGuard(editor)

  // Bottom safe-zone auto-scroll when typing or pressing Enter near the bottom blur / TextMenu
  useEffect(() => {
    if (!editor || readOnly || typeof window === 'undefined') return

    const ensureCaretAboveBottomZone = ({ transaction }: { transaction?: any }) => {
      if (!editor.isEditable || !editor.isFocused || !editor.view?.dom) return
      if (transaction && !transaction.docChanged && !transaction.selectionSet) return
      if ((window as any).__isTableDragging || editor.view.dragging) return

      requestAnimationFrame(() => {
        if (!editor || editor.isDestroyed || !editor.isEditable || !editor.isFocused) return
        try {
          const { selection } = editor.state
          if (!selection.empty) return
          const coords = editor.view.coordsAtPos(selection.to)
          const parsedOffset = typeof bottomMenuOffset === 'number' ? bottomMenuOffset : parseInt(String(bottomMenuOffset), 10) || 68
          const isMobile = window.innerWidth < 768 || Boolean(window.matchMedia?.('(pointer: coarse)').matches)
          const vv = window.visualViewport
          const isKeyboardActive = Boolean(isMobile && vv && window.innerHeight - vv.height > 120)
          const safeBottomMargin = isKeyboardActive
            ? 72
            : isMobile
            ? Math.max(parsedOffset + 52, 108)
            : Math.max(parsedOffset + 48, 104)

          const dom = editor.view.dom
          const scrollContainer = (
            dom.closest(scrollContainerSelector) ||
            dom.closest('.memo-scroll-surface') ||
            dom.closest('[class*="overflow-auto"]')
          ) as HTMLElement | null

          if (scrollContainer && scrollContainer.scrollHeight > scrollContainer.clientHeight) {
            const cRect = scrollContainer.getBoundingClientRect()
            const safeLimitY = cRect.bottom - safeBottomMargin
            if (coords.bottom > safeLimitY && coords.top <= cRect.bottom + 80) {
              const delta = coords.bottom - safeLimitY
              scrollContainer.scrollTop += delta
            }
          } else {
            const safeLimitY = window.innerHeight - safeBottomMargin
            if (coords.bottom > safeLimitY && coords.top <= window.innerHeight + 80) {
              window.scrollBy({ top: coords.bottom - safeLimitY, behavior: 'auto' })
            }
          }
        } catch {}
      })
    }

    editor.on('update', ensureCaretAboveBottomZone)
    return () => {
      editor.off('update', ensureCaretAboveBottomZone)
    }
  }, [editor, readOnly, bottomMenuOffset, scrollContainerSelector])

  // Anchor jump smooth scroll on mount, hashchange, and content transition with exponential backoff polling
  const pollingTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const prevContentRef = useRef<string>(content)

  const clearPollingTimers = useCallback(() => {
    pollingTimersRef.current.forEach(timer => clearTimeout(timer))
    pollingTimersRef.current = []
  }, [])

  const scrollToAnchor = useCallback(() => {
    if (typeof window === 'undefined') return
    const rawHash = window.location.hash?.slice(1)
    if (!rawHash) return

    clearPollingTimers()

    let hash = rawHash
    try {
      hash = decodeURIComponent(rawHash)
    } catch {
      hash = rawHash
    }

    const intervals = [50, 150, 300, 450, 600, 1000, 1500]
    intervals.forEach(delay => {
      const timer = setTimeout(() => {
        let target: Element | null = null
        try {
          target =
            document.getElementById(hash) ||
            document.querySelector(`[data-id="${hash}"], [data-toc-id="${hash}"]`) ||
            (rawHash !== hash
              ? document.getElementById(rawHash) ||
                document.querySelector(`[data-id="${rawHash}"], [data-toc-id="${rawHash}"]`)
              : null)
        } catch {
          target = document.getElementById(hash) || (rawHash ? document.getElementById(rawHash) : null)
        }

        if (target) {
          const scrollContainer = target.closest(scrollContainerSelector) || target.closest('.memo-scroll-surface') || target.closest('[class*="overflow-auto"]')
          if (scrollContainer && scrollContainer instanceof HTMLElement && scrollContainer.scrollHeight > scrollContainer.clientHeight) {
            const cRect = scrollContainer.getBoundingClientRect()
            const tRect = target.getBoundingClientRect()
            const targetTop = scrollContainer.scrollTop + (tRect.top - cRect.top) - anchorOffset
            scrollContainer.scrollTo({ top: Math.max(0, targetTop), behavior: delay < 350 ? 'auto' : scrollBehavior })
          } else {
            target.scrollIntoView({ behavior: scrollBehavior, block: 'start' })
          }
          if (delay >= 350) {
            clearPollingTimers()
          }
        }
      }, delay)
      pollingTimersRef.current.push(timer)
    })
  }, [clearPollingTimers])

  useEffect(() => {
    if (typeof window === 'undefined' || !editor) return

    scrollToAnchor()
    window.addEventListener('hashchange', scrollToAnchor)

    return () => {
      window.removeEventListener('hashchange', scrollToAnchor)
      clearPollingTimers()
    }
  }, [editor, scrollToAnchor, clearPollingTimers])

  useEffect(() => {
    const prevContent = prevContentRef.current
    prevContentRef.current = content

    const wasEmpty = !prevContent || prevContent.trim() === ''
    const isNowNonEmpty = Boolean(content && content.trim() !== '')

    if (wasEmpty && isNowNonEmpty && editor) {
      scrollToAnchor()
    }
  }, [content, editor, scrollToAnchor])


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
      if (_editable) {
        const currentStats = getStats(editor, maxCharacters, altCharacterCounter)
        setStats(currentStats)
        const currentHTML = editor.getHTML()
        const baselineHTML = baselineHTMLRef.current ?? content
        const { isChanged, isStrictChanged } = isReadyForUpdateRef.current
          ? compareDocs(baselineHTML, currentHTML)
          : { isChanged: false, isStrictChanged: false }
        if (!isChanged) {
          baselineHTMLRef.current = currentHTML
        }
        onChange?.(trimHTML(currentHTML), { isChanged, isStrictChanged }, currentStats)
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

  useEffect(() => {
    if (typeof document === 'undefined' || !themeColor) return
    const root = document.documentElement
    root.style.setProperty('--editor-primary', themeColor)
    root.style.setProperty('--editor-accent', `color-mix(in srgb, ${themeColor} 15%, transparent)`)
    root.style.setProperty('--editor-accent-border', `color-mix(in srgb, ${themeColor} 25%, transparent)`)
  }, [themeColor])

  if (!editor) {
    return null
  }

  const isDark = theme === 'dark'
  const themeClass = isDark
    ? 'dark theme-dark notion-dark-canvas editor-theme-dark'
    : 'theme-light notion-light-canvas editor-theme-light'

  const themeColorStyle: React.CSSProperties = {
    backgroundColor: 'transparent',
    ...(themeColor
      ? ({
          '--editor-primary': themeColor,
          '--editor-accent': `color-mix(in srgb, ${themeColor} 15%, transparent)`,
          '--editor-accent-border': `color-mix(in srgb, ${themeColor} 25%, transparent)`,
        } as React.CSSProperties)
      : {}),
    ...({
      '--editor-bottom-menu-offset': typeof bottomMenuOffset === 'number' ? `${bottomMenuOffset}px` : bottomMenuOffset,
      '--editor-anchor-offset': `${anchorOffset}px`,
    } as React.CSSProperties),
  }

  return (
    <>
      <div
        className={`relative flex w-full max-w-full min-w-0 min-h-full h-auto flex-[1_0_auto] overflow-x-clip [overflow-x:clip] box-border bg-transparent ${themeClass} ${className}`.trim()}
        data-theme={isDark ? 'dark' : 'light'}
        data-editor-theme={isDark ? 'dark' : 'light'}
        ref={menuContainerRef}
        style={themeColorStyle}
      >
        <div className="relative flex flex-col flex-1 w-full min-w-0 max-w-full h-auto min-h-full">
          {/* <EditorHeader
            editor={editor}
            // collabState={collabState}
            // users={users}
          /> */}
          {/* Sticky Table of Contents & Table Scroll Indicators (Client-only, works in both Edit and Read-only modes) */}
          {showToc && (
            <TableOfContents
              editor={editor}
              anchorOffset={anchorOffset}
              scrollContainerSelector={scrollContainerSelector}
              scrollBehavior={scrollBehavior}
              highlightDuration={highlightDuration}
              initialExpanded={initialTocExpanded}
              stickyOffset={tocStickyOffset}
              scrollSpy={tocScrollSpy}
              topScrollThreshold={topScrollThreshold}
            />
          )}
          {showTableScrollIndicator && <TableScrollIndicator editor={editor} appendTo={menuContainerRef} />}
          <EditorContent
            editor={editor}
            className={`flex-1 w-full min-w-0 max-w-full focus:outline-none ${!readOnly ? editorPaddingBottom : ''}`.trim()}
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
              <TextMenu editor={editor} appendTo={menuContainerRef} theme={theme} />
              <TableRowMenu editor={editor} appendTo={menuContainerRef} />
              <TableColumnMenu editor={editor} appendTo={menuContainerRef} />
              <TableCellMenu editor={editor} appendTo={menuContainerRef} />
              <TableAddButtons editor={editor} appendTo={menuContainerRef} />
              <ImageBlockMenu editor={editor} appendTo={menuContainerRef} />
              <YoutubeBlockMenu editor={editor} appendTo={menuContainerRef} />
              <YoutubeDialog editor={editor} appendTo={menuContainerRef} />
              <PastePreviewDialog editor={editor} theme={theme} />
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
        <UploadListDialog {...uploadDialog} className="fixed bottom-4 right-4" />
      )}
    </>
  )
}

export default BlockEditor
