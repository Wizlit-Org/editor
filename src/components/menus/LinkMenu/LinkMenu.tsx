import { useCallback, useState, useEffect, JSX, useMemo } from 'react'
import { BubbleMenu as BaseBubbleMenu } from '@tiptap/react/menus'
import { useEditorState } from '@tiptap/react'

import { MenuProps } from '../types'
import { LinkPreviewPanel } from '@/components/panels/LinkPreviewPanel'
import { LinkEditorPanel } from '@/components/panels'

export const LinkMenu = ({
  editor,
  appendTo,
  onLinkClick = () => false,
  disableDefaultAction = false,
}: MenuProps): JSX.Element => {
  const [showEdit, setShowEdit] = useState(false)
  const { link, target } = useEditorState({
    editor,
    selector: ctx => {
      const attrs = ctx.editor.getAttributes('link')
      return { link: attrs.href, target: attrs.target }
    },
  })

  // Close edit panel when selection moves away from link (only when not in active edit mode)
  useEffect(() => {
    if (!showEdit && !editor.isActive('link')) {
      setShowEdit(false)
    }
  }, [editor, editor.state.selection, showEdit])

  // Close edit panel on tiptap:close-menus (e.g. Esc key)
  useEffect(() => {
    const handleCloseMenus = () => {
      setShowEdit(false)
    }
    window.addEventListener('tiptap:close-menus', handleCloseMenus)
    return () => window.removeEventListener('tiptap:close-menus', handleCloseMenus)
  }, [])

  const shouldShow = useCallback(() => {
    if (showEdit) return true
    const isMedia =
      editor.isActive('youtube') ||
      editor.isActive('imageBlock') ||
      editor.state.doc.nodeAt(editor.state.selection.from)?.type.name === 'youtube'
    if (isMedia) return false
    const isActive = editor.isActive('link')
    return isActive
  }, [editor, showEdit])

  const editable = editor.isEditable

  const handleEdit = useCallback(() => {
    setShowEdit(true)
  }, [])

  // Extract current link text from the editor document
  const currentLinkText = useMemo(() => {
    if (!editor.isActive('link')) return ''
    try {
      const { state } = editor
      const { from, to } = state.selection
      const markType = state.schema.marks.link
      if (!markType) return ''

      let linkFrom = from
      let linkTo = to

      state.doc.nodesBetween(
        Math.max(0, from - 1),
        Math.min(state.doc.content.size, to + 1),
        (node, pos) => {
          const mark = node.marks?.find(m => m.type === markType)
          if (mark) {
            linkFrom = Math.min(linkFrom, pos)
            linkTo = Math.max(linkTo, pos + node.nodeSize)
          }
        },
      )

      return state.doc.textBetween(linkFrom, linkTo)
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
      setShowEdit(false)
    },
    [editor],
  )

  const onUnsetLink = useCallback(() => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    setShowEdit(false)
    return null
  }, [editor])

  const onHide = useCallback(() => {
    if (showEdit) return
    setShowEdit(false)
  }, [showEdit])

  // Trigger position update when switching to edit mode
  useEffect(() => {
    if (showEdit) {
      try {
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
      className="z-[1350]"
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
          onCancel={() => setShowEdit(false)}
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
