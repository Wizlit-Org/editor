import { BubbleMenu as BaseBubbleMenu } from '@tiptap/react/menus'
import { useEditorState } from '@tiptap/react'
import { useCallback, useRef, JSX } from 'react'
import { Toolbar } from '@/components/ui/Toolbar'
import { Icon } from '@/components/ui/Icon'
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
    return editor.isActive('imageBlock')
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

  const onToggleCaption = useCallback(() => {
    const currentCaption = editor.getAttributes('imageBlock')?.caption || ''
    if (!currentCaption) {
      editor.chain().focus(undefined, { scrollIntoView: false }).setImageBlockCaption(' ').run()
    } else {
      editor.chain().focus(undefined, { scrollIntoView: false }).setImageBlockCaption('').run()
    }
  }, [editor])

  const onDownload = useCallback(() => {
    const src = editor.getAttributes('imageBlock')?.src
    if (src && typeof window !== 'undefined') {
      const a = document.createElement('a')
      a.href = src
      a.download = 'image'
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }, [editor])

  const onDelete = useCallback(() => {
    editor.chain().focus(undefined, { scrollIntoView: false }).deleteSelection().run()
  }, [editor])

  const { isImageCenter, isImageLeft, isImageRight, hasCaption } = useEditorState({
    editor,
    selector: ctx => {
      return {
        isImageLeft: ctx.editor.isActive('imageBlock', { align: 'left' }),
        isImageCenter: ctx.editor.isActive('imageBlock', { align: 'center' }),
        isImageRight: ctx.editor.isActive('imageBlock', { align: 'right' }),
        hasCaption: !!ctx.editor.getAttributes('imageBlock')?.caption,
      }
    },
  })

  const BTN_CLASS =
    'h-7 w-7 p-0 flex items-center justify-center text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white hover:bg-black/5 active:bg-black/10 dark:hover:bg-white/5 dark:active:bg-white/10 rounded border border-transparent transition-colors'
  const ACTIVE_CLASS = 'bg-black/10 text-zinc-900 dark:bg-white/15 dark:text-white'

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
      <div
        ref={menuRef}
        className="inline-flex h-full leading-none gap-0.5 p-1 rounded-lg items-center z-50 bg-white/85 dark:bg-[#202020]/90 backdrop-blur-md border border-black/5 dark:border-white/10 shadow-lg text-zinc-800 dark:text-zinc-200"
      >
        <Toolbar.Button
          tooltip="Align left"
          active={isImageLeft}
          onClick={onAlignImageLeft}
          className={BTN_CLASS}
          activeClassname={ACTIVE_CLASS}
        >
          <Icon name="AlignLeft" className="w-4 h-4" />
        </Toolbar.Button>
        <Toolbar.Button
          tooltip="Align center"
          active={isImageCenter}
          onClick={onAlignImageCenter}
          className={BTN_CLASS}
          activeClassname={ACTIVE_CLASS}
        >
          <Icon name="AlignCenter" className="w-4 h-4" />
        </Toolbar.Button>
        <Toolbar.Button
          tooltip="Align right"
          active={isImageRight}
          onClick={onAlignImageRight}
          className={BTN_CLASS}
          activeClassname={ACTIVE_CLASS}
        >
          <Icon name="AlignRight" className="w-4 h-4" />
        </Toolbar.Button>

        <div className="h-4 w-[1px] bg-black/10 dark:bg-white/10 mx-1 shrink-0" />

        <Toolbar.Button
          tooltip="Toggle caption"
          active={hasCaption}
          onClick={onToggleCaption}
          className={BTN_CLASS}
          activeClassname={ACTIVE_CLASS}
        >
          <Icon name="Subtitles" className="w-4 h-4" />
        </Toolbar.Button>

        <Toolbar.Button
          tooltip="Download image"
          onClick={onDownload}
          className={BTN_CLASS}
          activeClassname={ACTIVE_CLASS}
        >
          <Icon name="Download" className="w-4 h-4" />
        </Toolbar.Button>

        <Toolbar.Button
          tooltip="Delete image"
          onClick={onDelete}
          className="h-7 w-7 p-0 flex items-center justify-center text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-500/10 active:bg-red-500/20 rounded border border-transparent transition-colors"
        >
          <Icon name="Trash2" className="w-4 h-4" />
        </Toolbar.Button>
      </div>
    </BaseBubbleMenu>
  )
}

export default ImageBlockMenu
