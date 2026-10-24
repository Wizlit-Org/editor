import React, { useCallback, useState, useEffect, useRef, useMemo, JSX } from 'react'
import { createPortal } from 'react-dom'
import * as Popover from '@radix-ui/react-popover'
import { CellSelection, splitCell, TableMap } from '@tiptap/pm/tables'
import { findTable, isCellSelection } from '../../utils'
import { expandRectToMergedCells } from '../../utils/TableClusterUtils'
import { isSelectionStraddlingHeader, hasMergedCellsInSelection } from '../../utils/TableHeaderStraddleUtils'
import { useContainingBlockOffset, ContainingBlockAnchor } from '../../utils/containingBlock'
import { startAutoScroll } from '../../utils/TableAutoScroll'
import { Icon } from '@/components/ui/Icon'
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
  const [selectionRect, setSelectionRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null)
  const [isButtonVisible, setIsButtonVisible] = useState(false)
  const [isScrolling, setIsScrolling] = useState(false)
  const isDraggingHandleRef = useRef(false)
  const scrollTimerRef = useRef<NodeJS.Timeout | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

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
        const cellOffsets = map.cellsInRect(expandedRect)
        const domCells: HTMLElement[] = []

        cellOffsets.forEach(offset => {
          try {
            const cellPos = table.start + offset
            const nodeDom = editor.view.nodeDOM(cellPos) as HTMLElement | null
            const cellEl = nodeDom && nodeDom.nodeType === 1 ? nodeDom : (editor.view.domAtPos(cellPos + 1).node as HTMLElement)?.closest?.('td, th') as HTMLElement | null
            if (cellEl) {
              domCells.push(cellEl)
              if (!cellEl.classList.contains('selectedCell')) {
                cellEl.classList.add('selectedCell')
              }
            }
          } catch {}
        })

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

      setSelectionRect(prev => (prev && prev.top === minTop && prev.left === minLeft && prev.width === maxRight - minLeft && prev.height === maxBottom - minTop ? prev : { top: minTop, left: minLeft, width: maxRight - minLeft, height: maxBottom - minTop }))

      const tableWrapper = cells[0].closest('.tableWrapper') as HTMLElement | null
      let isVisibleInWrapper = true
      if (tableWrapper) {
        const wrapperRect = tableWrapper.getBoundingClientRect()
        const isHorizontallyVisible = maxRight >= wrapperRect.left - 8 && maxRight <= wrapperRect.right + 15
        const isVerticallyVisible = minTop < window.innerHeight && maxBottom > 0
        isVisibleInWrapper = isHorizontallyVisible && isVerticallyVisible
      }

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
        const cellOffsets = map.cellsInRect(rect)
        const cellPositions: number[] = []
        const seen = new Set<number>()
        for (const offset of cellOffsets) {
          if (seen.has(offset)) continue
          seen.add(offset)
          const node = table.node.nodeAt(offset)
          if (node && ((node.attrs.colspan && node.attrs.colspan > 1) || (node.attrs.rowspan && node.attrs.rowspan > 1))) {
            cellPositions.push(table.start + offset)
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
        const cells = map.cellsInRect(expRect)
        for (const offset of cells) {
          const n = table.node.nodeAt(offset)
          if (n && ((n.attrs.colspan && n.attrs.colspan > 1) || (n.attrs.rowspan && n.attrs.rowspan > 1))) {
            return true
          }
        }
      }
    } catch {}
    return hasMergedCellsInSelection(editor) || editor.can().splitCell()
  }, [editor, editor.state.selection])

  const itemClass = "w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-left transition-colors text-zinc-700 dark:text-[#e3e3e3] hover:bg-black/5 dark:hover:bg-white/[0.08] active:bg-black/10 dark:active:bg-white/[0.12] select-none cursor-pointer"
  const dangerClass = "w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-left transition-colors text-red-600 dark:text-red-400 hover:bg-red-500/10 active:bg-red-500/20 select-none cursor-pointer"
  const isExpanded = isBtnHovered || menuOpen

  const shouldRender = mounted && (!isScrolling || isDraggingHandleRef.current) && typeof document !== 'undefined' && selectionRect && !editor.view?.dragging && (isCellSelected || editor.isActive('tableCell') || editor.isActive('tableHeader'))
  if (!shouldRender) return <></>

  return (
    <>
      {createPortal(
        <>
          <ContainingBlockAnchor ref={anchorRef} />
          {/* 1. Selection Perimeter Continuous 2px Outline & Unified Selection Background */}
          <div className="fixed pointer-events-none rounded-[2px] transition-all duration-75 z-[15] border-2 border-indigo-500/85 dark:border-violet-400/85 shadow-[0_0_0_1px_rgba(99,102,241,0.2)]"
            style={{
              top: selectionRect.top - offset.y,
              left: selectionRect.left - offset.x,
              width: selectionRect.width,
              height: selectionRect.height,
              backgroundColor: 'rgba(99, 102, 241, 0.12)',
              zIndex: 15,
            }} />

          {/* 2. Expandable 4-dot Circle Trigger & Popover Menu */}
          {isButtonVisible && (
            <div className="fixed z-[16] -translate-y-1/2 flex items-center"
              style={{ top: selectionRect.top + selectionRect.height / 2 - offset.y, left: selectionRect.left + selectionRect.width - offset.x, zIndex: 16 }}>
              <Popover.Root open={menuOpen} onOpenChange={open => { if (open) window.dispatchEvent(new CustomEvent('tiptap:close-menus', { detail: 'tableCell' })); setMenuOpen(open) }}>
                <Popover.Anchor asChild>
                  <button type="button" onPointerDown={handlePointerDown} onClick={e => { e.preventDefault(); e.stopPropagation() }}
                    onMouseEnter={() => setIsBtnHovered(true)} onMouseLeave={() => setIsBtnHovered(false)}
                    className={`rounded-full bg-indigo-600 dark:bg-violet-500 text-white shadow-xs cursor-pointer transition-all duration-150 flex items-center justify-center p-0 outline-none z-[16] select-none ${isExpanded ? 'w-4 h-4 -ml-2' : 'w-2 h-2 -ml-1'}`}
                    title="Click for options, drag to adjust cell selection" aria-label="Table cells option">
                    <svg className={`w-2.5 h-2.5 fill-current transition-opacity duration-150 ${isExpanded ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`} viewBox="0 0 16 16">
                      <circle cx="5" cy="5" r="1.5" /><circle cx="11" cy="5" r="1.5" /><circle cx="5" cy="11" r="1.5" /><circle cx="11" cy="11" r="1.5" />
                    </svg>
                  </button>
                </Popover.Anchor>
                <Popover.Portal container={typeof document !== 'undefined' ? ((appendTo?.current as HTMLElement) || document.body) : undefined}>
                  <Popover.Content side="right" align="center" sideOffset={10} collisionPadding={16} className="z-[1350] outline-none animate-in fade-in-0 zoom-in-95 duration-150" style={{ zIndex: 1350 }}>
                    <div className="glass-menu min-w-[12rem] p-1.5 shadow-2xl rounded-xl flex flex-col gap-0.5 bg-white/85 dark:bg-[#202020]/90 backdrop-blur-md border border-black/5 dark:border-white/10 text-zinc-800 dark:text-zinc-200">
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
