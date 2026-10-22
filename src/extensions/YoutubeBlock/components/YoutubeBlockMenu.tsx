import { BubbleMenu as BaseBubbleMenu } from '@tiptap/react/menus'
import { useEditorState } from '@tiptap/react'
import { useCallback, useRef, useState, JSX } from 'react'
import { Toolbar } from '@/components/ui/Toolbar'
import { Icon } from '@/components/ui/Icon'
import { MenuProps } from '@/components/menus/types'
import { getRenderContainer } from '@/lib/utils'

const YOUTUBE_BLOCK_MENU_OPTIONS = {
  offset: 8,
  flip: false,
  tippyOptions: {
    interactive: true,
    delay: [0, 300],
  },
}

export const YoutubeBlockMenu = ({ editor, appendTo }: MenuProps): JSX.Element => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isEditingUrl, setIsEditingUrl] = useState(false)
  const [urlInput, setUrlInput] = useState('')

  const getReferenceClientRect = useCallback(() => {
    const renderContainer =
      getRenderContainer(editor, 'node-youtube') ||
      editor.view?.dom?.querySelector('.node-youtube, [data-youtube-video]')
    const rect = renderContainer?.getBoundingClientRect() || new DOMRect(-1000, -1000, 0, 0)
    return rect
  }, [editor])

  const getReferencedVirtualElement = useCallback(
    () => ({ getBoundingClientRect: getReferenceClientRect }),
    [getReferenceClientRect],
  )

  const shouldShow = useCallback(() => {
    return editor.isActive('youtube')
  }, [editor])

  const onAlignLeft = useCallback(() => {
    editor.chain().focus(undefined, { scrollIntoView: false }).setYoutubeAlign('left').run()
  }, [editor])

  const onAlignCenter = useCallback(() => {
    editor.chain().focus(undefined, { scrollIntoView: false }).setYoutubeAlign('center').run()
  }, [editor])

  const onAlignRight = useCallback(() => {
    editor.chain().focus(undefined, { scrollIntoView: false }).setYoutubeAlign('right').run()
  }, [editor])

  const onDelete = useCallback(() => {
    editor.chain().focus(undefined, { scrollIntoView: false }).deleteSelection().run()
  }, [editor])

  const onStartEditUrl = useCallback(() => {
    const currentSrc = editor.getAttributes('youtube')?.src || ''
    setUrlInput(currentSrc)
    setIsEditingUrl(true)
    setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 50)
  }, [editor])

  const onApplyUrl = useCallback(() => {
    const trimmed = urlInput.trim()
    if (trimmed) {
      editor.chain().focus(undefined, { scrollIntoView: false }).setYoutubeVideo({ src: trimmed }).run()
    }
    setIsEditingUrl(false)
  }, [editor, urlInput])

  const onCancelEditUrl = useCallback(() => {
    setIsEditingUrl(false)
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        onApplyUrl()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onCancelEditUrl()
      }
    },
    [onApplyUrl, onCancelEditUrl],
  )

  const { isCenter, isLeft, isRight } = useEditorState({
    editor,
    selector: ctx => {
      return {
        isLeft: ctx.editor.isActive('youtube', { align: 'left' }),
        isCenter: ctx.editor.isActive('youtube', { align: 'center' }),
        isRight: ctx.editor.isActive('youtube', { align: 'right' }),
      }
    },
  })

  const BTN_CLASS =
    'h-7 w-7 p-0 flex items-center justify-center text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white hover:bg-black/5 active:bg-black/10 dark:hover:bg-white/5 dark:active:bg-white/10 rounded-md border border-transparent transition-colors'
  const ACTIVE_CLASS = 'bg-black/10 text-zinc-900 dark:bg-white/15 dark:text-white font-semibold'

  return (
    <BaseBubbleMenu
      editor={editor}
      pluginKey="youtubeBlockMenu"
      shouldShow={shouldShow}
      updateDelay={0}
      appendTo={appendTo?.current || undefined}
      getReferencedVirtualElement={getReferencedVirtualElement}
      options={YOUTUBE_BLOCK_MENU_OPTIONS}
    >
      <div className="flex items-center gap-1 p-1 rounded-xl bg-white/95 dark:bg-[#18181b]/95 backdrop-blur-2xl border border-black/10 dark:border-white/15 shadow-2xl ring-1 ring-white/40 dark:ring-white/5 text-zinc-800 dark:text-zinc-200">
        {isEditingUrl ? (
          <div className="flex items-center gap-1.5 px-1 py-0.5 animate-in fade-in-0 zoom-in-95 duration-100">
            <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-red-600/10 text-red-600 shrink-0">
              <Icon name="Video" className="w-3.5 h-3.5" />
            </div>
            <input
              ref={inputRef}
              type="text"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="새 YouTube 영상 URL 입력..."
              className="h-7 w-64 px-2.5 text-xs rounded-lg bg-black/5 dark:bg-white/10 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 outline-none border border-black/10 dark:border-white/15 focus:border-red-500/60 dark:focus:border-red-400/60 focus:ring-1 focus:ring-red-500/30 transition-all"
            />
            <button
              type="button"
              onClick={onApplyUrl}
              className="h-7 px-3 flex items-center justify-center gap-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium cursor-pointer shadow-xs transition-all active:scale-95 whitespace-nowrap"
              title="링크 교체 적용"
            >
              <Icon name="Check" className="w-3.5 h-3.5" />
              <span>교체</span>
            </button>
            <button
              type="button"
              onClick={onCancelEditUrl}
              className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer transition-colors"
              title="취소 (Esc)"
            >
              <Icon name="X" className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <>
            <Toolbar.Button
              tooltip="Align left"
              active={isLeft}
              onClick={onAlignLeft}
              className={BTN_CLASS}
              activeClassname={ACTIVE_CLASS}
            >
              <Icon name="AlignLeft" className="w-4 h-4" />
            </Toolbar.Button>
            <Toolbar.Button
              tooltip="Align center"
              active={isCenter}
              onClick={onAlignCenter}
              className={BTN_CLASS}
              activeClassname={ACTIVE_CLASS}
            >
              <Icon name="AlignCenter" className="w-4 h-4" />
            </Toolbar.Button>
            <Toolbar.Button
              tooltip="Align right"
              active={isRight}
              onClick={onAlignRight}
              className={BTN_CLASS}
              activeClassname={ACTIVE_CLASS}
            >
              <Icon name="AlignRight" className="w-4 h-4" />
            </Toolbar.Button>

            <div className="h-4 w-[1px] bg-black/10 dark:bg-white/10 mx-1 shrink-0" />

            <Toolbar.Button
              tooltip="Replace link"
              onClick={onStartEditUrl}
              className={BTN_CLASS}
              activeClassname={ACTIVE_CLASS}
            >
              <Icon name="Link2" className="w-4 h-4" />
            </Toolbar.Button>

            <Toolbar.Button
              tooltip="Delete video"
              onClick={onDelete}
              className="h-7 w-7 p-0 flex items-center justify-center text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-500/10 active:bg-red-500/20 rounded-md border border-transparent transition-colors"
            >
              <Icon name="Trash2" className="w-4 h-4" />
            </Toolbar.Button>
          </>
        )}
      </div>
    </BaseBubbleMenu>
  )
}

export default YoutubeBlockMenu
