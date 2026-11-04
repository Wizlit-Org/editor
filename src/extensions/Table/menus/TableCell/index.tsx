import React, { useCallback, useState, useEffect, useRef, useMemo, JSX } from 'react'
import { createPortal } from 'react-dom'
import * as Popover from '@radix-ui/react-popover'
import { CellSelection, splitCell, TableMap } from '@tiptap/pm/tables'
import { findTable, isCellSelection } from '../../utils'
import { expandRectToMergedCells } from '../../utils/TableClusterUtils'
import { isSelectionStraddlingHeader, hasMergedCellsInSelection } from '../../utils/TableHeaderStraddleUtils'
import { useContainingBlockOffset, ContainingBlockAnchor } from '../../utils/containingBlock'
import { startAutoScroll } from '../../utils/TableAutoScroll'
import { tableGripPluginKey } from '../../Table'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/utils'
import { MenuProps } from '@/components/menus/types'
import { TableAlignmentSubmenu } from '../TableAlignmentSubmenu'
import { DeleteRowIcon, DeleteColumnIcon } from '../../components/TableActionIcons'

const getCellPosFromDOM = (view: any, cellEl: HTMLElement): number | null => {
  try {
    const innerPos = view.posAtDOM(cellEl, 0)
    const $pos = view.state.doc.resolve(innerPos)
    for (let d = $pos.depth; d > 0; d--) {
      const nodeName = $pos.node(d).type.name
      if (nodeName === 'tableCell' || nodeName === 'tableHeader') return $pos.before(d)
    }
  } catch {}
  return null
}

export const TableCellMenu = React.memo(({ editor, appendTo }: MenuProps): JSX.Element => {
  const [mounted, setMounted] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [isBtnHovered, setIsBtnHovered] = useState(false)
  const [selectionRect, setSelectionRect] = useState<{ top: number; left: number; width: number; height: number; minColLeft?: number; wrapperRight?: number } | null>(null)
  const [isButtonVisible, setIsButtonVisible] = useState(false)
  const [isScrolling, setIsScrolling] = useState(false)
  const isDraggingHandleRef = useRef(false)
  const scrollTimerRef = useRef<NodeJS.Timeout | null>(null), animFrameRef = useRef<number | null>(null), timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const anchorRef = useRef<HTMLDivElement>(null)
  const offset = useContainingBlockOffset(anchorRef)

  useEffect(() => { setMounted(true) }, [])

  const isCellSelected = isCellSelection(editor.state?.selection)

  const getActiveCells = useCallback((): HTMLElement[] => {
    if (!editor.view?.dom) return []
    const { selection } = editor.state
    const table = findTable(selection)

    if (table && isCellSelection(selection)) {
      try {
        const map = TableMap.get(table.node)
        const start = selection.$anchorCell.start(-1)
        const rawRect = map.rectBetween(selection.$anchorCell.pos - start, selection.$headCell.pos - start)
        const expandedRect = expandRectToMergedCells(table.node, rawRect)
        const domCells: HTMLElement[] = []
        const seen = new Set<number>()

        for (let r = expandedRect.top; r < expandedRect.bottom; r++) {
          for (let c = expandedRect.left; c < expandedRect.right; c++) {
            const offset = map.map[r * map.width + c]
            if (seen.has(offset)) continue
            seen.add(offset)
            try {
              const cellPos = table.start + offset
              const nodeDom = editor.view.nodeDOM(cellPos) as HTMLElement | null
              const cellEl =
                nodeDom && nodeDom.nodeType === 1
                  ? nodeDom
                  : ((editor.view.domAtPos(cellPos + 1).node as HTMLElement)?.closest?.('td, th') as HTMLElement | null)
              if (cellEl) {
                domCells.push(cellEl)
                if (!cellEl.classList.contains('selectedCell')) {
                  cellEl.classList.add('selectedCell')
                }
              }
            } catch {}
          }
        }

        if (domCells.length > 0) return domCells
      } catch {}
    }

    const selectedCells = Array.from(editor.view.dom.querySelectorAll('.selectedCell')) as HTMLElement[]
    if (selectedCells.length > 0) return selectedCells

    if (editor.isActive('tableCell') || editor.isActive('tableHeader')) {
      try {
        const domAt = editor.view.domAtPos(editor.state.selection.from)
        const cellEl = (domAt.node instanceof HTMLElement ? domAt.node : domAt.node.parentElement)?.closest('td, th') as HTMLElement | null
        if (cellEl) return [cellEl]
      } catch {}
    }
    return []
  }, [editor])

  const updateSelectionRect = useCallback(() => {
    const gripSel = tableGripPluginKey.getState(editor.state)
    const table = findTable(editor.state.selection)

    if (gripSel && table && gripSel.tablePos === table.pos) {
      const dom = editor.view.nodeDOM(table.pos) as HTMLElement | null
      const tableEl = dom && dom.nodeType === 1 ? (dom.tagName === 'TABLE' ? dom : dom.querySelector('table')) : null
      if (tableEl) {
        const tRect = tableEl.getBoundingClientRect()
        let minTop = tRect.top, maxBottom = tRect.bottom, minLeft = tRect.left, maxRight = tRect.right
        if (gripSel.type === 'row') {
          const trs = Array.from(tableEl.querySelectorAll('tbody > tr, tr')) as HTMLTableRowElement[]
          if (trs.length > 0) {
            const topRow = trs[Math.min(gripSel.min, trs.length - 1)], bottomRow = trs[Math.min(gripSel.max, trs.length - 1)]
            if (topRow && bottomRow) { minTop = topRow.getBoundingClientRect().top; maxBottom = bottomRow.getBoundingClientRect().bottom }
          }
        } else {
          const map = TableMap.get(table.node)
          const leftCellOffset = map.map[Math.min(gripSel.min, map.width - 1)], rightCellOffset = map.map[Math.min(gripSel.max, map.width - 1)]
          const leftCellEl = (editor.view.nodeDOM(table.start + leftCellOffset) as HTMLElement | null) || tableEl.querySelector(`td:nth-child(${gripSel.min + 1}), th:nth-child(${gripSel.min + 1})`) as HTMLElement | null
          const rightCellEl = (editor.view.nodeDOM(table.start + rightCellOffset) as HTMLElement | null) || tableEl.querySelector(`td:nth-child(${gripSel.max + 1}), th:nth-child(${gripSel.max + 1})`) as HTMLElement | null
          if (leftCellEl && rightCellEl) { minLeft = leftCellEl.getBoundingClientRect().left; maxRight = rightCellEl.getBoundingClientRect().right }
        }
        const container = (appendTo?.current as HTMLElement) || null
        const isWithinContainer = !container || (() => { const cRect = container.getBoundingClientRect(), dotY = minTop + (maxBottom - minTop) / 2; return dotY >= cRect.top && dotY <= cRect.bottom })()
        const tableWrapper = tableEl.closest('.tableWrapper') as HTMLElement | null
        const wRect = tableWrapper ? tableWrapper.getBoundingClientRect() : null
        const hasLeftBlur = Boolean(tableWrapper && tableWrapper.scrollLeft > 2)
        const minColLeft = wRect ? wRect.left + (hasLeftBlur ? 40 : 0) : undefined, wrapperRight = wRect ? wRect.right : undefined
        const isVisibleInWrapper = wRect ? maxRight >= (minColLeft ?? wRect.left) + 8 && maxRight <= wRect.right + 15 : true
        setSelectionRect({ top: minTop, left: minLeft, width: maxRight - minLeft, height: maxBottom - minTop, minColLeft, wrapperRight })
        setIsButtonVisible(isVisibleInWrapper && isWithinContainer)
        return
      }
    }

    const cells = getActiveCells()
    if (cells.length > 0) {
      let minTop = Infinity, maxBottom = -Infinity, maxRight = -Infinity, minLeft = Infinity
      cells.forEach(cell => {
        const r = cell.getBoundingClientRect()
        if (r.top < minTop) minTop = r.top
        if (r.bottom > maxBottom) maxBottom = r.bottom
        if (r.right > maxRight) maxRight = r.right
        if (r.left < minLeft) minLeft = r.left
      })

      if (maxBottom < 0 || minTop > window.innerHeight || maxRight < 0 || minLeft > window.innerWidth) {
        setSelectionRect(null); setIsButtonVisible(false); setMenuOpen(false); return
      }

      const container = (appendTo?.current as HTMLElement) || null
      let isWithinContainer = true
      if (container) {
        const cRect = container.getBoundingClientRect()
        if (maxBottom < cRect.top || minTop > cRect.bottom || maxRight < cRect.left || minLeft > cRect.right) {
          setSelectionRect(null); setIsButtonVisible(false); setMenuOpen(false); return
        }
        const dotY = minTop + (maxBottom - minTop) / 2
        isWithinContainer = dotY >= cRect.top && dotY <= cRect.bottom
      }

      const tableWrapper = cells[0].closest('.tableWrapper') as HTMLElement | null
      const wRect = tableWrapper ? tableWrapper.getBoundingClientRect() : null
      const hasLeftBlur = Boolean(tableWrapper && tableWrapper.scrollLeft > 2)
      const minColLeft = wRect ? wRect.left + (hasLeftBlur ? 40 : 0) : undefined
      const wrapperRight = wRect ? wRect.right : undefined
      const isVisibleInWrapper = Boolean(wRect && maxRight >= (minColLeft ?? wRect.left) + 8 && maxRight <= wRect.right + 15 && minTop < window.innerHeight && maxBottom > 0)

      setSelectionRect(prev => (prev && prev.top === minTop && prev.left === minLeft && prev.width === maxRight - minLeft && prev.height === maxBottom - minTop && prev.minColLeft === minColLeft && prev.wrapperRight === wrapperRight ? prev : { top: minTop, left: minLeft, width: maxRight - minLeft, height: maxBottom - minTop, minColLeft, wrapperRight }))
      setIsButtonVisible(isVisibleInWrapper && isWithinContainer)
    } else {
      setSelectionRect(prev => (prev === null ? prev : null))
      setIsButtonVisible(prev => (prev === false ? prev : false))
    }
  }, [getActiveCells, appendTo])

  const triggerUpdate = useCallback(() => {
    updateSelectionRect()
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    animFrameRef.current = requestAnimationFrame(() => { updateSelectionRect(); animFrameRef.current = null })
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => { updateSelectionRect(); timeoutRef.current = null }, 30)
  }, [updateSelectionRect])

  useEffect(() => {
    const handleClose = (e: any) => { if (e.detail !== 'tableCell' && menuOpen) setMenuOpen(false) }
    window.addEventListener('tiptap:close-menus', handleClose)
    return () => window.removeEventListener('tiptap:close-menus', handleClose)
  }, [menuOpen])

  useEffect(() => {
    const handleScroll = () => { if (menuOpen) setMenuOpen(false) }
    window.addEventListener('scroll', handleScroll, { passive: true, capture: true })
    return () => window.removeEventListener('scroll', handleScroll, { capture: true })
  }, [menuOpen])

  useEffect(() => {
    triggerUpdate()
    editor.on('selectionUpdate', triggerUpdate)
    editor.on('transaction', triggerUpdate)
    editor.on('update', triggerUpdate)
    const handleScroll = () => {
      setIsScrolling(true)
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
      scrollTimerRef.current = setTimeout(() => { setIsScrolling(false); triggerUpdate(); scrollTimerRef.current = null }, 60)
    }
    window.addEventListener('scroll', handleScroll, { passive: true, capture: true })
    window.addEventListener('resize', handleScroll, { passive: true })
    return () => {
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      editor.off('selectionUpdate', triggerUpdate)
      editor.off('transaction', triggerUpdate)
      editor.off('update', triggerUpdate)
      window.removeEventListener('scroll', handleScroll, { capture: true })
      window.removeEventListener('resize', handleScroll)
    }
  }, [editor, triggerUpdate])

  useEffect(() => {
    const dom = editor.view?.dom
    if (!dom) return
    const ro = new ResizeObserver(() => triggerUpdate())
    ro.observe(dom)
    dom.querySelectorAll('table').forEach(t => ro.observe(t))
    const mo = new MutationObserver(() => triggerUpdate())
    mo.observe(dom, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['style', 'width', 'colwidth', 'class', 'rowspan', 'colspan', 'height'],
    })
    const onMouseMove = (e: MouseEvent) => {
      if (e.buttons > 0) updateSelectionRect()
    }
    window.addEventListener('mousemove', onMouseMove, { passive: true })
    return () => {
      ro.disconnect()
      mo.disconnect()
      window.removeEventListener('mousemove', onMouseMove)
    }
  }, [editor, triggerUpdate, updateSelectionRect])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault(); e.stopPropagation()
    isDraggingHandleRef.current = true
    const { view } = editor
    if (!view) return
    const startCells = getActiveCells()
    if (startCells.length === 0) return
    const startPos = getCellPosFromDOM(view, startCells[0])
    if (startPos === null) return
    let hasMoved = false

    const tableWrapper = startCells[0]?.closest('.tableWrapper') as HTMLElement | null
    const scrollContainer = (appendTo?.current as HTMLElement) || (typeof window !== 'undefined' ? window : null)

    const updateSelectionAtCoords = (clientX: number, clientY: number) => {
      const targetEl = document.elementFromPoint(clientX, clientY)?.closest('td, th') as HTMLElement | null
      if (!targetEl) return
      const endPos = getCellPosFromDOM(view, targetEl)
      if (endPos === null) return
      try {
        const cellSelection = new CellSelection(view.state.doc.resolve(startPos), view.state.doc.resolve(endPos))
        view.dispatch(view.state.tr.setSelection(cellSelection))
      } catch {}
    }

    const autoScroller = startAutoScroll({
      tableWrapper,
      scrollContainer,
      onTick: (cx, cy) => {
        if (hasMoved) updateSelectionAtCoords(cx, cy)
      },
    })

    const cleanUpPointerDrag = () => {
      autoScroller.stop()
      isDraggingHandleRef.current = false
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('keydown', onKeyDown, { capture: true })
    }
    const onKeyDown = (keyEvt: KeyboardEvent) => {
      if (keyEvt.key === 'Escape') {
        keyEvt.preventDefault(); keyEvt.stopPropagation(); keyEvt.stopImmediatePropagation()
        cleanUpPointerDrag()
      }
    }
    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (Math.hypot(moveEvent.clientX - e.clientX, moveEvent.clientY - e.clientY) > 6) hasMoved = true
      if (!hasMoved) return
      autoScroller.updateCoords(moveEvent.clientX, moveEvent.clientY)
      updateSelectionAtCoords(moveEvent.clientX, moveEvent.clientY)
    }
    const handlePointerUp = () => {
      cleanUpPointerDrag()
      if (!hasMoved) setMenuOpen(prev => !prev)
    }
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('keydown', onKeyDown, { capture: true })
  }, [editor, getActiveCells, appendTo])

  const onMergeCells = useCallback(() => {
    if (isSelectionStraddlingHeader(editor)) return
    editor.chain().focus().mergeCells().run(); setMenuOpen(false)
  }, [editor])

  const onSplitCell = useCallback(() => {
    const { state, view } = editor
    if (!view) return
    const table = findTable(state.selection)
    if (table) {
      const map = TableMap.get(table.node)
      let rect: { left: number; right: number; top: number; bottom: number } | null = null
      if (isCellSelection(state.selection)) {
        const start = state.selection.$anchorCell.start(-1)
        rect = map.rectBetween(state.selection.$anchorCell.pos - start, state.selection.$headCell.pos - start)
      } else {
        const $pos = state.selection.$from
        for (let d = $pos.depth; d > 0; d--) {
          const n = $pos.node(d)
          if (n.type.spec.tableRole === 'cell' || n.type.spec.tableRole === 'header_cell') {
            const cellPos = $pos.before(d) - table.start
            rect = map.findCell(cellPos)
            break
          }
        }
      }

      if (rect) {
        const cellPositions: number[] = []
        const seen = new Set<number>()
        for (let r = rect.top; r < rect.bottom; r++) {
          for (let c = rect.left; c < rect.right; c++) {
            const offset = map.map[r * map.width + c]
            if (seen.has(offset)) continue
            seen.add(offset)
            const node = table.node.nodeAt(offset)
            if (node && ((node.attrs.colspan && node.attrs.colspan > 1) || (node.attrs.rowspan && node.attrs.rowspan > 1))) {
              cellPositions.push(table.start + offset)
            }
          }
        }

        if (cellPositions.length > 0) {
          cellPositions.sort((a, b) => b - a)
          for (const pos of cellPositions) {
            try {
              const tr = view.state.tr.setSelection(new CellSelection(view.state.doc.resolve(pos), view.state.doc.resolve(pos)))
              view.dispatch(tr)
              splitCell(view.state, view.dispatch)
            } catch {}
          }
          setMenuOpen(false)
          return
        }
      }
    }
    editor.chain().focus().splitCell().run()
    setMenuOpen(false)
  }, [editor])

  const onClearContents = useCallback(() => { editor.chain().focus().deleteSelection().run(); setMenuOpen(false) }, [editor])
  const onDeleteRow = useCallback(() => { editor.chain().focus().deleteRow().run(); setMenuOpen(false) }, [editor])
  const onDeleteColumn = useCallback(() => { editor.chain().focus().deleteColumn().run(); setMenuOpen(false) }, [editor])

  useEffect(() => {
    const editorDom = editor.view?.dom
    if (!editorDom) return
    const handleContextMenu = (e: MouseEvent) => {
      const cellEl = (e.target as HTMLElement | null)?.closest('td, th') as HTMLElement | null
      if (!cellEl || !editorDom.contains(cellEl)) return
      e.preventDefault(); e.stopPropagation()
      if (!cellEl.classList.contains('selectedCell')) {
        try { editor.chain().focus().setTextSelection(editor.view.posAtDOM(cellEl, 0)).run() } catch {}
      }
      window.dispatchEvent(new CustomEvent('tiptap:reset-scroll-lock'))
      setMenuOpen(true)
    }
    editorDom.addEventListener('contextmenu', handleContextMenu)
    return () => editorDom.removeEventListener('contextmenu', handleContextMenu)
  }, [editor])

  const canMerge = editor.can().mergeCells() && !isSelectionStraddlingHeader(editor)
  const canSplit = useMemo(() => {
    try {
      const { selection } = editor.state
      const table = findTable(selection)
      if (table && isCellSelection(selection)) {
        const map = TableMap.get(table.node)
        const start = selection.$anchorCell.start(-1)
        const rawRect = map.rectBetween(selection.$anchorCell.pos - start, selection.$headCell.pos - start)
        const expRect = expandRectToMergedCells(table.node, rawRect)
        for (let r = expRect.top; r < expRect.bottom; r++) {
          for (let c = expRect.left; c < expRect.right; c++) {
            const offset = map.map[r * map.width + c]
            const n = table.node.nodeAt(offset)
            if (n && ((n.attrs.colspan && n.attrs.colspan > 1) || (n.attrs.rowspan && n.attrs.rowspan > 1))) {
              return true
            }
          }
        }
      }
    } catch {}
    return hasMergedCellsInSelection(editor) || editor.can().splitCell()
  }, [editor, editor.state.selection])

  const itemClass = "w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-left transition-colors text-zinc-700 dark:text-[#e3e3e3] hover:bg-black/5 dark:hover:bg-white/[0.08] active:bg-black/10 dark:active:bg-white/[0.12] select-none cursor-pointer"
  const dangerClass = "w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-left transition-colors text-red-600 dark:text-red-400 hover:bg-red-500/10 active:bg-red-500/20 select-none cursor-pointer"
  const isExpanded = isBtnHovered || menuOpen

  const isMultiCells = getActiveCells().length > 1
  const shouldRender = mounted && (!isScrolling || isDraggingHandleRef.current) && typeof document !== 'undefined' && selectionRect && !editor.view?.dragging && (isCellSelected || editor.isActive('tableCell') || editor.isActive('tableHeader') || Boolean(tableGripPluginKey.getState(editor.state)))
  if (!shouldRender) return <></>

  return (
    <>
      {createPortal(
        <>
          <ContainingBlockAnchor ref={anchorRef} />
          {/* 1. Selection Perimeter Outline & Background - Isolated Stacking Context z-index: 8 (below blur z-12) */}
          <div
            id="table-cell-selection"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              zIndex: 8,
              pointerEvents: 'none',
              clipPath: selectionRect.minColLeft !== undefined && selectionRect.wrapperRight !== undefined
                ? `polygon(${selectionRect.minColLeft - offset.x}px 0, ${selectionRect.wrapperRight - offset.x}px 0, ${selectionRect.wrapperRight - offset.x}px 100%, ${selectionRect.minColLeft - offset.x}px 100%)`
                : undefined,
            }}
          >
            <div
              className="fixed pointer-events-none rounded-[2px] transition-all duration-75 z-[8] border-2 border-[color-mix(in_srgb,var(--editor-primary)_85%,transparent)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--editor-primary)_20%,transparent)]"
              style={{
                top: selectionRect.top - offset.y,
                left: selectionRect.left - offset.x,
                width: selectionRect.width,
                height: selectionRect.height,
                borderColor: 'color-mix(in srgb, var(--editor-primary, #faaf2d) 85%, transparent)',
                backgroundColor: isMultiCells ? 'color-mix(in srgb, var(--editor-primary, #faaf2d) 12%, transparent)' : 'transparent',
                zIndex: 8,
              }}
            />
          </div>

          {/* 2. Expandable 4-dot Circle Trigger & Popover Menu - z-index: 9 (below blur z-12) */}
          {isButtonVisible && (
            <div className="fixed z-[9] -translate-y-1/2 flex items-center" style={{ top: selectionRect.top + selectionRect.height / 2 - offset.y, left: selectionRect.left + selectionRect.width - offset.x, zIndex: 9 }}>
              <Popover.Root open={menuOpen} onOpenChange={open => { if (open) window.dispatchEvent(new CustomEvent('tiptap:close-menus', { detail: 'tableCell' })); setMenuOpen(open) }}>
                <Popover.Anchor asChild>
                  <button type="button" onPointerDown={handlePointerDown} onClick={e => { e.preventDefault(); e.stopPropagation() }}
                    onMouseEnter={() => setIsBtnHovered(true)} onMouseLeave={() => setIsBtnHovered(false)}
                    style={{ backgroundColor: 'var(--editor-primary, #faaf2d)' }}
                    className={`rounded-full bg-[var(--editor-primary)] text-white shadow-xs cursor-pointer transition-all duration-150 flex items-center justify-center p-0 outline-none z-[9] select-none ${isExpanded ? 'w-4 h-4 -ml-2' : 'w-2 h-2 -ml-1'}`}
                    title="Click for options, drag to adjust cell selection" aria-label="Table cells option">
                    <svg className={`w-2.5 h-2.5 fill-current transition-opacity duration-150 ${isExpanded ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`} viewBox="0 0 16 16">
                      <circle cx="5" cy="5" r="1.5" /><circle cx="11" cy="5" r="1.5" /><circle cx="5" cy="11" r="1.5" /><circle cx="11" cy="11" r="1.5" />
                    </svg>
                  </button>
                </Popover.Anchor>
                <Popover.Portal container={typeof document !== 'undefined' ? ((appendTo?.current as HTMLElement) || document.body) : undefined}>
                  <Popover.Content side="right" align="center" sideOffset={10} collisionPadding={16} data-theme={editor?.view?.dom?.closest('.editor-theme-dark') ? 'dark' : 'light'}
                    className={cn('z-[1340] outline-none animate-in fade-in-0 zoom-in-95 duration-150', editor?.view?.dom?.closest('.editor-theme-dark') ? 'editor-theme-dark dark theme-dark' : 'editor-theme-light theme-light')}
                  >
                    <div className="glass-menu min-w-[12rem] p-1.5 shadow-2xl rounded-xl flex flex-col gap-0.5 bg-white dark:bg-[#202020]/95 backdrop-blur-md border border-black/5 dark:border-white/10 text-zinc-800 dark:text-zinc-200">
                      <TableAlignmentSubmenu editor={editor} scope="cell" />
                      <div className="h-[1px] bg-black/5 dark:bg-white/10 my-0.5" />
                      {canMerge && <button type="button" onClick={onMergeCells} className={itemClass}><Icon name="Combine" className="w-3.5 h-3.5 text-zinc-500 dark:text-[#9b9b9b]" /><span>Merge cells</span></button>}
                      {canSplit && <button type="button" onClick={onSplitCell} className={itemClass}><Icon name="Split" className="w-3.5 h-3.5 text-zinc-500 dark:text-[#9b9b9b]" /><span>Split cell</span></button>}
                      <button type="button" onClick={onClearContents} className={itemClass}><Icon name="Eraser" className="w-3.5 h-3.5 text-zinc-500 dark:text-[#9b9b9b]" /><span>Clear contents</span></button>
                      <div className="h-[1px] bg-black/5 dark:bg-white/10 my-0.5" />
                      <button type="button" onClick={onDeleteRow} className={dangerClass}><DeleteRowIcon /><span>Delete row</span></button>
                      <button type="button" onClick={onDeleteColumn} className={dangerClass}><DeleteColumnIcon /><span>Delete column</span></button>
                    </div>
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
            </div>
          )}
        </>,
        (appendTo?.current as HTMLElement) || (typeof document !== 'undefined' ? (document.body as HTMLElement) : (null as any)),
      )}
    </>
  )
})

TableCellMenu.displayName = 'TableCellMenu'

export default TableCellMenu
