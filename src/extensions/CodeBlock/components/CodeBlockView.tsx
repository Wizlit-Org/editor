import { NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import { Node } from '@tiptap/pm/model'
import { Editor, Extension } from '@tiptap/core'
import { useCallback, useState, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui/Icon'

interface CodeBlockViewProps {
  editor: Editor
  getPos: () => number
  node: Node
  updateAttributes: (attrs: Record<string, string>) => void
  extension: Extension
}

export const CodeBlockView = ({ editor, node, updateAttributes, extension }: CodeBlockViewProps) => {
  const language = node.attrs.language || 'plaintext'
  const [isCopied, setIsCopied] = useState(false)
  const [shouldWrap, setShouldWrap] = useState(false)
  const [search, setSearch] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [isInputFocused, setIsInputFocused] = useState(false)
  const isInputFocusedRef = useRef(false)
  const inputFocusTimestampRef = useRef(0)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })
  const menuRef = useRef<HTMLDivElement>(null)
  const dropdownPortalRef = useRef<HTMLDivElement>(null)
  const buttonPositionRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const detectIsMobile = useCallback(() => {
    if (typeof window === 'undefined') return false
    return (
      window.innerWidth < 768 ||
      Boolean(window.matchMedia?.('(pointer: coarse)').matches) ||
      Boolean(window.matchMedia?.('(hover: none)').matches) ||
      (typeof navigator !== 'undefined' &&
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent))
    )
  }, [])

  const detectedLanguage = useMemo(() => {
    if (language === 'auto' || !language) {
      try {
        const text = node.textContent
        if (text && text.trim().length > 0) {
          const res = extension.options?.lowlight?.highlightAuto?.(text)
          if (res?.data?.language) {
            return res.data.language
          }
          if (res?.language) {
            return res.language
          }
        }
      } catch {
        // ignore fallback
      }
    }
    return null
  }, [language, node.textContent, extension.options?.lowlight])

  const displayLanguage = useMemo(() => {
    if (language === 'auto') {
      return detectedLanguage ? `Auto (${detectedLanguage})` : 'Auto'
    }
    return language
  }, [language, detectedLanguage])

  const actualOpen = isOpen && editor.isEditable

  useEffect(() => {
    const isInsideDropdownOrTrigger = (target: HTMLElement | null) => {
      if (!target) return false
      return Boolean(
        menuRef.current?.contains(target) ||
          dropdownPortalRef.current?.contains(target) ||
          buttonPositionRef.current?.contains(target) ||
          target.closest?.('[data-code-lang-dropdown="true"]'),
      )
    }

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return
      if (!isInsideDropdownOrTrigger(target)) {
        setIsOpen(false)
      }
    }
    const handleCloseMenus = (e: Event) => {
      if ((e as CustomEvent)?.detail === 'scroll') return
      setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside, { passive: true })
    window.addEventListener('tiptap:close-menus', handleCloseMenus)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
      window.removeEventListener('tiptap:close-menus', handleCloseMenus)
    }
  }, [])

  const updateMenuPosition = useCallback(() => {
    if (buttonPositionRef.current && typeof window !== 'undefined') {
      const rect = buttonPositionRef.current.getBoundingClientRect()
      const menuW = 200
      const menuH = 264
      const viewportW = window.innerWidth
      const viewportH = window.visualViewport?.height || window.innerHeight
      const viewportTop = window.visualViewport?.offsetTop || 0
      const left = Math.max(12, Math.min(rect.left, viewportW - menuW - 12))
      const top =
        rect.bottom + 6 + menuH > viewportTop + viewportH
          ? Math.max(viewportTop + 12, rect.top - menuH - 6)
          : rect.bottom + 6
      setMenuPosition({ top, left })
    }
  }, [])

  useEffect(() => {
    if (actualOpen) {
      updateMenuPosition()
      const handleWindowScroll = (e: Event) => {
        const target = e.target as HTMLElement | null
        if (
          target &&
          (menuRef.current?.contains(target) ||
            dropdownPortalRef.current?.contains(target) ||
            buttonPositionRef.current?.contains(target) ||
            target.closest?.('[data-code-lang-dropdown="true"]'))
        ) {
          return
        }
        // When mobile virtual keyboard opens right after tapping search input (<500ms),
        // viewport scroll is triggered by browser — reposition dropdown instead of closing it
        if (
          (isInputFocusedRef.current || document.activeElement === searchInputRef.current) &&
          Date.now() - inputFocusTimestampRef.current < 500
        ) {
          updateMenuPosition()
          return
        }
        setIsOpen(false)
      }
      const handleResize = () => {
        updateMenuPosition()
      }
      window.addEventListener('scroll', handleWindowScroll, { capture: true, passive: true })
      window.addEventListener('resize', handleResize, { passive: true })
      window.visualViewport?.addEventListener('resize', handleResize, { passive: true })
      window.visualViewport?.addEventListener('scroll', handleResize, { passive: true })
      return () => {
        window.removeEventListener('scroll', handleWindowScroll, { capture: true })
        window.removeEventListener('resize', handleResize)
        window.visualViewport?.removeEventListener('resize', handleResize)
        window.visualViewport?.removeEventListener('scroll', handleResize)
      }
    }
  }, [actualOpen, updateMenuPosition])

  const handleCopy = useCallback(async () => {
    try {
      const content = node.textContent
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(content)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = content
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy code', err)
    }
  }, [node])

  const toggleWrap = useCallback(() => {
    setShouldWrap(prev => !prev)
  }, [])

  const languages = useMemo(() => {
    const list = extension.options.lowlight?.listLanguages?.() || []
    return ['auto', ...list.filter((l: string) => l !== 'auto')]
  }, [extension.options.lowlight])
  const filteredLanguages = languages.filter((lang: string) =>
    lang.toLowerCase().includes(search.toLowerCase()),
  )

  const handleLanguageChange = useCallback(
    (lang: string) => {
      updateAttributes({ language: lang })
      setIsOpen(false)
      setSearch('')
    },
    [updateAttributes],
  )

  useEffect(() => {
    if (!actualOpen) {
      isInputFocusedRef.current = false
      setIsInputFocused(false)
      setSearch('')
      return
    }
    setSearch('')
    const isMobile = detectIsMobile()
    if (isMobile) {
      isInputFocusedRef.current = false
      setIsInputFocused(false)
      // Ensure editor contenteditable or any active element is blurred on mobile so virtual keyboard does not pop up on open
      if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
    } else {
      isInputFocusedRef.current = true
      setIsInputFocused(true)
    }

    const rafId = requestAnimationFrame(() => {
      if (!isMobile) {
        searchInputRef.current?.focus({ preventScroll: true })
      } else {
        searchInputRef.current?.blur()
      }
      const container = menuRef.current
      if (container) {
        const selectedEl = container.querySelector(
          '[data-selected="true"], [aria-selected="true"]',
        ) as HTMLElement | null
        if (selectedEl) {
          const containerHeight = container.clientHeight
          const itemTop = selectedEl.offsetTop
          const itemBottom = itemTop + selectedEl.offsetHeight
          const viewTop = container.scrollTop
          const viewBottom = viewTop + containerHeight
          if (itemTop < viewTop || itemBottom > viewBottom) {
            container.scrollTop = Math.max(
              0,
              itemTop - containerHeight / 2 + selectedEl.offsetHeight / 2,
            )
          }
        }
      }
    })
    return () => cancelAnimationFrame(rafId)
  }, [actualOpen, detectIsMobile])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return

      if (e.key === 'Escape') {
        setIsOpen(false)
      } else if (e.key === 'Enter') {
        if (search) {
          handleLanguageChange(search)
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, search, handleLanguageChange])

  return (
    <NodeViewWrapper
      spellCheck="false"
      className="relative group w-full max-w-full min-w-0"
      style={{ marginTop: '12px', marginBottom: '12px' }}
    >
      <div className="w-full max-w-full min-w-0 rounded-xl overflow-hidden bg-zinc-900/85 dark:bg-[#18181b]/80 backdrop-blur-xl border border-black/10 dark:border-white/15 shadow-2xl transition-all ring-1 ring-black/5 dark:ring-white/5">
        {/* Code Header Bar: macOS 3-dot + Language Badge on Left, Action Buttons on Right (Slim 28px) */}
        <div
          contentEditable={false}
          onMouseDown={e => e.preventDefault()}
          style={{ userSelect: 'none' }}
          className="flex items-center justify-between px-3 py-1 min-h-[28px] max-md:min-h-[32px] border-b border-white/[0.08] bg-white/[0.03] select-none"
        >
          <div className="flex items-center gap-2 min-w-0">
            {/* macOS 3-dot decoration */}
            <div className="flex items-center gap-1.5 select-none shrink-0" aria-hidden="true">
              <span className="w-2 h-2 rounded-full bg-red-500/80 inline-block" />
              <span className="w-2 h-2 rounded-full bg-yellow-500/80 inline-block" />
              <span className="w-2 h-2 rounded-full bg-green-500/80 inline-block" />
            </div>

            <div className="h-2.5 w-[1px] bg-white/10 mx-0.5 shrink-0" />

            <div className="relative min-w-0" ref={buttonPositionRef}>
              <button
                type="button"
                onMouseDown={e => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onClick={e => {
                  e.stopPropagation()
                  if (!isOpen && detectIsMobile() && typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur()
                  }
                  setIsOpen(prev => !prev)
                }}
                tabIndex={-1}
                className={cn(
                  'inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 min-h-[22px] max-md:min-h-[26px] rounded-md transition-colors cursor-pointer touch-manipulation',
                  editor.isEditable
                    ? 'text-zinc-300 max-md:text-zinc-100 hover:text-white bg-white/5 max-md:bg-white/10 hover:bg-white/10 active:bg-white/15 border border-white/10 max-md:border-white/20'
                    : 'text-zinc-400 pointer-events-none',
                )}
              >
                <span className="truncate">{displayLanguage}</span>
                {editor.isEditable && <Icon name="ChevronDown" className="w-3 h-3 opacity-70 shrink-0" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0 opacity-100 max-md:opacity-100">
            <button
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={toggleWrap}
              tabIndex={-1}
              className={cn(
                'h-6 w-6 max-md:h-7 max-md:w-7 p-0 flex items-center justify-center rounded-md text-xs transition-colors cursor-pointer touch-manipulation',
                shouldWrap
                  ? 'bg-blue-500/20 text-blue-300'
                  : 'text-zinc-400 max-md:text-zinc-200 max-md:bg-white/[0.06] hover:text-zinc-200 hover:bg-white/10 active:bg-white/15',
              )}
              title={shouldWrap ? 'Disable wrapping' : 'Enable wrapping'}
            >
              <Icon name={shouldWrap ? 'WrapText' : 'Text'} className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={handleCopy}
              tabIndex={-1}
              className={cn(
                'h-6 max-md:h-7 flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] transition-colors cursor-pointer touch-manipulation',
                isCopied
                  ? 'bg-green-500/20 text-green-300 font-medium'
                  : 'text-zinc-400 max-md:text-zinc-200 max-md:bg-white/[0.06] hover:text-zinc-200 hover:bg-white/10 active:bg-white/15',
              )}
              title="Copy code"
            >
              <Icon name={isCopied ? 'Check' : 'Copy'} className="w-3.5 h-3.5" />
              <span>{isCopied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Code Content */}
        <pre
          className={cn(
            'p-3.5 m-0 bg-transparent text-sm font-mono leading-relaxed text-zinc-100',
            shouldWrap ? 'whitespace-pre-wrap break-all overflow-x-hidden' : 'whitespace-pre overflow-x-auto touch-pan-x touch-pan-y',
            language && `language-${language}`,
          )}
          style={
            shouldWrap
              ? { whiteSpace: 'pre-wrap', wordBreak: 'break-all', overflowX: 'hidden' }
              : { whiteSpace: 'pre', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }
          }
        >
          <NodeViewContent
            as={'code' as any}
            className={cn('font-mono block', shouldWrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre')}
            style={shouldWrap ? { whiteSpace: 'pre-wrap', wordBreak: 'break-all' } : { whiteSpace: 'pre' }}
          />
        </pre>
      </div>

      {actualOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            data-code-lang-dropdown="true"
            role="listbox"
            data-theme={editor?.view?.dom?.closest('.editor-theme-dark') ? 'dark' : 'light'}
            data-editor-theme={editor?.view?.dom?.closest('.editor-theme-dark') ? 'dark' : 'light'}
            className={cn(
              'glass-menu fixed w-[200px] max-w-[calc(100vw-24px)] rounded-xl border border-black/5 dark:border-white/10 bg-white/95 dark:bg-[#202020]/95 backdrop-blur-xl shadow-2xl overflow-hidden z-[1360] text-zinc-800 dark:text-zinc-200 animate-in fade-in zoom-in-95 duration-150',
              editor?.view?.dom?.closest('.editor-theme-dark')
                ? 'editor-theme-dark dark theme-dark'
                : 'editor-theme-light theme-light',
            )}
            style={{ top: menuPosition.top, left: menuPosition.left }}
            ref={dropdownPortalRef}
          >
            <div
              className="flex items-center border-b border-black/5 dark:border-white/10 px-2.5 py-1.5 cursor-text"
              onTouchStart={() => {
                inputFocusTimestampRef.current = Date.now()
                isInputFocusedRef.current = true
                setIsInputFocused(true)
                if (searchInputRef.current) {
                  searchInputRef.current.readOnly = false
                  searchInputRef.current.removeAttribute('readonly')
                }
              }}
              onMouseDown={e => {
                e.stopPropagation()
                inputFocusTimestampRef.current = Date.now()
                isInputFocusedRef.current = true
                setIsInputFocused(true)
                if (searchInputRef.current) {
                  searchInputRef.current.readOnly = false
                  searchInputRef.current.removeAttribute('readonly')
                }
              }}
              onClick={e => {
                e.stopPropagation()
                inputFocusTimestampRef.current = Date.now()
                isInputFocusedRef.current = true
                setIsInputFocused(true)
                if (searchInputRef.current) {
                  searchInputRef.current.readOnly = false
                  searchInputRef.current.removeAttribute('readonly')
                  searchInputRef.current.focus({ preventScroll: true })
                }
              }}
            >
              <Icon name="Search" className="mr-1.5 h-3.5 w-3.5 shrink-0 opacity-50 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                readOnly={detectIsMobile() && !isInputFocused}
                placeholder="언어 검색..."
                value={search}
                onFocus={() => {
                  inputFocusTimestampRef.current = Date.now()
                  isInputFocusedRef.current = true
                  setIsInputFocused(true)
                }}
                onBlur={() => {
                  isInputFocusedRef.current = false
                  setIsInputFocused(false)
                }}
                onChange={e => setSearch(e.target.value)}
                onScroll={e => e.stopPropagation()}
                className="flex h-7 w-full min-w-0 bg-transparent text-xs outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
              />
            </div>
            <div
              ref={menuRef}
              onMouseDown={e => e.preventDefault()}
              onScroll={e => e.stopPropagation()}
              className="relative max-h-[220px] overflow-y-auto p-1 space-y-0.5"
            >
              {search &&
                !filteredLanguages.some((lang: string) => lang.toLowerCase() === search.toLowerCase()) && (
                  <button
                    type="button"
                    onClick={() => handleLanguageChange(search.toLowerCase())}
                    className="flex w-full items-center px-2 py-1.5 text-xs rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-left cursor-pointer"
                    tabIndex={-1}
                  >
                    <span>Custom: {search}</span>
                  </button>
                )}
              {filteredLanguages.map((lang: string) => {
                const isSelected = lang === language
                return (
                  <button
                    type="button"
                    key={lang}
                    role="option"
                    aria-selected={isSelected}
                    data-selected={isSelected ? 'true' : undefined}
                    onClick={() => handleLanguageChange(lang)}
                    className={cn(
                      'flex w-full items-center justify-between px-2 py-1.5 text-xs rounded-md transition-colors text-left cursor-pointer',
                      isSelected
                        ? 'bg-black/5 dark:bg-white/10 font-medium text-zinc-900 dark:text-white'
                        : 'hover:bg-black/5 dark:hover:bg-white/10',
                    )}
                    tabIndex={-1}
                  >
                    <span>{lang}</span>
                    {isSelected && <Icon name="Check" className="h-3.5 w-3.5 text-blue-500" />}
                  </button>
                )
              })}
            </div>
          </div>,
          document.body,
        )}
    </NodeViewWrapper>
  )
}

export default CodeBlockView
