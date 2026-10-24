import React, { useCallback, useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Editor } from '@tiptap/react'
import { TableMap } from '@tiptap/pm/tables'
import { useTableGrips } from '../hooks/useTableGrips'
import { TableAddBar } from './TableAddBar'
import { TableDragOverlays, DragGhostData, DragIndicatorData } from './TableDragOverlays'
import { moveTableColumn, moveTableRow } from '../utils/TableDndUtils'
import { isCellSelection, findTable } from '../utils'
import { selectColRange, selectRowRange, focusTableGrip, isGripInCurrentSelection } from '../utils/TableClusterUtils'
import { hasMergedCellsInRowSelection, hasMergedCellsInColSelection, isHeaderStraddling, isTargetSplittingMergedCell } from '../utils/TableHeaderStraddleUtils'
import { useContainingBlockOffset, ContainingBlockAnchor } from '../utils/containingBlock'
import { startAutoScroll, scrollTargetCellIntoView } from '../utils/TableAutoScroll'
import { tableGripPluginKey } from '../Table'

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

  const anchorRef = useRef<HTMLDivElement>(null)
  const offset = useContainingBlockOffset(anchorRef)

  const [dragIndicator, setDragIndicator] = useState<DragIndicatorData | null>(null)
  const [dragGhost, setDragGhost] = useState<DragGhostData | null>(null)

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

      const isGripSelected = isGripInCurrentSelection(editor, type, index, tableRect.pos)
      const initialSelection = editor.state.selection
      const gripSel = tableGripPluginKey.getState(editor.state)

      let start = index
      let end = index
      if (
        gripSel &&
        gripSel.tablePos === tableRect.pos &&
        gripSel.type === type &&
        index >= gripSel.min &&
        index <= gripSel.max
      ) {
        start = gripSel.min
        end = gripSel.max
      } else if (isGripSelected && isCellSelection(editor.state.selection)) {
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

      const hasMerged = type === 'col'
        ? hasMergedCellsInColSelection(tableNode, start, end)
        : hasMergedCellsInRowSelection(tableNode, start, end)
      const count = end - start + 1
      ;(window as any).__isTableDragging = true

      const wrapperEl = currentTableEl ? (currentTableEl.closest('.tableWrapper') as HTMLElement | null) : null
      const scrollContainer = (appendTo?.current as HTMLElement) || (typeof window !== 'undefined' ? window : null)

      const handleDragMoveAtCoords = (clientX: number, clientY: number) => {
        const dist = Math.hypot(clientX - startX, clientY - startY)
        if (dist > 4) {
          if (!isDragging) {
            window.dispatchEvent(new CustomEvent('tiptap:close-table-menus'))
            isDragging = true
          }

          if (!isGripSelected) {
            document.body.style.cursor = 'cell'
            if (type === 'col') {
              let hCol = columnGrips.find(g => clientX >= g.left && clientX <= g.left + g.width)
              if (!hCol && columnGrips.length > 0) hCol = clientX < columnGrips[0].left ? columnGrips[0] : columnGrips[columnGrips.length - 1]
              if (hCol) editor.view.dispatch(selectColRange(editor.state.tr, Math.min(index, hCol.index), Math.max(index, hCol.index), tableRect.pos))
            } else {
              let hRow = rowGrips.find(g => clientY >= g.top && clientY <= g.top + g.height)
              if (!hRow && rowGrips.length > 0) hRow = clientY < rowGrips[0].top ? rowGrips[0] : rowGrips[rowGrips.length - 1]
              if (hRow) editor.view.dispatch(selectRowRange(editor.state.tr, Math.min(index, hRow.index), Math.max(index, hRow.index), tableRect.pos))
            }
            return
          }

          document.body.style.cursor = hasMerged ? 'not-allowed' : type === 'col' ? 'col-resize' : 'row-resize'
          if (hasMerged) {
            pendingTargetIdx = -1
            setDragIndicator(null)
            setDragGhost({ type, index, label: '이동 불가 (병합 셀 포함)', x: clientX, y: clientY, isBlocked: true, targetIdx: -1 })
            return
          }

          if (type === 'col') {
            let bCol = columnGrips.find(g => clientX >= g.left && clientX <= g.left + g.width)
            if (!bCol && columnGrips.length > 0) bCol = clientX < columnGrips[0].left ? columnGrips[0] : columnGrips[columnGrips.length - 1]
            if (bCol) {
              const targetIdx = clientX > bCol.left + bCol.width / 2 ? bCol.index + 1 : bCol.index
              pendingTargetIdx = targetIdx
              const isNoOp = targetIdx >= start && targetIdx <= end + 1
              const isHeaderBlocked = isHeaderStraddling(tableNode, 'col', index, Math.min(columnGrips.length - 1, targetIdx))
              const isSplitBlocked = isTargetSplittingMergedCell(tableNode, 'col', targetIdx)
              const isBlocked = isHeaderBlocked || isSplitBlocked
              const label = isHeaderBlocked
                ? '헤더 이동 불가'
                : isSplitBlocked
                ? '병합 셀 사이 이동 불가'
                : count > 1
                ? `${count}열 이동`
                : `${index + 1}열 이동`
              setDragGhost({ type, index, label, x: clientX, y: clientY, isBlocked, targetIdx })
              if (isNoOp || isBlocked) {
                setDragIndicator(null)
              } else {
                const lineX = targetIdx < columnGrips.length ? columnGrips[targetIdx].left : columnGrips[columnGrips.length - 1].left + columnGrips[columnGrips.length - 1].width
                setDragIndicator({ type: 'col', left: lineX - 1, top: tableRect.top, width: 2, height: tableRect.height, isBlocked: false })
              }
            }
          } else {
            let bRow = rowGrips.find(g => clientY >= g.top && clientY <= g.top + g.height)
            if (!bRow && rowGrips.length > 0) bRow = clientY < rowGrips[0].top ? rowGrips[0] : rowGrips[rowGrips.length - 1]
            if (bRow) {
              const targetIdx = clientY > bRow.top + bRow.height / 2 ? bRow.index + 1 : bRow.index
              pendingTargetIdx = targetIdx
              const isNoOp = targetIdx >= start && targetIdx <= end + 1
              const isHeaderBlocked = isHeaderStraddling(tableNode, 'row', index, Math.min(rowGrips.length - 1, targetIdx))
              const isSplitBlocked = isTargetSplittingMergedCell(tableNode, 'row', targetIdx)
              const isBlocked = isHeaderBlocked || isSplitBlocked
              const label = isHeaderBlocked
                ? '헤더 이동 불가'
                : isSplitBlocked
                ? '병합 셀 사이 이동 불가'
                : count > 1
                ? `${count}행 이동`
                : `${index + 1}행 이동`
              setDragGhost({ type, index, label, x: clientY, y: clientY, isBlocked, targetIdx })
              if (isNoOp || isBlocked) {
                setDragIndicator(null)
              } else {
                const lineY = targetIdx < rowGrips.length ? rowGrips[targetIdx].top : rowGrips[rowGrips.length - 1].top + rowGrips[rowGrips.length - 1].height
                setDragIndicator({ type: 'row', left: tableRect.left, top: lineY - 1, width: tableRect.width, height: 2, isBlocked: false })
              }
            }
          }
        }
      }

      const autoScroller = startAutoScroll({
        tableWrapper: wrapperEl,
        scrollContainer,
        onTick: (cx, cy) => {
          updateTableRect()
          handleDragMoveAtCoords(cx, cy)
        },
      })

      const cleanUpDrag = () => {
        autoScroller.stop()
        ;(window as any).__isTableDragging = false
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', onMouseUp)
        window.removeEventListener('keydown', onKeyDown, { capture: true })
        window.removeEventListener('tiptap:cancel-drag', handleCancelDrag)
        document.body.style.cursor = ''
        setDragIndicator(null)
        setDragGhost(null)
      }

      const handleCancelDrag = () => {
        if (!isGripSelected && initialSelection) {
          try { editor.view.dispatch(editor.state.tr.setSelection(initialSelection)) } catch {}
        }
        cleanUpDrag()
      }

      const onKeyDown = (keyEvt: KeyboardEvent) => {
        if (keyEvt.key === 'Escape') {
          keyEvt.preventDefault()
          keyEvt.stopPropagation()
          keyEvt.stopImmediatePropagation()
          handleCancelDrag()
        }
      }

      const onMouseMove = (moveEvent: MouseEvent) => {
        autoScroller.updateCoords(moveEvent.clientX, moveEvent.clientY)
        handleDragMoveAtCoords(moveEvent.clientX, moveEvent.clientY)
      }

      const onMouseUp = () => {
        const wasDragging = isDragging
        const target = pendingTargetIdx
        cleanUpDrag()
        if (wasDragging) {
          const swallowClick = (evt: MouseEvent) => {
            evt.preventDefault()
            evt.stopPropagation()
            evt.stopImmediatePropagation()
          }
          window.addEventListener('click', swallowClick, { capture: true, once: true })
          setTimeout(() => window.removeEventListener('click', swallowClick, { capture: true }), 100)

          if (isGripSelected && !hasMerged && target >= 0 && !(target >= start && target <= end + 1)) {
            const destIdx = target > end + 1 ? target - 1 : target
            if (
              !isHeaderStraddling(tableNode, type, index, destIdx) &&
              !isTargetSplittingMergedCell(tableNode, type, target)
            ) {
              if (type === 'col') moveTableColumn(editor, tableRect.pos, start, destIdx, count)
              else moveTableRow(editor, tableRect.pos, start, destIdx, count)
              try { editor.commands.focus(undefined, { scrollIntoView: false }) } catch {}
              setTimeout(updateTableRect, 50)
            }
          }
        } else {
          window.dispatchEvent(new CustomEvent(type === 'col' ? 'tiptap:open-table-col-menu' : 'tiptap:open-table-row-menu'))
          if (!isGripSelected) {
            focusTableGrip(editor, type, index, currentTableEl, tableRect?.pos ?? -1)
          }
          if (editor.view && !editor.view.isDestroyed) {
            editor.view.dispatch(editor.state.tr.setMeta('tableMenuTrigger', Date.now()).setMeta(type === 'col' ? 'tableColumnMenu' : 'tableRowMenu', 'show'))
          }
        }
      }

      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
      window.addEventListener('keydown', onKeyDown, { capture: true })
      window.addEventListener('tiptap:cancel-drag', handleCancelDrag)
    },
    [editor, tableRect, columnGrips, rowGrips, updateTableRect, currentTableEl],
  )

  const onAddColumnAtEnd = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    try {
      const tableNode = tableRect?.pos !== undefined && tableRect.pos >= 0 ? editor.state.doc.nodeAt(tableRect.pos) : null
      if (tableNode) {
        const map = TableMap.get(tableNode)
        editor.chain().focus().setTextSelection(tableRect!.pos + 1 + map.map[map.width - 1] + 1).addColumnAfter().run()
        scrollTargetCellIntoView(editor, { tablePos: tableRect!.pos, colIndex: map.width })
        setTimeout(updateTableRect, 50)
        return
      }
    } catch {}
    editor.chain().focus().addColumnAfter().run()
    setTimeout(updateTableRect, 50)
  }, [editor, tableRect, updateTableRect])

  const onAddRowAtEnd = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    try {
      const tableNode = tableRect?.pos !== undefined && tableRect.pos >= 0 ? editor.state.doc.nodeAt(tableRect.pos) : null
      if (tableNode) {
        const map = TableMap.get(tableNode)
        editor.chain().focus().setTextSelection(tableRect!.pos + 1 + map.map[(map.height - 1) * map.width] + 1).addRowAfter().run()
        scrollTargetCellIntoView(editor, { tablePos: tableRect!.pos, rowIndex: map.height })
        setTimeout(updateTableRect, 50)
        return
      }
    } catch {}
    editor.chain().focus().addRowAfter().run()
    setTimeout(updateTableRect, 50)
  }, [editor, tableRect, updateTableRect])

  if (!tableRect || !isHovered || !editor.isEditable || (isScrolling && !(window as any).__isTableDragging) || typeof document === 'undefined') return null

  const tableNode = tableRect.pos >= 0 ? editor.state.doc.nodeAt(tableRect.pos) : null
  const gripSel = tableGripPluginKey.getState(editor.state)
  let selCol: { start: number; end: number } | null = null
  let selRow: { start: number; end: number } | null = null

  if (gripSel && gripSel.tablePos === tableRect.pos) {
    if (gripSel.type === 'col') selCol = { start: gripSel.min, end: gripSel.max }
    else selRow = { start: gripSel.min, end: gripSel.max }
  } else {
    const selectedTable = findTable(editor.state.selection)
    if (tableNode && isCellSelection(editor.state.selection) && selectedTable && selectedTable.pos === tableRect.pos) {
      try {
        const map = TableMap.get(tableNode)
        const selStart = (editor.state.selection as any).$anchorCell.start(-1)
        const selRect = map.rectBetween((editor.state.selection as any).$anchorCell.pos - selStart, (editor.state.selection as any).$headCell.pos - selStart)
        if (selRect.bottom - selRect.top === map.height) selCol = { start: selRect.left, end: selRect.right - 1 }
        if (selRect.right - selRect.left === map.width) selRow = { start: selRect.top, end: selRect.bottom - 1 }
      } catch {}
    }
  }

  const activeColGrip = hoveredColIndex !== null ? columnGrips[hoveredColIndex] : null
  const activeRowGrip = hoveredRowIndex !== null ? rowGrips[hoveredRowIndex] : null

  let mergedCol: { left: number; width: number; startIdx: number } | null = null
  if (selCol && columnGrips[selCol.start] && columnGrips[selCol.end]) {
    const s = columnGrips[selCol.start], e = columnGrips[selCol.end]
    mergedCol = { left: s.left, width: e.left + e.width - s.left, startIdx: selCol.start }
  }

  let mergedRow: { top: number; height: number; startIdx: number } | null = null
  if (selRow && rowGrips[selRow.start] && rowGrips[selRow.end]) {
    const s = rowGrips[selRow.start], e = rowGrips[selRow.end]
    mergedRow = { top: s.top, height: e.top + e.height - s.top, startIdx: selRow.start }
  }

  const isColVisible = (g: { left: number; width: number }) =>
    !tableRect.wrapperLeft || (g.left + g.width > tableRect.wrapperLeft && g.left < (tableRect.wrapperRight ?? Infinity))

  const isLastCol = hoveredColIndex !== null && columnGrips.length > 0 && hoveredColIndex === columnGrips.length - 1
  const isLastRow = hoveredRowIndex !== null && rowGrips.length > 0 && hoveredRowIndex === rowGrips.length - 1

  const pillClass = "fixed rounded-full backdrop-blur-md shadow-2xs transition-all flex items-center justify-center p-0 cursor-pointer select-none"
  const colSinglePillClass = `${pillClass} z-[9] bg-zinc-500/15 hover:bg-zinc-500/25 active:bg-indigo-600/90 dark:bg-white/10 dark:hover:bg-white/20 dark:active:bg-violet-500/90 border border-black/[0.06] dark:border-white/10 text-zinc-500 dark:text-zinc-300 active:text-white`
  const colMergedPillClass = `${pillClass} z-[9] bg-indigo-600/35 hover:bg-indigo-600/50 active:bg-indigo-600/90 dark:bg-violet-500/35 dark:hover:bg-violet-500/50 dark:active:bg-violet-500/90 border border-indigo-500/40 dark:border-violet-400/40 text-indigo-700 dark:text-violet-200 active:text-white`
  const rowSinglePillClass = `${pillClass} z-[15] bg-zinc-500/15 hover:bg-zinc-500/25 active:bg-indigo-600/90 dark:bg-white/10 dark:hover:bg-white/20 dark:active:bg-violet-500/90 border border-black/[0.06] dark:border-white/10 text-zinc-500 dark:text-zinc-300 active:text-white`
  const rowMergedPillClass = `${pillClass} z-[15] bg-indigo-600/35 hover:bg-indigo-600/50 active:bg-indigo-600/90 dark:bg-violet-500/35 dark:hover:bg-violet-500/50 dark:active:bg-violet-500/90 border border-indigo-500/40 dark:border-violet-400/40 text-indigo-700 dark:text-violet-200 active:text-white`

  const originLeft = tableRect.originLeft !== undefined ? tableRect.originLeft : tableRect.left
  const rowGripLeft = originLeft - 15 - offset.x

  return createPortal(
    <>
      <ContainingBlockAnchor ref={anchorRef} />

      {/* 1. Column Grip (Merged Stretched Pill or Single Hovered Pill) - Isolated Stacking Context z-index: 9 (below blur z-12) */}
      <div id="table-col-grips" style={{ position: 'fixed', top: 0, left: 0, width: 0, height: 0, zIndex: 9, pointerEvents: 'none' }}>
        {mergedCol && isColVisible(mergedCol) ? (
          <button key="active-col-grip" type="button" onMouseDown={handleGripMouseDown('col', mergedCol.startIdx)}
            className={`${colMergedPillClass} h-[12px] pointer-events-auto`}
            style={{ top: tableRect.top - 15 - offset.y, left: mergedCol.left - offset.x, width: mergedCol.width, zIndex: 9 }}
            title="Click for options, drag to move selected columns">
            <div className="flex items-center gap-0.5"><span className="w-1 h-1 rounded-full bg-current opacity-80" /><span className="w-1 h-1 rounded-full bg-current opacity-80" /><span className="w-1 h-1 rounded-full bg-current opacity-80" /></div>
          </button>
        ) : activeColGrip && isColVisible(activeColGrip) ? (
          <button key="active-col-grip" type="button" onMouseDown={handleGripMouseDown('col', activeColGrip.index)}
            className={`${colSinglePillClass} h-[12px] pointer-events-auto`}
            style={{ top: tableRect.top - 15 - offset.y, left: activeColGrip.left - offset.x, width: activeColGrip.width, zIndex: 9 }}
            title={`Click to select, drag to move column ${activeColGrip.index + 1}`}>
            <div className="flex items-center gap-0.5"><span className="w-1 h-1 rounded-full bg-current opacity-70" /><span className="w-1 h-1 rounded-full bg-current opacity-70" /><span className="w-1 h-1 rounded-full bg-current opacity-70" /></div>
          </button>
        ) : null}
      </div>

      {/* 2. Row Grip (Merged Stretched Pill or Single Hovered Pill) - Isolated Stacking Context z-index: 15 (above blur z-12) */}
      <div id="table-row-grips" style={{ position: 'fixed', top: 0, left: 0, width: 0, height: 0, zIndex: 15, pointerEvents: 'none' }}>
        {mergedRow ? (
          <button key="active-row-grip" type="button" onMouseDown={handleGripMouseDown('row', mergedRow.startIdx)}
            className={`${rowMergedPillClass} w-[12px] pointer-events-auto`}
            style={{ top: mergedRow.top - offset.y, left: rowGripLeft, height: mergedRow.height, zIndex: 15 }}
            title="Click for options, drag to move selected rows">
            <div className="flex flex-col items-center gap-0.5"><span className="w-1 h-1 rounded-full bg-current opacity-80" /><span className="w-1 h-1 rounded-full bg-current opacity-80" /><span className="w-1 h-1 rounded-full bg-current opacity-80" /></div>
          </button>
        ) : activeRowGrip ? (
          <button key="active-row-grip" type="button" onMouseDown={handleGripMouseDown('row', activeRowGrip.index)}
            className={`${rowSinglePillClass} w-[12px] pointer-events-auto`}
            style={{ top: activeRowGrip.top - offset.y, left: rowGripLeft, height: activeRowGrip.height, zIndex: 15 }}
            title={`Click to select, drag to move row ${activeRowGrip.index + 1}`}>
            <div className="flex flex-col items-center gap-0.5"><span className="w-1 h-1 rounded-full bg-current opacity-70" /><span className="w-1 h-1 rounded-full bg-current opacity-70" /><span className="w-1 h-1 rounded-full bg-current opacity-70" /></div>
          </button>
        ) : null}
      </div>

      {/* 3. Right & Bottom Add Buttons & Drag Overlays */}
      <div id="table-overlays-wrapper" style={{ position: 'fixed', top: 0, left: 0, width: 0, height: 0, pointerEvents: 'none' }}>
        <TableAddBar tableRect={tableRect} activeRowRect={activeRowGrip ? { top: activeRowGrip.top, height: activeRowGrip.height } : null} activeColRect={activeColGrip ? { left: activeColGrip.left, width: activeColGrip.width } : null} showRightBar={showRightAddBar || isLastCol} showBottomBar={showBottomAddBar || isLastRow} containerOffset={offset} onAddColumn={onAddColumnAtEnd} onAddRow={onAddRowAtEnd} onHoverKeepAlive={() => { clearHoverTimer(); setIsHovered(true) }} />
        <TableDragOverlays dragGhost={dragGhost} dragIndicator={dragIndicator} tableRectLeft={tableRect.left} tableRectTop={tableRect.top} tableRectWidth={tableRect.width} tableRectHeight={tableRect.height} containerOffset={offset} />
      </div>
    </>,
    (appendTo?.current as HTMLElement) || (typeof document !== 'undefined' ? document.body : (null as any)),
  )
}

export default TableAddButtons
