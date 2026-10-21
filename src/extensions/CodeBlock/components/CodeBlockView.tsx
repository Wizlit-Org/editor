import { NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import { Node } from '@tiptap/pm/model'
import { Editor, Extension } from '@tiptap/core'
import { useCallback, useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui/Icon'

interface CodeBlockViewProps {
  editor: Editor
  getPos: () => number
  node: Node
  updateAttributes: (attrs: Record<string, string>) => void
  extension: Extension
}

export const CodeBlockView = ({ editor, node, getPos, updateAttributes, extension }: CodeBlockViewProps) => {
  const language = node.attrs.language || 'plaintext'
  const [isCopied, setIsCopied] = useState(false)
  const [shouldWrap, setShouldWrap] = useState(false)
  const [search, setSearch] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonPositionRef = useRef<HTMLDivElement>(null)

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

  const languages = extension.options.lowlight?.listLanguages?.() || []
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
    <NodeViewWrapper spellCheck="false" className="relative group my-4">
      <div className="rounded-xl overflow-hidden bg-[#18181b]/95 backdrop-blur-md border border-white/10 shadow-xl transition-all">
        {/* Code Header Bar: Language Badge on Left, Action Buttons on Right */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.08] bg-white/[0.02]">
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
              {language}
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleWrap}
              tabIndex={-1}
              className={cn(
                'p-1 rounded-md text-xs transition-colors',
                shouldWrap
                  ? 'bg-blue-500/20 text-blue-300'
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
        <pre className={cn('p-3.5 m-0 bg-transparent text-sm font-mono leading-relaxed overflow-x-auto text-zinc-100', language && `language-${language}`)}>
          <NodeViewContent as="div" className={cn('font-mono', shouldWrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre')} />
        </pre>
      </div>

      {actualOpen && (
        <div
          className="fixed w-[200px] rounded-xl border border-black/5 dark:border-white/10 bg-white/90 dark:bg-[#202020]/95 backdrop-blur-xl shadow-2xl overflow-hidden z-50 text-zinc-800 dark:text-zinc-200 animate-in fade-in zoom-in-95 duration-150"
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
                {lang === language && <Icon name="Check" className="h-3.5 w-3.5 text-blue-500" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </NodeViewWrapper>
  )
}

export default CodeBlockView
