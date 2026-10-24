import { BubbleMenu as BaseBubbleMenu } from '@tiptap/react/menus'
import React, { useCallback, useState, useEffect, useRef, JSX } from 'react'
import { isColumnGripSelected } from './utils'
import { Icon } from '@/components/ui/Icon'
import { MenuProps, ShouldShowProps } from '@/components/menus/types'
import {
  getSelectedColumnIndex,
  getSelectedColRange,
  moveColumnLeft,
  moveColumnRight,
  clearColumnContents,
  sortColumn,
  duplicateColumn,
  deleteColumn,
} from './columnActions'
import { findTable } from '../../utils'
import { TableMap } from '@tiptap/pm/tables'
import { TableAlignmentSubmenu } from '../TableAlignmentSubmenu'
import { getColumnAnchorVirtualElement } from '../useTableMenuPosition'
import { DeleteColumnIcon } from '../../components/TableActionIcons'
import { scrollTargetCellIntoView } from '../../utils/TableAutoScroll'

import { cn } from '@/lib/utils'

const TABLE_COLUMN_MENU_OPTIONS = {
  offset: 6,
  placement: 'bottom-start' as const,
  flip: true,
}

export const TableColumnMenu = React.memo(({ editor, appendTo }: MenuProps): JSX.Element => {
  const [, setTick] = useState(0)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const isMenuOpenRef = useRef(false)
  const [isClosedByScroll, setIsClosedByScroll] = useState(false)
  const isClosedByScrollRef = useRef(false)
  const lastOpenTimeRef = useRef(0)

  useEffect(() => {
    const handleOpen = () => {
      lastOpenTimeRef.current = Date.now()
      isMenuOpenRef.current = true
      setIsMenuOpen(true)
      isClosedByScrollRef.current = false
      setIsClosedByScroll(false)
      setTick(t => t + 1)
    }

    const handleClose = () => {
      isMenuOpenRef.current = false
      setIsMenuOpen(false)
      setTick(t => t + 1)
    }

    window.addEventListener('tiptap:open-table-col-menu', handleOpen)
    window.addEventListener('tiptap:close-table-menus', handleClose)
    window.addEventListener('tiptap:close-menus', handleClose)

    return () => {
      window.removeEventListener('tiptap:open-table-col-menu', handleOpen)
      window.removeEventListener('tiptap:close-table-menus', handleClose)
      window.removeEventListener('tiptap:close-menus', handleClose)
    }
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      // Ignore micro-scroll within 180ms of opening to prevent focus auto-scroll from closing menu
      if (Date.now() - lastOpenTimeRef.current < 180) return
      isClosedByScrollRef.current = true
      setIsClosedByScroll(true)
      isMenuOpenRef.current = false
      setIsMenuOpen(false)
    }
    window.addEventListener('scroll', handleScroll, { passive: true, capture: true })
    return () => window.removeEventListener('scroll', handleScroll, { capture: true })
  }, [])

  const getReferencedVirtualElement = useCallback(() => {
    return getColumnAnchorVirtualElement(editor)
  }, [editor])

  const shouldShow = useCallback(
    ({ view, state, from }: ShouldShowProps) => {
      if (!isMenuOpenRef.current || isClosedByScrollRef.current) {
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
    const range = getSelectedColRange(editor)
    const table = findTable(editor.state.selection)
    if (table) {
      const map = TableMap.get(table.node)
      const targetPos = table.start + map.map[range.min]
      editor.chain().focus().setTextSelection(targetPos + 1).addColumnBefore().run()
      scrollTargetCellIntoView(editor, { tablePos: table.pos, colIndex: range.min })
    } else {
      editor.chain().focus().addColumnBefore().run()
    }
  }, [editor])

  const onAddColumnAfter = useCallback(() => {
    const range = getSelectedColRange(editor)
    const table = findTable(editor.state.selection)
    if (table) {
      const map = TableMap.get(table.node)
      const targetPos = table.start + map.map[range.max]
      editor.chain().focus().setTextSelection(targetPos + 1).addColumnAfter().run()
      scrollTargetCellIntoView(editor, { tablePos: table.pos, colIndex: range.max + 1 })
    } else {
      editor.chain().focus().addColumnAfter().run()
    }
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
    deleteColumn(editor)
    isMenuOpenRef.current = false
    setIsMenuOpen(false)
  }, [editor])

  const onToggleHeaderColumn = useCallback(() => {
    editor.chain().focus().toggleHeaderColumn().run()
  }, [editor])

  const onDeleteTable = useCallback(() => {
    editor.chain().focus().deleteTable().run()
    isMenuOpenRef.current = false
    setIsMenuOpen(false)
  }, [editor])

  const selectedColIdx = getSelectedColumnIndex(editor)
  const isFirstCol = selectedColIdx === 0
  const canMoveLeft = selectedColIdx > 0

  const itemClass =
    'w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-left transition-colors text-zinc-700 dark:text-[#e3e3e3] hover:bg-black/5 dark:hover:bg-white/[0.08] active:bg-black/10 dark:active:bg-white/[0.12] select-none cursor-pointer'
  const dangerClass =
    'w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-left transition-colors text-red-600 dark:text-red-400 hover:bg-red-500/10 active:bg-red-500/20 select-none cursor-pointer'

  return (
    <BaseBubbleMenu
      editor={editor}
      pluginKey="tableColumnMenu"
      updateDelay={0}
      className={cn('z-[1350]', (!isMenuOpen || isClosedByScroll) && '!hidden pointer-events-none')}
      appendTo={typeof document !== 'undefined' ? document.body : undefined}
      getReferencedVirtualElement={getReferencedVirtualElement}
      options={TABLE_COLUMN_MENU_OPTIONS}
      shouldShow={shouldShow}
    >
      <div
        style={{ display: !isMenuOpen || isClosedByScroll ? 'none' : undefined, zIndex: 1350 }}
        className={cn(
          'glass-menu min-w-[14rem] p-1.5 shadow-2xl rounded-lg flex flex-col gap-0.5 z-[1350] bg-white/85 dark:bg-[#202020]/90 backdrop-blur-md border border-black/5 dark:border-white/10 text-zinc-800 dark:text-zinc-200',
          (!isMenuOpen || isClosedByScroll) && '!hidden',
        )}
      >
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
          <DeleteColumnIcon />
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
