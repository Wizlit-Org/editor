import React, { useState, useCallback, useRef, useMemo } from 'react'
import { Editor, NodeViewWrapper } from '@tiptap/react'
import { Node } from '@tiptap/pm/model'
import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui/Icon'
import type { NodeViewProps } from '@tiptap/react'
import { formatYoutubeEmbedUrl } from '../YoutubeBlock'

interface YoutubeBlockViewProps extends NodeViewProps {
  editor: Editor
  getPos: () => number
  node: Node & { attrs: { src: string; align?: string; width?: string; caption?: string } }
  updateAttributes: (attrs: Record<string, any>) => void
}

export const YoutubeBlockView: React.FC<YoutubeBlockViewProps> = ({
  editor,
  getPos,
  node,
  updateAttributes,
}) => {
  const { src, align = 'center', width = '100%', caption = '' } = node.attrs
  const editorEditable = editor.isEditable

  const [isResizing, setIsResizing] = useState(false)
  const [isEditingCaption, setIsEditingCaption] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const captionInputRef = useRef<HTMLInputElement>(null)

  const onSelectBlock = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      editor.commands.setNodeSelection(getPos())
    },
    [editor, getPos],
  )

  // Notion-style horizontal pill resize handle logic (60fps direct DOM update)
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
      let latestWidth = currentWidthPercent

      if (containerRef.current) {
        containerRef.current.style.transition = 'none'
      }

      const onMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startX
        const deltaPercent = (deltaX / parentWidth) * 100
        const factor = direction === 'right' ? 1 : -1
        const widthMultiplier = align === 'center' ? 2 : 1
        const rawNewWidth = currentWidthPercent + deltaPercent * factor * widthMultiplier
        latestWidth = Math.max(20, Math.min(100, Math.round(rawNewWidth)))

        if (containerRef.current) {
          containerRef.current.style.width = `${latestWidth}%`
        }
      }

      const onMouseUp = () => {
        setIsResizing(false)
        document.body.style.userSelect = ''
        document.body.style.cursor = ''
        if (containerRef.current) {
          containerRef.current.style.transition = ''
        }
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', onMouseUp)
        updateAttributes({ width: `${latestWidth}%` })
      }

      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    },
    [editorEditable, width, align, updateAttributes],
  )

  const handleAddCaption = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      setIsEditingCaption(true)
      setTimeout(() => {
        captionInputRef.current?.focus()
      }, 50)
    },
    [],
  )

  if (!src) return null

  const showCaption = Boolean(caption || isEditingCaption)

  const wrapperClassName = cn(
    align === 'left' ? 'ml-0' : 'ml-auto',
    align === 'right' ? 'mr-0' : 'mr-auto',
    align === 'center' && 'mx-auto',
    'group relative select-none',
    !isResizing && 'transition-all duration-200',
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
        {/* Main video container */}
        <div
          data-youtube-video="true"
          className="relative rounded-xl overflow-hidden group/youtube w-full aspect-video flex flex-col leading-none bg-black/[0.04] dark:bg-white/[0.04] shadow-sm"
        >
          {/* YouTube iframe */}
          <iframe
            src={formatYoutubeEmbedUrl(src)}
            title={caption || 'YouTube video'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className={cn(
              'w-full h-full border-0 rounded-xl block',
              isResizing ? 'pointer-events-none' : '',
            )}
          />

          {/* Edit mode: Transparent click overlay to prevent accidental playback & trigger selection */}
          {editorEditable && (
            <div
              onClick={onSelectBlock}
              className="absolute inset-0 z-10 cursor-pointer bg-transparent"
              title="클릭하여 유튜브 블록 선택"
            />
          )}

          {/* YouTube-style 10px Padded Symmetric Glass Ring Overlay on Hover / Active Selection */}
          <div className="pointer-events-none absolute -inset-[10px] rounded-2xl ring-1 ring-black/15 dark:ring-white/25 opacity-0 group-hover:opacity-100 group-hover/youtube:opacity-100 transition-opacity duration-150 z-20" />

          {/* Floating '+ 캡션 추가' Button on Hover (Perfect margin-based horizontal center) */}
          {editorEditable && !showCaption && (
            <button
              type="button"
              onClick={handleAddCaption}
              className="opacity-0 group-hover:opacity-100 group-hover/youtube:opacity-100 transition-all duration-200 absolute bottom-3 left-0 right-0 mx-auto w-fit px-2.5 py-1 rounded-full text-xs font-medium text-zinc-700 dark:text-zinc-200 bg-white/85 dark:bg-[#1e1e1e]/85 backdrop-blur-md shadow-md border border-black/10 dark:border-white/10 hover:bg-white dark:hover:bg-[#252525] hover:scale-105 active:scale-95 flex items-center gap-1.5 z-30 cursor-pointer whitespace-nowrap"
            >
              <Icon name="Captions" className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
              <span>캡션 추가</span>
            </button>
          )}
        </div>

        {/* Notion-style Left Pill Resize Handle */}
        {editorEditable && (
          <div
            onMouseDown={handleResizeStart('left')}
            className={cn(
              'tiptap-image-handle left absolute left-1.5 top-1/2 -translate-y-1/2 w-[6px] h-[48px] rounded-full cursor-ew-resize z-30 transition-all duration-150',
              'bg-white dark:bg-white border border-black/30 dark:border-black/50 shadow-[0_0_0_1.5px_rgba(255,255,255,0.9),0_2px_8px_rgba(0,0,0,0.5)]',
              isResizing
                ? 'opacity-100 scale-110 bg-white dark:bg-white ring-2 ring-blue-500'
                : 'opacity-0 group-hover:opacity-100',
            )}
            title="Resize width"
            role="slider"
            aria-label="Resize video width left"
          />
        )}

        {/* Notion-style Right Pill Resize Handle */}
        {editorEditable && (
          <div
            onMouseDown={handleResizeStart('right')}
            className={cn(
              'tiptap-image-handle right absolute right-1.5 top-1/2 -translate-y-1/2 w-[6px] h-[48px] rounded-full cursor-ew-resize z-30 transition-all duration-150',
              'bg-white dark:bg-white border border-black/30 dark:border-black/50 shadow-[0_0_0_1.5px_rgba(255,255,255,0.9),0_2px_8px_rgba(0,0,0,0.5)]',
              isResizing
                ? 'opacity-100 scale-110 bg-white dark:bg-white ring-2 ring-blue-500'
                : 'opacity-0 group-hover:opacity-100',
            )}
            title="Resize width"
            role="slider"
            aria-label="Resize video width right"
          />
        )}

        {/* Notion-style Inline Caption (0px height when empty and not editing) */}
        {showCaption && (
          <div className="mt-1.5 text-center px-2">
            {editorEditable ? (
              <input
                ref={captionInputRef}
                type="text"
                value={caption}
                onChange={e => updateAttributes({ caption: e.target.value })}
                onBlur={() => {
                  if (!caption.trim()) {
                    setIsEditingCaption(false)
                    updateAttributes({ caption: '' })
                  }
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === 'Escape') {
                    e.preventDefault()
                    if (!caption.trim()) {
                      setIsEditingCaption(false)
                      updateAttributes({ caption: '' })
                    }
                    editor.commands.focus()
                  }
                }}
                placeholder="캡션 입력..."
                className="w-full text-center text-xs text-zinc-500 dark:text-zinc-400 placeholder:text-zinc-400/60 dark:placeholder:text-zinc-500/60 bg-transparent outline-none border-b border-transparent hover:border-black/10 dark:hover:border-white/10 focus:border-black/20 dark:focus:border-white/20 transition-colors py-0.5"
              />
            ) : (
              <div className="text-xs text-center text-zinc-500 dark:text-zinc-400 italic py-0.5">{caption}</div>
            )}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  )
}

export default YoutubeBlockView
