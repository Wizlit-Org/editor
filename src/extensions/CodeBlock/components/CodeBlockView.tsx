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

export const CodeBlockView = ({ editor, node, getPos, updateAttributes, extension }: CodeBlockViewProps) => {
  const language = node.attrs.language || 'plaintext'
  const [isCopied, setIsCopied] = useState(false)
  const [shouldWrap, setShouldWrap] = useState(false)
  const [search, setSearch] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })
  const [isFirstLine, setIsFirstLine] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonPositionRef = useRef<HTMLDivElement>(null)
  const codeRef = useRef<HTMLElement>(null)

  const actualOpen = isOpen && editor.isEditable

  const checkCursorPosition = useCallback(() => {
    const { state } = editor
    const { selection } = state
    const pos = getPos()
    
    if (pos > -1) {
      const nodeStart = pos + 1 // +1 for the opening tag
      const nodeEnd = pos + node.nodeSize - 1 // -1 for the closing tag
      const cursorPos = selection.from
      
      // Check if cursor is within the code block
      if (cursorPos >= nodeStart && cursorPos <= nodeEnd) {
        // Get the text content up to the cursor position
        const textBeforeCursor = node.textContent.slice(0, cursorPos - nodeStart)
        // Check if there are any newlines before the cursor
        const isFirstLine = !textBeforeCursor.includes('\n')
        setIsFirstLine(isFirstLine)
      } else {
        // Cursor is outside the code block
        setIsFirstLine(false)
      }
    } else {
      // Invalid position
      setIsFirstLine(false)
    }
  }, [editor, getPos, node])

  // Add selection change listener to check cursor position
  useEffect(() => {
    editor.on('selectionUpdate', checkCursorPosition)
    return () => {
      editor.off('selectionUpdate', checkCursorPosition)
    }
  }, [editor, checkCursorPosition])

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
  }, [actualOpen, search])

  const languageButtonProps = {
    onClick: () => setIsOpen(_prev => !_prev),
    className: cn(
      "absolute top-2 left-2 text-xs px-2 py-0.5 rounded-md text-neutral-400 dark:text-neutral-500 transition-colors",
      editor.isEditable 
        ? cn("border border-neutral-600 dark:border-neutral-800 hover:border-white/10 dark:hover:border-neutral-600", 
            "text-white dark:hover:text-neutral-400 bg-white/5 hover:bg-white/10 hover:border-white/10") 
        : "pointer-events-none",
    ),
    tabIndex: -1,
    children: language
  }

  return (
    <NodeViewWrapper spellCheck="false" className="relative group">
      <div className="absolute top-10 left-2 pointer-events-none" ref={buttonPositionRef} />
      {!isFirstLine && <button {...languageButtonProps} />}

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
      <pre 
        className={cn(
          language && `language-${language}`
        )}
      >
        <NodeViewContent 
          as="code" 
          className={shouldWrap ? 'wrap' : 'nowrap'}
          ref={codeRef}
        />
      </pre>

      {isFirstLine && <button {...languageButtonProps} />}
      {actualOpen && (
        <div
          className="fixed w-[200px] rounded-lg border bg-white dark:bg-gray-800 shadow-md overflow-hidden z-50"
          style={{ top: menuPosition.top, left: menuPosition.left }}
          ref={menuRef}
        >
          <div className="flex items-center border-b px-3 py-2">
            <Icon name="Search" className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              type="text"
              placeholder="Search language..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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
    tabIndex={-1}
  >
    <span>{label}</span>
    {isSelected && (
      <Icon name="Check" className="ml-auto h-4 w-4" />
    )}
  </button>
) 