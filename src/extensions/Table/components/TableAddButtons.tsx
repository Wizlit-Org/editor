import React, { useCallback, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Editor } from '@tiptap/react'
import { TableMap } from '@tiptap/pm/tables'
import { useTableGrips } from '../hooks/useTableGrips'
import { TableAddBar } from './TableAddBar'
import { TableDragOverlays, DragGhostData, DragIndicatorData } from './TableDragOverlays'
import { moveTableColumn, moveTableRow } from '../utils/TableDndUtils'
import { isCellSelection } from '../utils'
import { selectColRange, selectRowRange, focusTableGrip, isGripInCurrentSelection } from '../utils/TableClusterUtils'
import { hasMergedCellsInRowSelection, hasMergedCellsInColSelection, isHeaderStraddling } from '../utils/TableHeaderStraddleUtils'

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

  const [dragIndicator, setDragIndicator] = useState<DragIndicatorData | null>(null)
  const [dragGhost, setDragGhost] = useState<DragGhostData | null>(null)
  const [resizingGuideX, setResizingGuideX] = useState<number | null>(null)

  // Listen to mouse events for column resizing to show full-height vertical guide
  useEffect(() => {
    const dom = editor.view?.dom
    if (!dom) return
    let activeCleanup: (() => void) | null = null

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (!target?.closest) return
      const handleEl = target.closest('.column-resize-handle') as HTMLElement | null
      const cellEl = target.closest('td, th') as HTMLElement | null
      const isResize = handleEl || (cellEl && Math.abs(e.clientX - cellEl.getBoundingClientRect().right) <= 8)

      if (isResize && currentTableEl) {
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

  const handleGripMouseDown = useCallback(
    (type: 'col' | 'row', index: number) => (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (!tableRect || tableRect.pos < 0) return

      const startX = e.clientX
      const startY = e.clientY
      let isDragging = false
      let pendingTargetIdx = -1

      const tableNode = editor.state.doc.nodeAt(tableRect.pos)
      if (!tableNode) return

      const isGripSelected = isGripInCurrentSelection(editor, type, index)

      // Calculate exact selected range [start..end] (AC ②)
      let start = index
      let end = index
      if (isGripSelected && isCellSelection(editor.state.selection)) {
        try {
          const map = TableMap.get(tableNode)
          const selStart = (editor.state.selection as any).$anchorCell.start(-1)
          const selRect = map.rectBetween(
            (editor.state.selection as any).$anchorCell.pos - selStart,
            (editor.state.selection as any).$headCell.pos - selStart,
          )
          if (type === 'col' && selRect.bottom - selRect.top === map.height) {
            start = selRect.left
            end = selRect.right - 1
          } else if (type === 'row' && selRect.right - selRect.left === map.width) {
            start = selRect.top
            end = selRect.bottom - 1
          }
        } catch {}
      }

      // Check if selected range contains any merged cells (AC ②)
      const hasMerged =
        type === 'col'
          ? hasMergedCellsInColSelection(tableNode, start, end)
          : hasMergedCellsInRowSelection(tableNode, start, end)

      const count = end - start + 1

      const cleanUpDrag = () => {
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', onMouseUp)
        window.removeEventListener('keydown', onKeyDown, true)
        document.body.style.cursor = ''
        setDragIndicator(null)
        setDragGhost(null)
      }

      // AC ①: Drag cancellation on Escape key
      const onKeyDown = (keyEvt: KeyboardEvent) => {
        if (keyEvt.key === 'Escape') {
          keyEvt.preventDefault()
          keyEvt.stopPropagation()
          cleanUpDrag()
        }
      }

      const onMouseMove = (moveEvent: MouseEvent) => {
        const dist = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY)
        if (dist > 4) {
          if (!isDragging) {
            window.dispatchEvent(new CustomEvent('tiptap:close-table-menus'))
            isDragging = true
          }

          // Case A: Unselected grip drag -> real-time multi-range selection
          if (!isGripSelected) {
            document.body.style.cursor = 'cell'
            if (type === 'col') {
              let hoverCol = columnGrips.find(g => moveEvent.clientX >= g.left && moveEvent.clientX <= g.left + g.width)
              if (!hoverCol && columnGrips.length > 0) {
                hoverCol = moveEvent.clientX < columnGrips[0].left ? columnGrips[0] : columnGrips[columnGrips.length - 1]
              }
              if (hoverCol) {
                const tr = selectColRange(editor.state.tr, Math.min(index, hoverCol.index), Math.max(index, hoverCol.index))
                editor.view.dispatch(tr)
              }
            } else {
              let hoverRow = rowGrips.find(g => moveEvent.clientY >= g.top && moveEvent.clientY <= g.top + g.height)
              if (!hoverRow && rowGrips.length > 0) {
                hoverRow = moveEvent.clientY < rowGrips[0].top ? rowGrips[0] : rowGrips[rowGrips.length - 1]
              }
              if (hoverRow) {
                const tr = selectRowRange(editor.state.tr, Math.min(index, hoverRow.index), Math.max(index, hoverRow.index))
                editor.view.dispatch(tr)
              }
            }
            return
          }

          // Case B: Selected grip drag -> move
          document.body.style.cursor = hasMerged ? 'not-allowed' : type === 'col' ? 'col-resize' : 'row-resize'

          // AC ②: Moving selection with merged cells is strictly blocked
          if (hasMerged) {
            pendingTargetIdx = -1
            setDragIndicator(null)
            setDragGhost({
              type,
              index,
              label: '이동 불가 (병합 셀 포함)',
              x: moveEvent.clientX,
              y: moveEvent.clientY,
              isBlocked: true,
              targetIdx: -1,
            })
            return
          }

          if (type === 'col') {
            let bestCol = columnGrips.find(g => moveEvent.clientX >= g.left && moveEvent.clientX <= g.left + g.width)
            if (!bestCol && columnGrips.length > 0) {
              bestCol = moveEvent.clientX < columnGrips[0].left ? columnGrips[0] : columnGrips[columnGrips.length - 1]
            }

            if (bestCol) {
              const isRight = moveEvent.clientX > bestCol.left + bestCol.width / 2
              let targetIdx = isRight ? bestCol.index + 1 : bestCol.index
              pendingTargetIdx = targetIdx

              // AC ⑤: Drop at current position or abutting boundary is No-op -> dragIndicator = null
              const isNoOp = pendingTargetIdx >= start && pendingTargetIdx <= end + 1
              const isBlocked = isHeaderStraddling(tableNode, 'col', index, Math.min(columnGrips.length - 1, targetIdx))
              const label = isBlocked ? '헤더 이동 불가' : count > 1 ? `${count}열 이동` : `${index + 1}열 이동`

              setDragGhost({ type, index, label, x: moveEvent.clientX, y: moveEvent.clientY, isBlocked, targetIdx })

              if (isNoOp || isBlocked) {
                setDragIndicator(null)
              } else {
                const lineX = targetIdx < columnGrips.length ? columnGrips[targetIdx].left : columnGrips[columnGrips.length - 1].left + columnGrips[columnGrips.length - 1].width
                setDragIndicator({ type: 'col', left: lineX - 1, top: tableRect.top, width: 2, height: tableRect.height, isBlocked: false })
              }
            } else {
              setDragIndicator(null)
              pendingTargetIdx = -1
            }
          } else {
            // Row
            let bestRow = rowGrips.find(g => moveEvent.clientY >= g.top && moveEvent.clientY <= g.top + g.height)
            if (!bestRow && rowGrips.length > 0) {
              bestRow = moveEvent.clientY < rowGrips[0].top ? rowGrips[0] : rowGrips[rowGrips.length - 1]
            }

            if (bestRow) {
              const isBottom = moveEvent.clientY > bestRow.top + bestRow.height / 2
              let targetIdx = isBottom ? bestRow.index + 1 : bestRow.index
              pendingTargetIdx = targetIdx

              // AC ⑤: Drop at current position or abutting boundary is No-op -> dragIndicator = null
              const isNoOp = pendingTargetIdx >= start && pendingTargetIdx <= end + 1
              const isBlocked = isHeaderStraddling(tableNode, 'row', index, Math.min(rowGrips.length - 1, targetIdx))
              const label = isBlocked ? '헤더 이동 불가' : count > 1 ? `${count}행 이동` : `${index + 1}행 이동`

              setDragGhost({ type, index, label, x: moveEvent.clientX, y: moveEvent.clientY, isBlocked, targetIdx })

              if (isNoOp || isBlocked) {
                setDragIndicator(null)
              } else {
                const lineY = targetIdx < rowGrips.length ? rowGrips[targetIdx].top : rowGrips[rowGrips.length - 1].top + rowGrips[rowGrips.length - 1].height
                setDragIndicator({ type: 'row', left: tableRect.left, top: lineY - 1, width: tableRect.width, height: 2, isBlocked: false })
              }
            } else {
              setDragIndicator(null)
              pendingTargetIdx = -1
            }
          }
        }
      }

      const onMouseUp = () => {
        const wasDragging = isDragging
        const target = pendingTargetIdx
        cleanUpDrag()

        if (wasDragging) {
          if (isGripSelected && !hasMerged && target >= 0 && !(target >= start && target <= end + 1)) {
            const destIdx = target > end + 1 ? target - 1 : target
            if (!isHeaderStraddling(tableNode, type, index, destIdx)) {
              if (type === 'col') {
                moveTableColumn(editor, tableRect.pos, start, destIdx)
              } else {
                moveTableRow(editor, tableRect.pos, start, destIdx)
              }
              setTimeout(updateTableRect, 50)
            }
          }
        } else {
          // Pure click action
          window.dispatchEvent(new CustomEvent(type === 'col' ? 'tiptap:open-table-col-menu' : 'tiptap:open-table-row-menu'))
          focusTableGrip(editor, type, index, currentTableEl, tableRect?.pos ?? -1)
          if (editor.view && !editor.view.isDestroyed) {
            editor.view.dispatch(
              editor.state.tr
                .setMeta('tableMenuTrigger', Date.now())
                .setMeta(type === 'col' ? 'tableColumnMenu' : 'tableRowMenu', 'show'),
            )
          }
        }
      }

      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
      window.addEventListener('keydown', onKeyDown, true)
    },
    [editor, tableRect, columnGrips, rowGrips, updateTableRect, currentTableEl],
  )

  const onAddColumnAtEnd = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      try {
        const tableNode = tableRect?.pos !== undefined && tableRect.pos >= 0 ? editor.state.doc.nodeAt(tableRect.pos) : null
        if (tableNode) {
          const map = TableMap.get(tableNode)
          const lastColCellPos = tableRect!.pos + 1 + map.map[map.width - 1]
          editor.chain().focus().setTextSelection(lastColCellPos + 1).addColumnAfter().run()
          setTimeout(updateTableRect, 50)
          return
        }
      } catch {}
      editor.chain().focus().addColumnAfter().run()
      setTimeout(updateTableRect, 50)
    },
    [editor, tableRect, updateTableRect],
  )

  const onAddRowAtEnd = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      try {
        const tableNode = tableRect?.pos !== undefined && tableRect.pos >= 0 ? editor.state.doc.nodeAt(tableRect.pos) : null
        if (tableNode) {
          const map = TableMap.get(tableNode)
          const lastRowCellPos = tableRect!.pos + 1 + map.map[(map.height - 1) * map.width]
          editor.chain().focus().setTextSelection(lastRowCellPos + 1).addRowAfter().run()
          setTimeout(updateTableRect, 50)
          return
        }
      } catch {}
      editor.chain().focus().addRowAfter().run()
      setTimeout(updateTableRect, 50)
    },
    [editor, tableRect, updateTableRect],
  )

  if (!tableRect || !isHovered || !editor.isEditable || isScrolling || typeof document === 'undefined') {
    return null
  }

  const activeColGrip = hoveredColIndex !== null ? columnGrips[hoveredColIndex] : null
  const activeRowGrip = hoveredRowIndex !== null ? rowGrips[hoveredRowIndex] : null

  const isLastColHovered = hoveredColIndex !== null && columnGrips.length > 0 && hoveredColIndex === columnGrips.length - 1
  const isLastRowHovered = hoveredRowIndex !== null && rowGrips.length > 0 && hoveredRowIndex === rowGrips.length - 1

  const isColGripVisible =
    activeColGrip &&
    (!tableRect.wrapperLeft ||
      (activeColGrip.left + activeColGrip.width > tableRect.wrapperLeft &&
        activeColGrip.left < (tableRect.wrapperRight ?? Infinity)))

  return createPortal(
    <div id="table-add-buttons-portal" className="pointer-events-auto" style={{ zIndex: 15, position: 'relative' }}>
      {/* 1. Single Top Column Grip Bar (AC ⑦: z-[15]) */}
      {activeColGrip && isColGripVisible && (
        <button
          key={`active-col-grip-${activeColGrip.index}`}
          type="button"
          onMouseDown={handleGripMouseDown('col', activeColGrip.index)}
          className="fixed z-[15] h-[12px] rounded-full bg-zinc-500/15 hover:bg-zinc-500/25 active:bg-indigo-600/90 dark:bg-white/10 dark:hover:bg-white/20 dark:active:bg-violet-500/90 backdrop-blur-md border border-black/[0.06] dark:border-white/10 text-zinc-500 dark:text-zinc-300 active:text-white shadow-2xs transition-all flex items-center justify-center p-0 cursor-pointer select-none"
          style={{ top: tableRect.top - 15, left: activeColGrip.left, width: activeColGrip.width, zIndex: 15 }}
          title={`Click to select, drag to move column ${activeColGrip.index + 1}`}
        >
          <div className="flex items-center gap-0.5">
            <span className="w-1 h-1 rounded-full bg-current opacity-70" />
            <span className="w-1 h-1 rounded-full bg-current opacity-70" />
            <span className="w-1 h-1 rounded-full bg-current opacity-70" />
          </div>
        </button>
      )}

      {/* 2. Single Left Row Grip Bar (AC ⑦: z-[15]) */}
      {activeRowGrip && (
        <button
          key={`active-row-grip-${activeRowGrip.index}`}
          type="button"
          onMouseDown={handleGripMouseDown('row', activeRowGrip.index)}
          className="fixed z-[15] w-[12px] rounded-full bg-zinc-500/15 hover:bg-zinc-500/25 active:bg-indigo-600/90 dark:bg-white/10 dark:hover:bg-white/20 dark:active:bg-violet-500/90 backdrop-blur-md border border-black/[0.06] dark:border-white/10 text-zinc-500 dark:text-zinc-300 active:text-white shadow-2xs transition-all flex items-center justify-center p-0 cursor-pointer select-none"
          style={{ top: activeRowGrip.top, left: tableRect.left - 15, height: activeRowGrip.height, zIndex: 15 }}
          title={`Click to select, drag to move row ${activeRowGrip.index + 1}`}
        >
          <div className="flex flex-col items-center gap-0.5">
            <span className="w-1 h-1 rounded-full bg-current opacity-70" />
            <span className="w-1 h-1 rounded-full bg-current opacity-70" />
            <span className="w-1 h-1 rounded-full bg-current opacity-70" />
          </div>
        </button>
      )}

      {/* 3. Right Column & Bottom Row Add Buttons */}
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

      {/* 4. Drag & Resize Visual Overlays */}
      <TableDragOverlays
        dragGhost={dragGhost}
        dragIndicator={dragIndicator}
        resizingGuideX={resizingGuideX}
        tableRectLeft={tableRect.left}
        tableRectTop={tableRect.top}
        tableRectWidth={tableRect.width}
        tableRectHeight={tableRect.height}
      />
    </div>,
    (appendTo?.current as HTMLElement) || (typeof document !== 'undefined' ? document.body : (null as any)),
  )
}

export default TableAddButtons
