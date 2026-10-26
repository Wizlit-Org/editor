import { NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import { Node } from '@tiptap/pm/model'
import { Editor, Extension } from '@tiptap/core'
import { useCallback, useState, useRef, useEffect, useMemo } from 'react'
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
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonPositionRef = useRef<HTMLDivElement>(null)

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
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as HTMLElement)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const updateMenuPosition = useCallback(() => {
    if (buttonPositionRef.current) {
      const rect = buttonPositionRef.current.getBoundingClientRect()
      setMenuPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
      })
    }
  }, [])

  useEffect(() => {
    if (actualOpen) {
      updateMenuPosition()
      window.addEventListener('scroll', updateMenuPosition)
      window.addEventListener('resize', updateMenuPosition)
      return () => {
        window.removeEventListener('scroll', updateMenuPosition)
        window.removeEventListener('resize', updateMenuPosition)
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
    if (actualOpen) {
      setSearch('')
    }
  }, [actualOpen])

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
    <NodeViewWrapper spellCheck="false" className="relative group my-4 w-full max-w-full min-w-0">
      <div className="w-full max-w-full min-w-0 rounded-xl overflow-hidden bg-zinc-900/85 dark:bg-[#18181b]/80 backdrop-blur-xl border border-black/10 dark:border-white/15 shadow-2xl transition-all ring-1 ring-black/5 dark:ring-white/5">
        {/* Code Header Bar: macOS 3-dot + Language Badge on Left, Action Buttons on Right */}
        <div className="flex items-center justify-between px-3.5 py-2 border-b border-white/[0.08] bg-white/[0.03]">
          <div className="flex items-center gap-2.5">
            {/* macOS 3-dot decoration */}
            <div className="flex items-center gap-1.5 select-none" aria-hidden="true">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-green-500/80 inline-block" />
            </div>

            <div className="h-3 w-[1px] bg-white/10 mx-0.5" />

            <div className="relative" ref={buttonPositionRef}>
              <button
                type="button"
                onClick={() => setIsOpen(prev => !prev)}
                tabIndex={-1}
                className={cn(
                  'text-[11px] font-mono px-2 py-0.5 rounded-md transition-colors',
                  editor.isEditable
                    ? 'text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10'
                    : 'text-zinc-400 pointer-events-none',
                )}
              >
                {displayLanguage}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleWrap}
              tabIndex={-1}
              className={cn(
                'p-1 rounded-md text-xs transition-colors',
                shouldWrap
                  ? 'bg-[var(--editor-accent)] text-[var(--editor-primary)]'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/10',
              )}
              title={shouldWrap ? 'Disable wrapping' : 'Enable wrapping'}
            >
              <Icon name={shouldWrap ? 'WrapText' : 'Text'} className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleCopy}
              tabIndex={-1}
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] transition-colors',
                isCopied
                  ? 'bg-green-500/20 text-green-300 font-medium'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/10',
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
            shouldWrap ? 'whitespace-pre-wrap break-all overflow-x-hidden' : 'whitespace-pre overflow-x-auto',
            language && `language-${language}`,
          )}
          style={
            shouldWrap
              ? { whiteSpace: 'pre-wrap', wordBreak: 'break-all', overflowX: 'hidden' }
              : { whiteSpace: 'pre', overflowX: 'auto' }
          }
        >
          <NodeViewContent
            as="div"
            className={cn('font-mono', shouldWrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre')}
            style={shouldWrap ? { whiteSpace: 'pre-wrap', wordBreak: 'break-all' } : { whiteSpace: 'pre' }}
          />
        </pre>
      </div>

      {actualOpen && (
        <div
          data-theme={editor?.view?.dom?.closest('.editor-theme-dark') ? 'dark' : 'light'}
          data-editor-theme={editor?.view?.dom?.closest('.editor-theme-dark') ? 'dark' : 'light'}
          className={cn(
            'fixed w-[200px] rounded-xl border border-black/5 dark:border-white/10 bg-white/90 dark:bg-[#202020]/95 backdrop-blur-xl shadow-2xl overflow-hidden z-50 text-zinc-800 dark:text-zinc-200 animate-in fade-in zoom-in-95 duration-150',
            editor?.view?.dom?.closest('.editor-theme-dark')
              ? 'editor-theme-dark dark theme-dark'
              : 'editor-theme-light theme-light',
          )}
          style={{ top: menuPosition.top, left: menuPosition.left }}
          ref={menuRef}
        >
          <div className="flex items-center border-b border-black/5 dark:border-white/10 px-2.5 py-1.5">
            <Icon name="Search" className="mr-1.5 h-3.5 w-3.5 shrink-0 opacity-50" />
            <input
              type="text"
              placeholder="언어 검색..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex h-7 w-full bg-transparent text-xs outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
              autoFocus
            />
          </div>
          <div className="max-h-[220px] overflow-y-auto p-1 space-y-0.5">
            {search &&
              !filteredLanguages.some((lang: string) => lang.toLowerCase() === search.toLowerCase()) && (
                <button
                  type="button"
                  onClick={() => handleLanguageChange(search.toLowerCase())}
                  className="flex w-full items-center px-2 py-1.5 text-xs rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-left"
                  tabIndex={-1}
                >
                  <span>Custom: {search}</span>
                </button>
              )}
            {filteredLanguages.map((lang: string) => (
              <button
                type="button"
                key={lang}
                onClick={() => handleLanguageChange(lang)}
                className="flex w-full items-center justify-between px-2 py-1.5 text-xs rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-left"
                tabIndex={-1}
              >
                <span>{lang}</span>
                {lang === language && <Icon name="Check" className="h-3.5 w-3.5 text-[var(--editor-primary)]" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </NodeViewWrapper>
  )
}

export default CodeBlockView
