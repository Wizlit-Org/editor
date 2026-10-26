import React from 'react'
import { Editor } from '@tiptap/react'
import { Icon } from '@/components/ui/Icon'
import { icons } from 'lucide-react'
import { cn } from '@/lib/utils'
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
  type: 'paragraph' | 'heading' | 'blockquote' | 'codeBlock' | 'bulletList' | 'orderedList' | 'taskList'
  attrs?: Record<string, any>
  action: (editor: Editor, pos: number) => void
}

const TURN_INTO_OPTIONS: TurnIntoOption[] = [
  {
    label: 'Text',
    icon: 'Type',
    type: 'paragraph',
    action: (editor, pos) => {
      turnIntoBlock(editor, pos, 'paragraph')
    },
  },
  {
    label: 'Heading 1',
    icon: 'Heading1',
    type: 'heading',
    attrs: { level: 1 },
    action: (editor, pos) => {
      turnIntoBlock(editor, pos, 'heading', { level: 1 })
    },
  },
  {
    label: 'Heading 2',
    icon: 'Heading2',
    type: 'heading',
    attrs: { level: 2 },
    action: (editor, pos) => {
      turnIntoBlock(editor, pos, 'heading', { level: 2 })
    },
  },
  {
    label: 'Heading 3',
    icon: 'Heading3',
    type: 'heading',
    attrs: { level: 3 },
    action: (editor, pos) => {
      turnIntoBlock(editor, pos, 'heading', { level: 3 })
    },
  },
  {
    label: 'Bulleted list',
    icon: 'List',
    type: 'bulletList',
    action: (editor, pos) => {
      turnIntoBlock(editor, pos, 'bulletList')
    },
  },
  {
    label: 'Numbered list',
    icon: 'ListOrdered',
    type: 'orderedList',
    action: (editor, pos) => {
      turnIntoBlock(editor, pos, 'orderedList')
    },
  },
  {
    label: 'To-do list',
    icon: 'ListTodo',
    type: 'taskList',
    action: (editor, pos) => {
      turnIntoBlock(editor, pos, 'taskList')
    },
  },
  {
    label: 'Quote',
    icon: 'Quote',
    type: 'blockquote',
    action: (editor, pos) => {
      turnIntoBlock(editor, pos, 'blockquote')
    },
  },
  {
    label: 'Code block',
    icon: 'Code',
    type: 'codeBlock',
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
  const currentNode =
    currentNodePos >= 0 && editor?.state?.doc
      ? editor.state.doc.nodeAt(currentNodePos)
      : null

  const isOptionActive = (option: TurnIntoOption) => {
    if (!editor) return false

    if (option.type === 'paragraph') {
      return editor.isActive('paragraph') || currentNode?.type.name === 'paragraph'
    }
    if (option.type === 'heading') {
      const level = option.attrs?.level
      return (
        editor.isActive('heading', { level }) ||
        (currentNode?.type.name === 'heading' && currentNode?.attrs?.level === level)
      )
    }
    if (option.type === 'bulletList') {
      return editor.isActive('bulletList') || currentNode?.type.name === 'bulletList'
    }
    if (option.type === 'orderedList') {
      return editor.isActive('orderedList') || currentNode?.type.name === 'orderedList'
    }
    if (option.type === 'taskList') {
      return editor.isActive('taskList') || currentNode?.type.name === 'taskList'
    }
    if (option.type === 'blockquote') {
      return (
        editor.isActive('blockquoteFigure') ||
        editor.isActive('blockquote') ||
        editor.isActive('quote') ||
        ['blockquoteFigure', 'blockquote', 'quote'].includes(currentNode?.type.name || '')
      )
    }
    if (option.type === 'codeBlock') {
      return editor.isActive('codeBlock') || currentNode?.type.name === 'codeBlock'
    }
    return false
  }

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
        {TURN_INTO_OPTIONS.map((option) => {
          const isActive = isOptionActive(option)

          return (
            <button
              key={option.label}
              type="button"
              onClick={() => {
                option.action(editor, currentNodePos)
                onClose()
              }}
              className={cn(
                'w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-medium rounded border border-transparent transition-colors text-left',
                isActive
                  ? 'bg-black/5 dark:bg-white/[0.08] text-zinc-900 dark:text-white font-semibold'
                  : 'text-zinc-700 dark:text-[#e3e3e3] hover:text-zinc-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.06] active:bg-black/10 dark:active:bg-white/[0.1]',
              )}
            >
              <Icon
                name={option.icon}
                className={cn(
                  'w-4 h-4 shrink-0',
                  isActive ? 'text-zinc-900 dark:text-white' : 'text-zinc-400 dark:text-[#9b9b9b]',
                )}
              />
              <span className="flex-1">{option.label}</span>
              {isActive && (
                <Icon name="Check" className="w-3.5 h-3.5 text-zinc-900 dark:text-white shrink-0 ml-auto" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default TurnIntoSubmenu
