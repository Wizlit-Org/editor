import { BubbleMenu as BaseBubbleMenu } from '@tiptap/react/menus'
import React, { useCallback, JSX } from 'react'
import { isRowGripSelected } from './utils'
import { Icon } from '@/components/ui/Icon'
import { MenuProps, ShouldShowProps } from '@/components/menus/types'
import { getSelectedRowIndex, clearRowContents } from './rowActions'

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

  const onAddRowBefore = useCallback(() => {
    editor.chain().focus().addRowBefore().run()
  }, [editor])

  const onAddRowAfter = useCallback(() => {
    editor.chain().focus().addRowAfter().run()
  }, [editor])

  const onMergeCells = useCallback(() => {
    editor.chain().focus().mergeCells().run()
  }, [editor])

  const onClearRow = useCallback(() => {
    const idx = getSelectedRowIndex(editor)
    clearRowContents(editor, idx)
  }, [editor])

  const onDeleteRow = useCallback(() => {
    editor.chain().focus().deleteRow().run()
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
      <div className="glass-menu min-w-[12rem] p-1.5 shadow-2xl rounded-lg flex flex-col gap-0.5 z-50">
        <button type="button" onClick={onAddRowBefore} className={itemClass}>
          <Icon name="ArrowUpToLine" className="w-3.5 h-3.5 text-zinc-500 dark:text-[#9b9b9b]" />
          <span>Insert row above</span>
        </button>

        <button type="button" onClick={onAddRowAfter} className={itemClass}>
          <Icon name="ArrowDownToLine" className="w-3.5 h-3.5 text-zinc-500 dark:text-[#9b9b9b]" />
          <span>Insert row below</span>
        </button>

        <div className="h-[1px] bg-black/5 dark:bg-white/10 my-1" />

        <button type="button" onClick={onMergeCells} className={itemClass}>
          <Icon name="Columns2" className="w-3.5 h-3.5 text-zinc-500 dark:text-[#9b9b9b]" />
          <span>Merge cells</span>
        </button>

        <button type="button" onClick={onClearRow} className={itemClass}>
          <Icon name="Eraser" className="w-3.5 h-3.5 text-zinc-500 dark:text-[#9b9b9b]" />
          <span>Clear row contents</span>
        </button>

        <div className="h-[1px] bg-black/5 dark:bg-white/10 my-1" />

        <button type="button" onClick={onDeleteRow} className={dangerClass}>
          <Icon name="Trash2" className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
          <span>Delete row</span>
        </button>
      </div>
    </BaseBubbleMenu>
  )
})

TableRowMenu.displayName = 'TableRowMenu'

export default TableRowMenu
