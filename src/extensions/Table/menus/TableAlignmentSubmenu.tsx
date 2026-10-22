import React, { useState, useCallback } from 'react'
import { Editor } from '@tiptap/react'
import { Icon } from '@/components/ui/Icon'

interface TableAlignmentSubmenuProps {
  editor: Editor
  onClose?: () => void
}

export const TableAlignmentSubmenu: React.FC<TableAlignmentSubmenuProps> = ({ editor, onClose }) => {
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
      try {
        editor.chain().focus().setCellAttribute('textAlign', align).setTextAlign(align).run()
      } catch {
        editor.chain().focus().setCellAttribute('textAlign', align).run()
      }
      onClose?.()
    },
    [editor, onClose],
  )

  const handleVerticalAlign = useCallback(
    (valign: 'top' | 'middle' | 'bottom') => (e: React.MouseEvent) => {
      e.stopPropagation()
      editor.chain().focus().setCellAttribute('verticalAlign', valign).run()
      onClose?.()
    },
    [editor, onClose],
  )

  const itemClass =
    'w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs text-left transition-colors text-zinc-700 dark:text-[#e3e3e3] hover:bg-black/5 dark:hover:bg-white/[0.08] active:bg-black/10 dark:active:bg-white/[0.12] select-none cursor-pointer'

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
        <div className="absolute left-full top-0 ml-1 min-w-[11rem] p-1.5 shadow-2xl rounded-xl flex flex-col gap-0.5 bg-white/95 dark:bg-[#202020]/95 backdrop-blur-md border border-black/10 dark:border-white/10 z-[1350] text-zinc-800 dark:text-zinc-200 animate-in fade-in-0 zoom-in-95 duration-100">
          {/* Horizontal Alignments */}
          <button
            type="button"
            onClick={handleTextAlign('left')}
            className={itemClass}
          >
            <span className="flex items-center gap-2">
              <Icon name="AlignLeft" className="w-3.5 h-3.5" />
              <span>Align left</span>
            </span>
            {activeTextAlign === 'left' && <Icon name="Check" className="w-3.5 h-3.5 text-indigo-500" />}
          </button>

          <button
            type="button"
            onClick={handleTextAlign('center')}
            className={itemClass}
          >
            <span className="flex items-center gap-2">
              <Icon name="AlignCenter" className="w-3.5 h-3.5" />
              <span>Align center</span>
            </span>
            {activeTextAlign === 'center' && <Icon name="Check" className="w-3.5 h-3.5 text-indigo-500" />}
          </button>

          <button
            type="button"
            onClick={handleTextAlign('right')}
            className={itemClass}
          >
            <span className="flex items-center gap-2">
              <Icon name="AlignRight" className="w-3.5 h-3.5" />
              <span>Align right</span>
            </span>
            {activeTextAlign === 'right' && <Icon name="Check" className="w-3.5 h-3.5 text-indigo-500" />}
          </button>

          <div className="h-[1px] bg-black/5 dark:bg-white/10 my-1" />

          {/* Vertical Alignments */}
          <button
            type="button"
            onClick={handleVerticalAlign('top')}
            className={itemClass}
          >
            <span className="flex items-center gap-2">
              <Icon name="AlignVerticalJustifyStart" className="w-3.5 h-3.5" />
              <span>Align top</span>
            </span>
            {activeVerticalAlign === 'top' && <Icon name="Check" className="w-3.5 h-3.5 text-indigo-500" />}
          </button>

          <button
            type="button"
            onClick={handleVerticalAlign('middle')}
            className={itemClass}
          >
            <span className="flex items-center gap-2">
              <Icon name="AlignVerticalJustifyCenter" className="w-3.5 h-3.5" />
              <span>Align middle</span>
            </span>
            {activeVerticalAlign === 'middle' && <Icon name="Check" className="w-3.5 h-3.5 text-indigo-500" />}
          </button>

          <button
            type="button"
            onClick={handleVerticalAlign('bottom')}
            className={itemClass}
          >
            <span className="flex items-center gap-2">
              <Icon name="AlignVerticalJustifyEnd" className="w-3.5 h-3.5" />
              <span>Align bottom</span>
            </span>
            {activeVerticalAlign === 'bottom' && <Icon name="Check" className="w-3.5 h-3.5 text-indigo-500" />}
          </button>
        </div>
      )}
    </div>
  )
}
