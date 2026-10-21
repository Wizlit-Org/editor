import { BubbleMenu as BaseBubbleMenu } from '@tiptap/react/menus'
import React, { useCallback, useState, useEffect, useRef, JSX } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { CellSelection } from '@tiptap/pm/tables'
import { isCellSelection } from '../../utils'
import { Icon } from '@/components/ui/Icon'
import { MenuProps, ShouldShowProps } from '@/components/menus/types'

const TABLE_CELL_MENU_OPTIONS = {
  placement: 'right' as const,
  offset: 0,
  flip: false,
  tippyOptions: {
    interactive: true,
    interactiveBorder: 30,
    delay: [0, 300],
  },
}

export const TableCellMenu = React.memo(({ editor, appendTo }: MenuProps): JSX.Element => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [selectionRect, setSelectionRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null)
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

      setSelectionRect({
        top: minTop,
        left: minLeft,
        width: maxRight - minLeft,
        height: maxBottom - minTop,
      })
    } else {
      setSelectionRect(null)
    }
  }, [getActiveCells])

  useEffect(() => {
    updateSelectionRect()
    editor.on('selectionUpdate', updateSelectionRect)
    window.addEventListener('scroll', updateSelectionRect, { passive: true, capture: true })
    window.addEventListener('resize', updateSelectionRect, { passive: true })

    return () => {
      editor.off('selectionUpdate', updateSelectionRect)
      window.removeEventListener('scroll', updateSelectionRect, { capture: true })
      window.removeEventListener('resize', updateSelectionRect)
    }
  }, [editor, updateSelectionRect])

  const shouldShow = useCallback(
    ({ state }: ShouldShowProps) => {
      if (!state) return false
      if (editor.view?.dragging || (typeof document !== 'undefined' && document.querySelector('[data-dragging="true"]'))) {
        return false
      }
      // Suppress if full row or column grip is selected
      if (typeof document !== 'undefined' && document.querySelector('a.grip-column.selected, a.grip-row.selected')) {
        return false
      }

      // Show if cell selection OR cursor is inside a single table cell
      if (isCellSelection(state.selection)) return true
      return editor.isActive('tableCell') || editor.isActive('tableHeader')
    },
    [editor],
  )

  const getReferencedVirtualElement = useCallback(() => {
    const cells = getActiveCells()
    if (cells.length > 0) {
      let minTop = Infinity
      let maxBottom = -Infinity
      let maxRight = -Infinity

      cells.forEach(cell => {
        const r = cell.getBoundingClientRect()
        if (r.top < minTop) minTop = r.top
        if (r.bottom > maxBottom) maxBottom = r.bottom
        if (r.right > maxRight) maxRight = r.right
      })

      const centerY = (minTop + maxBottom) / 2
      return {
        getBoundingClientRect: () => ({
          top: centerY,
          bottom: centerY,
          left: maxRight,
          right: maxRight,
          width: 0,
          height: 0,
          x: maxRight,
          y: centerY,
          toJSON: () => {},
        }),
      }
    }

    return null
  }, [getActiveCells])

  // Drag selection adjustment handler: Dragging the circle button expands/adjusts CellSelection
  const handleButtonMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const startX = e.clientX
      const startY = e.clientY
      let isDrag = false

      const { view, state } = editor
      let anchorCellPos = -1

      // Find anchor cell pos
      if (isCellSelection(state.selection)) {
        anchorCellPos = (state.selection as any).$anchorCell.pos
      } else {
        try {
          const domAt = view.domAtPos(state.selection.from)
          const cellEl = (domAt.node instanceof HTMLElement ? domAt.node : domAt.node.parentElement)?.closest('td, th') as HTMLElement | null
          if (cellEl) {
            anchorCellPos = view.posAtDOM(cellEl, 0)
          }
        } catch {
          anchorCellPos = -1
        }
      }

      const onMouseMove = (moveEvent: MouseEvent) => {
        const dist = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY)
        if (dist > 3) {
          isDrag = true
          isDraggingHandleRef.current = true
          document.body.style.cursor = 'crosshair'

          // Find cell under mouse point
          const targetEl = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)?.closest('td, th') as HTMLElement | null
          if (targetEl && anchorCellPos >= 0) {
            try {
              const headCellPos = view.posAtDOM(targetEl, 0)
              const $anchor = state.doc.resolve(anchorCellPos)
              const $head = state.doc.resolve(headCellPos)
              const newSelection = new CellSelection($anchor, $head)
              view.dispatch(state.tr.setSelection(newSelection))
            } catch {
              // ignore
            }
          }
        }
      }

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', onMouseUp)
        document.body.style.cursor = ''
        setTimeout(() => {
          isDraggingHandleRef.current = false
        }, 50)

        if (!isDrag) {
          // Pure click: toggle Popover menu
          setMenuOpen(prev => !prev)
        }
      }

      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    },
    [editor],
  )

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

  const onDeleteRow = useCallback(() => {
    editor.chain().focus().deleteRow().run()
    setMenuOpen(false)
  }, [editor])

  const onDeleteColumn = useCallback(() => {
    editor.chain().focus().deleteColumn().run()
    setMenuOpen(false)
  }, [editor])

  const onDeleteTable = useCallback(() => {
    editor.chain().focus().deleteTable().run()
    setMenuOpen(false)
  }, [editor])

  const canMerge = editor.can().mergeCells()
  const canSplit = editor.can().splitCell()

  const itemClass =
    'w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-left transition-colors text-zinc-700 dark:text-[#e3e3e3] hover:bg-black/5 dark:hover:bg-white/[0.08] active:bg-black/10 dark:active:bg-white/[0.12] select-none'
  const dangerClass =
    'w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-left transition-colors text-red-600 dark:text-red-400 hover:bg-red-500/10 active:bg-red-500/20 select-none'

  return (
    <>
      {/* 1. Selection Perimeter Continuous 2px Outline (Notion Style) */}
      {isCellSelected && !editor.view?.dragging && selectionRect && (
        <div
          className="fixed pointer-events-none rounded-[2px] transition-all duration-75 z-20"
          style={{
            top: selectionRect.top,
            left: selectionRect.left,
            width: selectionRect.width,
            height: selectionRect.height,
            border: '2px solid #3b82f6',
            boxShadow: '0 0 0 1px rgba(59, 130, 246, 0.25)',
          }}
        />
      )}

      {/* 2. BubbleMenu with Right-Edge 12px Circle Trigger and TableCell Popover */}
      <BaseBubbleMenu
        editor={editor}
        pluginKey="tableCellMenu"
        updateDelay={0}
        appendTo={appendTo?.current || undefined}
        getReferencedVirtualElement={getReferencedVirtualElement}
        options={TABLE_CELL_MENU_OPTIONS}
        shouldShow={shouldShow}
      >
        <div className="relative flex items-center">
          <Popover.Root open={menuOpen} onOpenChange={setMenuOpen}>
            <Popover.Trigger asChild>
              <button
                type="button"
                onMouseDown={handleButtonMouseDown}
                className="w-3 h-3 -ml-1.5 -translate-y-1/2 rounded-full bg-white dark:bg-[#202020] border border-blue-500 shadow-md hover:scale-125 active:scale-95 cursor-pointer transition-all flex items-center justify-center p-0 outline-none z-30 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 select-none"
                title="Click for options, drag to adjust cell selection"
                aria-label="Table cells option"
              >
                <Icon name="Ellipsis" className="w-2 h-2" />
              </button>
            </Popover.Trigger>
            <Popover.Content
              side="right"
              align="start"
              sideOffset={8}
              className="z-[1400] outline-none animate-in fade-in-0 zoom-in-95 duration-150"
            >
              <div className="glass-menu min-w-[12rem] p-1.5 shadow-2xl rounded-xl flex flex-col gap-0.5 bg-white/85 dark:bg-[#202020]/90 backdrop-blur-md border border-black/5 dark:border-white/10 text-zinc-800 dark:text-zinc-200">
                {canMerge && (
                  <button type="button" onClick={onMergeCells} className={itemClass}>
                    <Icon name="Columns2" className="w-3.5 h-3.5 text-zinc-500 dark:text-[#9b9b9b]" />
                    <span>Merge cells</span>
                  </button>
                )}

                {canSplit && (
                  <button type="button" onClick={onSplitCell} className={itemClass}>
                    <Icon name="Split" className="w-3.5 h-3.5 text-zinc-500 dark:text-[#9b9b9b]" />
                    <span>Split cell</span>
                  </button>
                )}

                {(canMerge || canSplit) && <div className="h-[1px] bg-black/5 dark:bg-white/10 my-1" />}

                <button type="button" onClick={onClearContents} className={itemClass}>
                  <Icon name="Eraser" className="w-3.5 h-3.5 text-zinc-500 dark:text-[#9b9b9b]" />
                  <span>Clear cell contents</span>
                </button>

                <div className="h-[1px] bg-black/5 dark:bg-white/10 my-1" />

                <button type="button" onClick={onDeleteRow} className={dangerClass}>
                  <Icon name="Trash2" className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
                  <span>Delete row</span>
                </button>

                <button type="button" onClick={onDeleteColumn} className={dangerClass}>
                  <Icon name="Trash2" className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
                  <span>Delete column</span>
                </button>

                <button type="button" onClick={onDeleteTable} className={dangerClass}>
                  <Icon name="Trash" className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
                  <span>Delete entire table</span>
                </button>
              </div>
            </Popover.Content>
          </Popover.Root>
        </div>
      </BaseBubbleMenu>
    </>
  )
})

TableCellMenu.displayName = 'TableCellMenu'

export default TableCellMenu
