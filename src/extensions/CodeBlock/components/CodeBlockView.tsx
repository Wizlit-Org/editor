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
  const [preHeight, setPreHeight] = useState(100)
  const [shouldWrap, setShouldWrap] = useState(false)
  const [search, setSearch] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })
  const preRef = useRef<HTMLPreElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const actualOpen = useMemo(() => {
    return isOpen && editor.isEditable
  }, [isOpen, editor.isEditable])

  useEffect(() => {
    if (preRef.current) {
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setPreHeight(entry.target.clientHeight + 6)
        }
      })
      resizeObserver.observe(preRef.current)
      return () => resizeObserver.disconnect()
    }
  }, [])

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
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setMenuPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX
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
    const content = node.textContent
    await navigator.clipboard.writeText(content)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }, [node])

  const toggleWrap = useCallback(() => {
    setShouldWrap(prev => !prev)
  }, [])

  const languages = extension.options.lowlight.listLanguages()
  const filteredLanguages = languages.filter((lang: string) => 
    lang.toLowerCase().includes(search.toLowerCase())
  )

  const handleLanguageChange = useCallback((lang: string) => {
    updateAttributes({ language: lang })
    setIsOpen(false)
    setSearch('')
  }, [updateAttributes])

  useEffect(() => {
    if (actualOpen) {
      setSearch('')
    }
  }, [actualOpen])

  return (
    <NodeViewWrapper spellCheck="false" className="relative group">
      <pre 
        ref={preRef}
        className={cn(
          'absolute top-0',
          language && `language-${language}`
        )}
      >
        <NodeViewContent 
          as="code" 
          className={shouldWrap ? 'wrap' : 'nowrap'}
        />
      </pre>
      <div style={{ height: preHeight }} className="w-full" />
      <div className="absolute left-2 top-2" ref={menuRef}>
        <button
          ref={buttonRef}
          onClick={() => setIsOpen(!actualOpen)}
          className={cn(
            "text-xs px-2 py-0.5 rounded-md text-neutral-400 dark:text-neutral-500 transition-colors",
            editor.isEditable 
              ? cn("border border-neutral-600 dark:border-neutral-800 hover:border-white/10 dark:hover:border-neutral-600", 
                  "text-white dark:hover:text-neutral-400 bg-white/5 hover:bg-white/10 hover:border-white/10") 
              : "pointer-events-none"
          )}
          tabIndex={-1}
        >
          {language}
        </button>
        {actualOpen && (
          <div 
            className="fixed w-[200px] rounded-lg border bg-white dark:bg-gray-800 shadow-md overflow-hidden z-50"
            style={{ top: menuPosition.top, left: menuPosition.left }}
          >
            <div className="flex items-center border-b px-3 py-2">
              <Icon name="Search" className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <input
                type="text"
                placeholder="Search language..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleLanguageChange(search)
                  } else if (e.key === 'Escape') {
                    setIsOpen(false)
                  }
                }}
                className="flex h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                autoFocus
              />
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {search && !filteredLanguages.some((lang: string) => 
                lang.toLowerCase() === search.toLowerCase()
              ) && (
                <LanguageButton
                  name={search.toLowerCase()}
                  label={`Custom: ${search}`}
                  isSelected={language === search.toLowerCase()}
                  onClick={() => handleLanguageChange(search.toLowerCase())}
                />
              )}
              {filteredLanguages.map((lang: string) => (
                <LanguageButton
                  key={lang}
                  name={lang}
                  label={lang}
                  isSelected={lang === language}
                  onClick={() => handleLanguageChange(lang)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="absolute right-2 top-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={toggleWrap}
          tabIndex={-1}
          className={cn(
            "p-1 rounded-md transition-colors",
            shouldWrap 
              ? "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
              : "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
          )}
          title={shouldWrap ? "Disable wrapping" : "Enable wrapping"}
        >
          <Icon name={shouldWrap ? "WrapText" : "Text"} className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleCopy}
          tabIndex={-1}
          className={cn(
            "p-1 rounded-md transition-colors",
            isCopied 
              ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
              : "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
          )}
          title="Copy code"
        >
          <Icon name={isCopied ? "Check" : "Copy"} className="w-3.5 h-3.5" />
        </button>
      </div>
    </NodeViewWrapper>
  )
}

interface LanguageButtonProps {
  name: string
  label: string
  isSelected: boolean
  onClick: () => void
}

const LanguageButton = ({ name, label, isSelected, onClick }: LanguageButtonProps) => (
  <button
    key={name}
    onClick={onClick}
    className="flex w-full items-center px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
  >
    <span>{label}</span>
    {isSelected && (
      <Icon name="Check" className="ml-auto h-4 w-4" />
    )}
  </button>
) 