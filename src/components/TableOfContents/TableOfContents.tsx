import React, { useState, useCallback, useEffect, useRef } from 'react'
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
  const inlineContainerRef = useRef<HTMLDivElement>(null)
  const [isInlineExpanded, setIsInlineExpanded] = useState(true)
  const [isScrolledOut, setIsScrolledOut] = useState(false)
  const [isStickyDropdownOpen, setIsStickyDropdownOpen] = useState(false)

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

  // Detect when the inline TOC is scrolled out of view
  useEffect(() => {
    const el = inlineContainerRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        // When inline TOC top is above the viewport (scrolled out of view above)
        if (!entry.isIntersecting && entry.boundingClientRect.top < 60) {
          setIsScrolledOut(true)
        } else if (entry.isIntersecting) {
          setIsScrolledOut(false)
          setIsStickyDropdownOpen(false)
        }
      },
      {
        threshold: 0,
        rootMargin: '-60px 0px 0px 0px',
      },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [headings?.length])

  const handleScrollToHeading = useCallback(
    (pos: number) => {
      setIsStickyDropdownOpen(false)
      editor.chain().focus(undefined, { scrollIntoView: false }).setTextSelection(pos + 1).run()
      try {
        const dom = editor.view.nodeDOM(pos) as HTMLElement || (editor.view.domAtPos(pos).node as HTMLElement)
        const element = dom && dom.nodeType === 1 ? dom : dom?.parentElement
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' })
        } else {
          editor.chain().focus(pos + 1, { scrollIntoView: true }).run()
        }
      } catch {
        editor.chain().focus(pos + 1, { scrollIntoView: true }).run()
      }
    },
    [editor],
  )

  if (!headings || headings.length === 0) {
    return null
  }

  return (
    <>
      {/* 1. Inline TOC: Placed in document flow at top, expanded by default */}
      <div
        ref={inlineContainerRef}
        className={`w-full select-none transition-all duration-200 mb-6 ${className}`.trim()}
      >
        <div className="mx-auto max-w-3xl px-4 pt-2">
          <div className="glass-panel rounded-xl shadow-sm border border-black/5 dark:border-white/10 overflow-hidden backdrop-blur-md">
            {/* Header */}
            <div
              onClick={() => setIsInlineExpanded(prev => !prev)}
              className="flex items-center justify-between px-3.5 py-2.5 cursor-pointer hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors"
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
                title={isInlineExpanded ? 'Collapse TOC' : 'Expand TOC'}
              >
                <Icon
                  name={isInlineExpanded ? 'ChevronUp' : 'ChevronDown'}
                  className="w-3.5 h-3.5 transition-transform duration-200"
                />
              </button>
            </div>

            {/* Expanded Content */}
            {isInlineExpanded && (
              <div className="max-h-72 overflow-y-auto px-2 pb-2.5 pt-1 space-y-0.5 border-t border-black/5 dark:border-white/10">
                {headings.map(item => {
                  const indentClass =
                    item.level === 1
                      ? 'pl-2 font-medium text-zinc-800 dark:text-[#e3e3e3]'
                      : item.level === 2
                      ? 'pl-5 text-zinc-600 dark:text-zinc-300'
                      : 'pl-8 text-zinc-500 dark:text-zinc-400'

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

      {/* 2. Compact Sticky Header Bar: Slides in at top ONLY when inline TOC is scrolled out */}
      <div
        className={`sticky top-2 z-20 w-fit mx-auto transition-all duration-300 select-none ${
          isScrolledOut
            ? 'opacity-100 translate-y-0 pointer-events-auto h-auto mb-2'
            : 'opacity-0 -translate-y-2 pointer-events-none h-0 overflow-hidden'
        }`}
      >
        <div className="relative">
          {/* Compact Bar Trigger (Fixed 300px width) */}
          <button
            type="button"
            onClick={() => setIsStickyDropdownOpen(prev => !prev)}
            className="glass-toolbar flex items-center justify-between w-[300px] min-w-[300px] px-3.5 py-1.5 rounded-full shadow-xl hover:shadow-2xl border border-black/10 dark:border-white/15 transition-all text-xs font-medium text-zinc-800 dark:text-[#e3e3e3]"
          >
            <div className="flex items-center gap-2 truncate">
              <Icon name="ListOrdered" className="w-3.5 h-3.5 text-indigo-500 dark:text-violet-400 shrink-0" />
              <span className="text-xs font-semibold truncate">Table of Contents</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/10 dark:bg-violet-500/20 text-indigo-600 dark:text-violet-300 font-mono font-medium shrink-0">
                {headings.length}
              </span>
            </div>
            <Icon
              name={isStickyDropdownOpen ? 'ChevronUp' : 'ChevronDown'}
              className="w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 shrink-0"
            />
          </button>

          {/* Sticky Dropdown Popover (Matching 300px width 1:1 aligned) */}
          {isStickyDropdownOpen && (
            <div className="glass-menu absolute top-full left-0 right-0 mt-2 w-[300px] min-w-[300px] max-h-72 overflow-y-auto p-1.5 shadow-2xl rounded-xl z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-2 py-1 text-[10px] font-semibold tracking-wider text-zinc-400 dark:text-zinc-500 uppercase select-none">
                Table of Contents
              </div>
              <div className="h-[1px] bg-black/5 dark:bg-white/10 my-1" />
              <div className="space-y-0.5">
                {headings.map(item => {
                  const indentClass =
                    item.level === 1
                      ? 'pl-2 font-medium text-zinc-800 dark:text-[#e3e3e3]'
                      : item.level === 2
                      ? 'pl-5 text-zinc-600 dark:text-zinc-300'
                      : 'pl-8 text-zinc-500 dark:text-zinc-400'

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
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default TableOfContents
