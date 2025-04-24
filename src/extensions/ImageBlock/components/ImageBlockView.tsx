import { cn } from '@/lib/utils'
import { Node } from '@tiptap/pm/model'
import { Editor, NodeViewWrapper } from '@tiptap/react'
import { useCallback, useRef } from 'react'
import { Loader2 } from 'lucide-react'

interface ImageBlockViewProps {
  editor: Editor
  getPos: () => number
  node: Node
  updateAttributes: (attrs: Record<string, string>) => void
}

export const ImageBlockView = (props: ImageBlockViewProps) => {
  const { editor, getPos, node } = props as ImageBlockViewProps & {
    node: Node & {
      attrs: {
        src: string
        loading: boolean
        error: string | null
      }
    }
  }
  const imageWrapperRef = useRef<HTMLDivElement>(null)
  const { src, loading, error } = node.attrs

  const wrapperClassName = cn(
    node.attrs.align === 'left' ? 'ml-0' : 'ml-auto',
    node.attrs.align === 'right' ? 'mr-0' : 'mr-auto',
    node.attrs.align === 'center' && 'mx-auto',
    'relative'
  )

  const onClick = useCallback(() => {
    editor.commands.setNodeSelection(getPos())
  }, [getPos, editor.commands])

  return (
    <NodeViewWrapper>
      <div className={`${wrapperClassName} min-w-[50px] min-h-[50px]`} style={{ width: node.attrs.width }} data-drag-handle>
        <div contentEditable={false} ref={imageWrapperRef}>
          <img className="block" src={src} alt="" onClick={onClick} />
          {loading && (
            <div className="absolute bottom-2 right-2 flex items-center gap-2 px-2 py-1 rounded">
              <Loader2 className="h-3 w-3 animate-spin text-white" />
              <span className="text-xs text-white">Uploading...</span>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-md">
              <div className="text-center text-white">
                <p className="text-sm font-medium">{error}</p>
                <button className="bg-white text-black px-2 py-1 rounded text-sm">Click to retry</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </NodeViewWrapper>
  )
}

export default ImageBlockView
