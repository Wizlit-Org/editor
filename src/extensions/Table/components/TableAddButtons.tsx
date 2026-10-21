import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Editor } from '@tiptap/react'
import { CellSelection, TableMap } from '@tiptap/pm/tables'
import { Icon } from '@/components/ui/Icon'

export interface TableAddButtonsProps {
  editor: Editor
}

interface TableRectInfo {
  top: number
  left: number
  right: number
  bottom: number
  width: number
  height: number
  pos: number
}

interface GripItem {
  index: number
  top: number
  left: number
  width: number
  height: number
  pos: number
}

export const TableAddButtons: React.FC<TableAddButtonsProps> = ({ editor }) => {
  const [tableRect, setTableRect] = useState<TableRectInfo | null>(null)
  const [isHovered, setIsHovered] = useState(false)
  const [currentTableEl, setCurrentTableEl] = useState<HTMLTableElement | null>(null)
  const [columnGrips, setColumnGrips] = useState<GripItem[]>([])
  const [rowGrips, setRowGrips] = useState<GripItem[]>([])

  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null)

  const clearHoverTimer = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
  }

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
      const pos = editor.view.posAtDOM(currentTableEl, 0)
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

    setTableRect({
      top: r.top,
      left: r.left,
      right: r.right,
      bottom: r.bottom,
      width: r.width,
      height: r.height,
      pos: tablePos,
    })

    // Calculate column grips along top edge
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
          top: cr.top,
          left: cr.left,
          width: cr.width,
          height: cr.height,
          pos: cellPos,
        }
      })
      setColumnGrips(colItems)
    }

    // Calculate row grips along left edge
    const rows = Array.from(currentTableEl.querySelectorAll('tr')) as HTMLElement[]
    if (rows.length > 0 && tablePos >= 0) {
      const rowItems: GripItem[] = rows.map((row, idx) => {
        const firstCell = row.firstElementChild as HTMLElement | null
        const rr = (firstCell || row).getBoundingClientRect()
        let rowCellPos = -1
        try {
          if (firstCell) {
            rowCellPos = editor.view.posAtDOM(firstCell, 0)
          }
        } catch {
          rowCellPos = -1
        }
        return {
          index: idx,
          top: rr.top,
          left: rr.left,
          width: rr.width,
          height: rr.height,
          pos: rowCellPos,
        }
      })
      setRowGrips(rowItems)
    }
  }, [currentTableEl, editor])

  useEffect(() => {
    if (!editor?.view?.dom) return

    const editorDom = editor.view.dom

    const handleMouseMove = (e: MouseEvent) => {
      if (editor.view?.dragging || document.querySelector('[data-dragging="true"]')) {
        setTableRect(null)
        setIsHovered(false)
        return
      }

      const target = e.target as HTMLElement | null
      const table = target?.closest('table') as HTMLTableElement | null

      if (table && editorDom.contains(table)) {
        clearHoverTimer()
        setCurrentTableEl(table)
        setIsHovered(true)
        return
      }

      const buttonsContainer = document.getElementById('table-add-buttons-portal')
      if (buttonsContainer && buttonsContainer.contains(target)) {
        clearHoverTimer()
        setIsHovered(true)
        return
      }

      // Check proximity to current table (buffer of 35px)
      if (currentTableEl && tableRect) {
        const buffer = 35
        const inBuffer =
          e.clientX >= tableRect.left - buffer &&
          e.clientX <= tableRect.right + buffer &&
          e.clientY >= tableRect.top - buffer &&
          e.clientY <= tableRect.bottom + buffer

        if (inBuffer) {
          clearHoverTimer()
          setIsHovered(true)
          return
        }
      }

      // Delay hiding by 300ms to allow smooth mouse transit to '+' bars
      if (!hoverTimerRef.current) {
        hoverTimerRef.current = setTimeout(() => {
          setIsHovered(false)
          hoverTimerRef.current = null
        }, 300)
      }
    }

    const handleMouseLeave = () => {
      clearHoverTimer()
      hoverTimerRef.current = setTimeout(() => {
        setIsHovered(false)
        hoverTimerRef.current = null
      }, 300)
    }

    editorDom.addEventListener('mousemove', handleMouseMove, { passive: true })
    editorDom.addEventListener('mouseleave', handleMouseLeave, { passive: true })
    window.addEventListener('scroll', updateTableRect, { passive: true, capture: true })
    window.addEventListener('resize', updateTableRect, { passive: true })

    return () => {
      clearHoverTimer()
      editorDom.removeEventListener('mousemove', handleMouseMove)
      editorDom.removeEventListener('mouseleave', handleMouseLeave)
      window.removeEventListener('scroll', updateTableRect, { capture: true })
      window.removeEventListener('resize', updateTableRect)
    }
  }, [editor, currentTableEl, tableRect, updateTableRect])

  useEffect(() => {
    updateTableRect()
  }, [currentTableEl, updateTableRect])

  const onSelectColumn = useCallback(
    (colIdx: number) => (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (!tableRect || tableRect.pos < 0) return

      try {
        const tableNode = editor.state.doc.nodeAt(tableRect.pos)
        if (!tableNode) return
        const map = TableMap.get(tableNode)
        const anchorCellPos = tableRect.pos + 1 + map.map[colIdx]
        const headCellPos = tableRect.pos + 1 + map.map[(map.height - 1) * map.width + colIdx]

        const $anchor = editor.state.doc.resolve(anchorCellPos)
        const $head = editor.state.doc.resolve(headCellPos)
        const selection = new CellSelection($anchor, $head)
        editor.view.dispatch(editor.state.tr.setSelection(selection))
        editor.view.focus()
      } catch (err) {
        console.error('Error selecting column:', err)
      }
    },
    [editor, tableRect],
  )

  const onSelectRow = useCallback(
    (rowIdx: number) => (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (!tableRect || tableRect.pos < 0) return

      try {
        const tableNode = editor.state.doc.nodeAt(tableRect.pos)
        if (!tableNode) return
        const map = TableMap.get(tableNode)
        const anchorCellPos = tableRect.pos + 1 + map.map[rowIdx * map.width]
        const headCellPos = tableRect.pos + 1 + map.map[rowIdx * map.width + (map.width - 1)]

        const $anchor = editor.state.doc.resolve(anchorCellPos)
        const $head = editor.state.doc.resolve(headCellPos)
        const selection = new CellSelection($anchor, $head)
        editor.view.dispatch(editor.state.tr.setSelection(selection))
        editor.view.focus()
      } catch (err) {
        console.error('Error selecting row:', err)
      }
    },
    [editor, tableRect],
  )

  const onAddColumnAtEnd = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (!tableRect || tableRect.pos < 0) {
        editor.chain().focus().addColumnAfter().run()
        return
      }
      try {
        const tableNode = editor.state.doc.nodeAt(tableRect.pos)
        if (tableNode) {
          const map = TableMap.get(tableNode)
          const lastColCellPos = tableRect.pos + 1 + map.map[map.width - 1]
          editor.chain().focus().setTextSelection(lastColCellPos + 1).addColumnAfter().run()
          setTimeout(updateTableRect, 50)
          return
        }
      } catch {
        // Fallback
      }
      editor.chain().focus().addColumnAfter().run()
      setTimeout(updateTableRect, 50)
    },
    [editor, tableRect, updateTableRect],
  )

  const onAddRowAtEnd = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (!tableRect || tableRect.pos < 0) {
        editor.chain().focus().addRowAfter().run()
        return
      }
      try {
        const tableNode = editor.state.doc.nodeAt(tableRect.pos)
        if (tableNode) {
          const map = TableMap.get(tableNode)
          const lastRowCellPos = tableRect.pos + 1 + map.map[(map.height - 1) * map.width]
          editor.chain().focus().setTextSelection(lastRowCellPos + 1).addRowAfter().run()
          setTimeout(updateTableRect, 50)
          return
        }
      } catch {
        // Fallback
      }
      editor.chain().focus().addRowAfter().run()
      setTimeout(updateTableRect, 50)
    },
    [editor, tableRect, updateTableRect],
  )

  if (!tableRect || !isHovered || !editor.isEditable) {
    return null
  }

  if (typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div id="table-add-buttons-portal" className="pointer-events-auto">
      {/* 1. Top Column Grips (···) */}
      {columnGrips.map(col => (
        <button
          key={`col-grip-${col.index}`}
          type="button"
          onClick={onSelectColumn(col.index)}
          className="fixed z-30 w-7 h-3.5 -mt-3.5 rounded-t-md bg-white/90 dark:bg-[#202020]/90 backdrop-blur-md border-t border-x border-black/10 dark:border-white/15 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all flex items-center justify-center p-0 shadow-sm cursor-pointer"
          style={{
            top: col.top,
            left: col.left + col.width / 2 - 14,
          }}
          title={`Select column ${col.index + 1}`}
        >
          <div className="flex items-center gap-0.5">
            <span className="w-1 h-1 rounded-full bg-current opacity-70" />
            <span className="w-1 h-1 rounded-full bg-current opacity-70" />
            <span className="w-1 h-1 rounded-full bg-current opacity-70" />
          </div>
        </button>
      ))}

      {/* 2. Left Row Grips (⋮) */}
      {rowGrips.map(row => (
        <button
          key={`row-grip-${row.index}`}
          type="button"
          onClick={onSelectRow(row.index)}
          className="fixed z-30 w-3.5 h-7 -ml-3.5 rounded-l-md bg-white/90 dark:bg-[#202020]/90 backdrop-blur-md border-l border-y border-black/10 dark:border-white/15 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all flex items-center justify-center p-0 shadow-sm cursor-pointer"
          style={{
            top: row.top + row.height / 2 - 14,
            left: row.left,
          }}
          title={`Select row ${row.index + 1}`}
        >
          <div className="flex flex-col items-center gap-0.5">
            <span className="w-1 h-1 rounded-full bg-current opacity-70" />
            <span className="w-1 h-1 rounded-full bg-current opacity-70" />
            <span className="w-1 h-1 rounded-full bg-current opacity-70" />
          </div>
        </button>
      ))}

      {/* 3. Right Column Add Bar: Vertical bar along table right edge with persistent hover buffer */}
      <div
        className="fixed z-20 flex items-center justify-center transition-all duration-150 rounded-r cursor-pointer group hover:bg-black/5 dark:hover:bg-white/10"
        style={{
          top: tableRect.top,
          left: tableRect.right + 2,
          height: tableRect.height,
          width: 16,
        }}
        onClick={onAddColumnAtEnd}
        onMouseEnter={() => {
          clearHoverTimer()
          setIsHovered(true)
        }}
        title="Add column at end"
        aria-label="Add column at end"
      >
        <div className="w-3.5 h-7 rounded-full bg-white/90 dark:bg-[#202020]/90 backdrop-blur-md group-hover:bg-blue-500 group-hover:text-white dark:group-hover:bg-blue-500 dark:group-hover:text-white border border-black/10 dark:border-white/15 text-zinc-500 dark:text-zinc-400 flex items-center justify-center transition-all shadow-md">
          <Icon name="Plus" className="w-2.5 h-2.5 stroke-[2.5]" />
        </div>
      </div>

      {/* 4. Bottom Row Add Bar: Horizontal bar along table bottom edge with persistent hover buffer */}
      <div
        className="fixed z-20 flex items-center justify-center transition-all duration-150 rounded-b cursor-pointer group hover:bg-black/5 dark:hover:bg-white/10"
        style={{
          top: tableRect.bottom + 2,
          left: tableRect.left,
          width: tableRect.width,
          height: 16,
        }}
        onClick={onAddRowAtEnd}
        onMouseEnter={() => {
          clearHoverTimer()
          setIsHovered(true)
        }}
        title="Add row at end"
        aria-label="Add row at end"
      >
        <div className="h-3.5 w-7 rounded-full bg-white/90 dark:bg-[#202020]/90 backdrop-blur-md group-hover:bg-blue-500 group-hover:text-white dark:group-hover:bg-blue-500 dark:group-hover:text-white border border-black/10 dark:border-white/15 text-zinc-500 dark:text-zinc-400 flex items-center justify-center transition-all shadow-md">
          <Icon name="Plus" className="w-2.5 h-2.5 stroke-[2.5]" />
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default TableAddButtons
