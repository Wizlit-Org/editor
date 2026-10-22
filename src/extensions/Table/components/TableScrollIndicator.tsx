import React, { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Editor } from '@tiptap/react'

interface TableScrollIndicatorProps {
  editor: Editor
}

interface TableShadowState {
  id: string
  rect: { top: number; left: number; width: number; height: number }
  showLeft: boolean
  showRight: boolean
}

export const TableScrollIndicator: React.FC<TableScrollIndicatorProps> = ({ editor }) => {
  const [tables, setTables] = useState<TableShadowState[]>([])

  const updateTableScrollStates = useCallback(() => {
    if (!editor.view?.dom) {
      setTables([])
      return
    }

    const wrappers = Array.from(
      editor.view.dom.querySelectorAll('.tableWrapper'),
    ) as HTMLElement[]

    if (wrappers.length === 0) {
      setTables([])
      return
    }

    const nextStates: TableShadowState[] = []

    wrappers.forEach((wrapper, index) => {
      const rect = wrapper.getBoundingClientRect()
      // Skip if wrapper is out of viewport vertically
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        return
      }

      const { scrollLeft, scrollWidth, clientWidth } = wrapper
      const hasHorizontalScroll = scrollWidth > clientWidth + 2

      if (!hasHorizontalScroll) {
        return
      }

      const showLeft = scrollLeft > 4
      const showRight = scrollLeft < scrollWidth - clientWidth - 4

      nextStates.push({
        id: `table-wrapper-${index}`,
        rect: {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        },
        showLeft,
        showRight,
      })
    })

    setTables(nextStates)
  }, [editor])

  useEffect(() => {
    updateTableScrollStates()

    editor.on('selectionUpdate', updateTableScrollStates)
    editor.on('transaction', updateTableScrollStates)
    window.addEventListener('scroll', updateTableScrollStates, { passive: true, capture: true })
    window.addEventListener('resize', updateTableScrollStates, { passive: true })

    return () => {
      editor.off('selectionUpdate', updateTableScrollStates)
      editor.off('transaction', updateTableScrollStates)
      window.removeEventListener('scroll', updateTableScrollStates, { capture: true })
      window.removeEventListener('resize', updateTableScrollStates)
    }
  }, [editor, updateTableScrollStates])

  if (typeof document === 'undefined' || tables.length === 0) {
    return null
  }

  return createPortal(
    <>
      {tables.map(t => (
        <React.Fragment key={t.id}>
          {/* Left Edge Fade Shadow Indicator */}
          <div
            className={`fixed pointer-events-none z-[1380] transition-opacity duration-200 bg-gradient-to-r from-black/15 dark:from-black/40 to-transparent ${
              t.showLeft ? 'opacity-100' : 'opacity-0'
            }`}
            style={{
              top: t.rect.top,
              left: t.rect.left,
              width: '28px',
              height: t.rect.height,
            }}
          />

          {/* Right Edge Fade Shadow Indicator */}
          <div
            className={`fixed pointer-events-none z-[1380] transition-opacity duration-200 bg-gradient-to-l from-black/15 dark:from-black/40 to-transparent ${
              t.showRight ? 'opacity-100' : 'opacity-0'
            }`}
            style={{
              top: t.rect.top,
              left: t.rect.left + t.rect.width - 28,
              width: '28px',
              height: t.rect.height,
            }}
          />
        </React.Fragment>
      ))}
    </>,
    document.body,
  )
}
