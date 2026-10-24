import React, { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Editor } from '@tiptap/react'
import { Icon } from '@/components/ui/Icon'
import { useContainingBlockOffset, ContainingBlockAnchor } from '../utils/containingBlock'

interface TableScrollIndicatorProps {
  editor: Editor
  appendTo?: React.RefObject<HTMLElement | null>
}

interface TableShadowState {
  id: string
  wrapper: HTMLElement
  rect: { top: number; left: number; width: number; height: number }
  showLeft: boolean
  showRight: boolean
}

const isSameTables = (prev: TableShadowState[], next: TableShadowState[]): boolean => {
  if (prev.length !== next.length) return false
  return prev.every((p, i) => {
    const n = next[i]
    if (!n) return false
    return (
      p.id === n.id &&
      p.wrapper === n.wrapper &&
      p.showLeft === n.showLeft &&
      p.showRight === n.showRight &&
      Math.abs(p.rect.top - n.rect.top) < 0.5 &&
      Math.abs(p.rect.left - n.rect.left) < 0.5 &&
      Math.abs(p.rect.width - n.rect.width) < 0.5 &&
      Math.abs(p.rect.height - n.rect.height) < 0.5
    )
  })
}

export const TableScrollIndicator: React.FC<TableScrollIndicatorProps> = ({ editor, appendTo }) => {
  const [tables, setTables] = useState<TableShadowState[]>([])
  const anchorRef = useRef<HTMLDivElement>(null)
  const offset = useContainingBlockOffset(anchorRef)

  const updateTableScrollStates = useCallback(() => {
    const dom = editor.view?.dom
    if (!dom) {
      setTables(prev => (prev.length === 0 ? prev : []))
      return
    }

    const wrappers = Array.from(
      dom.querySelectorAll('.tableWrapper'),
    ) as HTMLElement[]

    if (wrappers.length === 0) {
      setTables(prev => (prev.length === 0 ? prev : []))
      return
    }

    const nextStates: TableShadowState[] = []

    wrappers.forEach((wrapper, index) => {
      const rect = wrapper.getBoundingClientRect()
      // Skip if wrapper is zero-sized or out of viewport vertically
      if (rect.width <= 0 || rect.height <= 0 || rect.bottom < 0 || rect.top > window.innerHeight) {
        return
      }

      const { scrollLeft, scrollWidth, clientWidth } = wrapper
      const hasHorizontalScroll = scrollWidth > clientWidth + 1

      if (!hasHorizontalScroll) {
        return
      }

      const showLeft = scrollLeft > 2
      const showRight = scrollLeft < scrollWidth - clientWidth - 2

      nextStates.push({
        id: `table-wrapper-${index}`,
        wrapper,
        rect: {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        },
        showLeft,
        showRight,
      })
    })

    setTables(prev => (isSameTables(prev, nextStates) ? prev : nextStates))
  }, [editor])

  useEffect(() => {
    let rafId: number | null = null
    let active = true

    const scheduledUpdate = () => {
      if (rafId !== null) return
      rafId = window.requestAnimationFrame(() => {
        rafId = null
        if (active) updateTableScrollStates()
      })
    }

    scheduledUpdate()

    // 3-stage poll after mount to catch ProseMirror/TipTap table wrapper rendering
    const timer1 = setTimeout(scheduledUpdate, 50)
    const timer2 = setTimeout(scheduledUpdate, 200)
    const timer3 = setTimeout(scheduledUpdate, 500)

    const dom = editor.view?.dom
    let ro: ResizeObserver | null = null
    let mo: MutationObserver | null = null

    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => scheduledUpdate())
      if (dom) ro.observe(dom)
    }

    if (typeof MutationObserver !== 'undefined') {
      mo = new MutationObserver(() => scheduledUpdate())
      if (dom) {
        mo.observe(dom, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] })
      } else if (typeof document !== 'undefined') {
        mo.observe(document.body, { childList: true, subtree: true })
      }
    }

    editor.on('selectionUpdate', scheduledUpdate)
    editor.on('transaction', scheduledUpdate)
    editor.on('update', scheduledUpdate)
    window.addEventListener('scroll', scheduledUpdate, { passive: true, capture: true })
    window.addEventListener('resize', scheduledUpdate, { passive: true })

    return () => {
      active = false
      clearTimeout(timer1)
      clearTimeout(timer2)
      clearTimeout(timer3)
      if (rafId !== null) window.cancelAnimationFrame(rafId)
      ro?.disconnect()
      mo?.disconnect()
      editor.off('selectionUpdate', scheduledUpdate)
      editor.off('transaction', scheduledUpdate)
      editor.off('update', scheduledUpdate)
      window.removeEventListener('scroll', scheduledUpdate, { capture: true })
      window.removeEventListener('resize', scheduledUpdate)
    }
  }, [editor, updateTableScrollStates])

  const handleScrollLeft = useCallback((wrapper: HTMLElement) => {
    wrapper.scrollBy({ left: -240, behavior: 'smooth' })
  }, [])

  const handleScrollRight = useCallback((wrapper: HTMLElement) => {
    wrapper.scrollBy({ left: 240, behavior: 'smooth' })
  }, [])

  if (typeof document === 'undefined' || tables.length === 0) {
    return null
  }

  return createPortal(
    <>
      <ContainingBlockAnchor ref={anchorRef} />
      {tables.map(t => {
        const visibleTop = Math.max(t.rect.top, 0)
        const visibleBottom = Math.min(t.rect.bottom, window.innerHeight)
        const isVisibleInViewport = visibleBottom > visibleTop
        const centerY = isVisibleInViewport
          ? (visibleTop + visibleBottom) / 2 - 16 - offset.y
          : t.rect.top + t.rect.height / 2 - 16 - offset.y

        const containerEl = (appendTo?.current as HTMLElement) || (editor.view?.dom as HTMLElement) || null
        const containerRect = containerEl ? containerEl.getBoundingClientRect() : { left: 0, right: typeof window !== 'undefined' ? window.innerWidth : 0 }
        const visibleLeft = Math.max(t.rect.left, containerRect.left)
        const visibleRight = Math.min(t.rect.left + t.rect.width, containerRect.right)

        const wrapperRect = t.wrapper.getBoundingClientRect()
        const leftFadeX = editor.isEditable
          ? wrapperRect.left - offset.x
          : visibleLeft - offset.x
        const leftFadeWidth = editor.isEditable ? '48px' : '36px'

        return (
          <React.Fragment key={t.id}>
            {/* Left Edge Fade Shadow Indicator & Edit mode glass blur */}
            <div
              style={{
                position: 'fixed',
                pointerEvents: 'none',
                zIndex: 14,
                transition: 'opacity 0.2s ease',
                opacity: t.showLeft ? 1 : 0,
                top: t.rect.top - offset.y,
                left: leftFadeX,
                width: leftFadeWidth,
                height: t.rect.height,
                background: 'linear-gradient(to right, rgba(0,0,0,0.18), transparent)',
                ...(editor.isEditable
                  ? {
                      backdropFilter: 'blur(4px)',
                      WebkitBackdropFilter: 'blur(4px)',
                      maskImage: 'linear-gradient(to right, transparent 0px, black 48px)',
                      WebkitMaskImage: 'linear-gradient(to right, transparent 0px, black 48px)',
                    }
                  : {}),
              }}
            />

            {/* Right Edge Fade Shadow Indicator */}
            <div
              style={{
                position: 'fixed',
                pointerEvents: 'none',
                zIndex: 14,
                transition: 'opacity 0.2s ease',
                opacity: t.showRight ? 1 : 0,
                top: t.rect.top - offset.y,
                left: visibleRight - 32 - offset.x,
                width: '32px',
                height: t.rect.height,
                background: 'linear-gradient(to left, rgba(0,0,0,0.18), transparent)',
              }}
            />

            {/* Left Scroll Arrow Button */}
            <button
              type="button"
              onClick={() => handleScrollLeft(t.wrapper)}
              title="Scroll table left"
              aria-label="Scroll table left"
              className={`fixed z-[40] w-8 h-8 rounded-full bg-white/90 dark:bg-[#202020]/90 backdrop-blur-md border border-black/10 dark:border-white/15 shadow-md flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-110 active:scale-95 hover:bg-white dark:hover:bg-[#2c2c2c] text-zinc-700 dark:text-zinc-200 ${
                t.showLeft
                  ? 'opacity-100 pointer-events-auto'
                  : 'opacity-0 pointer-events-none'
              }`}
              style={{
                top: centerY,
                left: visibleLeft + 12 - offset.x,
              }}
            >
              <Icon name="ChevronLeft" className="w-4 h-4" />
            </button>

            {/* Right Scroll Arrow Button */}
            <button
              type="button"
              onClick={() => handleScrollRight(t.wrapper)}
              title="Scroll table right"
              aria-label="Scroll table right"
              className={`fixed z-[40] w-8 h-8 rounded-full bg-white/90 dark:bg-[#202020]/90 backdrop-blur-md border border-black/10 dark:border-white/15 shadow-md flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-110 active:scale-95 hover:bg-white dark:hover:bg-[#2c2c2c] text-zinc-700 dark:text-zinc-200 ${
                t.showRight
                  ? 'opacity-100 pointer-events-auto'
                  : 'opacity-0 pointer-events-none'
              }`}
              style={{
                top: centerY,
                left: visibleRight - 44 - offset.x,
              }}
            >
              <Icon name="ChevronRight" className="w-4 h-4" />
            </button>
          </React.Fragment>
        )
      })}
    </>,
    (appendTo?.current as HTMLElement) || (typeof document !== 'undefined' ? document.body : (null as any)),
  )
}
