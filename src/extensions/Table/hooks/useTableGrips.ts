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

    const firstRow = currentTableEl.querySelector('tr')
    if (firstRow && tablePos >= 0) {
      const cells = Array.from(firstRow.children) as HTMLElement[]
      const colItems: GripItem[] = cells.map((cell, idx) => {
        const cr = cell.getBoundingClientRect()
        let cellPos = -1
        try {
          cellPos = editor.view.posAtDOM(cell, 0)
        } catch {
          cellPos = -1
        }
        return {
          index: idx,
          top: r.top,
          left: cr.left,
          width: cr.width,
          height: cr.height,
          pos: cellPos,
        }
      })
      setColumnGrips(colItems)
    }

    const rows = Array.from(currentTableEl.querySelectorAll('tr')) as HTMLElement[]
    if (rows.length > 0 && tablePos >= 0) {
      const rowItems: GripItem[] = rows.map((row, idx) => {
        const rr = row.getBoundingClientRect()
        let rowPos = -1
        try {
          rowPos = editor.view.posAtDOM(row, 0)
        } catch {
          rowPos = -1
        }
        return {
          index: idx,
          top: rr.top,
          left: r.left,
          width: rr.width,
          height: rr.height,
          pos: rowPos,
        }
      })
      setRowGrips(rowItems)
    }
  }, [currentTableEl, editor])

  useEffect(() => {
    if (!editor?.view?.dom) return

    const handleMouseMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (!target) return

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
