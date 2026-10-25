import React from 'react'
import { Editor } from '@tiptap/react'
import { Icon } from '@/components/ui/Icon'
import { icons } from 'lucide-react'
import { turnIntoBlock } from '../hooks/useContentItemActions'

export interface TurnIntoSubmenuProps {
  editor: Editor
  currentNodePos: number
  onBack: () => void
  onClose: () => void
}

interface TurnIntoOption {
  label: string
  icon: keyof typeof icons
  action: (editor: Editor, pos: number) => void
}

const TURN_INTO_OPTIONS: TurnIntoOption[] = [
  {
    label: 'Text',
    icon: 'Type',
    action: (editor, pos) => {
      turnIntoBlock(editor, pos, 'paragraph')
    },
  },
  {
    label: 'Heading 1',
    icon: 'Heading1',
    action: (editor, pos) => {
      turnIntoBlock(editor, pos, 'heading', { level: 1 })
    },
  },
  {
    label: 'Heading 2',
    icon: 'Heading2',
    action: (editor, pos) => {
      turnIntoBlock(editor, pos, 'heading', { level: 2 })
    },
  },
  {
    label: 'Heading 3',
    icon: 'Heading3',
    action: (editor, pos) => {
      turnIntoBlock(editor, pos, 'heading', { level: 3 })
    },
  },
  {
    label: 'Bulleted list',
    icon: 'List',
    action: (editor, pos) => {
      turnIntoBlock(editor, pos, 'bulletList')
    },
  },
  {
    label: 'Numbered list',
    icon: 'ListOrdered',
    action: (editor, pos) => {
      turnIntoBlock(editor, pos, 'orderedList')
    },
  },
  {
    label: 'To-do list',
    icon: 'ListTodo',
    action: (editor, pos) => {
      turnIntoBlock(editor, pos, 'taskList')
    },
  },
  {
    label: 'Quote',
    icon: 'Quote',
    action: (editor, pos) => {
      turnIntoBlock(editor, pos, 'blockquote')
    },
  },
  {
    label: 'Code block',
    icon: 'Code',
    action: (editor, pos) => {
      turnIntoBlock(editor, pos, 'codeBlock')
    },
  },
]

export const TurnIntoSubmenu: React.FC<TurnIntoSubmenuProps> = ({
  editor,
  currentNodePos,
  onBack,
  onClose,
}) => {
  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        onClick={onBack}
        className="w-full flex items-center gap-1.5 px-2 py-1 mb-1 text-xs font-semibold text-zinc-500 dark:text-[#9b9b9b] hover:text-zinc-800 dark:hover:text-[#e3e3e3] hover:bg-black/5 dark:hover:bg-white/[0.06] rounded border border-transparent transition-colors text-left"
      >
        <Icon name="ArrowLeft" className="w-3.5 h-3.5" />
        <span>Turn into</span>
      </button>
      <div className="flex flex-col gap-0.5">
        {TURN_INTO_OPTIONS.map((option) => (
          <button
            key={option.label}
            type="button"
            onClick={() => {
              option.action(editor, currentNodePos)
              onClose()
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-[#e3e3e3] hover:text-zinc-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.06] active:bg-black/10 dark:active:bg-white/[0.1] rounded border border-transparent transition-colors text-left"
          >
            <Icon name={option.icon} className="w-4 h-4 text-zinc-400 dark:text-[#9b9b9b] shrink-0" />
            <span>{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default TurnIntoSubmenu
