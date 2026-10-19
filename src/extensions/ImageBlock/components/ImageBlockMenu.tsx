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

  const onAlignFullWidth = useCallback(() => {
    editor.chain().focus(undefined, { scrollIntoView: false }).setImageBlockWidth(100).setImageBlockAlign('center').run()
  }, [editor])

  const onResetOriginalWidth = useCallback(() => {
    editor.chain().focus(undefined, { scrollIntoView: false }).setImageBlockWidth('auto').run()
  }, [editor])

  const onWidthChange = useCallback(
    (value: number) => {
      editor.chain().focus(undefined, { scrollIntoView: false }).setImageBlockWidth(value).run()
    },
    [editor],
  )

  const { isImageCenter, isImageLeft, isImageRight, isFullWidth, width, src } = useEditorState({
    editor,
    selector: ctx => {
      const w = parseInt(ctx.editor.getAttributes('imageBlock')?.width || '100', 10)
      return {
        isImageLeft: ctx.editor.isActive('imageBlock', { align: 'left' }) && w < 100,
        isImageCenter: ctx.editor.isActive('imageBlock', { align: 'center' }) && w < 100,
        isImageRight: ctx.editor.isActive('imageBlock', { align: 'right' }) && w < 100,
        isFullWidth: w >= 100,
        width: w,
        src: ctx.editor.getAttributes('imageBlock')?.src as string | undefined,
      }
    },
  })

  const onDownloadImage = useCallback(() => {
    if (!src) return
    const a = document.createElement('a')
    a.href = src
    a.download = src.split('/').pop() || 'image'
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }, [src])

  const onReplaceImage = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || [])
      if (files.length > 0) {
        editor.commands.uploadImages({ files })
      }
    }
    input.click()
  }, [editor])

  const onDeleteImage = useCallback(() => {
    editor.chain().focus(undefined, { scrollIntoView: false }).deleteSelection().run()
  }, [editor])

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
      <div className="glass-toolbar inline-flex h-full leading-none gap-0.5 p-1 items-center shadow-xl z-50 rounded-lg" ref={menuRef}>
        <Toolbar.Button
          tooltip="Align image left"
          active={isImageLeft}
          onClick={onAlignImageLeft}
          className="text-zinc-500 hover:text-zinc-800 dark:text-[#9b9b9b] dark:hover:text-[#e3e3e3] hover:bg-black/5 dark:hover:bg-white/[0.06] active:bg-black/10 dark:active:bg-white/[0.1] border border-transparent transition-colors"
          activeClassname="bg-black/10 dark:bg-white/[0.1] text-zinc-900 dark:text-white"
        >
          <Icon name="AlignHorizontalDistributeStart" className="w-4 h-4" />
        </Toolbar.Button>
        <Toolbar.Button
          tooltip="Align image center"
          active={isImageCenter}
          onClick={onAlignImageCenter}
          className="text-zinc-500 hover:text-zinc-800 dark:text-[#9b9b9b] dark:hover:text-[#e3e3e3] hover:bg-black/5 dark:hover:bg-white/[0.06] active:bg-black/10 dark:active:bg-white/[0.1] border border-transparent transition-colors"
          activeClassname="bg-black/10 dark:bg-white/[0.1] text-zinc-900 dark:text-white"
        >
          <Icon name="AlignHorizontalDistributeCenter" className="w-4 h-4" />
        </Toolbar.Button>
        <Toolbar.Button
          tooltip="Align image right"
          active={isImageRight}
          onClick={onAlignImageRight}
          className="text-zinc-500 hover:text-zinc-800 dark:text-[#9b9b9b] dark:hover:text-[#e3e3e3] hover:bg-black/5 dark:hover:bg-white/[0.06] active:bg-black/10 dark:active:bg-white/[0.1] border border-transparent transition-colors"
          activeClassname="bg-black/10 dark:bg-white/[0.1] text-zinc-900 dark:text-white"
        >
          <Icon name="AlignHorizontalDistributeEnd" className="w-4 h-4" />
        </Toolbar.Button>
        <Toolbar.Button
          tooltip="Full width (100%)"
          active={isFullWidth}
          onClick={onAlignFullWidth}
          className="text-zinc-500 hover:text-zinc-800 dark:text-[#9b9b9b] dark:hover:text-[#e3e3e3] hover:bg-black/5 dark:hover:bg-white/[0.06] active:bg-black/10 dark:active:bg-white/[0.1] border border-transparent transition-colors"
          activeClassname="bg-black/10 dark:bg-white/[0.1] text-zinc-900 dark:text-white"
        >
          <Icon name="Maximize2" className="w-4 h-4" />
        </Toolbar.Button>
        <Toolbar.Button
          tooltip="Reset to original size"
          onClick={onResetOriginalWidth}
          className="text-zinc-500 hover:text-zinc-800 dark:text-[#9b9b9b] dark:hover:text-[#e3e3e3] hover:bg-black/5 dark:hover:bg-white/[0.06] active:bg-black/10 dark:active:bg-white/[0.1] border border-transparent transition-colors"
        >
          <Icon name="RotateCcw" className="w-4 h-4" />
        </Toolbar.Button>
        <div className="h-4 w-[1px] bg-black/10 dark:bg-white/10 mx-1 shrink-0" />
        <ImageBlockWidth onChange={onWidthChange} value={width} />
        <div className="h-4 w-[1px] bg-black/10 dark:bg-white/10 mx-1 shrink-0" />
        <Toolbar.Button
          tooltip="Download image"
          onClick={onDownloadImage}
          className="text-zinc-500 hover:text-zinc-800 dark:text-[#9b9b9b] dark:hover:text-[#e3e3e3] hover:bg-black/5 dark:hover:bg-white/[0.06] active:bg-black/10 dark:active:bg-white/[0.1] border border-transparent transition-colors"
        >
          <Icon name="Download" className="w-4 h-4" />
        </Toolbar.Button>
        <Toolbar.Button
          tooltip="Replace image"
          onClick={onReplaceImage}
          className="text-zinc-500 hover:text-zinc-800 dark:text-[#9b9b9b] dark:hover:text-[#e3e3e3] hover:bg-black/5 dark:hover:bg-white/[0.06] active:bg-black/10 dark:active:bg-white/[0.1] border border-transparent transition-colors"
        >
          <Icon name="RefreshCw" className="w-4 h-4" />
        </Toolbar.Button>
        <Toolbar.Button
          tooltip="Delete image"
          onClick={onDeleteImage}
          className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-500/10 active:bg-red-500/20 border border-transparent transition-colors"
        >
          <Icon name="Trash2" className="w-4 h-4" />
        </Toolbar.Button>
      </div>
    </BaseBubbleMenu>
  )
}

export default ImageBlockMenu
