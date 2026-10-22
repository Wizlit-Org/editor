import { BubbleMenu as BaseBubbleMenu } from '@tiptap/react/menus'
import React, { useCallback, useState, useEffect, JSX } from 'react'
import { isRowGripSelected } from './utils'
import { Icon } from '@/components/ui/Icon'
import { MenuProps, ShouldShowProps } from '@/components/menus/types'
import {
  getSelectedRowIndex,
  moveRowUp,
  moveRowDown,
  clearRowContents,
  duplicateRow,
} from './rowActions'
import { getRowAnchorVirtualElement } from '../useTableMenuPosition'
import { cn } from '@/lib/utils'

const TABLE_ROW_MENU_OPTIONS = {
  offset: 12,
  flip: true,
  appendTo: () => (typeof document !== 'undefined' ? document.body : 'parent'),
}

export const TableRowMenu = React.memo(({ editor, appendTo }: MenuProps): JSX.Element => {
  const [, setTick] = useState(0)
  const [isClosedByScroll, setIsClosedByScroll] = useState(false)

  useEffect(() => {
    const handleUpdate = () => {
      setIsClosedByScroll(false)
      setTick(t => t + 1)
    }
    editor.on('selectionUpdate', handleUpdate)
    editor.on('transaction', handleUpdate)
    editor.on('focus', handleUpdate)
    window.addEventListener('tiptap:reset-scroll-lock', handleUpdate)
    return () => {
      editor.off('selectionUpdate', handleUpdate)
      editor.off('transaction', handleUpdate)
      editor.off('focus', handleUpdate)
      window.removeEventListener('tiptap:reset-scroll-lock', handleUpdate)
    }
  }, [editor])

  // Auto-close menu when editor or window scrolls
  useEffect(() => {
    const handleScroll = () => {
      setIsClosedByScroll(true)
      window.dispatchEvent(new CustomEvent('tiptap:close-menus', { detail: 'scroll' }))
    }
    window.addEventListener('scroll', handleScroll, { passive: true, capture: true })
    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true })
    }
  }, [])

  const getReferencedVirtualElement = useCallback(() => {
    return getRowAnchorVirtualElement(editor)
  }, [editor])

  const shouldShow = useCallback(
    ({ view, state, from }: ShouldShowProps) => {
      if (isClosedByScroll || !state || typeof from !== 'number') {
        return false
      }

      return isRowGripSelected({ editor, view, state, from })
    },
    [editor, isClosedByScroll],
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

  const selectedRowIdx = getSelectedRowIndex(editor)
  const isFirstRow = selectedRowIdx === 0

  const itemClass =
    'w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-left transition-colors text-zinc-700 dark:text-[#e3e3e3] hover:bg-black/5 dark:hover:bg-white/[0.08] active:bg-black/10 dark:active:bg-white/[0.12] select-none'
  const dangerClass =
    'w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-left transition-colors text-red-600 dark:text-red-400 hover:bg-red-500/10 active:bg-red-500/20 select-none'

  return (
    <BaseBubbleMenu
      editor={editor}
      pluginKey="tableRowMenu"
      updateDelay={0}
      className="z-[1350]"
      appendTo={typeof document !== 'undefined' ? document.body : undefined}
      getReferencedVirtualElement={getReferencedVirtualElement}
      options={TABLE_ROW_MENU_OPTIONS}
      shouldShow={shouldShow}
    >
      <div
        style={{ display: isClosedByScroll ? 'none' : undefined }}
        className={cn(
          'glass-menu min-w-[14rem] p-1.5 shadow-2xl rounded-lg flex flex-col gap-0.5 z-[1350] bg-white/85 dark:bg-[#202020]/90 backdrop-blur-md border border-black/5 dark:border-white/10 text-zinc-800 dark:text-zinc-200',
          isClosedByScroll && '!hidden',
        )}
      >
        {isFirstRow && (
          <>
            <button type="button" onClick={onToggleHeaderRow} className={itemClass}>
              <Icon name="Table" className="w-3.5 h-3.5 text-zinc-500 dark:text-[#9b9b9b]" />
              <span>Header row</span>
            </button>
            <div className="h-[1px] bg-black/5 dark:bg-white/10 my-1" />
          </>
        )}

        <button type="button" onClick={onMoveRowUp} className={itemClass}>
          <Icon name="ArrowUp" className="w-3.5 h-3.5 text-zinc-500 dark:text-[#9b9b9b]" />
          <span>Move row up</span>
        </button>

        <button type="button" onClick={onMoveRowDown} className={itemClass}>
          <Icon name="ArrowDown" className="w-3.5 h-3.5 text-zinc-500 dark:text-[#9b9b9b]" />
          <span>Move row down</span>
        </button>

        <div className="h-[1px] bg-black/5 dark:bg-white/10 my-1" />

        <button type="button" onClick={onAddRowBefore} className={itemClass}>
          <Icon name="ArrowUpToLine" className="w-3.5 h-3.5 text-zinc-500 dark:text-[#9b9b9b]" />
          <span>Insert row above</span>
        </button>

        <button type="button" onClick={onAddRowAfter} className={itemClass}>
          <Icon name="ArrowDownToLine" className="w-3.5 h-3.5 text-zinc-500 dark:text-[#9b9b9b]" />
          <span>Insert row below</span>
        </button>

        <div className="h-[1px] bg-black/5 dark:bg-white/10 my-1" />

        <button type="button" onClick={onClearRow} className={itemClass}>
          <Icon name="Eraser" className="w-3.5 h-3.5 text-zinc-500 dark:text-[#9b9b9b]" />
          <span>Clear contents</span>
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
