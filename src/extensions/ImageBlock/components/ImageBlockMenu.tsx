import { BubbleMenu as BaseBubbleMenu } from '@tiptap/react/menus'
import { useEditorState } from '@tiptap/react'
import { useCallback, useRef, useState, useEffect, JSX } from 'react'
import { Toolbar } from '@/components/ui/Toolbar'
import { Icon } from '@/components/ui/Icon'
import { MenuProps } from '@/components/menus/types'
import { getRenderContainer, cn } from '@/lib/utils'

const IMAGE_BLOCK_MENU_OPTIONS = {
  offset: 8,
  flip: false,
}

export const ImageBlockMenu = ({ editor, appendTo }: MenuProps): JSX.Element => {
  const menuRef = useRef<HTMLDivElement>(null)
  const [isClosedByScroll, setIsClosedByScroll] = useState(false)
  const isClosedByScrollRef = useRef(false)

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

  useEffect(() => {
    const handleClose = () => {
      isClosedByScrollRef.current = true
      setIsClosedByScroll(true)
      try {
        editor.view.dispatch(editor.state.tr.setMeta('imageBlockMenu', 'hide'))
      } catch {}
    }
    window.addEventListener('tiptap:close-menus', handleClose)
    window.addEventListener('scroll', handleClose, { passive: true, capture: true })
    return () => {
      window.removeEventListener('tiptap:close-menus', handleClose)
      window.removeEventListener('scroll', handleClose, { capture: true })
    }
  }, [editor])

  const getReferenceClientRect = useCallback(() => {
    const renderContainer =
      getRenderContainer(editor, 'node-imageBlock') ||
      editor.view?.dom?.querySelector('.node-imageBlock, [data-type="node-imageBlock"]')
    const rect = renderContainer?.getBoundingClientRect() || new DOMRect(-1000, -1000, 0, 0)

    return rect
  }, [editor])

  const getReferencedVirtualElement = useCallback(
    () => ({
      getBoundingClientRect: getReferenceClientRect,
      getClientRects: () => [getReferenceClientRect()],
    }),
    [getReferenceClientRect],
  )

  const shouldShow = useCallback(() => {
    if (isClosedByScrollRef.current) return false
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

  const fileInputRef = useRef<HTMLInputElement>(null)

  const onReplaceImageClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      try {
        const imageUploadExt = editor.extensionManager.extensions.find(e => e.name === 'imageUpload')
        const uploadFn = (imageUploadExt?.options as any)?.onUpload

        if (typeof uploadFn === 'function') {
          const uploadedUrl = await uploadFn(file)
          if (uploadedUrl && typeof uploadedUrl === 'string') {
            editor.chain().focus(undefined, { scrollIntoView: false }).updateAttributes('imageBlock', { src: uploadedUrl }).run()
          }
        } else {
          console.error('No upload handler provided in imageUpload extension')
        }
      } catch (err) {
        console.error('Failed to replace image:', err)
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    },
    [editor],
  )

  const onDelete = useCallback(() => {
    editor.chain().focus(undefined, { scrollIntoView: false }).deleteSelection().run()
  }, [editor])

  const { isImageCenter, isImageLeft, isImageRight, currentMargin } = useEditorState({
    editor,
    selector: ctx => {
      return {
        isImageLeft: ctx.editor.isActive('imageBlock', { align: 'left' }),
        isImageCenter: ctx.editor.isActive('imageBlock', { align: 'center' }),
        isImageRight: ctx.editor.isActive('imageBlock', { align: 'right' }),
        currentMargin: (ctx.editor.getAttributes('imageBlock').margin as 'tight' | 'normal' | 'relaxed') || 'normal',
      }
    },
  })

  const marginLabel = currentMargin === 'relaxed' ? '넓게' : currentMargin === 'tight' ? '좁게' : '보통'

  const onToggleMargin = useCallback(() => {
    const cur = (editor.getAttributes('imageBlock').margin as 'tight' | 'normal' | 'relaxed') || 'normal'
    const nxt = cur === 'normal' ? 'relaxed' : cur === 'relaxed' ? 'tight' : 'normal'
    editor
      .chain()
      .focus(undefined, { scrollIntoView: false })
      .setImageBlockMargin(nxt)
      .run()
  }, [editor])

  const BTN_CLASS =
    'h-7 w-7 p-0 flex items-center justify-center text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white hover:bg-black/5 active:bg-black/10 dark:hover:bg-white/5 dark:active:bg-white/10 rounded-md border border-transparent transition-colors duration-150'
  const ACTIVE_CLASS = 'bg-black/10 text-zinc-900 dark:bg-white/15 dark:text-white'

  return (
    <BaseBubbleMenu
      editor={editor}
      pluginKey="imageBlockMenu"
      shouldShow={shouldShow}
      updateDelay={0}
      className={cn('z-[1340]', isClosedByScroll && '!hidden pointer-events-none')}
      appendTo={appendTo?.current || undefined}
      options={IMAGE_BLOCK_MENU_OPTIONS}
      getReferencedVirtualElement={getReferencedVirtualElement}
    >
      <div
        ref={menuRef}
        className="inline-flex h-full leading-none gap-0.5 p-1 rounded-xl items-center z-[1340] bg-white/85 dark:bg-[#202020]/90 backdrop-blur-xl border border-black/[0.08] dark:border-white/[0.1] shadow-xl ring-1 ring-white/40 dark:ring-white/5 text-zinc-800 dark:text-zinc-200"
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
          tooltip={`여백: ${marginLabel}`}
          onClick={onToggleMargin}
          className="h-7 px-1.5 flex items-center gap-1 text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white hover:bg-black/5 active:bg-black/10 dark:hover:bg-white/5 dark:active:bg-white/10 rounded-md border border-transparent transition-colors duration-150 cursor-pointer text-xs"
        >
          <Icon name="MoveVertical" className="w-3.5 h-3.5" />
          <span>{marginLabel}</span>
        </Toolbar.Button>

        <div className="h-4 w-[1px] bg-black/10 dark:bg-white/10 mx-1 shrink-0" />

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        <Toolbar.Button
          tooltip="Replace image"
          onClick={onReplaceImageClick}
          className={BTN_CLASS}
          activeClassname={ACTIVE_CLASS}
        >
          <Icon name="RefreshCw" className="w-4 h-4" />
        </Toolbar.Button>

        <Toolbar.Button
          tooltip="Delete image"
          onClick={onDelete}
          className="h-7 w-7 p-0 flex items-center justify-center text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-500/10 active:bg-red-500/20 rounded-md border border-transparent transition-colors"
        >
          <Icon name="Trash2" className="w-4 h-4" />
        </Toolbar.Button>
      </div>
    </BaseBubbleMenu>
  )
}

export default ImageBlockMenu
