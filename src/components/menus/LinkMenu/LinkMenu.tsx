import { useCallback, useState, useEffect, useRef, JSX, useMemo } from 'react'
import { BubbleMenu as BaseBubbleMenu } from '@tiptap/react/menus'
import { useEditorState } from '@tiptap/react'

import { MenuProps } from '../types'
import { LinkPreviewPanel } from '@/components/panels/LinkPreviewPanel'
import { LinkEditorPanel } from '@/components/panels'
import { cn } from '@/lib/utils'

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
      return Boolean(hasMark)
    } catch {
      return false
    }
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
    }
  }, [editor, editor.state.selection, checkIsLinkActive, setEditMode])

  // Reset scroll lock on editor interaction
  useEffect(() => {
    const handleReset = () => {
      isClosedByScrollRef.current = false
      setIsClosedByScroll(false)
    }
    editor.on('selectionUpdate', handleReset)
    editor.on('focus', handleReset)
    window.addEventListener('tiptap:reset-scroll-lock', handleReset)
    return () => {
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
    if (isClosedByScrollRef.current) return false
    if (showEditRef.current) return true
    const isMedia =
      editor.isActive('youtube') ||
      editor.isActive('imageBlock') ||
      editor.state.doc.nodeAt(editor.state.selection.from)?.type.name === 'youtube'
    if (isMedia) return false
    return checkIsLinkActive()
  }, [editor, checkIsLinkActive])

  const editable = editor.isEditable

  // Safe mark range extension supporting split text nodes, hashes, and image URLs
  const safeExtendLinkRange = useCallback(() => {
    try {
      const { state } = editor
      const { selection, schema } = state
      const linkType = schema.marks.link
      if (!linkType) {
        editor.chain().focus().extendMarkRange('link').run()
        return
      }

      const { from, to, $from } = selection
      const markFound =
        $from.marks().find(m => m.type === linkType) ||
        $from.nodeBefore?.marks?.find(m => m.type === linkType) ||
        $from.nodeAfter?.marks?.find(m => m.type === linkType)

      const targetHref = markFound?.attrs?.href

      let startPos = from
      let endPos = to

      // Scan contiguous nodes within parent that share the link mark
      if ($from.parent) {
        const parentStart = $from.start()
        $from.parent.forEach((child, offset) => {
          const childMark = child.marks?.find(m => m.type === linkType)
          if (childMark && (!targetHref || childMark.attrs?.href === targetHref)) {
            const nodeStart = parentStart + offset
            const nodeEnd = nodeStart + child.nodeSize
            if (
              (from >= nodeStart && from <= nodeEnd) ||
              (to >= nodeStart && to <= nodeEnd) ||
              (nodeStart >= from && nodeEnd <= to) ||
              Math.abs(from - nodeEnd) <= 1 ||
              Math.abs(to - nodeStart) <= 1
            ) {
              startPos = Math.min(startPos, nodeStart)
              endPos = Math.max(endPos, nodeEnd)
            }
          }
        })
      }

      if (startPos < endPos) {
        editor.chain().focus().setTextSelection({ from: startPos, to: endPos }).run()
      } else {
        editor.chain().focus().extendMarkRange('link').run()
      }
    } catch {
      try {
        editor.chain().focus().extendMarkRange('link').run()
      } catch {}
    }
  }, [editor])

  const handleEdit = useCallback(() => {
    setEditMode(true)
    safeExtendLinkRange()
    requestAnimationFrame(() => {
      try {
        editor.view.dispatch(editor.state.tr.setMeta('linkMenu', 'show'))
        editor.view.dispatch(editor.state.tr.setMeta('linkMenu', 'updatePosition'))
      } catch {}
    })
  }, [editor, setEditMode, safeExtendLinkRange])

  // Extract current link text from the editor document
  const currentLinkText = useMemo(() => {
    try {
      const { state } = editor
      const { from, to, $from } = state.selection
      const markType = state.schema.marks.link
      if (!markType) return ''

      // If user has a non-empty text selection, return that text
      if (from !== to) {
        return state.doc.textBetween(from, to)
      }

      // Find the exact link node at cursor
      const node =
        $from.parent.childAfter($from.parentOffset).node ||
        $from.parent.childBefore($from.parentOffset).node
      if (node && node.marks?.some(m => m.type === markType) && node.text) {
        return node.text
      }

      let linkText = ''
      state.doc.nodesBetween(
        Math.max(0, from - 2),
        Math.min(state.doc.content.size, to + 2),
        n => {
          const mark = n.marks?.find(m => m.type === markType)
          if (mark && n.text && !linkText) {
            linkText = n.text
          }
        },
      )
      return linkText
    } catch {
      return ''
    }
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
    const { from } = editor.state.selection
    try {
      const domAtPos = editor.view.domAtPos(from)
      const el = domAtPos.node as HTMLElement
      const linkEl =
        el?.nodeType === 1
          ? (el as HTMLElement).closest('a')
          : el?.parentElement?.closest('a')
      if (linkEl) {
        return linkEl.getBoundingClientRect()
      }
    } catch {}

    try {
      const coords = editor.view.coordsAtPos(from)
      return new DOMRect(coords.left, coords.top, Math.max(1, coords.right - coords.left), Math.max(1, coords.bottom - coords.top))
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
