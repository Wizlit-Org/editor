import React, { useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { Editor } from '@tiptap/react'
import { TextSelection } from '@tiptap/pm/state'
import { TableMap } from '@tiptap/pm/tables'
import { useTableGrips } from '../hooks/useTableGrips'
import { TableAddBar } from './TableAddBar'
import {
  TableDragOverlays,
  DragGhostData,
  DragIndicatorData,
  DraggingSourceData,
  TargetSlotData,
} from './TableDragOverlays'
import { moveTableColumn, moveTableRow, getMergedColRange, getMergedRowRange } from '../utils/TableDndUtils'
import { findTable, isCellSelection } from '../utils'
import { findSafeDropIndex, selectColRange, selectRowRange, focusTableGrip, isGripInCurrentSelection } from '../utils/TableClusterUtils'
import { isHeaderStraddling, extractCellTextSnippets } from '../utils/TableHeaderStraddleUtils'

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
  const [draggingSource, setDraggingSource] = useState<DraggingSourceData | null>(null)
  const [dragGhost, setDragGhost] = useState<DragGhostData | null>(null)
  const [targetSlot, setTargetSlot] = useState<TargetSlotData | null>(null)
  const [resizingGuideX, setResizingGuideX] = useState<number | null>(null)

  // Listen to mouse events for column resizing to show full-height vertical indigo guide
  React.useEffect(() => {
    const dom = editor.view?.dom
    if (!dom) return
    let activeCleanup: (() => void) | null = null

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (!target || !(target instanceof Element) || typeof target.closest !== 'function') return
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
      const colBundle = type === 'col' && tableNode ? getMergedColRange(tableNode, index) : { start: index, count: 1 }
      const rowBundle = type === 'row' && tableNode ? getMergedRowRange(tableNode, index) : { start: index, count: 1 }

      // Check if clicked grip is already inside current selection
      const isGripSelected = isGripInCurrentSelection(editor, type, index)

      const onMouseMove = (moveEvent: MouseEvent) => {
        const dist = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY)
        if (dist > 4) {
          if (!isDragging) {
            window.dispatchEvent(new CustomEvent('tiptap:close-table-menus'))
            isDragging = true
          }

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

              const isBlocked = isHeaderStraddling(tableNode, 'col', index, targetIdx)
              const label = colBundle.count > 1 ? `${colBundle.count}개 열 이동 중` : `열 ${index + 1}`
              const snippets = extractCellTextSnippets(tableNode, 'col', index, 4)
              setDragGhost({
                type,
                index,
                label,
                x: moveEvent.clientX,
                y: moveEvent.clientY,
                snippets,
                isBlocked,
                targetIdx,
              })

              const targetGrip = columnGrips[targetIdx]
              if (targetGrip) {
                setTargetSlot({
                  left: targetGrip.left,
                  top: tableRect.top,
                  width: targetGrip.width,
                  height: tableRect.height,
                })
              }

              const lineX = targetGrip ? (isRightSide ? targetGrip.left + targetGrip.width : targetGrip.left) : (isRightSide ? bestCol.left + bestCol.width : bestCol.left)
              setDragIndicator({
                type: 'col',
                left: lineX - 1.5,
                top: tableRect.top,
                width: 3,
                height: tableRect.height,
                isBlocked,
                blockMessage: isBlocked ? '헤더와 일반 셀에 걸쳐 이동할 수 없습니다' : undefined,
              })
            } else {
              setDragIndicator(null)
              setTargetSlot(null)
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

              const isBlocked = isHeaderStraddling(tableNode, 'row', index, targetIdx)
              const label = rowBundle.count > 1 ? `${rowBundle.count}개 행 이동 중` : `행 ${index + 1}`
              const snippets = extractCellTextSnippets(tableNode, 'row', index, 4)
              setDragGhost({
                type,
                index,
                label,
                x: moveEvent.clientX,
                y: moveEvent.clientY,
                snippets,
                isBlocked,
                targetIdx,
              })

              const targetGrip = rowGrips[targetIdx]
              if (targetGrip) {
                setTargetSlot({
                  left: tableRect.left,
                  top: targetGrip.top,
                  width: tableRect.width,
                  height: targetGrip.height,
                })
              }

              const lineY = targetGrip ? (isBottomSide ? targetGrip.top + targetGrip.height : targetGrip.top) : (isBottomSide ? bestRow.top + bestRow.height : bestRow.top)
              setDragIndicator({
                type: 'row',
                left: tableRect.left,
                top: lineY - 1.5,
                width: tableRect.width,
                height: 3,
                isBlocked,
                blockMessage: isBlocked ? '헤더와 일반 셀에 걸쳐 이동할 수 없습니다' : undefined,
              })
            } else {
              setDragIndicator(null)
              setTargetSlot(null)
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
        setTargetSlot(null)

        if (isDragging) {
          if (isGripSelected && pendingTargetIdx >= 0 && pendingTargetIdx !== index && tableNode) {
            const isBlocked = isHeaderStraddling(tableNode, type, index, pendingTargetIdx)
            if (!isBlocked) {
              if (type === 'col') {
                moveTableColumn(editor, tableRect.pos, index, pendingTargetIdx)
              } else {
                moveTableRow(editor, tableRect.pos, index, pendingTargetIdx)
              }
              setTimeout(updateTableRect, 50)
            }
          }
        } else {
          // Pure click action: 100% reliable menu open
          // 1. Dispatch open event first so isMenuOpenRef.current becomes true synchronously
          if (type === 'col') {
            window.dispatchEvent(new CustomEvent('tiptap:open-table-col-menu'))
          } else {
            window.dispatchEvent(new CustomEvent('tiptap:open-table-row-menu'))
          }

          // 2. Focus and select the table grip (dispatches CellSelection)
          focusTableGrip(editor, type, index, currentTableEl, tableRect?.pos ?? -1)

          // 3. Force ProseMirror view.update cycle with tableMenu meta to guarantee BubbleMenuView shouldShow runs immediately
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
    },
    [editor, tableRect, columnGrips, rowGrips, updateTableRect, currentTableEl],
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

      {/* 4. Drag & Resize Visual Overlays */}
      <TableDragOverlays
        dragGhost={dragGhost}
        draggingSource={draggingSource}
        dragIndicator={dragIndicator}
        targetSlot={targetSlot}
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
