import React, { useCallback } from 'react'
import { Editor } from '@tiptap/react'
import { TableMap, CellSelection } from '@tiptap/pm/tables'
import { Icon } from '@/components/ui/Icon'
import { findTable, isCellSelection } from '../utils'
import { getSelectedRowRange } from './TableRow/rowActions'
import { getSelectedColRange } from './TableColumn/columnActions'

export interface TableAlignmentSubmenuProps {
  editor: Editor
  onClose?: () => void
  scope?: 'cell' | 'row' | 'column'
  index?: number
}

export const TableAlignmentSubmenu: React.FC<TableAlignmentSubmenuProps> = ({
  editor,
  scope = 'cell',
  index,
  onClose,
}) => {
  const activeTextAlign =
    editor.getAttributes('tableCell').textAlign ||
    editor.getAttributes('tableHeader').textAlign ||
    (editor.isActive({ textAlign: 'center' })
      ? 'center'
      : editor.isActive({ textAlign: 'right' })
      ? 'right'
      : 'left')

  const activeVerticalAlign =
    editor.getAttributes('tableCell').verticalAlign ||
    editor.getAttributes('tableHeader').verticalAlign ||
    'top'

  const applyAlignment = useCallback(
    (type: 'textAlign' | 'verticalAlign', value: string) => {
      const { state, view } = editor
      const table = findTable(state.selection)
      if (!table) return

      const map = TableMap.get(table.node)
      let minRow = 0
      let maxRow = map.height - 1
      let minCol = 0
      let maxCol = map.width - 1

      if (scope === 'row') {
        const range = getSelectedRowRange(editor)
        minRow = typeof index === 'number' ? index : range.min
        maxRow = typeof index === 'number' ? index : range.max
      } else if (scope === 'column') {
        const range = getSelectedColRange(editor)
        minCol = typeof index === 'number' ? index : range.min
        maxCol = typeof index === 'number' ? index : range.max
      } else {
        // Single cell
        if (isCellSelection(state.selection)) {
          const start = state.selection.$anchorCell.start(-1)
          const rect = map.rectBetween(state.selection.$anchorCell.pos - start, state.selection.$headCell.pos - start)
          minRow = rect.top
          maxRow = rect.bottom - 1
          minCol = rect.left
          maxCol = rect.right - 1
        }
      }

      const cells = map.cellsInRect({
        left: minCol,
        right: maxCol + 1,
        top: minRow,
        bottom: maxRow + 1,
      })

      let tr = state.tr
      const seen = new Set<number>()

      cells.forEach(cellOffset => {
        const cellPos = table.start + cellOffset
        if (seen.has(cellPos)) return
        seen.add(cellPos)

        const cellNode = state.doc.nodeAt(cellPos)
        if (!cellNode) return

        const newAttrs = { ...cellNode.attrs, [type]: value }
        tr = tr.setNodeMarkup(cellPos, null, newAttrs)

        // Also update inner paragraph / heading textAlign if type is textAlign
        if (type === 'textAlign') {
          cellNode.forEach((child, childOffset) => {
            if (child.type.name === 'paragraph' || child.type.name === 'heading') {
              const childPos = cellPos + 1 + childOffset
              tr = tr.setNodeMarkup(childPos, null, { ...child.attrs, textAlign: value })
            }
          })
        }
      })

      // Strictly preserve or re-anchor CellSelection over the target range
      const cellsFirst = map.cellsInRect({ left: minCol, right: minCol + 1, top: minRow, bottom: minRow + 1 })
      const cellsLast = map.cellsInRect({ left: maxCol, right: maxCol + 1, top: maxRow, bottom: maxRow + 1 })
      if (cellsFirst.length > 0 && cellsLast.length > 0) {
        const head = table.start + cellsFirst[0]
        const anchor = table.start + cellsLast[cellsLast.length - 1]
        tr = tr.setSelection(new CellSelection(tr.doc.resolve(anchor), tr.doc.resolve(head)))
      }

      view.dispatch(tr)
      view.dom.focus({ preventScroll: true })
      if (typeof onClose === 'function') {
        onClose()
      } else {
        window.dispatchEvent(new CustomEvent('tiptap:close-table-menus'))
      }
    },
    [editor, scope, index, onClose],
  )

  const handleTextAlign = useCallback(
    (align: 'left' | 'center' | 'right') => (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      applyAlignment('textAlign', align)
    },
    [applyAlignment],
  )

  const handleVerticalAlign = useCallback(
    (valign: 'top' | 'middle' | 'bottom') => (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      applyAlignment('verticalAlign', valign)
    },
    [applyAlignment],
  )

  const iconBtnClass = (isActive: boolean) =>
    `flex-1 h-6 rounded flex items-center justify-center transition-colors cursor-pointer ${
      isActive
        ? 'bg-white dark:bg-white/20 text-indigo-600 dark:text-violet-300 shadow-xs font-semibold'
        : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-black/5 dark:hover:bg-white/10'
    }`

  return (
    <div className="flex flex-col gap-1 p-1 bg-black/[0.03] dark:bg-white/[0.04] rounded-lg border border-black/5 dark:border-white/5 mb-0.5">
      {/* 1. Horizontal Alignment */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 w-6 shrink-0 pl-1 select-none">
          수평
        </span>
        <div className="flex-1 flex items-center gap-0.5 bg-black/[0.03] dark:bg-white/[0.06] p-0.5 rounded-md">
          <button
            type="button"
            onClick={handleTextAlign('left')}
            className={iconBtnClass(activeTextAlign === 'left')}
            title="왼쪽 정렬 (Align left)"
          >
            <Icon name="AlignLeft" className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleTextAlign('center')}
            className={iconBtnClass(activeTextAlign === 'center')}
            title="가운데 정렬 (Align center)"
          >
            <Icon name="AlignCenter" className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleTextAlign('right')}
            className={iconBtnClass(activeTextAlign === 'right')}
            title="오른쪽 정렬 (Align right)"
          >
            <Icon name="AlignRight" className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Vertical Alignment */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 w-6 shrink-0 pl-1 select-none">
          수직
        </span>
        <div className="flex-1 flex items-center gap-0.5 bg-black/[0.03] dark:bg-white/[0.06] p-0.5 rounded-md">
          <button
            type="button"
            onClick={handleVerticalAlign('top')}
            className={iconBtnClass(activeVerticalAlign === 'top')}
            title="상단 정렬 (Align top)"
          >
            <Icon name="AlignVerticalJustifyStart" className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleVerticalAlign('middle')}
            className={iconBtnClass(activeVerticalAlign === 'middle')}
            title="중앙 정렬 (Align middle)"
          >
            <Icon name="AlignVerticalJustifyCenter" className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleVerticalAlign('bottom')}
            className={iconBtnClass(activeVerticalAlign === 'bottom')}
            title="하단 정렬 (Align bottom)"
          >
            <Icon name="AlignVerticalJustifyEnd" className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default TableAlignmentSubmenu
