import React, { useCallback } from 'react'
import { Editor } from '@tiptap/react'
import { Icon } from '@/components/ui/Icon'
import { setRowAlignment, getSelectedRowIndex } from './TableRow/rowActions'
import { setColumnAlignment, getSelectedColumnIndex } from './TableColumn/columnActions'

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

  const handleTextAlign = useCallback(
    (align: 'left' | 'center' | 'right') => (e: React.MouseEvent) => {
      e.stopPropagation()
      if (scope === 'row') {
        const rowIdx = index ?? getSelectedRowIndex(editor)
        setRowAlignment(editor, rowIdx, 'textAlign', align)
      } else if (scope === 'column') {
        const colIdx = index ?? getSelectedColumnIndex(editor)
        setColumnAlignment(editor, colIdx, 'textAlign', align)
      } else {
        try {
          editor.chain().focus().setCellAttribute('textAlign', align).setTextAlign(align).run()
        } catch {
          editor.chain().focus().setCellAttribute('textAlign', align).run()
        }
      }
    },
    [editor, scope, index],
  )

  const handleVerticalAlign = useCallback(
    (valign: 'top' | 'middle' | 'bottom') => (e: React.MouseEvent) => {
      e.stopPropagation()
      if (scope === 'row') {
        const rowIdx = index ?? getSelectedRowIndex(editor)
        setRowAlignment(editor, rowIdx, 'verticalAlign', valign)
      } else if (scope === 'column') {
        const colIdx = index ?? getSelectedColumnIndex(editor)
        setColumnAlignment(editor, colIdx, 'verticalAlign', valign)
      } else {
        editor.chain().focus().setCellAttribute('verticalAlign', valign).run()
      }
    },
    [editor, scope, index],
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
