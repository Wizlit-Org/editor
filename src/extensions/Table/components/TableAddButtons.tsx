import React, { useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { Editor } from '@tiptap/react'
import { TextSelection } from '@tiptap/pm/state'
import { useTableGrips } from '../hooks/useTableGrips'
import { TableAddBar } from './TableAddBar'
import { moveTableColumn, moveTableRow, getMergedColRange, getMergedRowRange } from '../utils/TableDndUtils'
import { findTable, isCellSelection } from '../utils'
import { findSafeDropIndex, selectColRange, selectRowRange, focusTableGrip } from '../utils/TableClusterUtils'

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
    isScrolling,
    setIsHovered,
    clearHoverTimer,
    updateTableRect,
  } = useTableGrips(editor)

  const [dragIndicator, setDragIndicator] = useState<{ type: 'col' | 'row'; left: number; top: number; width: number; height: number } | null>(null)
  const [draggingSource, setDraggingSource] = useState<{ type: 'col' | 'row'; left: number; top: number; width: number; height: number } | null>(null)
  const [dragGhost, setDragGhost] = useState<{ type: 'col' | 'row'; index: number; label: string; x: number; y: number } | null>(null)
  const [resizingGuideX, setResizingGuideX] = useState<number | null>(null)

  // Listen to mouse events for column resizing to show full-height vertical indigo guide
  React.useEffect(() => {
    const dom = editor.view?.dom
    if (!dom) return
    let activeCleanup: (() => void) | null = null

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (!target) return
      const handleEl = target.closest('.column-resize-handle') as HTMLElement | null
      const cellEl = target.closest('td, th') as HTMLElement | null

      let isResizeStart = false
      if (handleEl) {
        isResizeStart = true
      } else if (cellEl) {
        const rect = cellEl.getBoundingClientRect()
        if (Math.abs(e.clientX - rect.right) <= 8) isResizeStart = true
      }

      if (isResizeStart && currentTableEl) {
        currentTableEl.classList.add('resizing')
        setResizingGuideX(e.clientX)
        const onMouseMove = (moveEvt: MouseEvent) => setResizingGuideX(moveEvt.clientX)
        const onMouseUp = () => {
          window.removeEventListener('mousemove', onMouseMove)
          window.removeEventListener('mouseup', onMouseUp)
          if (currentTableEl) currentTableEl.classList.remove('resizing')
          setResizingGuideX(null)
          setTimeout(updateTableRect, 50)
        }

        window.addEventListener('mousemove', onMouseMove)
        window.addEventListener('mouseup', onMouseUp)
        activeCleanup = () => {
          window.removeEventListener('mousemove', onMouseMove)
          window.removeEventListener('mouseup', onMouseUp)
          if (currentTableEl) currentTableEl.classList.remove('resizing')
        }
      }
    }

    dom.addEventListener('mousedown', handleMouseDown)
    return () => {
      dom.removeEventListener('mousedown', handleMouseDown)
      if (activeCleanup) activeCleanup()
    }
  }, [editor, currentTableEl, updateTableRect])

  const onSelectGrip = useCallback(
    (type: 'col' | 'row', index: number) => (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      window.dispatchEvent(new CustomEvent('tiptap:reset-scroll-lock'))
      focusTableGrip(editor, type, index, currentTableEl, tableRect?.pos ?? -1)
    },
    [editor, currentTableEl, tableRect],
  )

  const handleGripMouseDown = useCallback(
    (type: 'col' | 'row', index: number) => (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      window.dispatchEvent(new CustomEvent('tiptap:reset-scroll-lock'))
      if (!tableRect || tableRect.pos < 0) return

      const startX = e.clientX
      const startY = e.clientY
      let isDragging = false
      let pendingTargetIdx = -1

      const tableNode = editor.state.doc.nodeAt(tableRect.pos)
      const colBundle = type === 'col' && tableNode ? getMergedColRange(tableNode, index) : { start: index, count: 1 }
      const rowBundle = type === 'row' && tableNode ? getMergedRowRange(tableNode, index) : { start: index, count: 1 }

      // Check if clicked grip is already inside current selection
      let isGripSelected = false
      const { selection } = editor.state
      if (isCellSelection(selection) && tableNode) {
        try {
          const map = TableMap.get(tableNode)
          const start = selection.$anchorCell.start(-1)
          const rect = map.rectBetween(selection.$anchorCell.pos - start, selection.$headCell.pos - start)
          if (type === 'col') {
            isGripSelected = rect.bottom - rect.top === map.height && rect.left <= index && index < rect.right
          } else {
            isGripSelected = rect.right - rect.left === map.width && rect.top <= index && index < rect.bottom
          }
        } catch {}
      }

      const onMouseMove = (moveEvent: MouseEvent) => {
        const dist = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY)
        if (dist > 4) {
          isDragging = true

          // Case A: Unselected grip drag -> real-time multi-range selection
          if (!isGripSelected && tableNode) {
            document.body.style.cursor = 'cell'
            if (type === 'col') {
              let hoverCol = columnGrips.find(g => moveEvent.clientX >= g.left && moveEvent.clientX <= g.left + g.width)
              if (!hoverCol && columnGrips.length > 0) {
                hoverCol = moveEvent.clientX < columnGrips[0].left ? columnGrips[0] : columnGrips[columnGrips.length - 1]
              }
              if (hoverCol) {
                const minC = Math.min(index, hoverCol.index)
                const maxC = Math.max(index, hoverCol.index)
                const tr = selectColRange(editor.state.tr, minC, maxC)
                editor.view.dispatch(tr)
              }
            } else {
              let hoverRow = rowGrips.find(g => moveEvent.clientY >= g.top && moveEvent.clientY <= g.top + g.height)
              if (!hoverRow && rowGrips.length > 0) {
                hoverRow = moveEvent.clientY < rowGrips[0].top ? rowGrips[0] : rowGrips[rowGrips.length - 1]
              }
              if (hoverRow) {
                const minR = Math.min(index, hoverRow.index)
                const maxR = Math.max(index, hoverRow.index)
                const tr = selectRowRange(editor.state.tr, minR, maxR)
                editor.view.dispatch(tr)
              }
            }
            return
          }

          // Case B: Already selected grip drag -> move entire bundle
          document.body.style.cursor = type === 'col' ? 'col-resize' : 'row-resize'

          if (type === 'col') {
            const startGrip = columnGrips[colBundle.start]
            const endGrip = columnGrips[colBundle.start + colBundle.count - 1]
            if (startGrip && endGrip) {
              setDraggingSource({
                type: 'col',
                left: startGrip.left,
                top: tableRect.top,
                width: endGrip.left + endGrip.width - startGrip.left,
                height: tableRect.height,
              })
            }
            const label = colBundle.count > 1 ? `Columns ${colBundle.start + 1}-${colBundle.start + colBundle.count}` : `Column ${index + 1}`
            setDragGhost({ type, index, label, x: moveEvent.clientX, y: moveEvent.clientY })

            let bestCol = columnGrips.find(g => moveEvent.clientX >= g.left && moveEvent.clientX <= g.left + g.width)
            if (!bestCol && columnGrips.length > 0) {
              bestCol = moveEvent.clientX < columnGrips[0].left ? columnGrips[0] : columnGrips[columnGrips.length - 1]
            }
            if (bestCol && tableNode) {
              const isRightSide = moveEvent.clientX > bestCol.left + bestCol.width / 2
              let targetIdx = isRightSide
                ? (index < bestCol.index ? bestCol.index : Math.min(columnGrips.length - 1, bestCol.index + 1))
                : (index < bestCol.index ? Math.max(0, bestCol.index - 1) : bestCol.index)

              // Snap to safe cluster boundary
              targetIdx = findSafeDropIndex(tableNode, 'col', targetIdx)
              pendingTargetIdx = targetIdx

              const targetGrip = columnGrips[targetIdx]
              const lineX = targetGrip ? (isRightSide ? targetGrip.left + targetGrip.width : targetGrip.left) : (isRightSide ? bestCol.left + bestCol.width : bestCol.left)
              setDragIndicator({ type: 'col', left: lineX - 1.5, top: tableRect.top, width: 3, height: tableRect.height })
            } else {
              setDragIndicator(null)
              pendingTargetIdx = -1
            }
          } else {
            const startGrip = rowGrips[rowBundle.start]
            const endGrip = rowGrips[rowBundle.start + rowBundle.count - 1]
            if (startGrip && endGrip) {
              setDraggingSource({
                type: 'row',
                left: tableRect.left,
                top: startGrip.top,
                width: tableRect.width,
                height: endGrip.top + endGrip.height - startGrip.top,
              })
            }
            const label = rowBundle.count > 1 ? `Rows ${rowBundle.start + 1}-${rowBundle.start + rowBundle.count}` : `Row ${index + 1}`
            setDragGhost({ type, index, label, x: moveEvent.clientX, y: moveEvent.clientY })

            let bestRow = rowGrips.find(g => moveEvent.clientY >= g.top && moveEvent.clientY <= g.top + g.height)
            if (!bestRow && rowGrips.length > 0) {
              bestRow = moveEvent.clientY < rowGrips[0].top ? rowGrips[0] : rowGrips[rowGrips.length - 1]
            }
            if (bestRow && tableNode) {
              const isBottomSide = moveEvent.clientY > bestRow.top + bestRow.height / 2
              let targetIdx = isBottomSide
                ? (index < bestRow.index ? bestRow.index : Math.min(rowGrips.length - 1, bestRow.index + 1))
                : (index < bestRow.index ? Math.max(0, bestRow.index - 1) : bestRow.index)

              // Snap to safe cluster boundary
              targetIdx = findSafeDropIndex(tableNode, 'row', targetIdx)
              pendingTargetIdx = targetIdx

              const targetGrip = rowGrips[targetIdx]
              const lineY = targetGrip ? (isBottomSide ? targetGrip.top + targetGrip.height : targetGrip.top) : (isBottomSide ? bestRow.top + bestRow.height : bestRow.top)
              setDragIndicator({ type: 'row', left: tableRect.left, top: lineY - 1.5, width: tableRect.width, height: 3 })
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
        setDraggingSource(null)
        setDragGhost(null)

        if (isDragging) {
          if (isGripSelected && pendingTargetIdx >= 0 && pendingTargetIdx !== index) {
            if (type === 'col') {
              moveTableColumn(editor, tableRect.pos, index, pendingTargetIdx)
            } else {
              moveTableRow(editor, tableRect.pos, index, pendingTargetIdx)
            }
            setTimeout(updateTableRect, 50)
          }
          window.dispatchEvent(new CustomEvent('tiptap:reset-scroll-lock'))
        } else {
          // Click action: select row/col if not selected, or keep selection and trigger menu
          if (!isGripSelected) {
            onSelectGrip(type, index)(e)
          } else {
            window.dispatchEvent(new CustomEvent('tiptap:reset-scroll-lock'))
          }
        }
      }

      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    },
    [editor, tableRect, columnGrips, rowGrips, updateTableRect, onSelectGrip],
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

  if (!tableRect || !isHovered || !editor.isEditable || isScrolling) {
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

      {/* 4. Drag Cursor-Following Ghost Preview Badge */}
      {dragGhost && (
        <div
          className="fixed pointer-events-none z-[1450] flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900/95 dark:bg-zinc-100/95 text-white dark:text-zinc-900 text-xs font-semibold shadow-2xl backdrop-blur-md -translate-x-1/2 -translate-y-9 select-none animate-in fade-in-0 zoom-in-95 duration-75"
          style={{ left: dragGhost.x, top: dragGhost.y }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 dark:bg-violet-500 animate-pulse" />
          <span>{dragGhost.label}</span>
        </div>
      )}

      {/* 5. Drag Source Highlight Overlay (dashed border + translucent fill) */}
      {draggingSource && (
        <div
          className="fixed pointer-events-none bg-indigo-500/15 dark:bg-violet-500/20 border-2 border-dashed border-indigo-500/70 dark:border-violet-400/70 z-[1390] rounded transition-all duration-75"
          style={{
            left: draggingSource.left,
            top: draggingSource.top,
            width: draggingSource.width,
            height: draggingSource.height,
          }}
        />
      )}

      {/* 5. Drag Drop Position Indicator Guide Bar */}
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

      {/* 6. Real-time Column Resizing Full-Height Vertical Guide Line */}
      {resizingGuideX !== null && (
        <div
          className="fixed pointer-events-none bg-indigo-500 dark:bg-violet-400 z-[1400] shadow-[0_0_10px_rgba(99,102,241,0.95)] rounded-full transition-none"
          style={{
            left: resizingGuideX - 1.5,
            top: tableRect.top,
            width: 3,
            height: tableRect.height,
          }}
        />
      )}
    </div>,
    (appendTo?.current as HTMLElement) || (typeof document !== 'undefined' ? document.body : (null as any)),
  )
}

export default TableAddButtons
