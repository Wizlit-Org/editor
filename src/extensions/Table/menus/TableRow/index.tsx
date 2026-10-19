import { BubbleMenu as BaseBubbleMenu } from '@tiptap/react/menus'
import React, { useCallback, JSX } from 'react'
import { isRowGripSelected } from './utils'
import { Icon } from '@/components/ui/Icon'
import { MenuProps, ShouldShowProps } from '@/components/menus/types'
import {
  getSelectedRowIndex,
  clearRowContents,
  duplicateRow,
  moveRowUp,
  moveRowDown,
} from './rowActions'

const TABLE_ROW_MENU_OPTIONS = {
  placement: 'left' as const,
  offset: 15,
  flip: false,
}

export const TableRowMenu = React.memo(({ editor, appendTo }: MenuProps): JSX.Element => {
  const shouldShow = useCallback(
    ({ view, state, from }: ShouldShowProps) => {
      if (!state || !from) {
        return false
      }

      return isRowGripSelected({ editor, view, state, from })
    },
    [editor],
  )

  const onMoveRowUp = useCallback(() => {
    const idx = getSelectedRowIndex(editor)
    moveRowUp(editor, idx)
  }, [editor])

  const onMoveRowDown = useCallback(() => {
    const idx = getSelectedRowIndex(editor)
    moveRowDown(editor, idx)
  }, [editor])

  const onAddRowBefore = useCallback(() => {
    editor.chain().focus().addRowBefore().run()
  }, [editor])

  const onAddRowAfter = useCallback(() => {
    editor.chain().focus().addRowAfter().run()
  }, [editor])

  const onDuplicate = useCallback(() => {
    const idx = getSelectedRowIndex(editor)
    duplicateRow(editor, idx)
  }, [editor])

  const onMergeCells = useCallback(() => {
    editor.chain().focus().mergeCells().run()
  }, [editor])

  const onSplitCell = useCallback(() => {
    editor.chain().focus().splitCell().run()
  }, [editor])

  const onToggleHeaderRow = useCallback(() => {
    editor.chain().focus().toggleHeaderRow().run()
  }, [editor])

  const onClearRow = useCallback(() => {
    const idx = getSelectedRowIndex(editor)
    clearRowContents(editor, idx)
  }, [editor])

  const onDeleteRow = useCallback(() => {
    editor.chain().focus().deleteRow().run()
  }, [editor])

  const onDeleteTable = useCallback(() => {
    editor.chain().focus().deleteTable().run()
  }, [editor])

  const itemClass =
    'w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-left transition-colors text-zinc-700 dark:text-[#e3e3e3] hover:bg-black/5 dark:hover:bg-white/[0.08] active:bg-black/10 dark:active:bg-white/[0.12] select-none'
  const dangerClass =
    'w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-left transition-colors text-red-600 dark:text-red-400 hover:bg-red-500/10 active:bg-red-500/20 select-none'

  return (
    <BaseBubbleMenu
      editor={editor}
      pluginKey="tableRowMenu"
      updateDelay={0}
      appendTo={appendTo?.current || undefined}
      options={TABLE_ROW_MENU_OPTIONS}
      shouldShow={shouldShow}
    >
      <div className="glass-menu min-w-[12.5rem] p-1.5 shadow-2xl rounded-lg flex flex-col gap-0.5 z-50">
        <div className="flex items-center gap-1">
          <button type="button" onClick={onMoveRowUp} className={`${itemClass} flex-1 justify-center`}>
            <Icon name="ArrowUp" className="w-3.5 h-3.5 text-zinc-500 dark:text-[#9b9b9b]" />
            <span>Move up</span>
          </button>
          <button type="button" onClick={onMoveRowDown} className={`${itemClass} flex-1 justify-center`}>
            <span>Move down</span>
            <Icon name="ArrowDown" className="w-3.5 h-3.5 text-zinc-500 dark:text-[#9b9b9b]" />
          </button>
        </div>

        <button type="button" onClick={onAddRowBefore} className={itemClass}>
          <Icon name="ArrowUpToLine" className="w-3.5 h-3.5 text-zinc-500 dark:text-[#9b9b9b]" />
          <span>Insert row above</span>
        </button>

        <button type="button" onClick={onAddRowAfter} className={itemClass}>
          <Icon name="ArrowDownToLine" className="w-3.5 h-3.5 text-zinc-500 dark:text-[#9b9b9b]" />
          <span>Insert row below</span>
        </button>

        <div className="h-[1px] bg-black/5 dark:bg-white/10 my-1" />

        <button type="button" onClick={onToggleHeaderRow} className={itemClass}>
          <Icon name="Table" className="w-3.5 h-3.5 text-zinc-500 dark:text-[#9b9b9b]" />
          <span>Toggle header row</span>
        </button>

        <button type="button" onClick={onMergeCells} className={itemClass}>
          <Icon name="Columns2" className="w-3.5 h-3.5 text-zinc-500 dark:text-[#9b9b9b]" />
          <span>Merge cells</span>
        </button>

        <button type="button" onClick={onSplitCell} className={itemClass}>
          <Icon name="Split" className="w-3.5 h-3.5 text-zinc-500 dark:text-[#9b9b9b]" />
          <span>Split cell</span>
        </button>

        <button type="button" onClick={onClearRow} className={itemClass}>
          <Icon name="Eraser" className="w-3.5 h-3.5 text-zinc-500 dark:text-[#9b9b9b]" />
          <span>Clear row contents</span>
        </button>

        <button type="button" onClick={onDuplicate} className={itemClass}>
          <Icon name="Copy" className="w-3.5 h-3.5 text-zinc-500 dark:text-[#9b9b9b]" />
          <span>Duplicate row</span>
        </button>

        <div className="h-[1px] bg-black/5 dark:bg-white/10 my-1" />

        <button type="button" onClick={onDeleteRow} className={dangerClass}>
          <Icon name="Trash2" className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
          <span>Delete row</span>
        </button>

        <button type="button" onClick={onDeleteTable} className={dangerClass}>
          <Icon name="Trash" className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
          <span>Delete entire table</span>
        </button>
      </div>
    </BaseBubbleMenu>
  )
})

TableRowMenu.displayName = 'TableRowMenu'

export default TableRowMenu
