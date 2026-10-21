import React, { useState, useCallback, useEffect, useRef } from 'react'
import { Editor, NodeViewWrapper } from '@tiptap/react'
import { Node } from '@tiptap/pm/model'
import { cn } from '@/lib/utils'
import type { NodeViewProps } from '@tiptap/react'

interface ImageBlockViewProps extends NodeViewProps {
  editor: Editor
  getPos: () => number
  node: Node & { attrs: { src: string; align?: string; width?: string; caption?: string } }
  updateAttributes: (attrs: Record<string, any>) => void
}

export type ConvertSrc = (src: string) => (Promise<string> | string) | 'EXTERNAL_IMAGE'
export type OnImageClick = (url: string, event: React.MouseEvent<HTMLDivElement>) => void

export const ImageBlockView: React.FC<ImageBlockViewProps> = ({
  editor,
  getPos,
  node,
  updateAttributes,
  extension,
}) => {
  const { src: rawSrc, align = 'center', width = '100%', caption = '' } = node.attrs
  const { onImageClick, convertSrc } = extension.options
  const editorEditable = editor.isEditable

  const originalSrc = rawSrc?.match(/^https?:\/\//) ? rawSrc : undefined
  const [src, setSrc] = useState<string | 'EXTERNAL_IMAGE' | undefined>(originalSrc)
  const [hasError, setHasError] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    setHasError(false)
    if (convertSrc && rawSrc) {
      Promise.resolve(convertSrc(rawSrc))
        .then(resolved => setSrc(resolved))
        .catch(() => {
          setHasError(true)
        })
    } else if (rawSrc) {
      setSrc(rawSrc)
    }
  }, [convertSrc, rawSrc])

  const isExternalImage = src === 'EXTERNAL_IMAGE'

  const onClick = useCallback(
    (event: React.MouseEvent<HTMLImageElement>) => {
      editor.commands.setNodeSelection(getPos())
      if (onImageClick && !editorEditable && src) {
        onImageClick(src, event as any)
      }
    },
    [editor, getPos, onImageClick, editorEditable, src],
  )

  const handleReupload = useCallback(() => {
    editor.commands.uploadImageByUrl({ url: rawSrc, pos: getPos() })
    editor.chain().focus().deleteRange({ from: getPos(), to: getPos() + 1 }).run()
  }, [editor, rawSrc, getPos])

  // Notion-style horizontal pill resize handle logic
  const handleResizeStart = useCallback(
    (direction: 'left' | 'right') => (e: React.MouseEvent) => {
      if (!editorEditable) return
      e.preventDefault()
      e.stopPropagation()

      setIsResizing(true)
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'ew-resize'

      const startX = e.clientX
      const currentWidthPercent = parseFloat(width) || 100
      const parentElement = containerRef.current?.parentElement || document.body
      const parentWidth = parentElement.getBoundingClientRect().width || 624

      const onMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startX
        const deltaPercent = (deltaX / parentWidth) * 100
        const factor = direction === 'right' ? 1 : -1
        const rawNewWidth = currentWidthPercent + deltaPercent * factor
        const clampedWidth = Math.max(20, Math.min(100, Math.round(rawNewWidth)))

        updateAttributes({ width: `${clampedWidth}%` })
      }

      const onMouseUp = () => {
        setIsResizing(false)
        document.body.style.userSelect = ''
        document.body.style.cursor = ''
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', onMouseUp)
      }

      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    },
    [editorEditable, width, updateAttributes],
  )

  if (!rawSrc) return null

  const wrapperClassName = cn(
    align === 'left' ? 'ml-0' : 'ml-auto',
    align === 'right' ? 'mr-0' : 'mr-auto',
    align === 'center' && 'mx-auto',
    'group relative transition-all duration-200 select-none',
    !(editorEditable || isExternalImage) ? 'active:scale-[0.99]' : '',
  )

  return (
    <NodeViewWrapper className="w-full my-4">
      <div
        ref={containerRef}
        className={wrapperClassName}
        style={{
          width: width || '100%',
          position: 'relative',
        }}
        data-drag-handle
      >
        <div className="relative rounded-lg overflow-hidden group">
          {src && !isExternalImage && (
            <img
              ref={imgRef}
              src={isExternalImage ? originalSrc : (src as string)}
              alt={caption || ''}
              loading="lazy"
              onClick={onClick}
              onError={() => setHasError(true)}
              className={cn(
                'block w-full h-auto rounded-lg transition-opacity duration-200',
                !editorEditable ? 'cursor-pointer' : '',
              )}
              draggable={editorEditable}
            />
          )}

          {/* Notion-style Left Pill Resize Handle */}
          {editorEditable && (
            <div
              onMouseDown={handleResizeStart('left')}
              className={cn(
                'absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-12 rounded-full cursor-ew-resize z-20 transition-all duration-150',
                'bg-black/30 hover:bg-black/60 dark:bg-white/30 dark:hover:bg-white/60 shadow-md backdrop-blur-sm',
                isResizing
                  ? 'opacity-100 scale-110 bg-black/70 dark:bg-white/70'
                  : 'opacity-0 group-hover:opacity-100',
              )}
              title="Resize width"
            />
          )}

          {/* Notion-style Right Pill Resize Handle */}
          {editorEditable && (
            <div
              onMouseDown={handleResizeStart('right')}
              className={cn(
                'absolute right-2 top-1/2 -translate-y-1/2 w-1.5 h-12 rounded-full cursor-ew-resize z-20 transition-all duration-150',
                'bg-black/30 hover:bg-black/60 dark:bg-white/30 dark:hover:bg-white/60 shadow-md backdrop-blur-sm',
                isResizing
                  ? 'opacity-100 scale-110 bg-black/70 dark:bg-white/70'
                  : 'opacity-0 group-hover:opacity-100',
              )}
              title="Resize width"
            />
          )}

          {hasError && !isExternalImage && (
            <div className="w-full flex flex-col items-center justify-center bg-black/5 dark:bg-white/5 text-zinc-500 rounded-lg p-6 border border-black/10 dark:border-white/10 z-[2]">
              <span className="text-xs font-medium">이미지를 불러올 수 없습니다</span>
              {editorEditable && (
                <button
                  type="button"
                  onClick={handleReupload}
                  className="mt-2.5 px-3 py-1 bg-red-500/80 hover:bg-red-600 text-white rounded text-xs transition-colors"
                >
                  다시 업로드
                </button>
              )}
            </div>
          )}

          {isExternalImage && (
            <div className="w-full flex flex-col items-center justify-center p-6 bg-black/5 dark:bg-white/5 rounded-lg border border-black/10 dark:border-white/10 z-[2]">
              <div className="mb-2 text-xs text-zinc-500">External image not available</div>
              {editorEditable && (
                <button
                  type="button"
                  onClick={handleReupload}
                  className="mt-2 px-2.5 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors text-xs"
                >
                  Upload again
                </button>
              )}
            </div>
          )}
        </div>

        {/* Inline Notion-style Caption Input */}
        {(editorEditable || caption) && (
          <div className="mt-1.5 text-center px-2">
            {editorEditable ? (
              <input
                type="text"
                value={caption}
                onChange={e => updateAttributes({ caption: e.target.value })}
                placeholder="캡션 입력..."
                className="w-full text-center text-xs text-zinc-500 dark:text-zinc-400 placeholder:text-zinc-400/60 dark:placeholder:text-zinc-500/60 bg-transparent outline-none border-b border-transparent hover:border-black/10 dark:hover:border-white/10 focus:border-black/20 dark:focus:border-white/20 transition-colors py-0.5"
              />
            ) : (
              <div className="text-xs text-zinc-500 dark:text-zinc-400 italic py-0.5">{caption}</div>
            )}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  )
}

export default ImageBlockView
