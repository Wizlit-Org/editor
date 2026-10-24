import React, { useCallback, useState, useEffect, useRef, JSX } from 'react'
import { createPortal } from 'react-dom'
import * as Popover from '@radix-ui/react-popover'
import { CellSelection } from '@tiptap/pm/tables'
import { isCellSelection } from '../../utils'
import { isSelectionStraddlingHeader } from '../../utils/TableHeaderStraddleUtils'
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
      if (nodeName === 'tableCell' || nodeName === 'tableHeader') {
        return $pos.before(d)
      }
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

  useEffect(() => {
    setMounted(true)
  }, [])

  const isCellSelected = isCellSelection(editor.state?.selection)

  // Find target cell element(s) - either multiple selected cells or single active cell
  const getActiveCells = useCallback((): HTMLElement[] => {
    if (!editor.view?.dom) return []
    const selectedCells = Array.from(editor.view.dom.querySelectorAll('.selectedCell')) as HTMLElement[]
    if (selectedCells.length > 0) return selectedCells

    // Single cell fallback: active cursor inside tableCell/tableHeader
    if (editor.isActive('tableCell') || editor.isActive('tableHeader')) {
      try {
        const { from } = editor.state.selection
        const domAt = editor.view.domAtPos(from)
        const cellEl = (domAt.node instanceof HTMLElement ? domAt.node : domAt.node.parentElement)?.closest('td, th') as HTMLElement | null
        if (cellEl) return [cellEl]
      } catch {
        // Fallback
      }
    }
    return []
  }, [editor])

  const updateSelectionRect = useCallback(() => {
    const cells = getActiveCells()
    if (cells.length > 0) {
      let minTop = Infinity
      let maxBottom = -Infinity
      let maxRight = -Infinity
      let minLeft = Infinity

      cells.forEach(cell => {
        const r = cell.getBoundingClientRect()
        if (r.top < minTop) minTop = r.top
        if (r.bottom > maxBottom) maxBottom = r.bottom
        if (r.right > maxRight) maxRight = r.right
        if (r.left < minLeft) minLeft = r.left
      })

      // Check if target cells are still visible in viewport
      if (maxBottom < 0 || minTop > window.innerHeight || maxRight < 0 || minLeft > window.innerWidth) {
        setSelectionRect(null)
        setIsButtonVisible(false)
        setMenuOpen(false)
        return
      }

      setSelectionRect(prev => {
        if (
          prev &&
          prev.top === minTop &&
          prev.left === minLeft &&
          prev.width === maxRight - minLeft &&
          prev.height === maxBottom - minTop
        ) {
          return prev
        }
        return {
          top: minTop,
          left: minLeft,
          width: maxRight - minLeft,
          height: maxBottom - minTop,
        }
      })

      // Check horizontal visibility inside tableWrapper
      const tableWrapper = cells[0].closest('.tableWrapper') as HTMLElement | null
      if (tableWrapper) {
        const wrapperRect = tableWrapper.getBoundingClientRect()
        const isHorizontallyVisible = maxRight >= wrapperRect.left && maxRight <= wrapperRect.right + 10
        const isVerticallyVisible = minTop < window.innerHeight && maxBottom > 0
        setIsButtonVisible(isHorizontallyVisible && isVerticallyVisible)
      } else {
        setIsButtonVisible(true)
      }
    } else {
      setSelectionRect(prev => (prev === null ? prev : null))
      setIsButtonVisible(prev => (prev === false ? prev : false))
    }
  }, [getActiveCells])

  useEffect(() => {
    const handleCloseMenus = (e: any) => {
      if (e.detail !== 'tableCell' && menuOpen) {
        setMenuOpen(false)
      }
    }
    window.addEventListener('tiptap:close-menus', handleCloseMenus)
    return () => window.removeEventListener('tiptap:close-menus', handleCloseMenus)
  }, [menuOpen])

  // Auto-close cell menu on editor or window scroll
  useEffect(() => {
    const handleScroll = () => {
      if (menuOpen) {
        setMenuOpen(false)
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true, capture: true })
    return () => window.removeEventListener('scroll', handleScroll, { capture: true })
  }, [menuOpen])

  useEffect(() => {
    updateSelectionRect()
    const handleScroll = () => {
      setIsScrolling(true)
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
      scrollTimerRef.current = setTimeout(() => {
        setIsScrolling(false)
        updateSelectionRect()
        scrollTimerRef.current = null
      }, 60)
    }

    editor.on('selectionUpdate', updateSelectionRect)
    window.addEventListener('scroll', handleScroll, { passive: true, capture: true })
    window.addEventListener('resize', handleScroll, { passive: true })

    return () => {
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
      editor.off('selectionUpdate', updateSelectionRect)
      window.removeEventListener('scroll', handleScroll, { capture: true })
      window.removeEventListener('resize', handleScroll)
    }
  }, [editor, updateSelectionRect])

  // Drag-to-select cell interaction via unified PointerEvents
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()

      isDraggingHandleRef.current = true
      const { view } = editor
      if (!view) return

      const startCells = getActiveCells()
      if (startCells.length === 0) return
      const startCell = startCells[0]
      const startPos = getCellPosFromDOM(view, startCell)
      if (startPos === null) return

      let hasMoved = false

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const dist = Math.hypot(moveEvent.clientX - e.clientX, moveEvent.clientY - e.clientY)
        if (dist > 6) {
          hasMoved = true
        }
        if (!hasMoved) return

        const targetEl = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)
        if (!targetEl) return

        const cellEl = targetEl.closest('td, th') as HTMLElement | null
        if (!cellEl) return

        const endPos = getCellPosFromDOM(view, cellEl)
        if (endPos === null) return

        try {
          const $anchor = view.state.doc.resolve(startPos)
          const $head = view.state.doc.resolve(endPos)
          const cellSelection = new CellSelection($anchor, $head)
          const tr = view.state.tr.setSelection(cellSelection)
          view.dispatch(tr)
        } catch {
          // Fallback if cell selection creation fails
        }
      }

      const handlePointerUp = () => {
        isDraggingHandleRef.current = false
        window.removeEventListener('pointermove', handlePointerMove)
        window.removeEventListener('pointerup', handlePointerUp)

        if (!hasMoved) {
          setMenuOpen(prev => !prev)
        }
      }

      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', handlePointerUp)
    },
    [editor, getActiveCells],
  )

  const onMergeCells = useCallback(() => {
    if (isSelectionStraddlingHeader(editor)) return
    editor.chain().focus().mergeCells().run()
    setMenuOpen(false)
  }, [editor])

  const onSplitCell = useCallback(() => {
    editor.chain().focus().splitCell().run()
    setMenuOpen(false)
  }, [editor])

  const onClearContents = useCallback(() => {
    editor.chain().focus().deleteSelection().run()
    setMenuOpen(false)
  }, [editor])

  const onDeleteRow = useCallback(() => {
    editor.chain().focus().deleteRow().run()
    setMenuOpen(false)
  }, [editor])

  const onDeleteColumn = useCallback(() => {
    editor.chain().focus().deleteColumn().run()
    setMenuOpen(false)
  }, [editor])

  // Context menu listener for right-clicking inside table cells
  useEffect(() => {
    const editorDom = editor.view?.dom
    if (!editorDom) return

    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      const cellEl = target?.closest('td, th') as HTMLElement | null
      if (!cellEl || !editorDom.contains(cellEl)) return

      e.preventDefault()
      e.stopPropagation()

      // If right-clicked cell is already part of multiple cell selection, preserve selection
      const isCurrentCellSelected = cellEl.classList.contains('selectedCell')
      if (!isCurrentCellSelected) {
        try {
          const innerPos = editor.view.posAtDOM(cellEl, 0)
          editor.chain().focus().setTextSelection(innerPos).run()
        } catch {}
      }

      window.dispatchEvent(new CustomEvent('tiptap:reset-scroll-lock'))
      setMenuOpen(true)
    }

    editorDom.addEventListener('contextmenu', handleContextMenu)
    return () => {
      editorDom.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [editor])

  const canMerge = editor.can().mergeCells() && !isSelectionStraddlingHeader(editor)
  const canSplit = editor.can().splitCell()

  const itemClass =
    'w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-left transition-colors text-zinc-700 dark:text-[#e3e3e3] hover:bg-black/5 dark:hover:bg-white/[0.08] active:bg-black/10 dark:active:bg-white/[0.12] select-none cursor-pointer'
  const dangerClass =
    'w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-left transition-colors text-red-600 dark:text-red-400 hover:bg-red-500/10 active:bg-red-500/20 select-none cursor-pointer'

  const isExpanded = isBtnHovered || menuOpen

  const shouldRender =
    mounted &&
    !isScrolling &&
    typeof document !== 'undefined' &&
    selectionRect &&
    !editor.view?.dragging &&
    (isCellSelected || editor.isActive('tableCell') || editor.isActive('tableHeader'))

  if (!shouldRender) {
    return <></>
  }

  return (
    <>
      {createPortal(
        <>
          {/* 1. Selection Perimeter Continuous 2px Outline (Notion Style point border) */}
          <div
            className="fixed pointer-events-none rounded-[2px] transition-all duration-75 z-[1330] border-2 border-indigo-500/85 dark:border-violet-400/85 shadow-[0_0_0_1px_rgba(99,102,241,0.2)]"
            style={{
              top: selectionRect.top,
              left: selectionRect.left,
              width: selectionRect.width,
              height: selectionRect.height,
              zIndex: 1330,
            }}
          />

          {/* 2. Expandable 4-dot Circle Trigger (8px -> 16px) & Popover Menu */}
          {isButtonVisible && (
            <div
              className="fixed z-[1330] -translate-y-1/2 flex items-center"
              style={{
                top: selectionRect.top + selectionRect.height / 2,
                left: selectionRect.left + selectionRect.width,
                zIndex: 1330,
              }}
            >
              <Popover.Root
                open={menuOpen}
                onOpenChange={open => {
                  if (open) {
                    window.dispatchEvent(new CustomEvent('tiptap:close-menus', { detail: 'tableCell' }))
                  }
                  setMenuOpen(open)
                }}
              >
                <Popover.Anchor asChild>
                  <button
                    type="button"
                    onPointerDown={handlePointerDown}
                    onClick={e => {
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                    onMouseEnter={() => setIsBtnHovered(true)}
                    onMouseLeave={() => setIsBtnHovered(false)}
                    className={`rounded-full bg-indigo-600 dark:bg-violet-500 text-white shadow-xs cursor-pointer transition-all duration-150 flex items-center justify-center p-0 outline-none z-[1330] select-none ${
                      isExpanded ? 'w-4 h-4 -ml-2' : 'w-2 h-2 -ml-1'
                    }`}
                    title="Click for options, drag to adjust cell selection"
                    aria-label="Table cells option"
                  >
                    <svg
                      className={`w-2.5 h-2.5 fill-current transition-opacity duration-150 ${
                        isExpanded ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
                      }`}
                      viewBox="0 0 16 16"
                    >
                      <circle cx="5" cy="5" r="1.5" />
                      <circle cx="11" cy="5" r="1.5" />
                      <circle cx="5" cy="11" r="1.5" />
                      <circle cx="11" cy="11" r="1.5" />
                    </svg>
                  </button>
                </Popover.Anchor>
                <Popover.Portal container={typeof document !== 'undefined' ? document.body : undefined}>
                  <Popover.Content
                    side="right"
                    align="center"
                    sideOffset={10}
                    collisionPadding={16}
                    className="z-[1350] outline-none animate-in fade-in-0 zoom-in-95 duration-150"
                    style={{ zIndex: 1350 }}
                  >
                    <div className="glass-menu min-w-[12rem] p-1.5 shadow-2xl rounded-xl flex flex-col gap-0.5 bg-white/85 dark:bg-[#202020]/90 backdrop-blur-md border border-black/5 dark:border-white/10 text-zinc-800 dark:text-zinc-200">
                      {/* Alignment Toolbar (Horizontal & Vertical) */}
                      <TableAlignmentSubmenu editor={editor} scope="cell" />

                      <div className="h-[1px] bg-black/5 dark:bg-white/10 my-0.5" />

                      {canMerge && (
                        <button type="button" onClick={onMergeCells} className={itemClass}>
                          <Icon name="Combine" className="w-3.5 h-3.5 text-zinc-500 dark:text-[#9b9b9b]" />
                          <span>Merge cells</span>
                        </button>
                      )}

                      {canSplit && (
                        <button type="button" onClick={onSplitCell} className={itemClass}>
                          <Icon name="Split" className="w-3.5 h-3.5 text-zinc-500 dark:text-[#9b9b9b]" />
                          <span>Split cell</span>
                        </button>
                      )}

                      <button type="button" onClick={onClearContents} className={itemClass}>
                        <Icon name="Eraser" className="w-3.5 h-3.5 text-zinc-500 dark:text-[#9b9b9b]" />
                        <span>Clear contents</span>
                      </button>

                      <div className="h-[1px] bg-black/5 dark:bg-white/10 my-0.5" />

                      <button type="button" onClick={onDeleteRow} className={dangerClass}>
                        <DeleteRowIcon />
                        <span>Delete row</span>
                      </button>

                      <button type="button" onClick={onDeleteColumn} className={dangerClass}>
                        <DeleteColumnIcon />
                        <span>Delete column</span>
                      </button>
                    </div>
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
            </div>
          )}
        </>,
        typeof document !== 'undefined' ? (document.body as HTMLElement) : (null as any),
      )}
    </>
  )
})

TableCellMenu.displayName = 'TableCellMenu'

export default TableCellMenu
