import React, { useState, useCallback } from 'react'
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
  onClose,
  scope = 'cell',
  index,
}) => {
  const [isOpen, setIsOpen] = useState(false)

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
      onClose?.()
    },
    [editor, onClose, scope, index],
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
      onClose?.()
    },
    [editor, onClose, scope, index],
  )

  const itemClass =
    'w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs text-left transition-colors text-zinc-700 dark:text-[#e3e3e3] hover:bg-black/5 dark:hover:bg-white/[0.08] active:bg-black/10 dark:active:bg-white/[0.12] select-none cursor-pointer'

  const iconBtnClass = (isActive: boolean) =>
    `flex-1 h-7 rounded flex items-center justify-center transition-colors cursor-pointer ${
      isActive
        ? 'bg-black/10 dark:bg-white/20 text-indigo-600 dark:text-violet-400 font-semibold shadow-xs'
        : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-black/5 dark:hover:bg-white/10'
    }`

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={`${itemClass} flex items-center justify-between`}
      >
        <span className="flex items-center gap-2">
          <Icon name="AlignLeft" className="w-3.5 h-3.5" />
          <span>Alignment</span>
        </span>
        <Icon name="ChevronRight" className="w-3.5 h-3.5 opacity-60" />
      </button>

      {isOpen && (
        <div className="absolute left-full top-0 ml-1 min-w-[12rem] p-2 shadow-2xl rounded-xl flex flex-col gap-2 bg-white/95 dark:bg-[#202020]/95 backdrop-blur-md border border-black/10 dark:border-white/10 z-50 text-zinc-800 dark:text-zinc-200 animate-in fade-in-0 zoom-in-95 duration-100">
          {/* Horizontal Alignment Group */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 px-1 select-none">
              수평 정렬
            </span>
            <div className="flex items-center gap-1 bg-black/[0.03] dark:bg-white/[0.04] p-0.5 rounded-lg border border-black/5 dark:border-white/5">
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

          <div className="h-[1px] bg-black/5 dark:bg-white/10 my-0.5" />

          {/* Vertical Alignment Group */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 px-1 select-none">
              수직 정렬
            </span>
            <div className="flex items-center gap-1 bg-black/[0.03] dark:bg-white/[0.04] p-0.5 rounded-lg border border-black/5 dark:border-white/5">
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
      )}
    </div>
  )
}

export default TableAlignmentSubmenu
