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
      return {
        isImageLeft: ctx.editor.isActive('imageBlock', { align: 'left' }),
        isImageCenter: ctx.editor.isActive('imageBlock', { align: 'center' }),
        isImageRight: ctx.editor.isActive('imageBlock', { align: 'right' }),
        width: parseInt(ctx.editor.getAttributes('imageBlock')?.width || 0),
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
      <div className="glass-toolbar inline-flex h-full leading-none gap-0.5 p-1 items-center shadow-xl z-50" ref={menuRef}>
        <Toolbar.Button
          tooltip="Align image left"
          active={isImageLeft}
          onClick={onAlignImageLeft}
          className="text-zinc-500 hover:text-zinc-800 dark:text-[#9b9b9b] dark:hover:text-[#e3e3e3] hover:bg-black/5 dark:hover:bg-white/[0.06] active:bg-black/10 dark:active:bg-white/[0.1] border border-transparent transition-colors"
          activeClassname="bg-black/10 dark:bg-white/[0.1] text-zinc-900 dark:text-white"
        >
          <Icon name="AlignHorizontalDistributeStart" />
        </Toolbar.Button>
        <Toolbar.Button
          tooltip="Align image center"
          active={isImageCenter}
          onClick={onAlignImageCenter}
          className="text-zinc-500 hover:text-zinc-800 dark:text-[#9b9b9b] dark:hover:text-[#e3e3e3] hover:bg-black/5 dark:hover:bg-white/[0.06] active:bg-black/10 dark:active:bg-white/[0.1] border border-transparent transition-colors"
          activeClassname="bg-black/10 dark:bg-white/[0.1] text-zinc-900 dark:text-white"
        >
          <Icon name="AlignHorizontalDistributeCenter" />
        </Toolbar.Button>
        <Toolbar.Button
          tooltip="Align image right"
          active={isImageRight}
          onClick={onAlignImageRight}
          className="text-zinc-500 hover:text-zinc-800 dark:text-[#9b9b9b] dark:hover:text-[#e3e3e3] hover:bg-black/5 dark:hover:bg-white/[0.06] active:bg-black/10 dark:active:bg-white/[0.1] border border-transparent transition-colors"
          activeClassname="bg-black/10 dark:bg-white/[0.1] text-zinc-900 dark:text-white"
        >
          <Icon name="AlignHorizontalDistributeEnd" />
        </Toolbar.Button>
        <div className="h-4 w-[1px] bg-black/10 dark:bg-white/10 mx-1 shrink-0" />
        <ImageBlockWidth onChange={onWidthChange} value={width} />
      </div>
    </BaseBubbleMenu>
  )
}

export default ImageBlockMenu
