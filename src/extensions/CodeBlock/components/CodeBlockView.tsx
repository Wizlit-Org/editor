import { NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import { Node } from '@tiptap/pm/model'
import { Editor } from '@tiptap/core'
import { useCallback, useState } from 'react'
import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui/Icon'

interface CodeBlockViewProps {
  editor: Editor
  getPos: () => number
  node: Node
  updateAttributes: (attrs: Record<string, string>) => void
}

export const CodeBlockView = ({ editor, node }: CodeBlockViewProps) => {
  const language = node.attrs.language || 'plaintext'
  const [isCopied, setIsCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    const content = node.textContent
    await navigator.clipboard.writeText(content)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }, [node])

  return (
    <NodeViewWrapper spellCheck="false" className="relative group">
      <pre className={cn(
        '!mt-0 !mb-0 text-sm p-4 whitespace-pre overflow-x-auto',
        language && `language-${language}`
      )}>
        <NodeViewContent as="code" />
      </pre>
      <div className="absolute left-2 top-2 text-xs text-neutral-400 dark:text-neutral-500">
        {language}
      </div>
      <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleCopy}
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