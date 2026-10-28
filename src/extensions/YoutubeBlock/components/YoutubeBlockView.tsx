import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Editor, NodeViewWrapper } from '@tiptap/react'
import { Node } from '@tiptap/pm/model'
import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui/Icon'
import type { NodeViewProps } from '@tiptap/react'
import { formatYoutubeEmbedUrl } from '../YoutubeBlock'

interface YoutubeBlockViewProps extends NodeViewProps {
  editor: Editor
  getPos: () => number
  node: Node & { attrs: { src: string; align?: string; width?: string; caption?: string; isEditing?: boolean } }
  updateAttributes: (attrs: Record<string, any>) => void
}

function getYoutubeVideoId(url: string): string | null {
  if (!url) return null
  const regExp = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  const match = url.match(regExp)
  return match && match[1]?.length === 11 ? match[1] : null
}

export const YoutubeBlockView: React.FC<YoutubeBlockViewProps> = ({
  editor,
  getPos,
  node,
  updateAttributes,
  selected,
}) => {
  const { src, align = 'center', width = '100%', caption = '', isEditing = false } = node.attrs
  const editorEditable = editor.isEditable

  const [emptyUrlInput, setEmptyUrlInput] = useState(src || '')
  const [isResizing, setIsResizing] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [isEditingCaption, setIsEditingCaption] = useState(false)
  const [isPlayingInRead, setIsPlayingInRead] = useState(false)
  const [isNodeSelected, setIsNodeSelected] = useState(Boolean(selected))

  const containerRef = useRef<HTMLDivElement>(null)
  const captionInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const syncSelection = () => {
      try {
        const pos = typeof getPos === 'function' ? getPos() : -1
        const { from, to } = editor.state.selection
        setIsNodeSelected(
          Boolean(selected) || (pos >= 0 && from === pos && to === pos + node.nodeSize),
        )
      } catch {
        setIsNodeSelected(Boolean(selected))
      }
    }
    syncSelection()
    editor.on('selectionUpdate', syncSelection)
    editor.on('transaction', syncSelection)
    editor.on('focus', syncSelection)
    editor.on('blur', syncSelection)
    return () => {
      editor.off('selectionUpdate', syncSelection)
      editor.off('transaction', syncSelection)
      editor.off('focus', syncSelection)
      editor.off('blur', syncSelection)
    }
  }, [editor, getPos, node.nodeSize, selected])

  useEffect(() => {
    if (isEditing) {
      setEmptyUrlInput(src || '')
    }
  }, [isEditing, src])

  const videoId = useMemo(() => getYoutubeVideoId(src), [src])
  const thumbnailUrl = videoId ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : null

  // Real-time preview for empty state input
  const previewVideoId = useMemo(() => getYoutubeVideoId(emptyUrlInput), [emptyUrlInput])
  const previewThumbUrl = previewVideoId ? `https://i.ytimg.com/vi/${previewVideoId}/mqdefault.jpg` : null

  const handleApplyEmptyUrl = useCallback(() => {
    const trimmed = emptyUrlInput.trim()
    if (trimmed) {
      updateAttributes({ src: trimmed, isEditing: false })
    }
  }, [emptyUrlInput, updateAttributes])

  const handleCancelEmptyBlock = useCallback(() => {
    if (isEditing && src) {
      updateAttributes({ isEditing: false })
    } else {
      try {
        editor.commands.deleteSelection()
      } catch {
        updateAttributes({ src: '', isEditing: false })
      }
    }
  }, [editor, isEditing, src, updateAttributes])

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

  // Empty URL state or Editing mode: Render premium glassmorphism embed card
  const isBoxMode = !src || !src.trim() || isEditing
  if (isBoxMode) {
    if (!editorEditable) return <></>

    return (
      <NodeViewWrapper
        className="node-youtube w-full"
        style={{ marginTop: '24px', marginBottom: '24px' }}
      >
        <div
          ref={containerRef}
          className="mx-auto w-full max-w-lg p-6 rounded-2xl border border-white/40 dark:border-white/10 bg-white/80 dark:bg-[#18181b]/85 backdrop-blur-2xl shadow-2xl flex flex-col items-center justify-center gap-4 text-center select-none transition-all"
        >
          <div>
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {isEditing ? 'YouTube 동영상 링크 변경' : 'YouTube 동영상 임베드'}
            </h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              {isEditing
                ? '새 동영상 링크를 입력하여 영상을 교체하세요'
                : '동영상 링크를 붙여넣어 에디터에서 바로 시청하세요'}
            </p>
          </div>

          {/* Real-time Video Thumbnail Preview if valid URL typed (div Facade to eliminate host .external-image-label and ensure 100% fill) */}
          {previewThumbUrl && (
            <div className="w-full max-w-sm aspect-video rounded-xl overflow-hidden border border-black/10 dark:border-white/10 relative shadow-md bg-neutral-900 animate-in fade-in-0 zoom-in-95 duration-150">
              <div
                className="w-full h-full"
                style={{
                  backgroundImage: `url(${previewThumbUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center pointer-events-none">
                <div className="w-10 h-10 rounded-full bg-white/85 text-red-600 flex items-center justify-center shadow-lg">
                  <Icon name="Play" className="w-5 h-5 ml-0.5 fill-current" />
                </div>
              </div>
            </div>
          )}

          {/* Modern Round Glass Input Bar */}
          <div className="flex items-center gap-2 w-full max-w-md bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-3 py-1.5 focus-within:border-red-500/60 dark:focus-within:border-red-400/60 focus-within:ring-2 focus-within:ring-red-500/20 transition-all">
            <Icon name="Video" className="w-4 h-4 text-zinc-400 shrink-0" />
            <input
              type="text"
              value={emptyUrlInput}
              onChange={e => setEmptyUrlInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleApplyEmptyUrl()
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  handleCancelEmptyBlock()
                }
              }}
              placeholder="YouTube 영상 링크를 붙여넣으세요..."
              className="flex-1 bg-transparent text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 outline-none"
              autoFocus
            />
            <button
              type="button"
              onClick={handleApplyEmptyUrl}
              className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium text-xs shadow-md shadow-red-600/20 transition-all active:scale-95 whitespace-nowrap cursor-pointer"
            >
              {isEditing ? '동영상 변경' : '동영상 임베드'}
            </button>
            <button
              type="button"
              onClick={handleCancelEmptyBlock}
              className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              title="취소 (Esc)"
            >
              <Icon name="X" className="w-4 h-4" />
            </button>
          </div>
        </div>
      </NodeViewWrapper>
    )
  }

  const showCaption = Boolean(caption || isEditingCaption)

  const wrapperClassName = cn(
    align === 'left' ? 'ml-0' : 'ml-auto',
    align === 'right' ? 'mr-0' : 'mr-auto',
    align === 'center' && 'mx-auto',
    'group relative select-none',
    !isResizing && 'transition-all duration-200',
  )

  // Show hover UI when editable and hovered/resizing, and track focused/selected state
  const isFocused = Boolean(editorEditable && (selected || isNodeSelected))
  const isInteracting = editorEditable && (isHovered || isResizing || isFocused || isEditingCaption)

  const PILL_HANDLE_CLASS =
    'w-[6px] h-[48px] rounded-full cursor-ew-resize z-30 transition-all duration-150 bg-white/60 dark:bg-white/45 backdrop-blur-md border border-white/90 dark:border-white/70 shadow-[0_2px_12px_rgba(0,0,0,0.35),inset_0_1px_1px_rgba(255,255,255,0.95)] hover:bg-white/85 dark:hover:bg-white/75 hover:scale-y-105'

  const listId = useMemo(() => {
    if (!src) return null
    try {
      return new URL(src).searchParams.get('list')
    } catch {
      const match = src.match(/[?&]list=([a-zA-Z0-9_-]+)/)
      return match ? match[1] : null
    }
  }, [src])

  // Embed URL for playback (in read mode with standard controls)
  const activeEmbedUrl = useMemo(() => {
    if (videoId) {
      const base = `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=1&rel=0&modestbranding=1`
      return listId ? `${base}&list=${listId}` : base
    }
    if (listId) {
      return `https://www.youtube.com/embed/videoseries?list=${listId}&autoplay=1&controls=1&rel=0&modestbranding=1`
    }
    return formatYoutubeEmbedUrl(src)
  }, [videoId, listId, src])

  return (
    <NodeViewWrapper
      className="node-youtube w-full overflow-visible"
      style={{ marginTop: '24px', marginBottom: '24px' }}
    >
      <div
        ref={containerRef}
        className={cn(wrapperClassName, 'overflow-visible')}
        style={{
          width: width || '100%',
          position: 'relative',
        }}
        data-drag-handle
        onMouseEnter={() => {
          if (editorEditable) setIsHovered(true)
        }}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Main video outer container: overflow-visible so focus ring & hover ring are never clipped */}
        <div className="relative group/youtube w-full flex flex-col p-0 m-0 leading-none overflow-visible">
          {/* Inner video frame: clipped with rounded-xl + crisp theme focus ring when selected */}
          <div
            data-youtube-video="true"
            className={cn(
              'relative rounded-xl overflow-hidden w-full aspect-video flex flex-col leading-none bg-black/[0.04] dark:bg-white/[0.04] shadow-sm cursor-pointer transition-shadow duration-150',
              isFocused &&
                'ring-2 ring-[var(--editor-primary)] ring-offset-2 ring-offset-white dark:ring-offset-zinc-900 shadow-[0_0_0_4px_color-mix(in_srgb,var(--editor-primary)_18%,transparent)]',
            )}
            onClick={editorEditable ? onSelectBlock : undefined}
          >
            {/* Edit Mode OR Read Mode (prior to click): High-res Facade Preview to eliminate 🔗 link icon */}
            {editorEditable || !isPlayingInRead ? (
              <div
                className="relative w-full h-full bg-neutral-900 flex items-center justify-center overflow-hidden"
                onClick={!editorEditable ? () => setIsPlayingInRead(true) : undefined}
              >
                {thumbnailUrl ? (
                  <div
                    className="w-full h-full bg-cover bg-center opacity-90 group-hover/youtube:opacity-100 transition-opacity select-none pointer-events-none"
                    style={{ backgroundImage: `url(${thumbnailUrl})` }}
                  />
                ) : (
                  <div className="w-full h-full bg-neutral-800 flex items-center justify-center">
                    <Icon name="Play" className="w-12 h-12 text-white/50" />
                  </div>
                )}

                {/* Glassmorphism Play Icon overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors">
                  <div className="w-14 h-14 rounded-full bg-white/80 dark:bg-black/70 backdrop-blur-md shadow-xl flex items-center justify-center text-zinc-900 dark:text-white border border-white/40 dark:border-white/20 transition-transform group-hover/youtube:scale-110">
                    <Icon name="Play" className="w-6 h-6 ml-1 fill-current" />
                  </div>
                </div>
              </div>
            ) : (
              /* Read Mode (active playback): Render iframe with controls=1 */
              <iframe
                src={activeEmbedUrl}
                title={caption || 'YouTube video'}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full border-0 rounded-xl block"
              />
            )}
          </div>

          {/* YouTube-style 10px Padded Symmetric Glass Ring Overlay on hover when not focused */}
          <div
            className={cn(
              'pointer-events-none absolute -inset-[10px] rounded-2xl ring-2 ring-black/20 dark:ring-white/30 bg-black/[0.02] dark:bg-white/[0.03] transition-opacity duration-150 z-20',
              (isHovered || isResizing) && !isFocused ? 'opacity-100' : 'opacity-0',
            )}
          />

          {/* Floating '+ 캡션 추가' Button on Hover */}
          {editorEditable && !showCaption && (
            <button
              type="button"
              onClick={handleAddCaption}
              className={cn(
                'transition-all duration-150 absolute bottom-3 left-0 right-0 mx-auto w-fit px-2.5 py-1 rounded-full text-xs font-medium text-zinc-700 dark:text-zinc-200 bg-white/85 dark:bg-[#1e1e1e]/85 backdrop-blur-md shadow-md border border-black/10 dark:border-white/10 hover:bg-white dark:hover:bg-[#252525] hover:scale-105 active:scale-95 flex items-center gap-1.5 z-30 cursor-pointer whitespace-nowrap',
                isInteracting ? 'opacity-100' : 'opacity-0 pointer-events-none',
              )}
            >
              <Icon name="Captions" className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
              <span>캡션 추가</span>
            </button>
          )}

          {/* Frosted Glassmorphism Left Pill Resize Handle */}
          {editorEditable && (
            <div
              onMouseDown={handleResizeStart('left')}
              className={cn(
                'tiptap-image-handle left absolute left-1.5 top-1/2 -translate-y-1/2',
                PILL_HANDLE_CLASS,
                isInteracting ? 'opacity-100' : 'opacity-0 pointer-events-none',
              )}
              title="Resize width"
              role="slider"
              aria-label="Resize video width left"
            />
          )}

          {/* Frosted Glassmorphism Right Pill Resize Handle */}
          {editorEditable && (
            <div
              onMouseDown={handleResizeStart('right')}
              className={cn(
                'tiptap-image-handle right absolute right-1.5 top-1/2 -translate-y-1/2',
                PILL_HANDLE_CLASS,
                isInteracting ? 'opacity-100' : 'opacity-0 pointer-events-none',
              )}
              title="Resize width"
              role="slider"
              aria-label="Resize video width right"
            />
          )}
        </div>

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
                  setIsEditingCaption(false)
                  if (!caption.trim()) {
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
