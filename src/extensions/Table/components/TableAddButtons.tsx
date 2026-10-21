import React, { useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Editor } from '@tiptap/react'
import { CellSelection, TableMap } from '@tiptap/pm/tables'
import { useTableGrips } from '../hooks/useTableGrips'
import { TableAddBar } from './TableAddBar'
import { moveTableColumn, moveTableRow } from '../utils/TableDndUtils'

export interface TableAddButtonsProps {
  editor: Editor
}

export const TableAddButtons: React.FC<TableAddButtonsProps> = ({ editor }) => {
  const {
    tableRect,
    columnGrips,
    rowGrips,
    hoveredColIndex,
    hoveredRowIndex,
    isHovered,
    setIsHovered,
    clearHoverTimer,
    updateTableRect,
  } = useTableGrips(editor)

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

  const handleGripMouseDown = useCallback(
    (type: 'col' | 'row', index: number) => (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (!tableRect || tableRect.pos < 0) return

      const startX = e.clientX
      const startY = e.clientY
      let isDragging = false

      const onMouseMove = (moveEvent: MouseEvent) => {
        const dist = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY)
        if (dist > 3) {
          isDragging = true
          document.body.style.cursor = type === 'col' ? 'col-resize' : 'row-resize'
        }
      }

      const onMouseUp = (upEvent: MouseEvent) => {
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', onMouseUp)
        document.body.style.cursor = ''

        if (isDragging) {
          if (type === 'col') {
            const targetCol = columnGrips.find(
              g => upEvent.clientX >= g.left && upEvent.clientX <= g.left + g.width,
            )
            if (targetCol && targetCol.index !== index) {
              moveTableColumn(editor, tableRect.pos, index, targetCol.index)
              setTimeout(updateTableRect, 50)
              return
            }
          } else {
            const targetRow = rowGrips.find(
              g => upEvent.clientY >= g.top && upEvent.clientY <= g.top + g.height,
            )
            if (targetRow && targetRow.index !== index) {
              moveTableRow(editor, tableRect.pos, index, targetRow.index)
              setTimeout(updateTableRect, 50)
              return
            }
          }
        } else {
          if (type === 'col') {
            onSelectColumn(index)(e)
          } else {
            onSelectRow(index)(e)
          }
        }
      }

      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    },
    [editor, tableRect, columnGrips, rowGrips, updateTableRect, onSelectColumn, onSelectRow],
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

  // Render ONLY the single hovered column and row (Notion official spec)
  const activeColGrip = hoveredColIndex !== null ? columnGrips[hoveredColIndex] : null
  const activeRowGrip = hoveredRowIndex !== null ? rowGrips[hoveredRowIndex] : null

  return createPortal(
    <div id="table-add-buttons-portal" className="pointer-events-auto" style={{ zIndex: 1400, position: 'relative' }}>
      {/* 1. Single Top Column Grip Bar: Full column width 12px glass pill */}
      {activeColGrip && (
        <button
          key={`active-col-grip-${activeColGrip.index}`}
          type="button"
          onMouseDown={handleGripMouseDown('col', activeColGrip.index)}
          className="fixed z-[1400] h-[12px] rounded-full bg-zinc-500/15 hover:bg-zinc-500/25 active:bg-indigo-600/90 dark:bg-white/10 dark:hover:bg-white/20 dark:active:bg-violet-500/90 backdrop-blur-md border border-black/[0.06] dark:border-white/10 text-zinc-500 dark:text-zinc-300 active:text-white shadow-2xs transition-all flex items-center justify-center p-0 cursor-pointer select-none"
          style={{
            top: tableRect.top - 15,
            left: activeColGrip.left,
            width: activeColGrip.width,
            zIndex: 1400,
          }}
          title={`Click to select, drag to move column ${activeColGrip.index + 1}`}
        >
          <div className="flex items-center gap-0.5">
            <span className="w-1 h-1 rounded-full bg-current opacity-70" />
            <span className="w-1 h-1 rounded-full bg-current opacity-70" />
            <span className="w-1 h-1 rounded-full bg-current opacity-70" />
          </div>
        </button>
      )}

      {/* 2. Single Left Row Grip Bar: Full row height 12px glass pill */}
      {activeRowGrip && (
        <button
          key={`active-row-grip-${activeRowGrip.index}`}
          type="button"
          onMouseDown={handleGripMouseDown('row', activeRowGrip.index)}
          className="fixed z-[1400] w-[12px] rounded-full bg-zinc-500/15 hover:bg-zinc-500/25 active:bg-indigo-600/90 dark:bg-white/10 dark:hover:bg-white/20 dark:active:bg-violet-500/90 backdrop-blur-md border border-black/[0.06] dark:border-white/10 text-zinc-500 dark:text-zinc-300 active:text-white shadow-2xs transition-all flex items-center justify-center p-0 cursor-pointer select-none"
          style={{
            top: activeRowGrip.top,
            left: tableRect.left - 15,
            height: activeRowGrip.height,
            zIndex: 1400,
          }}
          title={`Click to select, drag to move row ${activeRowGrip.index + 1}`}
        >
          <div className="flex flex-col items-center gap-0.5">
            <span className="w-1 h-1 rounded-full bg-current opacity-70" />
            <span className="w-1 h-1 rounded-full bg-current opacity-70" />
            <span className="w-1 h-1 rounded-full bg-current opacity-70" />
          </div>
        </button>
      )}

      {/* 3. Full-length Right Column & Bottom Row Add Bars */}
      <TableAddBar
        tableRect={tableRect}
        onAddColumn={onAddColumnAtEnd}
        onAddRow={onAddRowAtEnd}
        onHoverKeepAlive={() => {
          clearHoverTimer()
          setIsHovered(true)
        }}
      />
    </div>,
    document.body,
  )
}

export default TableAddButtons
