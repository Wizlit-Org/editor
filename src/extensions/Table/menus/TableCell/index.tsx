import { BubbleMenu as BaseBubbleMenu } from '@tiptap/react/menus'
import React, { useCallback, useState, useEffect, JSX } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { isCellSelection } from '../../utils'
import { Icon } from '@/components/ui/Icon'
import { MenuProps, ShouldShowProps } from '@/components/menus/types'

const TABLE_CELL_MENU_OPTIONS = {
  placement: 'right' as const,
  offset: 4,
  flip: true,
}

export const TableCellMenu = React.memo(({ editor, appendTo }: MenuProps): JSX.Element => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [selectionRect, setSelectionRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null)

  const isCellSelected = isCellSelection(editor.state?.selection)

  const updateSelectionRect = useCallback(() => {
    if (!editor.view?.dom) {
      setSelectionRect(null)
      return
    }
    const selectedCells = editor.view.dom.querySelectorAll('.selectedCell')
    if (selectedCells.length > 0) {
      let minTop = Infinity
      let maxBottom = -Infinity
      let maxRight = -Infinity
      let minLeft = Infinity

      selectedCells.forEach((cell) => {
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
  }, [editor])

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
      if (typeof document !== 'undefined' && document.querySelector('a.grip-column.selected, a.grip-row.selected')) {
        return false
      }
      return isCellSelection(state.selection)
    },
    [editor],
  )

  const getReferencedVirtualElement = useCallback(() => {
    if (!editor.view?.dom) return null

    const selectedCells = editor.view.dom.querySelectorAll('.selectedCell')
    if (selectedCells.length > 0) {
      let minTop = Infinity
      let maxBottom = -Infinity
      let maxRight = -Infinity

      selectedCells.forEach((cell) => {
        const r = cell.getBoundingClientRect()
        if (r.top < minTop) minTop = r.top
        if (r.bottom > maxBottom) maxBottom = r.bottom
        if (r.right > maxRight) maxRight = r.right
      })

      return {
        getBoundingClientRect: () => ({
          top: minTop,
          bottom: minTop,
          left: maxRight,
          right: maxRight,
          width: 0,
          height: 0,
          x: maxRight,
          y: minTop,
          toJSON: () => {},
        }),
      }
    }

    return null
  }, [editor])

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

      {/* 2. BubbleMenu with Top-Right Edge 4-dot Trigger and TableCell Popover */}
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
                className="w-4 h-4 -ml-2 -mt-2 rounded bg-white dark:bg-[#1e1e1e] border border-blue-500 shadow-md hover:scale-125 cursor-pointer transition-transform flex items-center justify-center p-0.5 outline-none z-30"
                title="Table cells option"
                aria-label="Table cells option"
              >
                <div className="grid grid-cols-2 gap-0.5 pointer-events-none">
                  <span className="w-1 h-1 rounded-full bg-blue-500" />
                  <span className="w-1 h-1 rounded-full bg-blue-500" />
                  <span className="w-1 h-1 rounded-full bg-blue-500" />
                  <span className="w-1 h-1 rounded-full bg-blue-500" />
                </div>
              </button>
            </Popover.Trigger>
            <Popover.Content
              side="right"
              align="start"
              sideOffset={8}
              className="z-50 outline-none animate-in fade-in-0 zoom-in-95 duration-150"
            >
              <div className="glass-menu min-w-[12rem] p-1.5 shadow-2xl rounded-lg flex flex-col gap-0.5">
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

                {(canMerge || canSplit) && (
                  <div className="h-[1px] bg-black/5 dark:bg-white/10 my-1" />
                )}

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
