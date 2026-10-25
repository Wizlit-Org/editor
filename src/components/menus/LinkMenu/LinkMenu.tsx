import { useCallback, useState, useEffect, useRef, JSX, useMemo } from 'react'
import { BubbleMenu as BaseBubbleMenu } from '@tiptap/react/menus'
import { useEditorState } from '@tiptap/react'

import { MenuProps } from '../types'
import { LinkPreviewPanel } from '@/components/panels/LinkPreviewPanel'
import { LinkEditorPanel } from '@/components/panels'
import { cn } from '@/lib/utils'
import { safeExtendLinkRange, getCurrentLinkText } from './utils/linkHelpers'

export const LinkMenu = ({
  editor,
  appendTo,
  onLinkClick = () => false,
  disableDefaultAction = false,
}: MenuProps): JSX.Element => {
  const [showEdit, setShowEdit] = useState(false)
  const showEditRef = useRef(false)
  const [isClosedByScroll, setIsClosedByScroll] = useState(false)
  const isClosedByScrollRef = useRef(false)

  const setEditMode = useCallback((val: boolean) => {
    showEditRef.current = val
    setShowEdit(val)
  }, [])

  const checkIsLinkActive = useCallback(() => {
    if (editor.isActive('link')) return true
    try {
      const { $from } = editor.state.selection
      const hasMark =
        $from.marks().some(m => m.type.name === 'link') ||
        $from.nodeBefore?.marks?.some(m => m.type.name === 'link') ||
        $from.nodeAfter?.marks?.some(m => m.type.name === 'link')
      if (hasMark) return true
    } catch {}

    try {
      const clickedEl = (editor.storage as any)?.link?.clickedElement as HTMLAnchorElement | null
      if (clickedEl && clickedEl.isConnected && editor.view?.dom?.contains(clickedEl)) {
        return true
      }
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
      // Distinct target link clicked! Instantly reset edit mode to show preview panel
      setEditMode(false)
    }
  }, [currentTargetId, setEditMode])

  // Close edit panel when selection moves away from link completely
  useEffect(() => {
    if (!checkIsLinkActive()) {
      setEditMode(false)
      const storage = (editor.storage as any)?.link
      if (storage) {
        storage.clickedCoords = null
        storage.clickedElement = null
      }
    }
  }, [editor, editor.state.selection, checkIsLinkActive, setEditMode])

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
        const storage = (editor.storage as any)?.link
        if (storage) {
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
    if (showEditRef.current) return true
    const isLink = checkIsLinkActive()
    if (!isLink) return false

    // An active link is selected/clicked: unfreeze any scroll-lock immediately
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
      try {
        editor.chain().focus().extendMarkRange('link').run()
        const { from, to } = editor.state.selection
        const currentText = editor.state.doc.textBetween(from, to)

        if (text && text !== currentText) {
          editor
            .chain()
            .focus()
            .insertContentAt(
              { from, to },
              {
                type: 'text',
                text,
                marks: [
                  {
                    type: 'link',
                    attrs: {
                      href: url,
                      target: openInNewTab ? '_blank' : '',
                    },
                  },
                ],
              },
            )
            .run()
        } else {
          editor
            .chain()
            .focus()
            .extendMarkRange('link')
            .setLink({ href: url, target: openInNewTab ? '_blank' : '' })
            .run()
        }
      } catch (err) {
        console.error('Error setting link:', err)
      }
      setEditMode(false)
    },
    [editor, setEditMode],
  )

  const onUnsetLink = useCallback(() => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
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
    let linkEl: HTMLAnchorElement | null =
      ((editor.storage as any)?.link?.clickedElement as HTMLAnchorElement | null) || null

    if (!linkEl || !linkEl.isConnected) {
      const { from } = editor.state.selection
      try {
        const domAtPos = editor.view.domAtPos(from)
        const el = domAtPos.node as HTMLElement
        linkEl =
          el?.nodeType === 1
            ? (el as HTMLElement).closest('a')
            : (el?.parentElement?.closest('a') as HTMLAnchorElement | null)
      } catch {}
    }

    const clickedCoords = (editor.storage as any)?.link?.clickedCoords as
      | { x: number; y: number }
      | null
      | undefined

    if (linkEl && linkEl.isConnected) {
      const linkRect = linkEl.getBoundingClientRect()

      if (
        clickedCoords &&
        typeof clickedCoords.x === 'number' &&
        typeof clickedCoords.y === 'number'
      ) {
        // Multi-line link support: inspect getClientRects() to find the specific line rect clicked
        const clientRects = Array.from(linkEl.getClientRects())
        let targetLineRect = linkRect

        if (clientRects.length > 1) {
          const matchingRect =
            clientRects.find(
              r =>
                clickedCoords.y >= r.top - 4 &&
                clickedCoords.y <= r.bottom + 4 &&
                clickedCoords.x >= r.left - 8 &&
                clickedCoords.x <= r.right + 8,
            ) ||
            clientRects.find(
              r => clickedCoords.y >= r.top - 4 && clickedCoords.y <= r.bottom + 4,
            )
          if (matchingRect) {
            targetLineRect = matchingRect
          }
        }

        // Clamp clicked mouse X strictly within target link's horizontal boundary
        const clampedX = Math.max(
          targetLineRect.left,
          Math.min(clickedCoords.x, targetLineRect.right),
        )

        // Precision 1:1 anchor rect directly docked to clicked mouse coordinates
        // and link DOM boundary
        return new DOMRect(
          clampedX,
          targetLineRect.top,
          1,
          Math.max(1, targetLineRect.bottom - targetLineRect.top),
        )
      }

      return linkRect
    }

    try {
      const { from } = editor.state.selection
      const coords = editor.view.coordsAtPos(from)
      return new DOMRect(
        coords.left,
        coords.top,
        Math.max(1, coords.right - coords.left),
        Math.max(1, coords.bottom - coords.top),
      )
    } catch {
      return new DOMRect(-1000, -1000, 0, 0)
    }
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
      editor={editor}
      pluginKey="linkMenu"
      shouldShow={shouldShow}
      updateDelay={0}
      className={cn('z-[1350]', isClosedByScroll && '!hidden pointer-events-none')}
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
        />
      )}
    </BaseBubbleMenu>
  )
}

export default LinkMenu
