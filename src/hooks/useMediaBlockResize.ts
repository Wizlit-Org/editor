import React, { useCallback, useEffect, useState } from 'react'

interface UseMediaBlockResizeOptions {
  editorEditable: boolean
  width: string
  align: string
  containerRef: React.RefObject<HTMLDivElement | null>
  updateAttributes: (attrs: Record<string, any>) => void
  isFocused: boolean
}

export const MEDIA_PILL_HANDLE_CLASS =
  "w-[6px] h-[48px] rounded-full cursor-ew-resize z-30 transition-all duration-150 bg-white/60 dark:bg-white/45 backdrop-blur-md border border-white/90 dark:border-white/70 shadow-[0_2px_12px_rgba(0,0,0,0.35),inset_0_1px_1px_rgba(255,255,255,0.95)] hover:bg-white/85 dark:hover:bg-white/75 hover:scale-y-105 touch-none before:content-[''] before:absolute before:-inset-x-3 before:-inset-y-2"

export const useMediaBlockResize = ({
  editorEditable,
  width,
  align,
  containerRef,
  updateAttributes,
  isFocused,
}: UseMediaBlockResizeOptions) => {
  const [isResizing, setIsResizing] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  useEffect(() => {
    if (!isFocused && typeof window !== 'undefined' && window.matchMedia?.('(hover: none)').matches) {
      setIsHovered(false)
    }
  }, [isFocused])

  const onMouseEnter = useCallback(() => {
    if (!editorEditable) return
    if (typeof window !== 'undefined' && window.matchMedia?.('(hover: none)').matches) {
      return
    }
    setIsHovered(true)
  }, [editorEditable])

  const onMouseLeave = useCallback(() => {
    setIsHovered(false)
  }, [])

  const startResizeSession = useCallback(
    (direction: 'left' | 'right', startX: number, isTouch: boolean) => {
      setIsResizing(true)
      document.body.style.userSelect = 'none'
      if (!isTouch) {
        document.body.style.cursor = 'ew-resize'
      }

      const currentWidthPercent = parseFloat(width) || 100
      const parentElement = containerRef.current?.parentElement || document.body
      const parentWidth = parentElement.getBoundingClientRect().width || 624
      let latestWidth = currentWidthPercent

      if (containerRef.current) {
        containerRef.current.style.transition = 'none'
      }

      const updateWidthFromClientX = (clientX: number) => {
        const deltaX = clientX - startX
        const deltaPercent = (deltaX / parentWidth) * 100
        const factor = direction === 'right' ? 1 : -1
        const widthMultiplier = align === 'center' ? 2 : 1
        const rawNewWidth = currentWidthPercent + deltaPercent * factor * widthMultiplier
        latestWidth = Math.max(20, Math.min(100, Math.round(rawNewWidth)))

        if (containerRef.current) {
          containerRef.current.style.width = `${latestWidth}%`
        }
      }

      const finishResize = () => {
        setIsResizing(false)
        document.body.style.userSelect = ''
        document.body.style.cursor = ''
        if (containerRef.current) {
          containerRef.current.style.transition = ''
        }
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', finishResize)
        window.removeEventListener('touchmove', onTouchMove)
        window.removeEventListener('touchend', finishResize)
        window.removeEventListener('touchcancel', finishResize)
        updateAttributes({ width: `${latestWidth}%` })
      }

      const onMouseMove = (moveEvent: MouseEvent) => {
        updateWidthFromClientX(moveEvent.clientX)
      }

      const onTouchMove = (touchEvent: TouchEvent) => {
        if (touchEvent.touches.length > 0) {
          touchEvent.preventDefault()
          updateWidthFromClientX(touchEvent.touches[0].clientX)
        }
      }

      if (isTouch) {
        window.addEventListener('touchmove', onTouchMove, { passive: false })
        window.addEventListener('touchend', finishResize)
        window.addEventListener('touchcancel', finishResize)
      } else {
        window.addEventListener('mousemove', onMouseMove)
        window.addEventListener('mouseup', finishResize)
      }
    },
    [width, align, containerRef, updateAttributes],
  )

  const handleResizeStart = useCallback(
    (direction: 'left' | 'right') => (e: React.MouseEvent) => {
      if (!editorEditable) return
      e.preventDefault()
      e.stopPropagation()
      startResizeSession(direction, e.clientX, false)
    },
    [editorEditable, startResizeSession],
  )

  const handleResizeTouchStart = useCallback(
    (direction: 'left' | 'right') => (e: React.TouchEvent) => {
      if (!editorEditable || e.touches.length === 0) return
      e.stopPropagation()
      startResizeSession(direction, e.touches[0].clientX, true)
    },
    [editorEditable, startResizeSession],
  )

  return {
    isResizing,
    isHovered,
    onMouseEnter,
    onMouseLeave,
    handleResizeStart,
    handleResizeTouchStart,
  }
}
