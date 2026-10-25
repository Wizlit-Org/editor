import { BubbleMenu as BaseBubbleMenu } from '@tiptap/react/menus'
import React, { useCallback, useState, useEffect, useRef, useMemo, JSX } from 'react'
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
import { hasColStraddlingMerge, hasHeaderCol } from '../../utils/TableHeaderStraddleUtils'

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

    const handleDocumentMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (!target) return
      if (target.closest('.glass-menu') || target.closest('#table-col-grips')) return
      handleClose()
    }

    const handleSelectionUpdate = ({ transaction }: { transaction: any }) => {
      if (transaction?.getMeta('tableColumnMenu') === 'show') return
      if (Date.now() - lastOpenTimeRef.current < 80) return
      handleClose()
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose()
      }
    }

    window.addEventListener('tiptap:open-table-col-menu', handleOpen)
    window.addEventListener('tiptap:close-table-menus', handleClose)
    window.addEventListener('tiptap:close-menus', handleClose)
    window.addEventListener('mousedown', handleDocumentMouseDown, { capture: true })
    window.addEventListener('keydown', handleKeyDown)
    editor.on('selectionUpdate', handleSelectionUpdate)

    return () => {
      window.removeEventListener('tiptap:open-table-col-menu', handleOpen)
      window.removeEventListener('tiptap:close-table-menus', handleClose)
      window.removeEventListener('tiptap:close-menus', handleClose)
      window.removeEventListener('mousedown', handleDocumentMouseDown, { capture: true })
      window.removeEventListener('keydown', handleKeyDown)
      editor.off('selectionUpdate', handleSelectionUpdate)
    }
  }, [editor])

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

  const closeMenu = useCallback(() => {
    isMenuOpenRef.current = false
    setIsMenuOpen(false)
    window.dispatchEvent(new CustomEvent('tiptap:close-table-menus'))
  }, [])

  const onMoveColumnLeft = useCallback(() => {
    const idx = getSelectedColumnIndex(editor)
    moveColumnLeft(editor, idx)
    closeMenu()
  }, [editor, closeMenu])

  const onMoveColumnRight = useCallback(() => {
    const idx = getSelectedColumnIndex(editor)
    moveColumnRight(editor, idx)
    closeMenu()
  }, [editor, closeMenu])

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
    closeMenu()
  }, [editor, closeMenu])

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
    closeMenu()
  }, [editor, closeMenu])

  const onSortAsc = useCallback(() => {
    const idx = getSelectedColumnIndex(editor)
    sortColumn(editor, idx, 'asc')
    closeMenu()
  }, [editor, closeMenu])

  const onSortDesc = useCallback(() => {
    const idx = getSelectedColumnIndex(editor)
    sortColumn(editor, idx, 'desc')
    closeMenu()
  }, [editor, closeMenu])

  const onClearColumn = useCallback(() => {
    const idx = getSelectedColumnIndex(editor)
    clearColumnContents(editor, idx)
    closeMenu()
  }, [editor, closeMenu])

  const onDuplicate = useCallback(() => {
    const idx = getSelectedColumnIndex(editor)
    duplicateColumn(editor, idx)
    closeMenu()
  }, [editor, closeMenu])

  const onDeleteColumn = useCallback(() => {
    deleteColumn(editor)
    closeMenu()
  }, [editor, closeMenu])

  const isColHeaderBlocked = useMemo(() => {
    const table = findTable(editor.state.selection)
    return table ? hasColStraddlingMerge(table.node, 0) : false
  }, [editor.state.selection])

  const selectedColIdx = getSelectedColumnIndex(editor)
  const isFirstCol = selectedColIdx === 0
  const canMoveLeft = selectedColIdx > 0

  const isHeaderColActive = useMemo(() => {
    if (selectedColIdx !== 0) return false
    const table = findTable(editor.state.selection)
    if (!table) return false
    if (hasHeaderCol(table.node)) return true
    try {
      const map = TableMap.get(table.node)
      for (let r = 0; r < map.height; r++) {
        const cellPos = map.map[r * map.width]
        const cellNode = table.node.nodeAt(cellPos)
        if (!cellNode) return false
        const isTh = cellNode.type.name === 'tableHeader' || cellNode.type.spec?.tableRole === 'header_cell'
        if (!isTh) return false
      }
      return true
    } catch {
      return false
    }
  }, [editor.state.selection, selectedColIdx])

  const onToggleHeaderColumn = useCallback(() => {
    const table = findTable(editor.state.selection)
    if (table && hasColStraddlingMerge(table.node, 0)) return
    editor.chain().focus().toggleHeaderColumn().run()
    closeMenu()
  }, [editor, closeMenu])

  const onDeleteTable = useCallback(() => {
    editor.chain().focus().deleteTable().run()
    closeMenu()
  }, [editor, closeMenu])

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
      appendTo={appendTo?.current || (typeof document !== 'undefined' ? document.body : undefined)}
      getReferencedVirtualElement={getReferencedVirtualElement}
      options={TABLE_COLUMN_MENU_OPTIONS}
      shouldShow={shouldShow}
    >
      <div
        style={{ display: !isMenuOpen || isClosedByScroll ? 'none' : undefined, zIndex: 1350 }}
        data-theme={editor?.view?.dom?.closest('.editor-theme-dark') ? 'dark' : 'light'}
        data-editor-theme={editor?.view?.dom?.closest('.editor-theme-dark') ? 'dark' : 'light'}
        className={cn(
          'glass-menu min-w-[14rem] p-1.5 shadow-2xl rounded-lg flex flex-col gap-0.5 z-[1350] bg-white/85 dark:bg-[#202020]/90 backdrop-blur-md border border-black/5 dark:border-white/10 text-zinc-800 dark:text-zinc-200',
          editor?.view?.dom?.closest('.editor-theme-dark')
            ? 'editor-theme-dark dark theme-dark'
            : 'editor-theme-light theme-light',
          (!isMenuOpen || isClosedByScroll) && '!hidden',
        )}
      >
        <TableAlignmentSubmenu editor={editor} scope="column" index={selectedColIdx} onClose={closeMenu} />

        <div className="h-[1px] bg-black/5 dark:bg-white/10 my-0.5" />

        {isFirstCol && (
          <>
            <button
              type="button"
              onClick={onToggleHeaderColumn}
              disabled={isColHeaderBlocked}
              title={isColHeaderBlocked ? '병합 셀이 있어 헤더 열을 설정할 수 없습니다' : undefined}
              className={cn(
                itemClass,
                isColHeaderBlocked && 'opacity-50 cursor-not-allowed hover:bg-transparent',
                isHeaderColActive &&
                  '!bg-indigo-500/10 !text-indigo-600 dark:!text-indigo-400 font-medium hover:!bg-indigo-500/20',
              )}
            >
              <Icon
                name="Table"
                className={cn(
                  'w-3.5 h-3.5',
                  isHeaderColActive ? '!text-indigo-600 dark:!text-indigo-400' : 'text-zinc-500 dark:text-[#9b9b9b]',
                )}
              />
              <span>Header column</span>
              {isHeaderColActive && (
                <Icon name="Check" className="w-3.5 h-3.5 ml-auto !text-indigo-600 dark:!text-indigo-400" />
              )}
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
