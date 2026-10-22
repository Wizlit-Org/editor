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

  // Close edit panel when selection moves away from link
  useEffect(() => {
    if (!editor.isActive('link')) {
      setShowEdit(false)
    }
  }, [editor, editor.state.selection])

  // Close edit panel on tiptap:close-menus (e.g. Esc key)
  useEffect(() => {
    const handleCloseMenus = () => {
      setShowEdit(false)
    }
    window.addEventListener('tiptap:close-menus', handleCloseMenus)
    return () => window.removeEventListener('tiptap:close-menus', handleCloseMenus)
  }, [])

  const shouldShow = useCallback(() => {
    const isMedia =
      editor.isActive('youtube') ||
      editor.isActive('imageBlock') ||
      editor.state.doc.nodeAt(editor.state.selection.from)?.type.name === 'youtube'
    if (isMedia) return false
    const isActive = editor.isActive('link')
    return isActive
  }, [editor])

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
    setShowEdit(false)
  }, [])

  const menuOptions = useMemo(
    () => ({
      placement: 'top-start' as const,
      flip: false,
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
      appendTo={appendTo?.current || undefined}
      options={menuOptions}
    >
      {showEdit ? (
        <LinkEditorPanel
          initialUrl={link}
          initialText={currentLinkText}
          initialOpenInNewTab={target === '_blank'}
          onSetLink={onSetLink}
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
