import { useCallback, useState, useEffect, useRef, JSX, useMemo } from 'react'
import { BubbleMenu as BaseBubbleMenu } from '@tiptap/react/menus'
import { useEditorState } from '@tiptap/react'

import { MenuProps } from '../types'
import { LinkPreviewPanel } from '@/components/panels/LinkPreviewPanel'
import { LinkEditorPanel } from '@/components/panels'
import { cn } from '@/lib/utils'
import { safeExtendLinkRange, getCurrentLinkText, applySetLink, applyUnsetLink, getLinkReferenceClientRect } from './utils/linkHelpers'

export const LinkMenu = ({
  editor,
  appendTo,
  onLinkClick = () => false,
  disableDefaultAction = false,
}: MenuProps): JSX.Element => {
  const menuRef = useRef<HTMLDivElement>(null)
  const [showEdit, setShowEdit] = useState(false)
  const showEditRef = useRef(false)
  const [isClosedByScroll, setIsClosedByScroll] = useState(false)
  const isClosedByScrollRef = useRef(false)
  const [isDismissed, setIsDismissed] = useState(false)
  const isDismissedRef = useRef(false)

  const updateMenuPosition = useCallback(() => {
    try {
      editor.view.dispatch(editor.state.tr.setMeta('linkMenu', 'updatePosition'))
    } catch {}
  }, [editor])

  const setEditMode = useCallback((val: boolean) => {
    showEditRef.current = val
    setShowEdit(val)
  }, [])

  const dismissMenu = useCallback(() => {
    isDismissedRef.current = true
    setIsDismissed(true)
    setEditMode(false)
    const storage = (editor.storage as any)?.link
    if (storage) {
      storage.isDismissed = true
      storage.clickedCoords = null
      storage.clickedElement = null
    }
    try {
      editor.view.dispatch(editor.state.tr.setMeta('linkMenu', 'hide'))
    } catch {}
  }, [editor, setEditMode])

  const resetDismissal = useCallback(() => {
    isDismissedRef.current = false
    setIsDismissed(false)
    const storage = (editor.storage as any)?.link
    if (storage) {
      storage.isDismissed = false
    }
  }, [editor])

  const checkIsLinkActive = useCallback(() => {
    if (editor.isActive('link')) return true
    try {
      const { $from, from } = editor.state.selection
      const hasMark =
        $from.marks().some(m => m.type.name === 'link') ||
        $from.nodeBefore?.marks?.some(m => m.type.name === 'link') ||
        $from.nodeAfter?.marks?.some(m => m.type.name === 'link')
      if (hasMark) return true

      // Verify if current selection DOM node is actually within an <a> element
      const domAtPos = editor.view.domAtPos(from)
      const el = domAtPos.node as HTMLElement
      const linkEl =
        el?.nodeType === 1
          ? (el as HTMLElement).closest('a')
          : (el?.parentElement?.closest('a') as HTMLAnchorElement | null)
      if (linkEl) return true
    } catch {}

    return false
  }, [editor])

  const { link, target, linkPos } = useEditorState({
    editor,
    selector: ctx => {
      const { $from, from } = ctx.editor.state.selection
      const linkType = ctx.editor.state.schema.marks.link
      let foundHref = ''
      let foundTarget = ''
      let markStart = -1

      const attrs = ctx.editor.getAttributes('link')
      if (attrs?.href) {
        foundHref = attrs.href as string
        foundTarget = (attrs.target as string) || ''
      }

      // Fallback for cursor at boundary edges: check $from marks or adjacent nodes
      if (!foundHref && linkType) {
        try {
          const mark =
            $from.marks().find(m => m.type === linkType) ||
            $from.nodeBefore?.marks?.find(m => m.type === linkType) ||
            $from.nodeAfter?.marks?.find(m => m.type === linkType)
          if (mark) {
            foundHref = mark.attrs.href as string
            foundTarget = (mark.attrs.target as string) || ''
          }
        } catch {}
      }

      // Fallback from clicked element in storage when clicked at boundary edges
      if (!foundHref && (ctx.editor.storage as any)?.link?.clickedElement) {
        try {
          const clickedEl = (ctx.editor.storage as any).link.clickedElement as HTMLAnchorElement
          if (clickedEl && clickedEl.isConnected) {
            foundHref = clickedEl.getAttribute('href') || ''
            foundTarget = clickedEl.getAttribute('target') || ''
          }
        } catch {}
      }

      // Find start position of the current contiguous link mark node
      if (foundHref && linkType && $from.parent) {
        try {
          const parentStart = $from.start()
          $from.parent.forEach((child, offset) => {
            const childMark = child.marks?.find(m => m.type === linkType)
            if (childMark && childMark.attrs?.href === foundHref) {
              const nodeStart = parentStart + offset
              const nodeEnd = nodeStart + child.nodeSize
              if (from >= nodeStart && from <= nodeEnd) {
                markStart = nodeStart
              }
            }
          })
        } catch {}
      }

      return {
        link: foundHref,
        target: foundTarget,
        linkPos: markStart !== -1 ? markStart : from,
      }
    },
  })

  // Unique target ID combining link position and href to distinctly identify the active link
  const currentTargetId = link ? `${linkPos}_${link}` : ''
  const prevTargetRef = useRef<string>(currentTargetId)

  // When active target link changes (different URL or different link node in doc),
  // ALWAYS reset showEdit to false and revert to LinkPreviewPanel immediately
  useEffect(() => {
    if (!currentTargetId) {
      prevTargetRef.current = ''
      setEditMode(false)
      return
    }

    if (currentTargetId !== prevTargetRef.current) {
      prevTargetRef.current = currentTargetId
      resetDismissal()
      setEditMode(false)
    }
  }, [currentTargetId, setEditMode])

  // Close link menu when selection moves away from link completely
  useEffect(() => {
    if (!checkIsLinkActive()) {
      dismissMenu()
    }
  }, [editor.state.selection, checkIsLinkActive, dismissMenu])

  // Comprehensive outside click dismiss handler defending against stopPropagation
  useEffect(() => {
    const handleOutsideClick = (e: Event) => {
      if (isDismissedRef.current) return
      if (!checkIsLinkActive() && !showEditRef.current) return

      const target = (e as MouseEvent | PointerEvent).target as HTMLElement | null
      if (!target) return

      // Don't dismiss if click is inside the link menu itself
      if (
        menuRef.current?.contains(target) ||
        target.closest?.(
          '.link-preview-panel, .link-editor-panel, [data-ignore-external-label="true"], [role="dialog"]'
        )
      ) {
        return
      }

      // Don't dismiss if click is on an <a> element inside the editor
      if (target.closest?.('a')) {
        return
      }

      dismissMenu()
    }

    // Capture on window to bypass stopPropagation in modal/container wrappers
    window.addEventListener('pointerdown', handleOutsideClick, { capture: true, passive: true })
    window.addEventListener('mousedown', handleOutsideClick, { capture: true, passive: true })
    window.addEventListener('touchstart', handleOutsideClick, { capture: true, passive: true })
    window.addEventListener('tiptap:dismiss-link-menu', dismissMenu)

    return () => {
      window.removeEventListener('pointerdown', handleOutsideClick, { capture: true })
      window.removeEventListener('mousedown', handleOutsideClick, { capture: true })
      window.removeEventListener('touchstart', handleOutsideClick, { capture: true })
      window.removeEventListener('tiptap:dismiss-link-menu', dismissMenu)
    }
  }, [checkIsLinkActive, dismissMenu])

  // Floating UI autoUpdate & ResizeObserver: keep position firmly docked when content size changes
  useEffect(() => {
    const el = menuRef.current
    if (!el || typeof ResizeObserver === 'undefined') return

    let prevW = 0
    let prevH = 0

    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (Math.abs(width - prevW) > 1 || Math.abs(height - prevH) > 1) {
          prevW = width
          prevH = height
          updateMenuPosition()
        }
      }
    })

    ro.observe(el)
    return () => {
      ro.disconnect()
    }
  }, [updateMenuPosition])

  // Reset scroll lock on editor interaction & mousedown on links
  useEffect(() => {
    const handleReset = () => {
      isClosedByScrollRef.current = false
      setIsClosedByScroll(false)
    }

    const dom = editor.view?.dom
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      const target = e.target as HTMLElement | null
      const linkEl = target?.closest?.('a') as HTMLAnchorElement | null
      if (linkEl && dom?.contains(linkEl)) {
        handleReset()
        resetDismissal()
        const storage = (editor.storage as any)?.link
        if (storage) {
          storage.isDismissed = false
          storage.clickedCoords = { x: e.clientX, y: e.clientY }
          storage.clickedElement = linkEl
        }
      }
    }

    dom?.addEventListener('mousedown', handleMouseDown, { capture: true })
    editor.on('selectionUpdate', handleReset)
    editor.on('focus', handleReset)
    window.addEventListener('tiptap:reset-scroll-lock', handleReset)
    return () => {
      dom?.removeEventListener('mousedown', handleMouseDown, { capture: true })
      editor.off('selectionUpdate', handleReset)
      editor.off('focus', handleReset)
      window.removeEventListener('tiptap:reset-scroll-lock', handleReset)
    }
  }, [editor])

  // Close link menu on tiptap:close-menus or page scroll
  // Skip closing when currently in active edit mode (showEditRef.current === true)
  useEffect(() => {
    const handleCloseMenus = (e?: Event) => {
      if (showEditRef.current) return
      if (e) {
        const target = e.target as HTMLElement | null
        if (target) {
          if (
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable ||
            target.closest?.(
              '.glass-menu, [role="dialog"], [role="menu"], [data-radix-popper-content-wrapper], .link-editor-panel, .link-preview-panel'
            )
          ) {
            return
          }
        }
      }
      isClosedByScrollRef.current = true
      setIsClosedByScroll(true)
      setEditMode(false)
      try {
        editor.view.dispatch(editor.state.tr.setMeta('linkMenu', 'hide'))
      } catch {}
    }
    window.addEventListener('tiptap:close-menus', handleCloseMenus)
    window.addEventListener('scroll', handleCloseMenus, { passive: true, capture: true })
    return () => {
      window.removeEventListener('tiptap:close-menus', handleCloseMenus)
      window.removeEventListener('scroll', handleCloseMenus, { capture: true })
    }
  }, [editor, setEditMode])

  const shouldShow = useCallback(() => {
    if (isDismissedRef.current) return false
    const storage = (editor.storage as any)?.link
    if (storage?.isDismissed) return false
    if (showEditRef.current) return true
    const isLink = checkIsLinkActive()
    if (!isLink) return false

    if (isClosedByScrollRef.current) {
      isClosedByScrollRef.current = false
      setIsClosedByScroll(false)
    }

    const isMedia =
      editor.isActive('youtube') ||
      editor.isActive('imageBlock') ||
      editor.state.doc.nodeAt(editor.state.selection.from)?.type.name === 'youtube'
    if (isMedia) return false

    return true
  }, [editor, checkIsLinkActive])

  const editable = editor.isEditable

  const handleEdit = useCallback(() => {
    setEditMode(true)
    safeExtendLinkRange(editor)
    requestAnimationFrame(() => {
      try {
        editor.view.dispatch(editor.state.tr.setMeta('linkMenu', 'show'))
        editor.view.dispatch(editor.state.tr.setMeta('linkMenu', 'updatePosition'))
      } catch {}
    })
  }, [editor, setEditMode])

  // Extract current link text from the editor document
  const currentLinkText = useMemo(() => {
    return getCurrentLinkText(editor)
  }, [editor, editor.state.selection])

  const onSetLink = useCallback(
    (url: string, text?: string, openInNewTab?: boolean) => {
      applySetLink(editor, url, text, openInNewTab)
      setEditMode(false)
    },
    [editor, setEditMode],
  )

  const onUnsetLink = useCallback(() => {
    applyUnsetLink(editor)
    setEditMode(false)
    return null
  }, [editor, setEditMode])

  const onHide = useCallback(() => {
    if (showEditRef.current) {
      try {
        editor.view.dispatch(editor.state.tr.setMeta('linkMenu', 'show'))
      } catch {}
      return
    }
    setEditMode(false)
  }, [setEditMode, editor])

  // Keep menu visible and trigger position update when switching to edit mode
  useEffect(() => {
    if (showEdit) {
      try {
        editor.view.dispatch(editor.state.tr.setMeta('linkMenu', 'show'))
        editor.view.dispatch(editor.state.tr.setMeta('linkMenu', 'updatePosition'))
      } catch {}
    }
  }, [showEdit, editor])

  const getReferenceClientRect = useCallback(() => {
    return getLinkReferenceClientRect(editor)
  }, [editor])

  const getReferencedVirtualElement = useCallback(
    () => ({
      getBoundingClientRect: getReferenceClientRect,
      getClientRects: () => [getReferenceClientRect()],
    }),
    [getReferenceClientRect],
  )

  const menuOptions = useMemo(
    () => ({
      placement: 'bottom-start' as const,
      flip: true,
      shift: { padding: 8 },
      offset: 8,
      onHide,
    }),
    [onHide],
  )

  return (
    <BaseBubbleMenu
      ref={menuRef}
      editor={editor}
      pluginKey="linkMenu"
      shouldShow={shouldShow}
      updateDelay={0}
      className={cn('z-[1380]', (isClosedByScroll || isDismissed) && '!hidden pointer-events-none')}
      appendTo={appendTo?.current || (typeof document !== 'undefined' ? document.body : undefined)}
      getReferencedVirtualElement={getReferencedVirtualElement}
      options={menuOptions}
    >
      {showEdit ? (
        <LinkEditorPanel
          initialUrl={link}
          initialText={currentLinkText}
          initialOpenInNewTab={target === '_blank'}
          onSetLink={onSetLink}
          onCancel={() => setEditMode(false)}
        />
      ) : (
        <LinkPreviewPanel
          url={link}
          onClear={onUnsetLink}
          onEdit={handleEdit}
          onOpen={onLinkClick}
          editable={editable}
          disableDefaultAction={disableDefaultAction}
          onUpdatePosition={updateMenuPosition}
        />
      )}
    </BaseBubbleMenu>
  )
}

export default LinkMenu
