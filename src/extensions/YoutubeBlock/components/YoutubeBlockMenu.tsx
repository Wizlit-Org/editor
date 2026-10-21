import { BubbleMenu as BaseBubbleMenu } from '@tiptap/react/menus'
import { useEditorState } from '@tiptap/react'
import { useCallback, useRef, useState, useEffect, JSX } from 'react'
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
  const menuRef = useRef<HTMLDivElement>(null)
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

  const onSaveUrl = useCallback(() => {
    if (urlInput.trim()) {
      editor.chain().focus(undefined, { scrollIntoView: false }).updateYoutubeUrl(urlInput.trim()).run()
    }
    setIsEditingUrl(false)
  }, [editor, urlInput])

  const onCancelEditUrl = useCallback(() => {
    setIsEditingUrl(false)
  }, [])

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

  // Close URL edit mode when editor loses youtube active
  useEffect(() => {
    if (!editor.isActive('youtube')) {
      setIsEditingUrl(false)
    }
  }, [editor])

  const BTN_CLASS =
    'h-7 w-7 p-0 flex items-center justify-center text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white hover:bg-black/5 active:bg-black/10 dark:hover:bg-white/5 dark:active:bg-white/10 rounded-md border border-transparent transition-colors duration-150'
  const ACTIVE_CLASS = 'bg-black/10 text-zinc-900 dark:bg-white/15 dark:text-white'

  return (
    <BaseBubbleMenu
      editor={editor}
      pluginKey="youtubeBlockMenu"
      shouldShow={shouldShow}
      updateDelay={0}
      appendTo={appendTo?.current || undefined}
      options={YOUTUBE_BLOCK_MENU_OPTIONS}
      getReferencedVirtualElement={getReferencedVirtualElement}
    >
      <div
        ref={menuRef}
        className="inline-flex h-full leading-none gap-0.5 p-1 rounded-xl items-center z-50 bg-white/85 dark:bg-[#202020]/90 backdrop-blur-xl border border-black/[0.08] dark:border-white/[0.1] shadow-xl ring-1 ring-white/40 dark:ring-white/5 text-zinc-800 dark:text-zinc-200"
      >
        {isEditingUrl ? (
          <div className="flex items-center gap-1 px-1 py-0.5">
            <input
              ref={inputRef}
              type="text"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  onSaveUrl()
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  onCancelEditUrl()
                }
              }}
              placeholder="YouTube URL..."
              className="w-48 text-xs px-2 py-1 bg-black/5 dark:bg-white/10 rounded border border-transparent focus:border-black/20 dark:focus:border-white/20 outline-none text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400"
            />
            <button
              type="button"
              onClick={onSaveUrl}
              className="h-6 w-6 flex items-center justify-center text-emerald-600 hover:bg-emerald-500/10 rounded transition-colors"
              title="Apply URL"
            >
              <Icon name="Check" className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onCancelEditUrl}
              className="h-6 w-6 flex items-center justify-center text-zinc-400 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors"
              title="Cancel"
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
              tooltip="Edit video URL"
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
