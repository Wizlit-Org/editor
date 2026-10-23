import { BubbleMenu as BaseBubbleMenu } from '@tiptap/react/menus'
import React, { useCallback, useState, useEffect, JSX } from 'react'
import { isColumnGripSelected } from './utils'
import { Icon } from '@/components/ui/Icon'
import { MenuProps, ShouldShowProps } from '@/components/menus/types'
import {
  getSelectedColumnIndex,
  moveColumnLeft,
  moveColumnRight,
  clearColumnContents,
  sortColumn,
  duplicateColumn,
} from './columnActions'
import { TableAlignmentSubmenu } from '../TableAlignmentSubmenu'
import { getColumnAnchorVirtualElement } from '../useTableMenuPosition'

import { cn } from '@/lib/utils'

const TABLE_COLUMN_MENU_OPTIONS = {
  offset: 6,
  placement: 'bottom-start' as const,
  flip: true,
}

export const TableColumnMenu = React.memo(({ editor, appendTo }: MenuProps): JSX.Element => {
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
    return getColumnAnchorVirtualElement(editor)
  }, [editor])

  const shouldShow = useCallback(
    ({ view, state, from }: ShouldShowProps) => {
      if (!state) {
        return false
      }

      return isColumnGripSelected({ editor, view, state, from: from || 0 })
    },
    [editor],
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

  const onMoveColumnLeft = useCallback(() => {
    const idx = getSelectedColumnIndex(editor)
    moveColumnLeft(editor, idx)
  }, [editor])

  const onMoveColumnRight = useCallback(() => {
    const idx = getSelectedColumnIndex(editor)
    moveColumnRight(editor, idx)
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

  const onToggleHeaderColumn = useCallback(() => {
    editor.chain().focus().toggleHeaderColumn().run()
  }, [editor])

  const onDeleteTable = useCallback(() => {
    editor.chain().focus().deleteTable().run()
  }, [editor])

  const selectedColIdx = getSelectedColumnIndex(editor)
  const isFirstCol = selectedColIdx === 0

  const itemClass =
    'w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-left transition-colors text-zinc-700 dark:text-[#e3e3e3] hover:bg-black/5 dark:hover:bg-white/[0.08] active:bg-black/10 dark:active:bg-white/[0.12] select-none cursor-pointer'
  const dangerClass =
    'w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-left transition-colors text-red-600 dark:text-red-400 hover:bg-red-500/10 active:bg-red-500/20 select-none cursor-pointer'

  return (
    <BaseBubbleMenu
      editor={editor}
      pluginKey="tableColumnMenu"
      updateDelay={0}
      className="z-[1350]"
      appendTo={typeof document !== 'undefined' ? document.body : undefined}
      getReferencedVirtualElement={getReferencedVirtualElement}
      options={TABLE_COLUMN_MENU_OPTIONS}
      shouldShow={shouldShow}
    >
      <div
        style={{ display: isClosedByScroll ? 'none' : undefined, zIndex: 1350 }}
        className={cn(
          'glass-menu min-w-[14rem] p-1.5 shadow-2xl rounded-lg flex flex-col gap-0.5 z-[1350] bg-white/85 dark:bg-[#202020]/90 backdrop-blur-md border border-black/5 dark:border-white/10 text-zinc-800 dark:text-zinc-200',
          isClosedByScroll && '!hidden',
        )}
      >
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
        <TableAlignmentSubmenu editor={editor} />

        <div className="h-[1px] bg-black/5 dark:bg-white/10 my-0.5" />

        {isFirstCol && (
          <>
            <button type="button" onClick={onToggleHeaderColumn} className={itemClass}>
              <Icon name="Table" className="w-3.5 h-3.5 text-zinc-500 dark:text-[#9b9b9b]" />
              <span>Header column</span>
            </button>
            <div className="h-[1px] bg-black/5 dark:bg-white/10 my-1" />
          </>
        )}

        <button type="button" onClick={onMoveColumnLeft} className={itemClass}>
          <Icon name="ArrowLeft" className="w-3.5 h-3.5 text-zinc-500 dark:text-[#9b9b9b]" />
          <span>Move column left</span>
        </button>

        <button type="button" onClick={onMoveColumnRight} className={itemClass}>
          <Icon name="ArrowRight" className="w-3.5 h-3.5 text-zinc-500 dark:text-[#9b9b9b]" />
          <span>Move column right</span>
        </button>

        <div className="h-[1px] bg-black/5 dark:bg-white/10 my-1" />

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
          <Icon name="ArrowDownUp" className="w-3.5 h-3.5 text-zinc-500 dark:text-[#9b9b9b]" />
          <span>Sort ascending</span>
        </button>

        <button type="button" onClick={onSortDesc} className={itemClass}>
          <Icon name="ArrowUpDown" className="w-3.5 h-3.5 text-zinc-500 dark:text-[#9b9b9b]" />
          <span>Sort descending</span>
        </button>

        <div className="h-[1px] bg-black/5 dark:bg-white/10 my-1" />

        <button type="button" onClick={onClearColumn} className={itemClass}>
          <Icon name="Eraser" className="w-3.5 h-3.5 text-zinc-500 dark:text-[#9b9b9b]" />
          <span>Clear contents</span>
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

        <button type="button" onClick={onDeleteTable} className={dangerClass}>
          <Icon name="Trash" className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
          <span>Delete entire table</span>
        </button>
      </div>
    </BaseBubbleMenu>
  )
})

TableColumnMenu.displayName = 'TableColumnMenu'

export default TableColumnMenu
