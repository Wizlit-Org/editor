import React, { useState, useMemo, useCallback } from 'react'
import { Editor, useEditorState } from '@tiptap/react'
import { Icon } from '@/components/ui/Icon'

interface TableOfContentsProps {
  editor: Editor
  className?: string
}

interface HeadingItem {
  id: string
  level: number
  text: string
  pos: number
}

export const TableOfContents: React.FC<TableOfContentsProps> = ({ editor, className = '' }) => {
  const [isExpanded, setIsExpanded] = useState(false)

  // Track doc changes to extract headings in real-time
  const headings = useEditorState({
    editor,
    selector: ctx => {
      const list: HeadingItem[] = []
      ctx.editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
          const level = node.attrs.level || 1
          const text = node.textContent.trim()
          if (text) {
            list.push({
              id: `heading-${pos}`,
              level,
              text,
              pos,
            })
          }
        }
      })
      return list
    },
  })

  const handleScrollToHeading = useCallback(
    (pos: number) => {
      editor.chain().focus(undefined, { scrollIntoView: false }).setTextSelection(pos + 1).run()
      try {
        const dom = editor.view.nodeDOM(pos) as HTMLElement || (editor.view.domAtPos(pos).node as HTMLElement)
        if (dom) {
          const element = dom.nodeType === 1 ? dom : dom.parentElement
          element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      } catch {
        // Fallback editor scroll
        editor.chain().focus(pos + 1, { scrollIntoView: true }).run()
      }
    },
    [editor],
  )

  if (!headings || headings.length === 0) {
    return null
  }

  return (
    <div
      className={`sticky top-0 z-30 w-full transition-all duration-200 select-none ${className}`.trim()}
    >
      <div className="mx-auto max-w-4xl px-4 pt-2">
        <div className="glass-panel rounded-xl shadow-lg border border-black/5 dark:border-white/10 overflow-hidden backdrop-blur-md">
          {/* Header Bar */}
          <div
            onClick={() => setIsExpanded(prev => !prev)}
            className="flex items-center justify-between px-3.5 py-2 cursor-pointer hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Icon name="ListOrdered" className="w-4 h-4 text-indigo-500 dark:text-violet-400" />
              <span className="text-xs font-semibold tracking-wide text-zinc-700 dark:text-[#e3e3e3]">
                Table of Contents
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/10 dark:bg-violet-500/20 text-indigo-600 dark:text-violet-300 font-medium">
                {headings.length}
              </span>
            </div>

            <button
              type="button"
              className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-[#e3e3e3] transition-colors"
              title={isExpanded ? 'Collapse TOC' : 'Expand TOC'}
            >
              <Icon
                name={isExpanded ? 'ChevronUp' : 'ChevronDown'}
                className="w-3.5 h-3.5 transition-transform duration-200"
              />
            </button>
          </div>

          {/* Collapsible Content */}
          {isExpanded && (
            <div className="max-h-60 overflow-y-auto px-2 pb-2.5 pt-1 space-y-0.5 border-t border-black/5 dark:border-white/10">
              {headings.map(item => {
                const indentClass =
                  item.level === 1 ? 'pl-2 font-medium' : item.level === 2 ? 'pl-5 text-zinc-600 dark:text-zinc-300' : 'pl-8 text-zinc-500 dark:text-zinc-400'

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleScrollToHeading(item.pos)}
                    className={`w-full text-left text-xs py-1.5 pr-2 rounded hover:bg-black/5 dark:hover:bg-white/[0.08] active:bg-black/10 dark:active:bg-white/[0.12] transition-colors truncate flex items-center gap-1.5 ${indentClass}`}
                  >
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 shrink-0 font-mono">
                      H{item.level}
                    </span>
                    <span className="truncate">{item.text}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TableOfContents
