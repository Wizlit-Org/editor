import { useCallback, useState, JSX, useMemo } from 'react'
import { BubbleMenu as BaseBubbleMenu } from '@tiptap/react/menus'
import { useEditorState } from '@tiptap/react'

import { MenuProps } from '../types'
import { LinkPreviewPanel } from '@/components/panels/LinkPreviewPanel'
import { LinkEditorPanel } from '@/components/panels'

export const LinkMenu = ({ editor, appendTo, onLinkClick = () => false, disableDefaultAction = false }: MenuProps): JSX.Element => {
  const [showEdit, setShowEdit] = useState(false)
  const { link, target } = useEditorState({
    editor,
    selector: ctx => {
      const attrs = ctx.editor.getAttributes('link')
      return { link: attrs.href, target: attrs.target }
    },
  })

  const shouldShow = useCallback(() => {
    const isActive = editor.isActive('link') && !editor.isActive('youtube') && !editor.isActive('imageBlock')
    return isActive
  }, [editor])

  const editable = editor.isEditable

  const handleEdit = useCallback(() => {
    setShowEdit(true)
  }, [])

  const onSetLink = useCallback(
    (url: string, openInNewTab?: boolean) => {
      editor
        .chain()
        .focus()
        .extendMarkRange('link')
        .setLink({ href: url, target: openInNewTab ? '_blank' : '' })
        .run()
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
        <LinkEditorPanel initialUrl={link} initialOpenInNewTab={target === '_blank'} onSetLink={onSetLink} />
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
