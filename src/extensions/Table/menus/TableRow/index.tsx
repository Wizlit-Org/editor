import { BubbleMenu as BaseBubbleMenu } from '@tiptap/react/menus'
import React, { useCallback, useState, useEffect, useRef, useMemo, JSX } from 'react'
import { isRowGripSelected } from './utils'
import { Icon } from '@/components/ui/Icon'
import { MenuProps, ShouldShowProps } from '@/components/menus/types'
import {
  getSelectedRowIndex,
  getSelectedRowRange,
  moveRowUp,
  moveRowDown,
  clearRowContents,
  duplicateRow,
  deleteRow,
} from './rowActions'
import { findTable } from '../../utils'
import { TableMap } from '@tiptap/pm/tables'
import { getRowAnchorVirtualElement } from '../useTableMenuPosition'
import { TableAlignmentSubmenu } from '../TableAlignmentSubmenu'
import { DeleteRowIcon } from '../../components/TableActionIcons'
import { scrollTargetCellIntoView } from '../../utils/TableAutoScroll'
import { hasRowStraddlingMerge } from '../../utils/TableHeaderStraddleUtils'
import { cn } from '@/lib/utils'

const TABLE_ROW_MENU_OPTIONS = {
  offset: 6,
  placement: 'right-start' as const,
  flip: true,
}

export const TableRowMenu = React.memo(({ editor, appendTo }: MenuProps): JSX.Element => {
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

    window.addEventListener('tiptap:open-table-row-menu', handleOpen)
    window.addEventListener('tiptap:close-table-menus', handleClose)
    window.addEventListener('tiptap:close-menus', handleClose)

    return () => {
      window.removeEventListener('tiptap:open-table-row-menu', handleOpen)
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
    return getRowAnchorVirtualElement(editor)
  }, [editor])

  const shouldShow = useCallback(
    ({ view, state, from }: ShouldShowProps) => {
      if (!isMenuOpenRef.current || isClosedByScrollRef.current) {
        return false
      }
      if (!state || typeof from !== 'number') {
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
    const range = getSelectedRowRange(editor)
    const table = findTable(editor.state.selection)
    if (table) {
      const map = TableMap.get(table.node)
      const targetPos = table.start + map.map[range.min * map.width]
      editor.chain().focus().setTextSelection(targetPos + 1).addRowBefore().run()
      scrollTargetCellIntoView(editor, { tablePos: table.pos, rowIndex: range.min })
    } else {
      editor.chain().focus().addRowBefore().run()
    }
  }, [editor])

  const onAddRowAfter = useCallback(() => {
    const range = getSelectedRowRange(editor)
    const table = findTable(editor.state.selection)
    if (table) {
      const map = TableMap.get(table.node)
      const targetPos = table.start + map.map[range.max * map.width]
      editor.chain().focus().setTextSelection(targetPos + 1).addRowAfter().run()
      scrollTargetCellIntoView(editor, { tablePos: table.pos, rowIndex: range.max + 1 })
    } else {
      editor.chain().focus().addRowAfter().run()
    }
  }, [editor])

  const onDuplicate = useCallback(() => {
    const idx = getSelectedRowIndex(editor)
    duplicateRow(editor, idx)
  }, [editor])

  const isRowHeaderBlocked = useMemo(() => {
    const table = findTable(editor.state.selection)
    return table ? hasRowStraddlingMerge(table.node, 0) : false
  }, [editor.state.selection])

  const onToggleHeaderRow = useCallback(() => {
    const table = findTable(editor.state.selection)
    if (table && hasRowStraddlingMerge(table.node, 0)) return
    editor.chain().focus().toggleHeaderRow().run()
  }, [editor])

  const onClearRow = useCallback(() => {
    const idx = getSelectedRowIndex(editor)
    clearRowContents(editor, idx)
  }, [editor])

  const onDeleteRow = useCallback(() => {
    deleteRow(editor)
    isMenuOpenRef.current = false
    setIsMenuOpen(false)
  }, [editor])

  const onDeleteTable = useCallback(() => {
    editor.chain().focus().deleteTable().run()
    isMenuOpenRef.current = false
    setIsMenuOpen(false)
  }, [editor])

  const selectedRowIdx = getSelectedRowIndex(editor)
  const isFirstRow = selectedRowIdx === 0
  const canMoveUp = selectedRowIdx > 0

  const itemClass =
    'w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-left transition-colors text-zinc-700 dark:text-[#e3e3e3] hover:bg-black/5 dark:hover:bg-white/[0.08] active:bg-black/10 dark:active:bg-white/[0.12] select-none cursor-pointer'
  const dangerClass =
    'w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-left transition-colors text-red-600 dark:text-red-400 hover:bg-red-500/10 active:bg-red-500/20 select-none cursor-pointer'

  return (
    <BaseBubbleMenu
      editor={editor}
      pluginKey="tableRowMenu"
      updateDelay={0}
      className={cn('z-[1350]', (!isMenuOpen || isClosedByScroll) && '!hidden pointer-events-none')}
      appendTo={typeof document !== 'undefined' ? document.body : undefined}
      getReferencedVirtualElement={getReferencedVirtualElement}
      options={TABLE_ROW_MENU_OPTIONS}
      shouldShow={shouldShow}
    >
      <div
        style={{ display: !isMenuOpen || isClosedByScroll ? 'none' : undefined, zIndex: 1350 }}
        className={cn(
          'glass-menu min-w-[14rem] p-1.5 shadow-2xl rounded-lg flex flex-col gap-0.5 z-[1350] bg-white/85 dark:bg-[#202020]/90 backdrop-blur-md border border-black/5 dark:border-white/10 text-zinc-800 dark:text-zinc-200',
          (!isMenuOpen || isClosedByScroll) && '!hidden',
        )}
      >
        <TableAlignmentSubmenu editor={editor} scope="row" index={selectedRowIdx} />

        <div className="h-[1px] bg-black/5 dark:bg-white/10 my-0.5" />

        {isFirstRow && (
          <>
            <button
              type="button"
              onClick={onToggleHeaderRow}
              disabled={isRowHeaderBlocked}
              title={isRowHeaderBlocked ? '병합 셀이 있어 헤더 행을 설정할 수 없습니다' : undefined}
              className={cn(itemClass, isRowHeaderBlocked && 'opacity-50 cursor-not-allowed hover:bg-transparent')}
            >
              <Icon name="Table" className="w-3.5 h-3.5 text-zinc-500 dark:text-[#9b9b9b]" />
              <span>Header row</span>
            </button>
            <div className="h-[1px] bg-black/5 dark:bg-white/10 my-1" />
          </>
        )}

        {canMoveUp && (
          <button type="button" onClick={onMoveRowUp} className={itemClass}>
            <Icon name="ArrowUp" className="w-3.5 h-3.5 text-zinc-500 dark:text-[#9b9b9b]" />
            <span>Move row up</span>
          </button>
        )}

        <button type="button" onClick={onMoveRowDown} className={itemClass}>
          <Icon name="ArrowDown" className="w-3.5 h-3.5 text-zinc-500 dark:text-[#9b9b9b]" />
          <span>Move row down</span>
        </button>

        <div className="h-[1px] bg-black/5 dark:bg-white/10 my-1" />

        {!isFirstRow && (
          <button type="button" onClick={onAddRowBefore} className={itemClass}>
            <Icon name="ArrowUpToLine" className="w-3.5 h-3.5 text-zinc-500 dark:text-[#9b9b9b]" />
            <span>Insert row above</span>
          </button>
        )}

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
          <DeleteRowIcon />
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
