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
  editorLeft?: number
  originLeft?: number
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
  const animFrameRef = useRef<number | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

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
    const editorLeft = editor.view?.dom ? editor.view.dom.getBoundingClientRect().left : r.left
    const originLeft = r.left + (wrapper ? wrapper.scrollLeft : 0)

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
      editorLeft,
      originLeft,
    })

    const tableNode = tablePos >= 0 ? editor.state.doc.nodeAt(tablePos) : null
    if (tableNode && tablePos >= 0) {
      const map = TableMap.get(tableNode)
      const trs = Array.from(currentTableEl.querySelectorAll('tbody > tr, tr')) as HTMLTableRowElement[]

      // Build 1:1 map of table cell positions to actual DOM elements
      const cellDomMap = new Map<number, HTMLElement>()
      trs.forEach((tr, rIdx) => {
        let cellDOMIdx = 0
        for (let c = 0; c < map.width; c++) {
          const cellPos = map.map[rIdx * map.width + c]
          const rect = map.findCell(cellPos)
          if (rect.top === rIdx && rect.left === c) {
            const cellEl = tr.children[cellDOMIdx] as HTMLElement | undefined
            if (cellEl) {
              cellDomMap.set(cellPos, cellEl)
              cellDOMIdx++
            }
          }
        }
      })

      // Calculate exact column grips using TableMap coordinates and actual DOM positions
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
            const el = cellDomMap.get(cellPos) || (editor.view?.nodeDOM(tablePos + 1 + cellPos) as HTMLElement | null)
            if (el instanceof HTMLElement) {
              foundCellEl = el
              colPos = tablePos + 1 + cellPos
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
          const el = cellDomMap.get(cellPos) || (editor.view?.nodeDOM(docCellPos) as HTMLElement | null)
          if (el instanceof HTMLElement) {
            const cr = el.getBoundingClientRect()
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
        const rowEl = trs[rIdx]
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

  // 3-tier debounce/rAF trigger for instantaneous layout reflow tracking (AC ②)
  const triggerUpdate = useCallback(() => {
    updateTableRect()
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    animFrameRef.current = requestAnimationFrame(() => {
      updateTableRect()
      animFrameRef.current = null
    })
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      updateTableRect()
      timeoutRef.current = null
    }, 30)
  }, [updateTableRect])

  // Subscribe to editor transactions and updates (Ctrl+Z / Undo / Redo / Move sync)
  useEffect(() => {
    if (!editor) return

    const handleSelectionChange = () => {
      const isCell =
        editor.state.selection.constructor.name === 'CellSelection' ||
        Boolean((editor.state.selection as any).$anchorCell)
      if (!isCell && !isHovered) {
        clearHoverTimer()
        setIsHovered(false)
        setCurrentTableEl(null)
        setTableRect(null)
      } else {
        triggerUpdate()
      }
    }

    editor.on('transaction', triggerUpdate)
    editor.on('update', triggerUpdate)
    editor.on('selectionUpdate', handleSelectionChange)

    return () => {
      editor.off('transaction', triggerUpdate)
      editor.off('update', triggerUpdate)
      editor.off('selectionUpdate', handleSelectionChange)
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [editor, triggerUpdate])

  // Observe active table DOM resize and mutations (colgroup, style, cell dimensions)
  useEffect(() => {
    if (!currentTableEl) return

    const ro = new ResizeObserver(() => {
      triggerUpdate()
    })
    ro.observe(currentTableEl)

    const mo = new MutationObserver(() => {
      triggerUpdate()
    })
    mo.observe(currentTableEl, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'width', 'colwidth', 'class'],
    })

    return () => {
      ro.disconnect()
      mo.disconnect()
    }
  }, [currentTableEl, triggerUpdate])

  useEffect(() => {
    if (!editor?.view?.dom) return

    const handleMouseMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (!target || !(target instanceof Element) || typeof target.closest !== 'function') return

      const table = target.closest('table')
      if (table && table !== currentTableEl && !(window as any).__isTableDragging) {
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

          // Coordinate-based hover detection (100% immune to merged cell index offset)
          let activeCol: number | null = null
          for (const g of columnGrips) {
            if (e.clientX >= g.left && e.clientX <= g.left + g.width) {
              activeCol = g.index
              break
            }
          }
          if (activeCol !== null) setHoveredColIndex(activeCol)

          let activeRow: number | null = null
          for (const g of rowGrips) {
            if (e.clientY >= g.top && e.clientY <= g.top + g.height) {
              activeRow = g.index
              break
            }
          }
          if (activeRow !== null) setHoveredRowIndex(activeRow)

          const totalRows = rowGrips.length > 0 ? rowGrips.length : currentTableEl.querySelectorAll('tr').length
          const totalCols = columnGrips.length > 0 ? columnGrips.length : currentTableEl.querySelector('tr')?.children.length ?? 0

          // Right column add bar visibility
          const isLastCol = activeCol !== null && totalCols > 0 && activeCol === totalCols - 1
          const isNearRightEdge = e.clientX >= r.right - 24 && e.clientX <= r.right + 24
          const inRightBar = Boolean(target.closest('[aria-label="Add column at end"]'))
          setShowRightAddBar(Boolean(isLastCol || isNearRightEdge || inRightBar))

          // Bottom row add bar visibility
          const isLastRow = activeRow !== null && totalRows > 0 && activeRow === totalRows - 1
          const isNearBottomEdge = e.clientY >= r.bottom - 24 && e.clientY <= r.bottom + 24
          const inBottomBar = Boolean(target.closest('[aria-label="Add row at end"]'))
          setShowBottomAddBar(Boolean(isLastRow || isNearBottomEdge || inBottomBar))
        } else {
          // Table / buffer zone out: 0ms hide if no cell is selected
          const isCellSelected =
            editor.state.selection.constructor.name === 'CellSelection' ||
            Boolean((editor.state.selection as any).$anchorCell)

          if (!isCellSelected) {
            clearHoverTimer()
            setIsHovered(false)
            setCurrentTableEl(null)
            setTableRect(null)
            setHoveredColIndex(null)
            setHoveredRowIndex(null)
            setShowRightAddBar(false)
            setShowBottomAddBar(false)
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
              }, 150)
            }
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
  }, [currentTableEl, editor, updateTableRect, clearHoverTimer, columnGrips, rowGrips])

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
