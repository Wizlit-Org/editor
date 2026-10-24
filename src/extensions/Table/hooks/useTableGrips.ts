import { useState, useEffect, useCallback, useRef } from 'react'
import { Editor } from '@tiptap/react'
import { TableMap } from '@tiptap/pm/tables'

export interface TableRectInfo {
  top: number
  left: number
  right: number
  bottom: number
  width: number
  height: number
  pos: number
  wrapperLeft?: number
  wrapperRight?: number
}

export interface GripItem {
  index: number
  top: number
  left: number
  width: number
  height: number
  pos: number
}

export function useTableGrips(editor: Editor) {
  const [tableRect, setTableRect] = useState<TableRectInfo | null>(null)
  const [currentTableEl, setCurrentTableEl] = useState<HTMLTableElement | null>(null)
  const [columnGrips, setColumnGrips] = useState<GripItem[]>([])
  const [rowGrips, setRowGrips] = useState<GripItem[]>([])
  const [hoveredColIndex, setHoveredColIndex] = useState<number | null>(null)
  const [hoveredRowIndex, setHoveredRowIndex] = useState<number | null>(null)
  const [showRightAddBar, setShowRightAddBar] = useState(false)
  const [showBottomAddBar, setShowBottomAddBar] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [isScrolling, setIsScrolling] = useState(false)

  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null)
  const scrollTimerRef = useRef<NodeJS.Timeout | null>(null)

  const clearHoverTimer = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
  }, [])

  const updateTableRect = useCallback(() => {
    if (!currentTableEl || !editor?.view?.dom) {
      setTableRect(null)
      setColumnGrips([])
      setRowGrips([])
      return
    }

    if (!document.body.contains(currentTableEl)) {
      setTableRect(null)
      setCurrentTableEl(null)
      setColumnGrips([])
      setRowGrips([])
      return
    }

    const r = currentTableEl.getBoundingClientRect()
    let tablePos = -1
    try {
      const firstCell = currentTableEl.querySelector('td, th')
      const pos = firstCell ? editor.view.posAtDOM(firstCell, 0) : editor.view.posAtDOM(currentTableEl, 0)
      const resolved = editor.state.doc.resolve(pos)
      for (let d = resolved.depth; d >= 0; d--) {
        if (resolved.node(d).type.name === 'table') {
          tablePos = resolved.before(d)
          break
        }
      }
    } catch {
      tablePos = -1
    }

    const wrapper = currentTableEl.closest('.tableWrapper') as HTMLElement | null
    const wr = wrapper ? wrapper.getBoundingClientRect() : r

    setTableRect({
      top: r.top,
      left: r.left,
      right: r.right,
      bottom: r.bottom,
      width: r.width,
      height: r.height,
      pos: tablePos,
      wrapperLeft: wr.left,
      wrapperRight: wr.right,
    })

    const tableNode = tablePos >= 0 ? editor.state.doc.nodeAt(tablePos) : null
    if (tableNode && tablePos >= 0) {
      const map = TableMap.get(tableNode)
      const rows = Array.from(currentTableEl.querySelectorAll('tr')) as HTMLElement[]

      // Calculate exact column grips using TableMap coordinates
      const colItems: GripItem[] = []
      for (let c = 0; c < map.width; c++) {
        let colLeft = 0
        let colWidth = 0
        let colPos = -1

        // Look for a cell in column c with colspan === 1 for pixel-perfect measurement
        let foundCellEl: HTMLElement | null = null
        for (let rIdx = 0; rIdx < map.height; rIdx++) {
          const cellPos = map.map[rIdx * map.width + c]
          const rect = map.findCell(cellPos)
          if (rect.right - rect.left === 1) {
            const docCellPos = tablePos + 1 + cellPos
            const dom = editor.view.nodeDOM(docCellPos) as HTMLElement | null
            if (dom instanceof HTMLElement) {
              foundCellEl = dom
              colPos = docCellPos
              break
            }
          }
        }

        if (foundCellEl) {
          const cr = foundCellEl.getBoundingClientRect()
          colLeft = cr.left
          colWidth = cr.width
        } else {
          // Fallback: If column c is part of horizontal merge across all rows
          const cellPos = map.map[c]
          const rect = map.findCell(cellPos)
          const docCellPos = tablePos + 1 + cellPos
          colPos = docCellPos
          const dom = editor.view.nodeDOM(docCellPos) as HTMLElement | null
          if (dom instanceof HTMLElement) {
            const cr = dom.getBoundingClientRect()
            const span = Math.max(1, rect.right - rect.left)
            const unitWidth = cr.width / span
            colLeft = cr.left + (c - rect.left) * unitWidth
            colWidth = unitWidth
          }
        }

        colItems.push({
          index: c,
          top: r.top,
          left: colLeft,
          width: colWidth,
          height: r.height,
          pos: colPos,
        })
      }
      setColumnGrips(colItems)

      // Calculate exact row grips (1:1 with each <tr>)
      const rowItems: GripItem[] = []
      for (let rIdx = 0; rIdx < map.height; rIdx++) {
        const rowEl = rows[rIdx]
        const rr = rowEl ? rowEl.getBoundingClientRect() : null
        const cellPos = map.map[rIdx * map.width]
        const rowPos = tablePos + 1 + cellPos

        rowItems.push({
          index: rIdx,
          top: rr ? rr.top : r.top + (rIdx * r.height) / map.height,
          left: r.left,
          width: r.width,
          height: rr ? rr.height : r.height / map.height,
          pos: rowPos,
        })
      }
      setRowGrips(rowItems)
    }
  }, [currentTableEl, editor])

  useEffect(() => {
    if (!editor?.view?.dom) return

    const handleMouseMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (!target || !(target instanceof Element) || typeof target.closest !== 'function') return

      const table = target.closest('table')
      if (table && table !== currentTableEl) {
        clearHoverTimer()
        setCurrentTableEl(table as HTMLTableElement)
        setIsHovered(true)
      }

      if (currentTableEl) {
        const portal = document.getElementById('table-add-buttons-portal')
        const inPortal = portal && portal.contains(target)

        const r = currentTableEl.getBoundingClientRect()
        const buffer = 35
        const inBufferZone =
          e.clientX >= r.left - buffer &&
          e.clientX <= r.right + buffer &&
          e.clientY >= r.top - buffer &&
          e.clientY <= r.bottom + buffer

        if (table || inPortal || inBufferZone) {
          clearHoverTimer()
          setIsHovered(true)

          // Detect which single column and row are hovered
          const td = target.closest('td, th') as HTMLElement | null
          let activeCol = hoveredColIndex
          let activeRow = hoveredRowIndex
          if (td) {
            const tr = td.parentElement as HTMLTableRowElement | null
            if (tr) {
              const rowIdx = Array.from(currentTableEl.querySelectorAll('tr')).indexOf(tr)
              const colIdx = Array.from(tr.children).indexOf(td)
              if (rowIdx >= 0) {
                setHoveredRowIndex(rowIdx)
                activeRow = rowIdx
              }
              if (colIdx >= 0) {
                setHoveredColIndex(colIdx)
                activeCol = colIdx
              }
            }
          }

          const totalRows = currentTableEl.querySelectorAll('tr').length
          const totalCols = currentTableEl.querySelector('tr')?.children.length ?? 0

          // Right column add bar visibility:
          // Visible only when hovering the last column, or mouse near right edge (within 24px), or hovering the bar itself
          const isLastCol = activeCol !== null && totalCols > 0 && activeCol === totalCols - 1
          const isNearRightEdge = e.clientX >= r.right - 24 && e.clientX <= r.right + 24
          const inRightBar = Boolean(target.closest('[aria-label="Add column at end"]'))
          setShowRightAddBar(Boolean(isLastCol || isNearRightEdge || inRightBar))

          // Bottom row add bar visibility:
          // Visible only when hovering the last row, or mouse near bottom edge (within 24px), or hovering the bar itself
          const isLastRow = activeRow !== null && totalRows > 0 && activeRow === totalRows - 1
          const isNearBottomEdge = e.clientY >= r.bottom - 24 && e.clientY <= r.bottom + 24
          const inBottomBar = Boolean(target.closest('[aria-label="Add row at end"]'))
          setShowBottomAddBar(Boolean(isLastRow || isNearBottomEdge || inBottomBar))
        } else {
          if (!hoverTimerRef.current) {
            hoverTimerRef.current = setTimeout(() => {
              setIsHovered(false)
              setCurrentTableEl(null)
              setTableRect(null)
              setHoveredColIndex(null)
              setHoveredRowIndex(null)
              setShowRightAddBar(false)
              setShowBottomAddBar(false)
              hoverTimerRef.current = null
            }, 300)
          }
        }
      }
    }

    const handleScroll = () => {
      setIsScrolling(true)
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
      scrollTimerRef.current = setTimeout(() => {
        setIsScrolling(false)
        updateTableRect()
        scrollTimerRef.current = null
      }, 60)
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true })
    window.addEventListener('resize', handleScroll, { passive: true })

    return () => {
      clearHoverTimer()
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('scroll', handleScroll, { capture: true })
      window.removeEventListener('resize', handleScroll)
    }
  }, [currentTableEl, editor, updateTableRect, clearHoverTimer])

  useEffect(() => {
    updateTableRect()
  }, [currentTableEl, updateTableRect])

  return {
    tableRect,
    currentTableEl,
    columnGrips,
    rowGrips,
    hoveredColIndex,
    hoveredRowIndex,
    showRightAddBar,
    showBottomAddBar,
    isHovered,
    isScrolling,
    setIsHovered,
    clearHoverTimer,
    updateTableRect,
  }
}
