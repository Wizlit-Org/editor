import { BubbleMenu as BaseBubbleMenu } from '@tiptap/react/menus'
import React, { useCallback, useState, JSX } from 'react'
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

  const shouldShow = useCallback(
    ({ state }: ShouldShowProps) => {
      if (!state) return false
      return isCellSelection(state.selection)
    },
    [],
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

  const itemClass =
    'w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-left transition-colors text-zinc-700 dark:text-[#e3e3e3] hover:bg-black/5 dark:hover:bg-white/[0.08] active:bg-black/10 dark:active:bg-white/[0.12] select-none'
  const dangerClass =
    'w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-left transition-colors text-red-600 dark:text-red-400 hover:bg-red-500/10 active:bg-red-500/20 select-none'

  return (
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
              className="w-3.5 h-3.5 -ml-1.5 rounded-full bg-[#7a52ff] dark:bg-[#8b5cf6] border-2 border-white dark:border-[#191919] shadow-md hover:scale-125 cursor-pointer transition-transform flex items-center justify-center outline-none z-30"
              title="Table cell options"
              aria-label="Table cell options"
            >
              <span className="w-1 h-1 rounded-full bg-white opacity-90" />
            </button>
          </Popover.Trigger>
          <Popover.Content
            side="right"
            align="center"
            sideOffset={8}
            className="z-50 outline-none animate-in fade-in-0 zoom-in-95 duration-150"
          >
            <div className="glass-menu min-w-[12rem] p-1.5 shadow-2xl rounded-lg flex flex-col gap-0.5">
              <button type="button" onClick={onMergeCells} className={itemClass}>
                <Icon name="Columns2" className="w-3.5 h-3.5 text-zinc-500 dark:text-[#9b9b9b]" />
                <span>Merge cells</span>
              </button>

              <button type="button" onClick={onSplitCell} className={itemClass}>
                <Icon name="Split" className="w-3.5 h-3.5 text-zinc-500 dark:text-[#9b9b9b]" />
                <span>Split cell</span>
              </button>

              <div className="h-[1px] bg-black/5 dark:bg-white/10 my-1" />

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
  )
})

TableCellMenu.displayName = 'TableCellMenu'

export default TableCellMenu
