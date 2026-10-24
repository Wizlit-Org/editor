import { Editor } from '@tiptap/core'
import { TableMap } from '@tiptap/pm/tables'

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

/**
 * Automatically scrolls the newly added or targeted cell into view,
 * adjusting both the horizontal .tableWrapper and the vertical scroll container.
 */
export function scrollTargetCellIntoView(
  editor: Editor,
  target: {
    tablePos?: number
    rowIndex?: number
    colIndex?: number
    cellEl?: HTMLElement | null
  },
) {
  setTimeout(() => {
    try {
      let cell = target.cellEl
      if (!cell && target.tablePos !== undefined && target.tablePos >= 0) {
        const tableNode = editor.state.doc.nodeAt(target.tablePos)
        if (tableNode) {
          const map = TableMap.get(tableNode)
          const dom = editor.view.nodeDOM(target.tablePos) as HTMLElement | null
          const tableEl =
            dom && dom.nodeType === 1 ? (dom.tagName === 'TABLE' ? dom : dom.querySelector('table')) : null
          if (tableEl) {
            const r = Math.max(0, Math.min(target.rowIndex ?? map.height - 1, map.height - 1))
            const c = Math.max(0, Math.min(target.colIndex ?? map.width - 1, map.width - 1))
            const cellRelPos = map.map[r * map.width + c]
            const nodeDom = editor.view.nodeDOM(target.tablePos + 1 + cellRelPos) as HTMLElement | null
            cell =
              nodeDom && nodeDom.nodeType === 1
                ? nodeDom
                : (tableEl.querySelectorAll('tr')[r]?.children[c] as HTMLElement | null)
          }
        }
      }

      if (!cell) return

      // 1. Horizontal scroll on .tableWrapper
      const wrapper = cell.closest('.tableWrapper') as HTMLElement | null
      if (wrapper) {
        const cRect = cell.getBoundingClientRect()
        const wRect = wrapper.getBoundingClientRect()
        if (cRect.left < wRect.left) {
          wrapper.scrollTo({
            left: wrapper.scrollLeft - (wRect.left - cRect.left) - 24,
            behavior: 'smooth',
          })
        } else if (cRect.right > wRect.right) {
          wrapper.scrollTo({
            left: wrapper.scrollLeft + (cRect.right - wRect.right) + 24,
            behavior: 'smooth',
          })
        }
      }

      // 2. Vertical scroll into view
      cell.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
    } catch {}
  }, 50)
}
