import { Icon } from '@/components/ui/Icon'
import { Toolbar } from '@/components/ui/Toolbar'
import { useTextmenuCommands } from './hooks/useTextmenuCommands'
import { useTextmenuStates } from './hooks/useTextmenuStates'
import { Editor } from '@tiptap/react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
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
  const probeRef = useRef<HTMLDivElement>(null)
  const [dockPos, setDockPos] = useState<{ left: string; bottom: string }>({
    left: '50%',
    bottom: '8px',
  })

  const updateDockPosition = useCallback(() => {
    if (typeof window === 'undefined' || !editor || editor.isDestroyed) return
    const pmDom = editor.view?.dom as HTMLElement | undefined
    const containerEl =
      (appendTo?.current as HTMLElement | null) ||
      (pmDom?.parentElement as HTMLElement | null)
    if (!containerEl) return

    // Prefer exact .ProseMirror content column rect for 0.0px true text-column horizontal centering
    const targetEl = pmDom && pmDom.offsetWidth > 0 ? pmDom : containerEl
    const rect = targetEl.getBoundingClientRect()
    if (rect.width <= 0) return

    // Measure fixed containing block origin (compensates for any ancestor transform/backdrop-filter in MUI Dialogs)
    const cbRect = probeRef.current?.getBoundingClientRect()
    const cbLeft = cbRect ? cbRect.left : 0
    const cbBottom = cbRect ? cbRect.bottom : window.innerHeight

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

    if (scrollEl && scrollEl !== document.body && scrollEl !== document.documentElement) {
      const sRect = scrollEl.getBoundingClientRect()
      visibleBottom = Math.min(viewportH, sRect.bottom)
    } else {
      const cRect = containerEl.getBoundingClientRect()
      if (cRect.bottom > 0 && cRect.bottom < viewportH) {
        visibleBottom = Math.max(120, cRect.bottom)
      }
    }

    // Target viewport coordinates: exact horizontal center of .ProseMirror, and 8px above visible bottom edge
    const targetViewportX = rect.left + rect.width / 2
    const targetViewportBottom = visibleBottom - 8

    // Convert viewport coordinates into local fixed containing-block coordinates
    const fixedLeft = Math.round((targetViewportX - cbLeft) * 10) / 10
    const fixedBottom = Math.max(6, Math.round((cbBottom - targetViewportBottom) * 10) / 10)

    const leftStr = `${fixedLeft}px`
    const bottomStr = `${fixedBottom}px`

    setDockPos(prev =>
      prev.left === leftStr && prev.bottom === bottomStr
        ? prev
        : { left: leftStr, bottom: bottomStr },
    )
  }, [appendTo, editor])

  useEffect(() => {
    if (typeof window === 'undefined') return
    updateDockPosition()
    const rafId = window.requestAnimationFrame(updateDockPosition)

    const handleLayoutChange = () => {
      updateDockPosition()
    }

    window.addEventListener('resize', handleLayoutChange, { passive: true })
    window.addEventListener('scroll', handleLayoutChange, { capture: true, passive: true })

    const pmDom = editor?.view?.dom as HTMLElement | undefined
    const containerEl =
      (appendTo?.current as HTMLElement | null) ||
      (pmDom?.parentElement as HTMLElement | null)
    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(handleLayoutChange)
      if (pmDom) ro.observe(pmDom)
      if (containerEl) ro.observe(containerEl)
      if (containerEl?.parentElement) ro.observe(containerEl.parentElement)
    }

    return () => {
      window.cancelAnimationFrame(rafId)
      window.removeEventListener('resize', handleLayoutChange)
      window.removeEventListener('scroll', handleLayoutChange, { capture: true })
      ro?.disconnect()
    }
  }, [appendTo, editor, updateDockPosition])

  const BTN_CLASS =
    'h-7 w-7 p-0 flex items-center justify-center text-zinc-700 hover:text-zinc-950 dark:text-zinc-200 dark:hover:text-white hover:bg-white/60 active:bg-white/80 dark:hover:bg-white/[0.1] dark:active:bg-white/[0.16] rounded-lg border border-transparent hover:border-white/50 dark:hover:border-white/[0.08] transition-all duration-150'
  const ACTIVE_CLASS =
    'bg-indigo-500/15 text-indigo-600 dark:bg-indigo-400/20 dark:text-indigo-300 border-indigo-500/25 dark:border-indigo-400/30 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] font-semibold'

  if (!editor || !editor.isEditable) {
    return null
  }

  return (
    <>
      {/* Hidden fixed-origin probe to measure any ancestor transform/backdrop-filter containing block offset */}
      <div
        ref={probeRef}
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none invisible -z-10"
      />
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
        className="fixed -translate-x-1/2 z-[40] pointer-events-auto select-none"
      >
        <div className="inline-flex h-full leading-none gap-0.5 p-1.5 rounded-2xl items-center bg-white/65 dark:bg-zinc-900/65 backdrop-blur-2xl backdrop-saturate-150 border border-white/75 dark:border-white/[0.14] ring-1 ring-slate-900/[0.06] dark:ring-black/50 shadow-[0_10px_32px_-4px_rgba(0,0,0,0.14),0_2px_6px_-1px_rgba(0,0,0,0.06),inset_0_1px_0_0_rgba(255,255,255,0.85)] dark:shadow-[0_12px_36px_-4px_rgba(0,0,0,0.65),inset_0_1px_0_0_rgba(255,255,255,0.14)] text-zinc-800 dark:text-zinc-100">
          <MemoContentTypePicker options={blockOptions} />
          <div className="h-4 w-[1px] bg-zinc-900/10 dark:bg-white/15 mx-1 shrink-0" />
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
          <div className="h-4 w-[1px] bg-zinc-900/10 dark:bg-white/15 mx-1 shrink-0" />
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
    </>
  )
}

export default TextMenu
