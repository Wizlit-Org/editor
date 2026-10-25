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
  const tablesRef = useRef(tables)
  tablesRef.current = tables
  const anchorRef = useRef<HTMLDivElement>(null)
  const offset = useContainingBlockOffset(anchorRef)

  const [hoveredWrapper, setHoveredWrapper] = useState<HTMLElement | null>(null)
  const hoveredWrapperRef = useRef<HTMLElement | null>(null)
  hoveredWrapperRef.current = hoveredWrapper
  const hoverLeaveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const maskClearTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  const [activeWrapper, setActiveWrapper] = useState<HTMLElement | null>(null)
  const activeWrapperRef = useRef<HTMLElement | null>(null)
  activeWrapperRef.current = activeWrapper

  const updateActiveTable = useCallback(() => {
    const dom = editor.view?.dom
    if (!dom || !editor.isFocused || !editor.isActive('table')) {
      if (activeWrapperRef.current !== null) {
        setActiveWrapper(null)
      }
      return
    }

    let foundWrapper: HTMLElement | null = null
    const sel = window.getSelection()
    if (sel && sel.anchorNode) {
      const el = sel.anchorNode instanceof Element ? sel.anchorNode : sel.anchorNode.parentElement
      foundWrapper = el?.closest('.tableWrapper') as HTMLElement | null
    }
    if (!foundWrapper) {
      const selectedCell = dom.querySelector('.selectedCell, .ProseMirror-selectednode')
      if (selectedCell) {
        foundWrapper = selectedCell.closest('.tableWrapper') as HTMLElement | null
      }
    }
    if (foundWrapper !== activeWrapperRef.current) {
      setActiveWrapper(foundWrapper)
    }
  }, [editor])

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
        wrapper.style.maskImage = ''
        ;(wrapper.style as any).webkitMaskImage = ''
        return
      }

      const { scrollLeft, scrollWidth, clientWidth } = wrapper
      const hasHorizontalScroll = scrollWidth > clientWidth + 1

      if (!hasHorizontalScroll) {
        wrapper.style.maskImage = ''
        ;(wrapper.style as any).webkitMaskImage = ''
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
    tables.forEach(t => {
      const isBlurVisible = t.showLeft && (hoveredWrapper === t.wrapper || activeWrapper === t.wrapper)
      const existingTimer = maskClearTimersRef.current.get(t.id)

      if (isBlurVisible) {
        if (existingTimer) {
          clearTimeout(existingTimer)
          maskClearTimersRef.current.delete(t.id)
        }
        const editorDomLeft = editor.view?.dom ? editor.view.dom.getBoundingClientRect().left : t.rect.left
        const gutter = Math.max(0, Math.round(editorDomLeft - t.rect.left))
        const mask = `linear-gradient(to right, transparent 0px, transparent ${gutter}px, rgba(0,0,0,0.3) ${gutter + 16}px, black ${gutter + 48}px)`
        t.wrapper.style.maskImage = mask
        ;(t.wrapper.style as any).webkitMaskImage = mask
      } else {
        if (!existingTimer && t.wrapper.style.maskImage) {
          const timer = setTimeout(() => {
            maskClearTimersRef.current.delete(t.id)
            t.wrapper.style.maskImage = ''
            ;(t.wrapper.style as any).webkitMaskImage = ''
          }, 650)
          maskClearTimersRef.current.set(t.id, timer)
        }
      }
    })
  }, [tables, hoveredWrapper, activeWrapper, editor])

  useEffect(() => {
    let rafId: number | null = null
    let active = true

    const scheduledUpdate = () => {
      if (rafId !== null) return
      rafId = window.requestAnimationFrame(() => {
        rafId = null
        if (active) {
          updateTableScrollStates()
          updateActiveTable()
        }
      })
    }

    scheduledUpdate()
    updateActiveTable()

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

    const handleMouseMove = (e: MouseEvent) => {
      let wrapper: HTMLElement | null = null

      const target = e.target as HTMLElement | null
      if (target && target instanceof Element && typeof target.closest === 'function') {
        wrapper = target.closest('.tableWrapper') as HTMLElement | null
        if (!wrapper) {
          const btn = target.closest('[data-table-scroll-wrapper-id]') as HTMLElement | null
          if (btn) {
            const wrapperId = btn.getAttribute('data-table-scroll-wrapper-id')
            const found = tablesRef.current.find(t => t.id === wrapperId)
            if (found) wrapper = found.wrapper
          }
        }
      }

      // Global window coordinate tracking for gutter, drag handles (.drag-handle, ContentItemMenu) and entire table horizontal slice
      if (!wrapper) {
        const hasDragHandleHover = Boolean(
          typeof document !== 'undefined' &&
            document.querySelector(
              '.drag-handle:hover, [data-drag-handle]:hover, .table-drag-handle:hover, [data-testid="content-item-menu"]:hover',
            ),
        )

        for (const t of tablesRef.current) {
          const editorDom = editor.view?.dom
          const editorLeft = editorDom ? editorDom.getBoundingClientRect().left : t.rect.left
          const inY = e.clientY >= t.rect.top - 40 && e.clientY <= t.rect.bottom + 40
          const inX = e.clientX >= editorLeft - 100 && e.clientX <= t.rect.left + t.rect.width + 30

          if (inY && (inX || hasDragHandleHover)) {
            wrapper = t.wrapper
            break
          }
        }
      }

      if (wrapper) {
        if (hoverLeaveTimerRef.current) {
          clearTimeout(hoverLeaveTimerRef.current)
          hoverLeaveTimerRef.current = null
        }
        if (wrapper !== hoveredWrapperRef.current) {
          hoveredWrapperRef.current = wrapper
          setHoveredWrapper(wrapper)
        }
      } else {
        if (hoveredWrapperRef.current !== null && !hoverLeaveTimerRef.current) {
          hoverLeaveTimerRef.current = setTimeout(() => {
            hoverLeaveTimerRef.current = null
            hoveredWrapperRef.current = null
            setHoveredWrapper(null)
          }, 600)
        }
      }
    }

    const handleMouseLeave = () => {
      if (hoveredWrapperRef.current !== null && !hoverLeaveTimerRef.current) {
        hoverLeaveTimerRef.current = setTimeout(() => {
          hoverLeaveTimerRef.current = null
          hoveredWrapperRef.current = null
          setHoveredWrapper(null)
        }, 600)
      }
    }

    editor.on('selectionUpdate', scheduledUpdate)
    editor.on('transaction', scheduledUpdate)
    editor.on('update', scheduledUpdate)
    editor.on('focus', updateActiveTable)
    editor.on('blur', updateActiveTable)
    window.addEventListener('scroll', scheduledUpdate, { passive: true, capture: true })
    window.addEventListener('resize', scheduledUpdate, { passive: true })
    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    document.addEventListener('mouseleave', handleMouseLeave)

    const handleInterceptBlurredCellClick = (e: MouseEvent) => {
      for (const t of tablesRef.current) {
        const isBlurVisible = t.showLeft && (hoveredWrapperRef.current === t.wrapper || activeWrapperRef.current === t.wrapper)
        if (!isBlurVisible) continue
        const editorDom = editor.view?.dom
        const editorContentLeft = editorDom ? editorDom.getBoundingClientRect().left : t.rect.left
        const blurCellMinX = editorContentLeft
        const blurCellMaxX = editorContentLeft + 48
        const blurCellMinY = t.rect.top
        const blurCellMaxY = t.rect.bottom

        if (
          e.clientX >= blurCellMinX &&
          e.clientX <= blurCellMaxX &&
          e.clientY >= blurCellMinY &&
          e.clientY <= blurCellMaxY
        ) {
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()
          return
        }
      }
    }

    window.addEventListener('mousedown', handleInterceptBlurredCellClick, { capture: true })
    window.addEventListener('click', handleInterceptBlurredCellClick, { capture: true })
    window.addEventListener('dblclick', handleInterceptBlurredCellClick, { capture: true })

    return () => {
      active = false
      clearTimeout(timer1)
      clearTimeout(timer2)
      clearTimeout(timer3)
      if (hoverLeaveTimerRef.current) {
        clearTimeout(hoverLeaveTimerRef.current)
        hoverLeaveTimerRef.current = null
      }
      maskClearTimersRef.current.forEach(timer => clearTimeout(timer))
      maskClearTimersRef.current.clear()
      if (rafId !== null) window.cancelAnimationFrame(rafId)
      ro?.disconnect()
      mo?.disconnect()
      editor.off('selectionUpdate', scheduledUpdate)
      editor.off('transaction', scheduledUpdate)
      editor.off('update', scheduledUpdate)
      editor.off('focus', updateActiveTable)
      editor.off('blur', updateActiveTable)
      window.removeEventListener('scroll', scheduledUpdate, { capture: true })
      window.removeEventListener('resize', scheduledUpdate)
      window.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseleave', handleMouseLeave)
      window.removeEventListener('mousedown', handleInterceptBlurredCellClick, { capture: true })
      window.removeEventListener('click', handleInterceptBlurredCellClick, { capture: true })
      window.removeEventListener('dblclick', handleInterceptBlurredCellClick, { capture: true })

      // Clean up inline maskImage on table wrappers
      const editorDom = editor.view?.dom
      if (editorDom) {
        editorDom.querySelectorAll('.tableWrapper').forEach((el) => {
          const w = el as HTMLElement
          w.style.maskImage = ''
          ;(w.style as any).webkitMaskImage = ''
        })
      }
    }
  }, [editor, updateTableScrollStates, updateActiveTable])

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

        const editorContentLeft = editor.view?.dom ? editor.view.dom.getBoundingClientRect().left : visibleLeft
        const gutterWidth = Math.max(0, Math.round(editorContentLeft - visibleLeft))
        const blurWidth = gutterWidth + 48
        const isBlurVisible = t.showLeft && (hoveredWrapper === t.wrapper || activeWrapper === t.wrapper)

        return (
          <React.Fragment key={t.id}>
            {/* Left Edge Fade Shadow / Frosted Glass Blur Indicator (Extended across full left boundary with pointerEvents: none) */}
            <div
              style={{
                position: 'fixed',
                pointerEvents: 'none',
                cursor: 'default',
                zIndex: 12,
                transition: isBlurVisible
                  ? 'opacity 300ms ease-out'
                  : 'opacity 600ms cubic-bezier(0.16, 1, 0.3, 1)',
                opacity: isBlurVisible ? 1 : 0,
                top: t.rect.top - 24 - offset.y,
                left: visibleLeft - offset.x,
                width: `${blurWidth}px`,
                height: t.rect.height + 48,
                background: 'transparent',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                maskImage: `linear-gradient(to right, black 0px, black ${gutterWidth}px, rgba(0,0,0,0.6) ${gutterWidth + 24}px, transparent ${blurWidth}px)`,
                WebkitMaskImage: `linear-gradient(to right, black 0px, black ${gutterWidth}px, rgba(0,0,0,0.6) ${gutterWidth + 24}px, transparent ${blurWidth}px)`,
              }}
            />

            {/* Left Scroll Arrow Button */}
            <button
              type="button"
              data-table-scroll-wrapper-id={t.id}
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
                transition: isBlurVisible
                  ? 'opacity 300ms ease-out'
                  : 'opacity 600ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              <Icon name="ChevronLeft" className="w-4 h-4" />
            </button>

            {/* Right Scroll Arrow Button */}
            <button
              type="button"
              data-table-scroll-wrapper-id={t.id}
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
                transition: isBlurVisible
                  ? 'opacity 300ms ease-out'
                  : 'opacity 600ms cubic-bezier(0.16, 1, 0.3, 1)',
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
