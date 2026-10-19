import { BubbleMenu as BaseBubbleMenu } from '@tiptap/react/menus'
import React, { useCallback, JSX } from 'react'
import { isColumnGripSelected } from './utils'
import { Icon } from '@/components/ui/Icon'
import { MenuProps, ShouldShowProps } from '@/components/menus/types'
import {
  getSelectedColumnIndex,
  moveColumnLeft,
  clearColumnContents,
  sortColumn,
  duplicateColumn,
} from './columnActions'

const TABLE_COLUMN_MENU_OPTIONS = {
  offset: 15,
  flip: false,
}

export const TableColumnMenu = React.memo(({ editor, appendTo }: MenuProps): JSX.Element => {
  const shouldShow = useCallback(
    ({ view, state, from }: ShouldShowProps) => {
      if (!state) {
        return false
      }

      return isColumnGripSelected({ editor, view, state, from: from || 0 })
    },
    [editor],
  )

  const onMoveColumnLeft = useCallback(() => {
    const idx = getSelectedColumnIndex(editor)
    moveColumnLeft(editor, idx)
  }, [editor])

  const onAddColumnBefore = useCallback(() => {
    editor.chain().focus().addColumnBefore().run()
  }, [editor])

  const onAddColumnAfter = useCallback(() => {
    editor.chain().focus().addColumnAfter().run()
  }, [editor])

  const onSortAsc = useCallback(() => {
    const idx = getSelectedColumnIndex(editor)
    sortColumn(editor, idx, 'asc')
  }, [editor])

  const onSortDesc = useCallback(() => {
    const idx = getSelectedColumnIndex(editor)
    sortColumn(editor, idx, 'desc')
  }, [editor])

  const onClearColumn = useCallback(() => {
    const idx = getSelectedColumnIndex(editor)
    clearColumnContents(editor, idx)
  }, [editor])

  const onDuplicate = useCallback(() => {
    const idx = getSelectedColumnIndex(editor)
    duplicateColumn(editor, idx)
  }, [editor])

  const onDeleteColumn = useCallback(() => {
    editor.chain().focus().deleteColumn().run()
  }, [editor])

  const onMergeCells = useCallback(() => {
    editor.chain().focus().mergeCells().run()
  }, [editor])

  const itemClass =
    'w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-left transition-colors text-zinc-700 dark:text-[#e3e3e3] hover:bg-black/5 dark:hover:bg-white/[0.08] active:bg-black/10 dark:active:bg-white/[0.12] select-none'
  const dangerClass =
    'w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-left transition-colors text-red-600 dark:text-red-400 hover:bg-red-500/10 active:bg-red-500/20 select-none'

  return (
    <BaseBubbleMenu
      editor={editor}
      pluginKey="tableColumnMenu"
      updateDelay={0}
      appendTo={appendTo?.current || undefined}
      options={TABLE_COLUMN_MENU_OPTIONS}
      shouldShow={shouldShow}
    >
      <div className="glass-menu min-w-[13rem] p-1.5 shadow-2xl rounded-lg flex flex-col gap-0.5 z-50">
        <button type="button" onClick={onMoveColumnLeft} className={itemClass}>
          <Icon name="ArrowLeft" className="w-3.5 h-3.5 text-zinc-500 dark:text-[#9b9b9b]" />
          <span>Move column left</span>
        </button>

        <button type="button" onClick={onAddColumnBefore} className={itemClass}>
          <Icon name="ArrowLeftToLine" className="w-3.5 h-3.5 text-zinc-500 dark:text-[#9b9b9b]" />
          <span>Insert column left</span>
        </button>

        <button type="button" onClick={onAddColumnAfter} className={itemClass}>
          <Icon name="ArrowRightToLine" className="w-3.5 h-3.5 text-zinc-500 dark:text-[#9b9b9b]" />
          <span>Insert column right</span>
        </button>

        <div className="h-[1px] bg-black/5 dark:bg-white/10 my-1" />

        <button type="button" onClick={onSortAsc} className={itemClass}>
          <Icon name="ArrowDown" className="w-3.5 h-3.5 text-zinc-500 dark:text-[#9b9b9b]" />
          <span>Sort column A-Z</span>
        </button>

        <button type="button" onClick={onSortDesc} className={itemClass}>
          <Icon name="ArrowUp" className="w-3.5 h-3.5 text-zinc-500 dark:text-[#9b9b9b]" />
          <span>Sort column Z-A</span>
        </button>

        <div className="h-[1px] bg-black/5 dark:bg-white/10 my-1" />

        <button type="button" onClick={onMergeCells} className={itemClass}>
          <Icon name="Columns2" className="w-3.5 h-3.5 text-zinc-500 dark:text-[#9b9b9b]" />
          <span>Merge cells</span>
        </button>

        <button type="button" onClick={onClearColumn} className={itemClass}>
          <Icon name="Eraser" className="w-3.5 h-3.5 text-zinc-500 dark:text-[#9b9b9b]" />
          <span>Clear column contents</span>
        </button>

        <button type="button" onClick={onDuplicate} className={itemClass}>
          <Icon name="Copy" className="w-3.5 h-3.5 text-zinc-500 dark:text-[#9b9b9b]" />
          <span>Duplicate column</span>
        </button>

        <div className="h-[1px] bg-black/5 dark:bg-white/10 my-1" />

        <button type="button" onClick={onDeleteColumn} className={dangerClass}>
          <Icon name="Trash2" className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
          <span>Delete column</span>
        </button>
      </div>
    </BaseBubbleMenu>
  )
})

TableColumnMenu.displayName = 'TableColumnMenu'

export default TableColumnMenu
