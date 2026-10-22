import React, { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Editor } from '@tiptap/react'
import { Icon } from '@/components/ui/Icon'

interface TableScrollIndicatorProps {
  editor: Editor
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

export const TableScrollIndicator: React.FC<TableScrollIndicatorProps> = ({ editor }) => {
  const [tables, setTables] = useState<TableShadowState[]>([])

  const updateTableScrollStates = useCallback(() => {
    if (!editor.view?.dom) {
      setTables(prev => (prev.length === 0 ? prev : []))
      return
    }

    const wrappers = Array.from(
      editor.view.dom.querySelectorAll('.tableWrapper'),
    ) as HTMLElement[]

    if (wrappers.length === 0) {
      setTables(prev => (prev.length === 0 ? prev : []))
      return
    }

    const nextStates: TableShadowState[] = []

    wrappers.forEach((wrapper, index) => {
      const rect = wrapper.getBoundingClientRect()
      // Skip if wrapper is out of viewport vertically
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        return
      }

      const { scrollLeft, scrollWidth, clientWidth } = wrapper
      const hasHorizontalScroll = scrollWidth > clientWidth + 2

      if (!hasHorizontalScroll) {
        return
      }

      const showLeft = scrollLeft > 4
      const showRight = scrollLeft < scrollWidth - clientWidth - 4

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

    const scheduledUpdate = () => {
      if (rafId !== null) return
      rafId = window.requestAnimationFrame(() => {
        rafId = null
        updateTableScrollStates()
      })
    }

    updateTableScrollStates()

    const wrappers = Array.from(
      editor.view?.dom?.querySelectorAll('.tableWrapper') || [],
    ) as HTMLElement[]

    wrappers.forEach(w => w.addEventListener('scroll', scheduledUpdate, { passive: true }))

    editor.on('selectionUpdate', scheduledUpdate)
    editor.on('transaction', scheduledUpdate)
    window.addEventListener('scroll', scheduledUpdate, { passive: true, capture: true })
    window.addEventListener('resize', scheduledUpdate, { passive: true })

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId)
      }
      wrappers.forEach(w => w.removeEventListener('scroll', scheduledUpdate))
      editor.off('selectionUpdate', scheduledUpdate)
      editor.off('transaction', scheduledUpdate)
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
      {tables.map(t => (
        <React.Fragment key={t.id}>
          {/* Left Edge Fade Shadow Indicator */}
          <div
            className={`fixed pointer-events-none z-[1380] transition-opacity duration-200 bg-gradient-to-r from-black/15 dark:from-black/40 to-transparent ${
              t.showLeft ? 'opacity-100' : 'opacity-0'
            }`}
            style={{
              top: t.rect.top,
              left: t.rect.left,
              width: '28px',
              height: t.rect.height,
            }}
          />

          {/* Right Edge Fade Shadow Indicator */}
          <div
            className={`fixed pointer-events-none z-[1380] transition-opacity duration-200 bg-gradient-to-l from-black/15 dark:from-black/40 to-transparent ${
              t.showRight ? 'opacity-100' : 'opacity-0'
            }`}
            style={{
              top: t.rect.top,
              left: t.rect.left + t.rect.width - 28,
              width: '28px',
              height: t.rect.height,
            }}
          />

          {/* Left Scroll Arrow Button */}
          <button
            type="button"
            onClick={() => handleScrollLeft(t.wrapper)}
            title="Scroll table left"
            aria-label="Scroll table left"
            className={`fixed z-[1390] w-8 h-8 rounded-full bg-white/90 dark:bg-[#202020]/90 backdrop-blur-md border border-black/10 dark:border-white/15 shadow-md flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-110 active:scale-95 hover:bg-white dark:hover:bg-[#2c2c2c] text-zinc-700 dark:text-zinc-200 ${
              t.showLeft
                ? 'opacity-100 pointer-events-auto'
                : 'opacity-0 pointer-events-none'
            }`}
            style={{
              top: t.rect.top + t.rect.height / 2 - 16,
              left: t.rect.left + 8,
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
            className={`fixed z-[1390] w-8 h-8 rounded-full bg-white/90 dark:bg-[#202020]/90 backdrop-blur-md border border-black/10 dark:border-white/15 shadow-md flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-110 active:scale-95 hover:bg-white dark:hover:bg-[#2c2c2c] text-zinc-700 dark:text-zinc-200 ${
              t.showRight
                ? 'opacity-100 pointer-events-auto'
                : 'opacity-0 pointer-events-none'
            }`}
            style={{
              top: t.rect.top + t.rect.height / 2 - 16,
              left: t.rect.left + t.rect.width - 40,
            }}
          >
            <Icon name="ChevronRight" className="w-4 h-4" />
          </button>
        </React.Fragment>
      ))}
    </>,
    document.body,
  )
}
