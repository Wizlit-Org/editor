import { BubbleMenu as BaseBubbleMenu } from '@tiptap/react/menus'
import React, { useCallback, useState, useEffect, useRef, JSX } from 'react'
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
  const isClosedByScrollRef = useRef(false)

  useEffect(() => {
    const handleReset = () => {
      isClosedByScrollRef.current = false
      setIsClosedByScroll(false)
      setTick(t => t + 1)
    }
    editor.on('selectionUpdate', handleReset)
    editor.on('focus', handleReset)
    window.addEventListener('tiptap:reset-scroll-lock', handleReset)
    return () => {
      editor.off('selectionUpdate', handleReset)
      editor.off('focus', handleReset)
      window.removeEventListener('tiptap:reset-scroll-lock', handleReset)
    }
  }, [editor])

  // Auto-close menu when editor or window scrolls or receives close event
  useEffect(() => {
    const handleClose = () => {
      isClosedByScrollRef.current = true
      setIsClosedByScroll(true)
      try {
        editor.view.dispatch(editor.state.tr.setMeta('tableColumnMenu', 'hide'))
      } catch {}
    }
    window.addEventListener('tiptap:close-menus', handleClose)
    window.addEventListener('scroll', handleClose, { passive: true, capture: true })
    return () => {
      window.removeEventListener('tiptap:close-menus', handleClose)
      window.removeEventListener('scroll', handleClose, { capture: true })
    }
  }, [editor])

  const getReferencedVirtualElement = useCallback(() => {
    return getColumnAnchorVirtualElement(editor)
  }, [editor])

  const shouldShow = useCallback(
    ({ view, state, from }: ShouldShowProps) => {
      if (isClosedByScrollRef.current) {
        return false
      }
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
  const canMoveLeft = selectedColIdx > 1

  const itemClass =
    'w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-left transition-colors text-zinc-700 dark:text-[#e3e3e3] hover:bg-black/5 dark:hover:bg-white/[0.08] active:bg-black/10 dark:active:bg-white/[0.12] select-none cursor-pointer'
  const dangerClass =
    'w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-left transition-colors text-red-600 dark:text-red-400 hover:bg-red-500/10 active:bg-red-500/20 select-none cursor-pointer'

  return (
    <BaseBubbleMenu
      editor={editor}
      pluginKey="tableColumnMenu"
      updateDelay={0}
      className={cn('z-[1350]', isClosedByScroll && '!hidden pointer-events-none')}
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
        {/* Alignment Toolbar (Horizontal & Vertical) */}
        <TableAlignmentSubmenu editor={editor} scope="column" index={selectedColIdx} />

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

        {!isFirstCol && (
          <>
            {canMoveLeft && (
              <button type="button" onClick={onMoveColumnLeft} className={itemClass}>
                <Icon name="ArrowLeft" className="w-3.5 h-3.5 text-zinc-500 dark:text-[#9b9b9b]" />
                <span>Move column left</span>
              </button>
            )}

            <button type="button" onClick={onMoveColumnRight} className={itemClass}>
              <Icon name="ArrowRight" className="w-3.5 h-3.5 text-zinc-500 dark:text-[#9b9b9b]" />
              <span>Move column right</span>
            </button>

            <div className="h-[1px] bg-black/5 dark:bg-white/10 my-1" />
          </>
        )}

        {!isFirstCol && (
          <button type="button" onClick={onAddColumnBefore} className={itemClass}>
            <Icon name="ArrowLeftToLine" className="w-3.5 h-3.5 text-zinc-500 dark:text-[#9b9b9b]" />
            <span>Insert column left</span>
          </button>
        )}

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
