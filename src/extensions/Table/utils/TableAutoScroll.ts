/**
 * Utility for smooth multi-axis auto-scrolling during table dragging (cell selection, grip selection, DnD move).
 */

export interface AutoScrollController {
  updateCoords: (x: number, y: number) => void
  stop: () => void
}

export function startAutoScroll(options: {
  tableWrapper: HTMLElement | null
  scrollContainer?: HTMLElement | Window | null
  onTick?: (x: number, y: number) => void
  threshold?: number
  maxSpeed?: number
}): AutoScrollController {
  const {
    tableWrapper,
    scrollContainer = typeof window !== 'undefined' ? window : null,
    onTick,
    threshold = 60,
    maxSpeed = 18,
  } = options

  let currentX = -1
  let currentY = -1
  let rafId: number | null = null
  let isRunning = true

  const getContainerRect = (): { top: number; bottom: number } | null => {
    if (!scrollContainer) return null
    if (scrollContainer === window) {
      return { top: 0, bottom: window.innerHeight }
    }
    const el = scrollContainer as HTMLElement
    if (typeof el.getBoundingClientRect === 'function') {
      const r = el.getBoundingClientRect()
      return { top: r.top, bottom: r.bottom }
    }
    return null
  }

  const loop = () => {
    if (!isRunning) return

    let scrolled = false

    // 1. Horizontal auto-scroll on tableWrapper
    if (tableWrapper && currentX >= 0) {
      const wRect = tableWrapper.getBoundingClientRect()
      if (currentX < wRect.left + threshold && tableWrapper.scrollLeft > 0) {
        const ratio = Math.max(0, (wRect.left + threshold - currentX) / threshold)
        const delta = Math.max(2, Math.round(ratio * maxSpeed))
        tableWrapper.scrollLeft -= delta
        scrolled = true
      } else if (currentX > wRect.right - threshold && tableWrapper.scrollLeft < tableWrapper.scrollWidth - tableWrapper.clientWidth - 1) {
        const ratio = Math.max(0, (currentX - (wRect.right - threshold)) / threshold)
        const delta = Math.max(2, Math.round(ratio * maxSpeed))
        tableWrapper.scrollLeft += delta
        scrolled = true
      }
    }

    // 2. Vertical auto-scroll on scrollContainer
    if (scrollContainer && currentY >= 0) {
      const cRect = getContainerRect()
      if (cRect) {
        if (currentY < cRect.top + threshold) {
          const ratio = Math.max(0, (cRect.top + threshold - currentY) / threshold)
          const delta = Math.max(2, Math.round(ratio * maxSpeed))
          if (scrollContainer === window) {
            window.scrollBy(0, -delta)
          } else {
            (scrollContainer as HTMLElement).scrollTop -= delta
          }
          scrolled = true
        } else if (currentY > cRect.bottom - threshold) {
          const ratio = Math.max(0, (currentY - (cRect.bottom - threshold)) / threshold)
          const delta = Math.max(2, Math.round(ratio * maxSpeed))
          if (scrollContainer === window) {
            window.scrollBy(0, delta)
          } else {
            (scrollContainer as HTMLElement).scrollTop += delta
          }
          scrolled = true
        }
      }
    }

    if (scrolled && onTick && currentX >= 0 && currentY >= 0) {
      onTick(currentX, currentY)
    }

    rafId = requestAnimationFrame(loop)
  }

  rafId = requestAnimationFrame(loop)

  return {
    updateCoords: (x: number, y: number) => {
      currentX = x
      currentY = y
    },
    stop: () => {
      isRunning = false
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
    },
  }
}
