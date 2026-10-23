import React, { useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { Editor } from '@tiptap/react'
import { TextSelection } from '@tiptap/pm/state'
import { useTableGrips } from '../hooks/useTableGrips'
import { TableAddBar } from './TableAddBar'
import { moveTableColumn, moveTableRow } from '../utils/TableDndUtils'
import { selectColumn, selectRow, findTable } from '../utils'

export interface TableAddButtonsProps {
  editor: Editor
  appendTo?: React.RefObject<HTMLElement | null>
}

export const TableAddButtons: React.FC<TableAddButtonsProps> = ({ editor, appendTo }) => {
  const {
    tableRect,
    currentTableEl,
    columnGrips,
    rowGrips,
    hoveredColIndex,
    hoveredRowIndex,
    showRightAddBar,
    showBottomAddBar,
    isHovered,
    setIsHovered,
    clearHoverTimer,
    updateTableRect,
  } = useTableGrips(editor)

  const [dragIndicator, setDragIndicator] = useState<{
    type: 'col' | 'row'
    left: number
    top: number
    width: number
    height: number
  } | null>(null)

  const onSelectColumn = useCallback(
    (colIdx: number) => (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      window.dispatchEvent(new CustomEvent('tiptap:reset-scroll-lock'))

      try {
        let tr = editor.state.tr
        if (!findTable(tr.selection)) {
          let targetPos = -1
          if (currentTableEl) {
            const firstCell = currentTableEl.querySelector('td, th')
            if (firstCell) {
              targetPos = editor.view.posAtDOM(firstCell, 0)
            }
          }
          if (targetPos < 0 && tableRect && tableRect.pos >= 0) {
            targetPos = tableRect.pos + 2
          }
          if (targetPos >= 0) {
            tr = tr.setSelection(TextSelection.near(tr.doc.resolve(targetPos)))
          }
        }

        const newTr = selectColumn(colIdx)(tr)
        editor.view.dispatch(newTr)
        editor.view.dom.focus({ preventScroll: true })
      } catch (err) {
        console.error('Error selecting column:', err)
      }
    },
    [editor, currentTableEl, tableRect],
  )

  const onSelectRow = useCallback(
    (rowIdx: number) => (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      window.dispatchEvent(new CustomEvent('tiptap:reset-scroll-lock'))

      try {
        let tr = editor.state.tr
        if (!findTable(tr.selection)) {
          let targetPos = -1
          if (currentTableEl) {
            const firstCell = currentTableEl.querySelector('td, th')
            if (firstCell) {
              targetPos = editor.view.posAtDOM(firstCell, 0)
            }
          }
          if (targetPos < 0 && tableRect && tableRect.pos >= 0) {
            targetPos = tableRect.pos + 2
          }
          if (targetPos >= 0) {
            tr = tr.setSelection(TextSelection.near(tr.doc.resolve(targetPos)))
          }
        }

        const newTr = selectRow(rowIdx)(tr)
        editor.view.dispatch(newTr)
        editor.view.dom.focus({ preventScroll: true })
      } catch (err) {
        console.error('Error selecting row:', err)
      }
    },
    [editor, currentTableEl, tableRect],
  )

  const handleGripMouseDown = useCallback(
    (type: 'col' | 'row', index: number) => (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      window.dispatchEvent(new CustomEvent('tiptap:reset-scroll-lock'))
      if (!tableRect || tableRect.pos < 0) return

      // Header row (index 0) or header column (index 0) cannot be dragged or moved
      if (index === 0) {
        if (type === 'col') onSelectColumn(index)(e)
        else onSelectRow(index)(e)
        return
      }

      const startX = e.clientX
      const startY = e.clientY
      let isDragging = false
      let pendingTargetIdx = -1

      const onMouseMove = (moveEvent: MouseEvent) => {
        const dist = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY)
        if (dist > 4) {
          isDragging = true
          document.body.style.cursor = type === 'col' ? 'col-resize' : 'row-resize'

          if (type === 'col') {
            // Find target column index (must be >= 1, cannot move to or replace header column)
            let bestCol = columnGrips.find(
              g => moveEvent.clientX >= g.left && moveEvent.clientX <= g.left + g.width,
            )
            if (!bestCol && columnGrips.length > 0) {
              if (moveEvent.clientX < columnGrips[1]?.left) {
                bestCol = columnGrips[1]
              } else if (moveEvent.clientX > columnGrips[columnGrips.length - 1].left + columnGrips[columnGrips.length - 1].width) {
                bestCol = columnGrips[columnGrips.length - 1]
              }
            }

            if (bestCol && bestCol.index >= 1) {
              const isRightSide = moveEvent.clientX > bestCol.left + bestCol.width / 2
              const targetIdx = isRightSide ? bestCol.index : Math.max(1, bestCol.index)
              pendingTargetIdx = targetIdx

              const lineX = isRightSide ? bestCol.left + bestCol.width : bestCol.left
              setDragIndicator({
                type: 'col',
                left: lineX - 1.5,
                top: tableRect.top,
                width: 3,
                height: tableRect.height,
              })
            } else {
              setDragIndicator(null)
              pendingTargetIdx = -1
            }
          } else {
            // Find target row index (must be >= 1, cannot move to or replace header row)
            let bestRow = rowGrips.find(
              g => moveEvent.clientY >= g.top && moveEvent.clientY <= g.top + g.height,
            )
            if (!bestRow && rowGrips.length > 0) {
              if (moveEvent.clientY < rowGrips[1]?.top) {
                bestRow = rowGrips[1]
              } else if (moveEvent.clientY > rowGrips[rowGrips.length - 1].top + rowGrips[rowGrips.length - 1].height) {
                bestRow = rowGrips[rowGrips.length - 1]
              }
            }

            if (bestRow && bestRow.index >= 1) {
              const isBottomSide = moveEvent.clientY > bestRow.top + bestRow.height / 2
              const targetIdx = isBottomSide ? bestRow.index : Math.max(1, bestRow.index)
              pendingTargetIdx = targetIdx

              const lineY = isBottomSide ? bestRow.top + bestRow.height : bestRow.top
              setDragIndicator({
                type: 'row',
                left: tableRect.left,
                top: lineY - 1.5,
                width: tableRect.width,
                height: 3,
              })
            } else {
              setDragIndicator(null)
              pendingTargetIdx = -1
            }
          }
        }
      }

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', onMouseUp)
        document.body.style.cursor = ''
        setDragIndicator(null)

        if (isDragging && pendingTargetIdx >= 1 && pendingTargetIdx !== index) {
          if (type === 'col') {
            moveTableColumn(editor, tableRect.pos, index, pendingTargetIdx)
            setTimeout(updateTableRect, 50)
          } else {
            moveTableRow(editor, tableRect.pos, index, pendingTargetIdx)
            setTimeout(updateTableRect, 50)
          }
        } else if (!isDragging) {
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

  // Additional safety: evaluate last column/row directly during render with latest state
  const isLastColHovered = hoveredColIndex !== null && columnGrips.length > 0 && hoveredColIndex === columnGrips.length - 1
  const isLastRowHovered = hoveredRowIndex !== null && rowGrips.length > 0 && hoveredRowIndex === rowGrips.length - 1

  // Clip column grip if scrolled outside visible tableWrapper
  const isColGripVisible =
    activeColGrip &&
    (!tableRect.wrapperLeft ||
      (activeColGrip.left + activeColGrip.width > tableRect.wrapperLeft &&
        activeColGrip.left < (tableRect.wrapperRight ?? Infinity)))

  return createPortal(
    <div id="table-add-buttons-portal" className="pointer-events-auto" style={{ zIndex: 30, position: 'relative' }}>
      {/* 1. Single Top Column Grip Bar: Full column width 12px glass pill */}
      {activeColGrip && isColGripVisible && (
        <button
          key={`active-col-grip-${activeColGrip.index}`}
          type="button"
          onMouseDown={handleGripMouseDown('col', activeColGrip.index)}
          className="fixed z-[30] h-[12px] rounded-full bg-zinc-500/15 hover:bg-zinc-500/25 active:bg-indigo-600/90 dark:bg-white/10 dark:hover:bg-white/20 dark:active:bg-violet-500/90 backdrop-blur-md border border-black/[0.06] dark:border-white/10 text-zinc-500 dark:text-zinc-300 active:text-white shadow-2xs transition-all flex items-center justify-center p-0 cursor-pointer select-none"
          style={{
            top: tableRect.top - 15,
            left: activeColGrip.left,
            width: activeColGrip.width,
            zIndex: 30,
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
          className="fixed z-[30] w-[12px] rounded-full bg-zinc-500/15 hover:bg-zinc-500/25 active:bg-indigo-600/90 dark:bg-white/10 dark:hover:bg-white/20 dark:active:bg-violet-500/90 backdrop-blur-md border border-black/[0.06] dark:border-white/10 text-zinc-500 dark:text-zinc-300 active:text-white shadow-2xs transition-all flex items-center justify-center p-0 cursor-pointer select-none"
          style={{
            top: activeRowGrip.top,
            left: tableRect.left - 15,
            height: activeRowGrip.height,
            zIndex: 30,
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

      {/* 3. Right Column & Bottom Row Add Buttons: Sized to hovered row/col */}
      <TableAddBar
        tableRect={tableRect}
        activeRowRect={activeRowGrip ? { top: activeRowGrip.top, height: activeRowGrip.height } : null}
        activeColRect={activeColGrip ? { left: activeColGrip.left, width: activeColGrip.width } : null}
        showRightBar={showRightAddBar || isLastColHovered}
        showBottomBar={showBottomAddBar || isLastRowHovered}
        onAddColumn={onAddColumnAtEnd}
        onAddRow={onAddRowAtEnd}
        onHoverKeepAlive={() => {
          clearHoverTimer()
          setIsHovered(true)
        }}
      />

      {/* 4. Drag Drop Position Indicator Guide Bar */}
      {dragIndicator && (
        <div
          className="fixed pointer-events-none bg-indigo-500 dark:bg-violet-400 z-[1400] shadow-[0_0_10px_rgba(99,102,241,0.9)] rounded-full transition-all duration-75"
          style={{
            left: dragIndicator.left,
            top: dragIndicator.top,
            width: dragIndicator.width,
            height: dragIndicator.height,
          }}
        />
      )}
    </div>,
    (appendTo?.current as HTMLElement) || (typeof document !== 'undefined' ? document.body : (null as any)),
  )
}

export default TableAddButtons
