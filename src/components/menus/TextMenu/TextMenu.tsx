import { Icon } from '@/components/ui/Icon'
import { Toolbar } from '@/components/ui/Toolbar'
import { useTextmenuCommands } from './hooks/useTextmenuCommands'
import { useTextmenuStates } from './hooks/useTextmenuStates'
import { Editor } from '@tiptap/react'
import { memo, useCallback, useEffect, useState } from 'react'
import { useTextmenuContentTypes } from './hooks/useTextmenuContentTypes'
import { ContentTypePicker } from './components/ContentTypePicker'
import { EditLinkPopover } from './components/EditLinkPopover'

const MemoButton = memo(Toolbar.Button)
const MemoContentTypePicker = memo(ContentTypePicker)

export type TextMenuProps = {
  editor: Editor
  appendTo?: React.RefObject<any>
}

export const TextMenu = ({ editor, appendTo }: TextMenuProps) => {
  const commands = useTextmenuCommands(editor)
  const states = useTextmenuStates(editor)
  const blockOptions = useTextmenuContentTypes(editor)
  const [dockPos, setDockPos] = useState<{ left: string; bottom: string }>({
    left: '50%',
    bottom: '20px',
  })

  const updateDockPosition = useCallback(() => {
    if (typeof window === 'undefined' || !editor || editor.isDestroyed) return
    const containerEl =
      (appendTo?.current as HTMLElement | null) ||
      (editor.view?.dom?.parentElement as HTMLElement | null)
    if (!containerEl) return

    const rect = containerEl.getBoundingClientRect()
    if (rect.width <= 0) return

    // Find nearest scrollable ancestor (e.g. MemoContent's overflow-auto container or modal scroll body)
    let scrollEl: HTMLElement | null = containerEl.parentElement
    while (scrollEl && scrollEl !== document.body && scrollEl !== document.documentElement) {
      const style = window.getComputedStyle(scrollEl)
      if (/(auto|scroll|overlay)/.test(style.overflowY)) {
        break
      }
      scrollEl = scrollEl.parentElement
    }

    const viewportH = window.innerHeight
    let visibleBottom = viewportH
    let visibleLeft = rect.left
    let visibleWidth = rect.width

    if (scrollEl && scrollEl !== document.body && scrollEl !== document.documentElement) {
      const sRect = scrollEl.getBoundingClientRect()
      visibleBottom = Math.min(viewportH, sRect.bottom)
      visibleLeft = sRect.left
      visibleWidth = sRect.width
    } else if (rect.bottom > 0 && rect.bottom < viewportH) {
      visibleBottom = Math.max(120, rect.bottom)
    }

    const centerX = `${Math.round(visibleLeft + visibleWidth / 2)}px`
    const bottomOffset = `${Math.max(16, Math.round(viewportH - visibleBottom + 18))}px`

    setDockPos(prev =>
      prev.left === centerX && prev.bottom === bottomOffset
        ? prev
        : { left: centerX, bottom: bottomOffset },
    )
  }, [appendTo, editor])

  useEffect(() => {
    if (typeof window === 'undefined') return
    updateDockPosition()

    const handleLayoutChange = () => {
      updateDockPosition()
    }

    window.addEventListener('resize', handleLayoutChange, { passive: true })
    window.addEventListener('scroll', handleLayoutChange, { capture: true, passive: true })

    const containerEl =
      (appendTo?.current as HTMLElement | null) ||
      (editor?.view?.dom?.parentElement as HTMLElement | null)
    let ro: ResizeObserver | null = null
    if (containerEl && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(handleLayoutChange)
      ro.observe(containerEl)
      if (containerEl.parentElement) {
        ro.observe(containerEl.parentElement)
      }
    }

    return () => {
      window.removeEventListener('resize', handleLayoutChange)
      window.removeEventListener('scroll', handleLayoutChange, { capture: true })
      ro?.disconnect()
    }
  }, [appendTo, editor, updateDockPosition])

  const BTN_CLASS =
    'h-7 w-7 p-0 flex items-center justify-center text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white hover:bg-black/5 active:bg-black/10 dark:hover:bg-white/5 dark:active:bg-white/10 rounded-md border border-transparent transition-colors duration-150'
  const ACTIVE_CLASS = 'bg-black/10 text-zinc-900 dark:bg-white/15 dark:text-white font-semibold'

  if (!editor || !editor.isEditable) {
    return null
  }

  return (
    <div
      role="toolbar"
      aria-label="텍스트 서식 도구 모음"
      data-bottom-text-menu="true"
      style={{
        left: dockPos.left,
        bottom: dockPos.bottom,
      }}
      onMouseDown={e => {
        const target = e.target as HTMLElement | null
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
          return
        }
        e.preventDefault()
      }}
      className="fixed -translate-x-1/2 z-[45] pointer-events-auto select-none"
    >
      <div className="inline-flex h-full leading-none gap-0.5 p-1 rounded-xl items-center bg-white/95 dark:bg-[#202020]/95 backdrop-blur-xl border border-black/[0.08] dark:border-white/[0.12] shadow-2xl ring-1 ring-white/40 dark:ring-white/5 text-zinc-800 dark:text-zinc-200">
        <MemoContentTypePicker options={blockOptions} />
        <div className="h-4 w-[1px] bg-black/10 dark:bg-white/10 mx-1 shrink-0" />
        <MemoButton
          tooltip="Bold"
          tooltipShortcut={['Mod', 'B']}
          onClick={commands.onBold}
          active={states.isBold}
          className={BTN_CLASS}
          activeClassname={ACTIVE_CLASS}
        >
          <Icon name="Bold" className="w-3.5 h-3.5" />
        </MemoButton>
        <MemoButton
          tooltip="Italic"
          tooltipShortcut={['Mod', 'I']}
          onClick={commands.onItalic}
          active={states.isItalic}
          className={BTN_CLASS}
          activeClassname={ACTIVE_CLASS}
        >
          <Icon name="Italic" className="w-3.5 h-3.5" />
        </MemoButton>
        <MemoButton
          tooltip="Underline"
          tooltipShortcut={['Mod', 'U']}
          onClick={commands.onUnderline}
          active={states.isUnderline}
          className={BTN_CLASS}
          activeClassname={ACTIVE_CLASS}
        >
          <Icon name="Underline" className="w-3.5 h-3.5" />
        </MemoButton>
        <MemoButton
          tooltip="Strikethrough"
          tooltipShortcut={['Mod', 'Shift', 'S']}
          onClick={commands.onStrike}
          active={states.isStrike}
          className={BTN_CLASS}
          activeClassname={ACTIVE_CLASS}
        >
          <Icon name="Strikethrough" className="w-3.5 h-3.5" />
        </MemoButton>
        <div className="h-4 w-[1px] bg-black/10 dark:bg-white/10 mx-1 shrink-0" />
        <MemoButton
          tooltip="Code"
          tooltipShortcut={['Mod', 'E']}
          onClick={commands.onCode}
          active={states.isCode}
          className={BTN_CLASS}
          activeClassname={ACTIVE_CLASS}
        >
          <Icon name="Code" className="w-3.5 h-3.5" />
        </MemoButton>
        <EditLinkPopover onSetLink={commands.onLink} />
      </div>
    </div>
  )
}

export default TextMenu
