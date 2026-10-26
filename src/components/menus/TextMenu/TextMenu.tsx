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
  const [isDark, setIsDark] = useState(false)
  const [dockPos, setDockPos] = useState<{ left: string; width: string; bottom: string }>({
    left: '0px',
    width: '100%',
    bottom: '8px',
  })

  const updateDockPosition = useCallback(() => {
    if (typeof window === 'undefined' || !editor || editor.isDestroyed) return
    const pmDom = editor.view?.dom as HTMLElement | undefined
    const containerEl =
      (appendTo?.current as HTMLElement | null) ||
      (pmDom?.parentElement as HTMLElement | null)
    if (!containerEl) return

    const darkDetected = Boolean(containerEl.closest('.editor-theme-dark'))
    setIsDark(prev => (prev === darkDetected ? prev : darkDetected))

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
      const isFakeScrollWrapper =
        scrollEl.classList.contains('smart-editor-wrapper') ||
        (style.overflowX === 'hidden' && scrollEl.clientHeight > window.innerHeight * 1.5)
      if (!isFakeScrollWrapper && /(auto|scroll|overlay)/.test(style.overflowY)) {
        break
      }
      scrollEl = scrollEl.parentElement
    }

    const viewportH = window.innerHeight
    const viewportW = window.innerWidth
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

    const targetViewportBottom = visibleBottom - 8

    // Clamp horizontal bounds within viewport on narrow mobile screens while preserving exact .ProseMirror column centering on desktop
    const clampedLeft = Math.max(8, rect.left)
    const clampedRight = Math.min(viewportW - 8, rect.right)
    const clampedWidth = Math.max(0, clampedRight - clampedLeft)

    const fixedLeft = Math.round((clampedLeft - cbLeft) * 10) / 10
    const fixedWidth = Math.round((clampedWidth > 0 ? clampedWidth : rect.width) * 10) / 10
    const fixedBottom = Math.max(6, Math.round((cbBottom - targetViewportBottom) * 10) / 10)

    const leftStr = `${fixedLeft}px`
    const widthStr = `${fixedWidth}px`
    const bottomStr = `${fixedBottom}px`

    setDockPos(prev =>
      prev.left === leftStr && prev.width === widthStr && prev.bottom === bottomStr
        ? prev
        : { left: leftStr, width: widthStr, bottom: bottomStr },
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
    'h-7 w-7 p-0 shrink-0 inline-flex items-center justify-center leading-none text-zinc-700 hover:text-zinc-950 dark:text-zinc-200 dark:hover:text-white hover:bg-white/60 active:bg-white/80 dark:hover:bg-white/[0.1] dark:active:bg-white/[0.16] rounded-lg border border-transparent hover:border-white/50 dark:hover:border-white/[0.08] transition-all duration-150'
  const ACTIVE_CLASS =
    'bg-[color-mix(in_srgb,var(--editor-primary)_15%,transparent)] text-[var(--editor-primary)] dark:bg-[color-mix(in_srgb,var(--editor-primary)_20%,transparent)] border-[color-mix(in_srgb,var(--editor-primary)_25%,transparent)] dark:border-[color-mix(in_srgb,var(--editor-primary)_30%,transparent)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] font-semibold'

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
        data-bottom-text-menu="true"
        style={{
          position: 'fixed',
          left: dockPos.left,
          width: dockPos.width,
          bottom: dockPos.bottom,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          pointerEvents: 'none',
          zIndex: 40,
          transform: 'none',
          translate: 'none',
        }}
        className="fixed z-[40] pointer-events-none select-none flex items-center justify-center"
      >
        <div
          role="toolbar"
          aria-label="텍스트 서식 도구 모음"
          onMouseDown={e => {
            const target = e.target as HTMLElement | null
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
              return
            }
            e.preventDefault()
          }}
          style={{
            pointerEvents: 'auto',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2px',
            padding: '5px 8px',
            borderRadius: '16px',
            maxWidth: 'calc(100vw - 16px)',
            backgroundColor: isDark ? 'rgba(24, 24, 27, 0.56)' : 'rgba(255, 255, 255, 0.54)',
            backgroundImage: isDark
              ? 'linear-gradient(135deg, rgba(39, 39, 42, 0.62) 0%, rgba(15, 23, 42, 0.48) 100%)'
              : 'linear-gradient(135deg, rgba(255, 255, 255, 0.62) 0%, rgba(241, 245, 249, 0.46) 100%)',
            backdropFilter: 'blur(20px) saturate(190%)',
            WebkitBackdropFilter: 'blur(20px) saturate(190%)',
            border: isDark
              ? '1px solid rgba(255, 255, 255, 0.16)'
              : '1px solid rgba(203, 213, 225, 0.85)',
            boxShadow: isDark
              ? '0 12px 32px -4px rgba(0, 0, 0, 0.55), 0 4px 12px -2px rgba(0, 0, 0, 0.35), inset 0 1px 0 0 rgba(255, 255, 255, 0.16)'
              : '0 10px 28px -4px rgba(15, 23, 42, 0.14), 0 4px 10px -2px rgba(15, 23, 42, 0.08), inset 0 1px 0 0 rgba(255, 255, 255, 0.92)',
          }}
          className="inline-flex h-full leading-none gap-0.5 p-1.5 rounded-2xl items-center justify-center text-zinc-800 dark:text-zinc-100 pointer-events-auto"
        >
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
