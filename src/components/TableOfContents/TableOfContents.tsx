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

const getScrollParent = (node: HTMLElement | null): HTMLElement | Window => {
  if (!node || typeof window === 'undefined') return window
  let parent = node.parentElement
  while (parent && parent !== document.body && parent !== document.documentElement) {
    const style = window.getComputedStyle(parent)
    const oy = style.overflowY
    const ox = style.overflow
    if (
      oy === 'auto' ||
      oy === 'scroll' ||
      oy === 'overlay' ||
      ox === 'auto' ||
      ox === 'scroll'
    ) {
      return parent
    }
    parent = parent.parentElement
  }
  return window
}

export const TableOfContents: React.FC<TableOfContentsProps> = ({ editor, className = '' }) => {
  const inlineContainerRef = useRef<HTMLDivElement>(null)
  const [isInlineExpanded, setIsInlineExpanded] = useState(true)
  const [isScrolledOut, setIsScrolledOut] = useState(false)
  const [isStickyDropdownOpen, setIsStickyDropdownOpen] = useState(false)
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      return window.location.hash.slice(1)
    }
    return null
  })
  const initialHashRef = useRef<string | null>(
    typeof window !== 'undefined' && window.location.hash ? window.location.hash.slice(1) : null,
  )
  const isInitialAnchorJumpRef = useRef<boolean>(Boolean(initialHashRef.current))
  const isProgrammaticScrollRef = useRef(Boolean(initialHashRef.current))
  const programmaticScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeScrollContainerRef = useRef<HTMLElement | Window | null>(null)

  const unlockProgrammaticScroll = useCallback(() => {
    if (programmaticScrollTimerRef.current) {
      clearTimeout(programmaticScrollTimerRef.current)
      programmaticScrollTimerRef.current = null
    }
    isProgrammaticScrollRef.current = false
    isInitialAnchorJumpRef.current = false
  }, [])

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
              id: node.attrs.id || `heading-${pos}`,
              level,
              text,
              pos,
            })
          }
        }
      })
      return list
    },
    equalityFn: (prev, next) => {
      if (!prev && !next) return true
      if (!prev || !next) return false
      if (prev.length !== next.length) return false
      return prev.every(
        (item, i) =>
          item.id === next[i]?.id &&
          item.level === next[i]?.level &&
          item.text === next[i]?.text &&
          item.pos === next[i]?.pos,
      )
    },
  })

  // Detect when the inline TOC is scrolled out of view and track active heading
  useEffect(() => {
    let rafId: number | null = null

    const checkScrolledOut = () => {
      const scrollParent =
        (activeScrollContainerRef.current instanceof HTMLElement &&
         ((inlineContainerRef.current && activeScrollContainerRef.current.contains(inlineContainerRef.current)) ||
          (editor.view?.dom && activeScrollContainerRef.current.contains(editor.view.dom)))
          ? activeScrollContainerRef.current
          : null) ||
        getScrollParent(inlineContainerRef.current || editor.view?.dom)

      const isHtmlElement =
        scrollParent instanceof HTMLElement &&
        scrollParent !== document.documentElement &&
        scrollParent !== document.body

      const containerTop = isHtmlElement
        ? scrollParent.getBoundingClientRect().top
        : 0

      if (inlineContainerRef.current) {
        const rect = inlineContainerRef.current.getBoundingClientRect()
        const isPast = rect.bottom <= containerTop + 16
        setIsScrolledOut(prev => (prev === isPast ? prev : isPast))
        if (!isPast) {
          setIsStickyDropdownOpen(prev => (prev ? false : prev))
        }
      }

      // If smooth programmatic scroll from TOC click or initial anchor restore is active, prevent scroll spy jitter
      if (isProgrammaticScrollRef.current || isInitialAnchorJumpRef.current) {
        return
      }

      const scrollTop = isHtmlElement
        ? scrollParent.scrollTop
        : (typeof window !== 'undefined'
            ? window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0
            : 0)

      // Track active heading
      if (headings && headings.length > 0) {
        let currentActive: string | null = null

        for (const h of headings) {
          let element: HTMLElement | null = null
          if (h.id) {
            element =
              document.getElementById(h.id) ||
              document.querySelector(`[data-id="${h.id}"], [data-toc-id="${h.id}"]`)
          }
          if (!element) {
            try {
              const dom =
                (editor.view.nodeDOM(h.pos) as HTMLElement) ||
                (editor.view.domAtPos(h.pos).node as HTMLElement)
              element = dom && dom.nodeType === 1 ? dom : dom?.parentElement
            } catch {}
          }
          if (element) {
            const er = element.getBoundingClientRect()
            const distFromTop = er.top - containerTop
            if (distFromTop <= 120) {
              currentActive = h.id
            }
          }
        }

        // At top: scrollTop <= 60px OR before first heading
        const isAtTop = scrollTop <= 60 || !currentActive

        if (isAtTop) {
          setActiveHeadingId(null)
          if (typeof window !== 'undefined' && window.location.hash) {
            window.history.replaceState(
              window.history.state,
              '',
              window.location.pathname + window.location.search,
            )
          }
        } else {
          setActiveHeadingId(prev => (prev === currentActive ? prev : currentActive))
          if (typeof window !== 'undefined') {
            const nextHash = `#${currentActive}`
            if (window.location.hash !== nextHash) {
              window.history.replaceState(window.history.state, '', nextHash)
            }
          }
        }
      } else {
        setActiveHeadingId(null)
        if (typeof window !== 'undefined' && window.location.hash) {
          window.history.replaceState(
            window.history.state,
            '',
            window.location.pathname + window.location.search,
          )
        }
      }
    }

    const scheduledCheck = () => {
      if (rafId !== null) return
      rafId = window.requestAnimationFrame(() => {
        rafId = null
        checkScrolledOut()
      })
    }

    const onScroll = (e: Event) => {
      const target = e.target
      if (target && target instanceof HTMLElement) {
        if (
          (inlineContainerRef.current && target.contains(inlineContainerRef.current)) ||
          (editor.view?.dom && target.contains(editor.view.dom))
        ) {
          activeScrollContainerRef.current = target
        }
      } else if (target === document || target === window) {
        activeScrollContainerRef.current = window
      }
      scheduledCheck()
    }

    const handleManualScrollStart = () => {
      isInitialAnchorJumpRef.current = false
      if (isProgrammaticScrollRef.current) {
        unlockProgrammaticScroll()
      }
    }

    checkScrolledOut()

    window.addEventListener('scroll', onScroll, { passive: true, capture: true })
    window.addEventListener('resize', scheduledCheck, { passive: true })
    window.addEventListener('wheel', handleManualScrollStart, { passive: true, capture: true })
    window.addEventListener('touchmove', handleManualScrollStart, { passive: true, capture: true })

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId)
      }
      if (programmaticScrollTimerRef.current) {
        clearTimeout(programmaticScrollTimerRef.current)
        programmaticScrollTimerRef.current = null
      }
      window.removeEventListener('scroll', onScroll, { capture: true })
      window.removeEventListener('resize', scheduledCheck)
      window.removeEventListener('wheel', handleManualScrollStart, { capture: true })
      window.removeEventListener('touchmove', handleManualScrollStart, { capture: true })
    }
  }, [editor, headings, unlockProgrammaticScroll])

  // Restore scroll to anchor on initial mount or hashchange
  useEffect(() => {
    if (typeof window === 'undefined' || !editor) return

    const scrollToHash = (hash: string) => {
      if (!hash) return
      let attempts = 0
      const tryScroll = () => {
        let el: HTMLElement | null =
          document.getElementById(hash) ||
          document.querySelector(`[data-id="${hash}"], [data-toc-id="${hash}"]`)

        if (!el && headings?.length) {
          const match = headings.find(h => h.id === hash)
          if (match) {
            try {
              const dom =
                (editor.view.nodeDOM(match.pos) as HTMLElement) ||
                (editor.view.domAtPos(match.pos).node as HTMLElement)
              el = dom && dom.nodeType === 1 ? dom : dom?.parentElement
            } catch {}
          }
        }

        if (el) {
          isProgrammaticScrollRef.current = true
          setActiveHeadingId(hash)
          el.scrollIntoView({ behavior: 'smooth', block: 'start' })
          el.classList.remove('heading-toc-highlight')
          void el.offsetWidth
          el.classList.add('heading-toc-highlight')
          setTimeout(() => el?.classList.remove('heading-toc-highlight'), 1600)

          if (programmaticScrollTimerRef.current) clearTimeout(programmaticScrollTimerRef.current)
          programmaticScrollTimerRef.current = setTimeout(() => {
            isProgrammaticScrollRef.current = false
            isInitialAnchorJumpRef.current = false
            programmaticScrollTimerRef.current = null
          }, 1200)
        } else if (attempts < 15) {
          attempts++
          setTimeout(tryScroll, 100)
        } else {
          isProgrammaticScrollRef.current = false
          isInitialAnchorJumpRef.current = false
        }
      }
      setTimeout(tryScroll, 60)
    }

    if (initialHashRef.current) {
      scrollToHash(initialHashRef.current)
      initialHashRef.current = null
    }

    const onHashChange = () => {
      const hash = window.location.hash?.slice(1)
      if (hash) scrollToHash(hash)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [editor, headings])

  const handleScrollToHeading = useCallback(
    (pos: number, id?: string) => {
      setIsStickyDropdownOpen(false)
      if (id && typeof window !== 'undefined') {
        // Programmatic scroll lock: prevent scroll spy hash flutter during smooth scroll
        isProgrammaticScrollRef.current = true
        if (programmaticScrollTimerRef.current) {
          clearTimeout(programmaticScrollTimerRef.current)
        }
        programmaticScrollTimerRef.current = setTimeout(() => {
          isProgrammaticScrollRef.current = false
          programmaticScrollTimerRef.current = null
        }, 1000)

        setActiveHeadingId(id)
        window.history.replaceState(window.history.state, '', `#${id}`)
      }
      if (editor.isEditable) {
        editor.chain().focus(undefined, { scrollIntoView: false }).setTextSelection(pos + 1).run()
      }
      try {
        let element: HTMLElement | null = null
        if (id) {
          element =
            document.getElementById(id) ||
            document.querySelector(`[data-id="${id}"], [data-toc-id="${id}"]`)
        }
        if (!element) {
          const dom = (editor.view.nodeDOM(pos) as HTMLElement) || (editor.view.domAtPos(pos).node as HTMLElement)
          element = dom && dom.nodeType === 1 ? dom : dom?.parentElement
        }
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' })
          element.classList.remove('heading-toc-highlight')
          void element.offsetWidth
          element.classList.add('heading-toc-highlight')
          setTimeout(() => {
            element?.classList.remove('heading-toc-highlight')
          }, 1600)
        } else if (editor.isEditable) {
          editor.chain().focus(pos + 1, { scrollIntoView: true }).run()
        }
      } catch {
        if (editor.isEditable) {
          editor.chain().focus(pos + 1, { scrollIntoView: true }).run()
        }
      }
    },
    [editor],
  )

  const renderHeadingList = () =>
    headings.map(item => {
      const isActive = item.id === activeHeadingId
      const activeCls = isActive
        ? 'text-[var(--editor-primary)] font-semibold bg-[color-mix(in_srgb,var(--editor-primary)_10%,transparent)] dark:bg-[color-mix(in_srgb,var(--editor-primary)_20%,transparent)]'
        : ''
      const indentClass =
        item.level === 1
          ? `pl-2 font-medium ${activeCls || 'text-zinc-800 dark:text-[#e3e3e3]'}`
          : item.level === 2
          ? `pl-5 ${activeCls || 'text-zinc-600 dark:text-zinc-300'}`
          : `pl-8 ${activeCls || 'text-zinc-500 dark:text-zinc-400'}`

      return (
        <button
          key={item.id}
          type="button"
          onClick={() => handleScrollToHeading(item.pos, item.id)}
          className={`w-full text-left text-xs py-1.5 pr-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/[0.08] active:bg-black/10 dark:active:bg-white/[0.12] transition-colors truncate flex items-center gap-1.5 ${indentClass}`}
        >
          <span
            className={`text-[10px] shrink-0 font-mono ${isActive ? 'text-[var(--editor-primary)] font-bold' : 'text-zinc-400 dark:text-zinc-500'}`}
            style={isActive ? { color: 'var(--editor-primary, #faaf2d)' } : undefined}
          >
            H{item.level}
          </span>
          <span className="truncate">{item.text}</span>
        </button>
      )
    })

  if (!headings || headings.length === 0) {
    return null
  }

  return (
    <>
      {/* 1. Inline TOC: Placed in document flow at top */}
      <div
        ref={inlineContainerRef}
        className={`w-full select-none transition-all duration-200 mb-6 ${className}`.trim()}
      >
        <div className="mx-auto max-w-2xl px-4 pt-2">
          <div className="rounded-xl shadow-md border border-black/5 dark:border-white/10 overflow-hidden bg-white/85 dark:bg-[#202020]/90 backdrop-blur-xl ring-1 ring-white/40 dark:ring-white/5">
            {/* Header */}
            <div
              onClick={() => setIsInlineExpanded(prev => !prev)}
              className="flex items-center justify-between px-3.5 py-2.5 cursor-pointer hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors"
            >
              <div className="flex items-center gap-2">
                <Icon name="ListOrdered" className="w-4 h-4 text-[var(--editor-primary)]" style={{ color: 'var(--editor-primary, #faaf2d)' }} />
                <span className="text-xs font-semibold tracking-wide text-zinc-700 dark:text-[#e3e3e3]">
                  Table of Contents
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[color-mix(in_srgb,var(--editor-primary)_10%,transparent)] dark:bg-[color-mix(in_srgb,var(--editor-primary)_20%,transparent)] text-[var(--editor-primary)] font-medium">
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
                {renderHeadingList()}
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
          <button
            type="button"
            onClick={() => setIsStickyDropdownOpen(prev => !prev)}
            className="flex items-center justify-between w-[300px] min-w-[300px] px-3.5 py-1.5 rounded-full shadow-xl hover:shadow-2xl bg-white/85 dark:bg-[#202020]/90 backdrop-blur-xl border border-black/10 dark:border-white/15 ring-1 ring-white/40 dark:ring-white/5 transition-all text-xs font-medium text-zinc-800 dark:text-[#e3e3e3]"
          >
            <div className="flex items-center gap-2 truncate">
              <Icon name="ListOrdered" className="w-3.5 h-3.5 text-[var(--editor-primary)] shrink-0" style={{ color: 'var(--editor-primary, #faaf2d)' }} />
              <span className="text-xs font-semibold truncate">Table of Contents</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[color-mix(in_srgb,var(--editor-primary)_10%,transparent)] dark:bg-[color-mix(in_srgb,var(--editor-primary)_20%,transparent)] text-[var(--editor-primary)] font-mono font-medium shrink-0">
                {headings.length}
              </span>
            </div>
            <Icon
              name={isStickyDropdownOpen ? 'ChevronUp' : 'ChevronDown'}
              className="w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 shrink-0"
            />
          </button>

          {isStickyDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 w-[300px] min-w-[300px] max-h-72 overflow-y-auto p-1.5 shadow-2xl rounded-2xl z-50 animate-in fade-in zoom-in-95 duration-150 bg-white/90 dark:bg-[#202020]/95 backdrop-blur-xl border border-black/5 dark:border-white/10 text-zinc-800 dark:text-zinc-200">
              <div className="px-2 py-1 text-[10px] font-semibold tracking-wider text-zinc-400 dark:text-zinc-500 uppercase select-none">
                Table of Contents
              </div>
              <div className="h-[1px] bg-black/5 dark:bg-white/10 my-1" />
              <div className="space-y-0.5">
                {renderHeadingList()}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default TableOfContents
