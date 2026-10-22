import React, { useCallback, useState, useEffect, useRef, JSX } from 'react'
import { createPortal } from 'react-dom'
import * as Popover from '@radix-ui/react-popover'
import { CellSelection } from '@tiptap/pm/tables'
import { isCellSelection } from '../../utils'
import { Icon } from '@/components/ui/Icon'
import { MenuProps } from '@/components/menus/types'
import { TableAlignmentSubmenu } from '../TableAlignmentSubmenu'

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

export const TableCellMenu = React.memo(({ editor }: MenuProps): JSX.Element => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [isBtnHovered, setIsBtnHovered] = useState(false)
  const [selectionRect, setSelectionRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null)
  const [isButtonVisible, setIsButtonVisible] = useState(false)
  const isDraggingHandleRef = useRef(false)

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

      setSelectionRect({
        top: minTop,
        left: minLeft,
        width: maxRight - minLeft,
        height: maxBottom - minTop,
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
      setSelectionRect(null)
      setIsButtonVisible(false)
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

  useEffect(() => {
    updateSelectionRect()
    editor.on('selectionUpdate', updateSelectionRect)
    editor.on('transaction', updateSelectionRect)
    window.addEventListener('scroll', updateSelectionRect, { passive: true, capture: true })
    window.addEventListener('resize', updateSelectionRect, { passive: true })

    return () => {
      editor.off('selectionUpdate', updateSelectionRect)
      editor.off('transaction', updateSelectionRect)
      window.removeEventListener('scroll', updateSelectionRect, { capture: true })
      window.removeEventListener('resize', updateSelectionRect)
    }
  }, [editor, updateSelectionRect])

  // Drag-to-select cell interaction
  const handleButtonMouseDown = useCallback(
    (e: React.MouseEvent) => {
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

      const handleMouseMove = (moveEvent: MouseEvent) => {
        hasMoved = true
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

      const handleMouseUp = () => {
        isDraggingHandleRef.current = false
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)

        if (!hasMoved) {
          setMenuOpen(prev => !prev)
        }
      }

      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    },
    [editor, getActiveCells],
  )

  const onAlign = useCallback(
    (alignment: 'left' | 'center' | 'right') => (e: React.MouseEvent) => {
      e.stopPropagation()
      try {
        editor.chain().focus().setCellAttribute('textAlign', alignment).setTextAlign(alignment).run()
      } catch {
        editor.chain().focus().setCellAttribute('textAlign', alignment).run()
      }
    },
    [editor],
  )

  const activeAlign =
    editor.getAttributes('tableCell').textAlign ||
    editor.getAttributes('tableHeader').textAlign ||
    (editor.isActive({ textAlign: 'center' })
      ? 'center'
      : editor.isActive({ textAlign: 'right' })
      ? 'right'
      : 'left')

  const onMergeCells = useCallback(() => {
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

  const canMerge = editor.can().mergeCells()
  const canSplit = editor.can().splitCell()

  const itemClass =
    'w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-left transition-colors text-zinc-700 dark:text-[#e3e3e3] hover:bg-black/5 dark:hover:bg-white/[0.08] active:bg-black/10 dark:active:bg-white/[0.12] select-none cursor-pointer'

  const isExpanded = isBtnHovered || menuOpen

  const shouldRender =
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
            className="fixed pointer-events-none rounded-[2px] transition-all duration-75 z-[1390] border-2 border-indigo-500/85 dark:border-violet-400/85 shadow-[0_0_0_1px_rgba(99,102,241,0.2)]"
            style={{
              top: selectionRect.top,
              left: selectionRect.left,
              width: selectionRect.width,
              height: selectionRect.height,
            }}
          />

          {/* 2. Expandable 4-dot Circle Trigger (8px -> 16px) & Popover Menu */}
          {isButtonVisible && (
            <div
              className="fixed z-[1395] -translate-y-1/2 flex items-center"
              style={{
                top: selectionRect.top + selectionRect.height / 2,
                left: selectionRect.left + selectionRect.width,
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
                <Popover.Trigger asChild>
                  <button
                    type="button"
                    onPointerDown={e => {
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                    onMouseDown={handleButtonMouseDown}
                    onMouseEnter={() => setIsBtnHovered(true)}
                    onMouseLeave={() => setIsBtnHovered(false)}
                    className={`rounded-full bg-indigo-600 dark:bg-violet-500 text-white shadow-xs cursor-pointer transition-all duration-150 flex items-center justify-center p-0 outline-none z-30 select-none ${
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
                </Popover.Trigger>
                <Popover.Content
                  side="right"
                  align="start"
                  sideOffset={8}
                  className="z-[1400] outline-none animate-in fade-in-0 zoom-in-95 duration-150"
                >
                  <div className="glass-menu min-w-[12rem] p-1.5 shadow-2xl rounded-xl flex flex-col gap-0.5 bg-white/85 dark:bg-[#202020]/90 backdrop-blur-md border border-black/5 dark:border-white/10 text-zinc-800 dark:text-zinc-200">
                    {/* 1. One-click Segmented Alignment Toolbar */}
                    <div className="flex items-center gap-1 p-0.5 bg-black/5 dark:bg-white/5 rounded-md mb-0.5">
                      <button
                        type="button"
                        onClick={onAlign('left')}
                        className={`flex-1 py-1 flex items-center justify-center rounded text-xs transition-colors ${
                          activeAlign === 'left'
                            ? 'bg-white dark:bg-white/20 text-indigo-600 dark:text-violet-300 shadow-xs font-semibold'
                            : 'hover:bg-black/10 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-200'
                        }`}
                        title="Align left"
                      >
                        <Icon name="AlignLeft" className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={onAlign('center')}
                        className={`flex-1 py-1 flex items-center justify-center rounded text-xs transition-colors ${
                          activeAlign === 'center'
                            ? 'bg-white dark:bg-white/20 text-indigo-600 dark:text-violet-300 shadow-xs font-semibold'
                            : 'hover:bg-black/10 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-200'
                        }`}
                        title="Align center"
                      >
                        <Icon name="AlignCenter" className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={onAlign('right')}
                        className={`flex-1 py-1 flex items-center justify-center rounded text-xs transition-colors ${
                          activeAlign === 'right'
                            ? 'bg-white dark:bg-white/20 text-indigo-600 dark:text-violet-300 shadow-xs font-semibold'
                            : 'hover:bg-black/10 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-200'
                        }`}
                        title="Align right"
                      >
                        <Icon name="AlignRight" className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* 2. Submenu for detailed Vertical Alignment */}
                    <TableAlignmentSubmenu editor={editor} onClose={() => setMenuOpen(false)} />

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
                  </div>
                </Popover.Content>
              </Popover.Root>
            </div>
          )}
        </>,
        document.body,
      )}
    </>
  )
})

TableCellMenu.displayName = 'TableCellMenu'

export default TableCellMenu
