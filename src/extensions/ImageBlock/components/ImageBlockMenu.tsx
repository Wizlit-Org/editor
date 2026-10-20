import { BubbleMenu as BaseBubbleMenu } from '@tiptap/react/menus'
import { useEditorState } from '@tiptap/react'
import { useCallback, useRef, JSX } from 'react'
import { Toolbar } from '@/components/ui/Toolbar'
import { Icon } from '@/components/ui/Icon'
import { ImageBlockWidth } from './ImageBlockWidth'
import { MenuProps } from '@/components/menus/types'
import { getRenderContainer } from '@/lib/utils'

const IMAGE_BLOCK_MENU_OPTIONS = {
  offset: 8,
  flip: false,
}

export const ImageBlockMenu = ({ editor, appendTo }: MenuProps): JSX.Element => {
  const menuRef = useRef<HTMLDivElement>(null)

  const getReferenceClientRect = useCallback(() => {
    const renderContainer = getRenderContainer(editor, 'node-imageBlock')
    const rect = renderContainer?.getBoundingClientRect() || new DOMRect(-1000, -1000, 0, 0)

    return rect
  }, [editor])

  const getReferencedVirtualElement = useCallback(
    () => ({ getBoundingClientRect: getReferenceClientRect }),
    [getReferenceClientRect],
  )

  const shouldShow = useCallback(() => {
    const isActive = editor.isActive('imageBlock')

    return isActive
  }, [editor])

  const onAlignImageLeft = useCallback(() => {
    editor.chain().focus(undefined, { scrollIntoView: false }).setImageBlockAlign('left').run()
  }, [editor])

  const onAlignImageCenter = useCallback(() => {
    editor.chain().focus(undefined, { scrollIntoView: false }).setImageBlockAlign('center').run()
  }, [editor])

  const onAlignImageRight = useCallback(() => {
    editor.chain().focus(undefined, { scrollIntoView: false }).setImageBlockAlign('right').run()
  }, [editor])

  const onWidthChange = useCallback(
    (value: number) => {
      editor.chain().focus(undefined, { scrollIntoView: false }).setImageBlockWidth(value).run()
    },
    [editor],
  )
  const { isImageCenter, isImageLeft, isImageRight, width } = useEditorState({
    editor,
    selector: ctx => {
      const rawWidthAttr = ctx.editor.getAttributes('imageBlock')?.width
      let computedWidth = 100

      if (rawWidthAttr && rawWidthAttr !== 'auto' && rawWidthAttr !== '100%') {
        computedWidth = parseInt(rawWidthAttr, 10) || 100
      } else {
        const renderContainer = getRenderContainer(ctx.editor, 'node-imageBlock')
        if (renderContainer) {
          const imgEl = renderContainer.querySelector('img')
          const editorDom = ctx.editor.view?.dom
          if (imgEl && editorDom) {
            const imgRect = imgEl.getBoundingClientRect()
            const editorRect = editorDom.getBoundingClientRect()
            if (editorRect.width > 0 && imgRect.width > 0) {
              computedWidth = Math.min(100, Math.max(25, Math.round((imgRect.width / editorRect.width) * 100)))
            }
          }
        }
      }

      return {
        isImageLeft: ctx.editor.isActive('imageBlock', { align: 'left' }),
        isImageCenter: ctx.editor.isActive('imageBlock', { align: 'center' }),
        isImageRight: ctx.editor.isActive('imageBlock', { align: 'right' }),
        width: computedWidth,
      }
    },
  })

  return (
    <BaseBubbleMenu
      editor={editor}
      pluginKey="imageBlockMenu"
      shouldShow={shouldShow}
      updateDelay={0}
      appendTo={appendTo?.current || undefined}
      options={IMAGE_BLOCK_MENU_OPTIONS}
      getReferencedVirtualElement={getReferencedVirtualElement}
    >
      <Toolbar.Wrapper shouldShowContent={shouldShow()} ref={menuRef}>
        <Toolbar.Button tooltip="Align image left" active={isImageLeft} onClick={onAlignImageLeft}>
          <Icon name="AlignHorizontalDistributeStart" />
        </Toolbar.Button>
        <Toolbar.Button tooltip="Align image center" active={isImageCenter} onClick={onAlignImageCenter}>
          <Icon name="AlignHorizontalDistributeCenter" />
        </Toolbar.Button>
        <Toolbar.Button tooltip="Align image right" active={isImageRight} onClick={onAlignImageRight}>
          <Icon name="AlignHorizontalDistributeEnd" />
        </Toolbar.Button>
        <Toolbar.Divider />
        <ImageBlockWidth onChange={onWidthChange} value={width} />
      </Toolbar.Wrapper>
    </BaseBubbleMenu>
  )
}

export default ImageBlockMenu
