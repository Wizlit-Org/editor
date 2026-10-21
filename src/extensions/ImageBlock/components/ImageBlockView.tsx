import React, { useState, useCallback, useEffect, useRef } from 'react'
import { Editor, NodeViewWrapper } from '@tiptap/react'
import { Node } from '@tiptap/pm/model'
import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui/Icon'
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
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isEditingCaption, setIsEditingCaption] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const captionInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setIsLoading(true)
    setHasError(false)
    if (convertSrc && rawSrc) {
      Promise.resolve(convertSrc(rawSrc))
        .then(resolved => setSrc(resolved))
        .catch(() => {
          setIsLoading(false)
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

  // Notion-style horizontal pill resize handle logic (with center-pivot physics)
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

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!editorEditable) return
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(true)
    }
  }, [editorEditable])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!editorEditable) return
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [editorEditable])

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      if (!editorEditable) return
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)

      const file = e.dataTransfer.files?.[0]
      if (!file || !file.type.startsWith('image/')) return

      try {
        const imageUploadExt = editor.extensionManager.extensions.find(e => e.name === 'imageUpload')
        const uploadFn = (imageUploadExt?.options as any)?.onUpload

        if (typeof uploadFn === 'function') {
          setIsUploading(true)
          const uploadedUrl = await uploadFn(file)
          if (uploadedUrl && typeof uploadedUrl === 'string') {
            updateAttributes({ src: uploadedUrl })
          }
        } else {
          console.error('No upload handler provided in imageUpload extension')
        }
      } catch (err) {
        console.error('Failed to replace image on drop:', err)
      } finally {
        setIsUploading(false)
      }
    },
    [editorEditable, editor, updateAttributes],
  )

  if (!rawSrc) return null

  const showCaption = Boolean(caption || isEditingCaption)

  const wrapperClassName = cn(
    align === 'left' ? 'ml-0' : 'ml-auto',
    align === 'right' ? 'mr-0' : 'mr-auto',
    align === 'center' && 'mx-auto',
    'group relative select-none',
    !isResizing && 'transition-all duration-200',
    !(editorEditable || isExternalImage) ? 'active:scale-[0.99]' : '',
  )

  // Show hover UI purely when hovered or resizing (0ms dismiss on mouseleave)
  const isInteracting = isHovered || isResizing

  const PILL_HANDLE_CLASS =
    'w-[6px] h-[48px] rounded-full cursor-ew-resize z-30 transition-all duration-150 bg-white/60 dark:bg-white/45 backdrop-blur-md border border-white/90 dark:border-white/70 shadow-[0_2px_12px_rgba(0,0,0,0.35),inset_0_1px_1px_rgba(255,255,255,0.95)] hover:bg-white/85 dark:hover:bg-white/75 hover:scale-y-105'

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
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Main image container: overflow-visible so the -inset-[10px] ring is fully visible */}
        <div className="relative group/image w-full flex flex-col p-0 m-0 leading-none">
          {/* Inner image frame: clipped with rounded-lg */}
          <div
            className="relative rounded-lg overflow-hidden w-full flex flex-col p-0 m-0 leading-none bg-black/[0.02] dark:bg-white/[0.02]"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {/* Drag & Drop Replace Overlay */}
            {isDragOver && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-indigo-500/25 dark:bg-violet-500/25 backdrop-blur-md rounded-lg border-2 border-dashed border-indigo-500 dark:border-violet-400 text-indigo-700 dark:text-violet-200 transition-all pointer-events-none gap-2">
                <Icon name="RefreshCw" className="w-8 h-8 animate-spin" />
                <span className="text-xs font-semibold">드롭하여 이미지 교체</span>
              </div>
            )}

            {/* Uploading Server Image Overlay */}
            {isUploading && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-md rounded-lg text-white transition-all pointer-events-none gap-2">
                <Icon name="RefreshCw" className="w-8 h-8 animate-spin" />
                <span className="text-xs font-semibold">이미지 업로드 중...</span>
              </div>
            )}
            {/* Loading Skeleton */}
            {isLoading && !hasError && (
              <div className="w-full aspect-video min-h-[140px] rounded-lg bg-black/[0.04] dark:bg-white/[0.04] backdrop-blur-sm animate-pulse flex flex-col items-center justify-center gap-2 border border-black/5 dark:border-white/5">
                <Icon name="Image" className="w-7 h-7 text-zinc-400 dark:text-zinc-500 animate-pulse" />
                <span className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">이미지 불러오는 중...</span>
              </div>
            )}

            {/* Actual Image */}
            {src && !isExternalImage && (
              <img
                ref={imgRef}
                src={isExternalImage ? originalSrc : (src as string)}
                alt={caption || ''}
                loading="lazy"
                onClick={onClick}
                onLoad={() => setIsLoading(false)}
                onError={() => {
                  setIsLoading(false)
                  setHasError(true)
                }}
                style={{ margin: 0, padding: 0, display: 'block', width: '100%', height: 'auto' }}
                className={cn(
                  'block w-full min-w-full h-auto rounded-lg object-contain !m-0 !p-0 transition-all duration-200',
                  isLoading ? 'opacity-0 h-0 overflow-hidden absolute pointer-events-none' : 'opacity-100',
                  !editorEditable ? 'cursor-pointer' : '',
                )}
                draggable={editorEditable}
              />
            )}

            {/* Error / Fallback Card */}
            {hasError && !isExternalImage && (
              <div className="w-full flex flex-col items-center justify-center bg-black/[0.02] dark:bg-white/[0.03] backdrop-blur-md text-zinc-500 rounded-lg p-6 border border-dashed border-black/15 dark:border-white/15 gap-2 z-[2]">
                <Icon name="ImageOff" className="w-8 h-8 text-zinc-400 dark:text-zinc-500" />
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">이미지를 불러올 수 없습니다</span>
                {editorEditable && (
                  <button
                    type="button"
                    onClick={handleReupload}
                    className="mt-1 px-3 py-1 bg-zinc-800 hover:bg-zinc-700 dark:bg-zinc-200 dark:hover:bg-zinc-300 text-white dark:text-zinc-900 rounded-md text-xs font-medium transition-colors shadow-sm"
                  >
                    다시 업로드
                  </button>
                )}
              </div>
            )}

            {/* External Image Fallback */}
            {isExternalImage && (
              <div className="w-full flex flex-col items-center justify-center p-6 bg-black/[0.02] dark:bg-white/[0.03] backdrop-blur-md rounded-lg border border-dashed border-black/15 dark:border-white/15 gap-2 z-[2]">
                <Icon name="ImageOff" className="w-8 h-8 text-zinc-400 dark:text-zinc-500" />
                <div className="text-xs text-zinc-500 dark:text-zinc-400">외부 이미지를 표시할 수 없습니다</div>
                {editorEditable && (
                  <button
                    type="button"
                    onClick={handleReupload}
                    className="mt-1 px-3 py-1 bg-zinc-800 hover:bg-zinc-700 dark:bg-zinc-200 dark:hover:bg-zinc-300 text-white dark:text-zinc-900 rounded-md text-xs font-medium transition-colors shadow-sm"
                  >
                    다시 업로드
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Notion-style 10px Padded Symmetric Glass Ring Overlay (Dismissed immediately on mouseleave) */}
          {!hasError && !isLoading && (
            <div
              className={cn(
                'pointer-events-none absolute -inset-[10px] rounded-xl ring-2 ring-black/20 dark:ring-white/30 bg-black/[0.02] dark:bg-white/[0.03] transition-opacity duration-150 z-10',
                isInteracting ? 'opacity-100' : 'opacity-0',
              )}
            />
          )}

          {/* Floating '+ 캡션 추가' Button on Hover */}
          {editorEditable && !showCaption && !hasError && !isLoading && (
            <button
              type="button"
              onClick={handleAddCaption}
              className={cn(
                'transition-all duration-150 absolute bottom-3 left-0 right-0 mx-auto w-fit px-2.5 py-1 rounded-full text-xs font-medium text-zinc-700 dark:text-zinc-200 bg-white/85 dark:bg-[#1e1e1e]/85 backdrop-blur-md shadow-md border border-black/10 dark:border-white/10 hover:bg-white dark:hover:bg-[#252525] hover:scale-105 active:scale-95 flex items-center gap-1.5 z-20 cursor-pointer whitespace-nowrap',
                isInteracting ? 'opacity-100' : 'opacity-0 pointer-events-none',
              )}
            >
              <Icon name="Captions" className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
              <span>캡션 추가</span>
            </button>
          )}

          {/* Frosted Glassmorphism Left Pill Resize Handle */}
          {editorEditable && !hasError && !isLoading && (
            <div
              onMouseDown={handleResizeStart('left')}
              className={cn(
                'tiptap-image-handle left absolute left-1.5 top-1/2 -translate-y-1/2',
                PILL_HANDLE_CLASS,
                isInteracting ? 'opacity-100' : 'opacity-0 pointer-events-none',
              )}
              title="Resize width"
              role="slider"
              aria-label="Resize image width left"
            />
          )}

          {/* Frosted Glassmorphism Right Pill Resize Handle */}
          {editorEditable && !hasError && !isLoading && (
            <div
              onMouseDown={handleResizeStart('right')}
              className={cn(
                'tiptap-image-handle right absolute right-1.5 top-1/2 -translate-y-1/2',
                PILL_HANDLE_CLASS,
                isInteracting ? 'opacity-100' : 'opacity-0 pointer-events-none',
              )}
              title="Resize width"
              role="slider"
              aria-label="Resize image width right"
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

export default ImageBlockView
