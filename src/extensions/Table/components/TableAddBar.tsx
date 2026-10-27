import React from 'react'
import { Icon } from '@/components/ui/Icon'

interface TableAddBarProps {
  tableRect: {
    top: number
    left: number
    right: number
    bottom: number
    width: number
    height: number
  }
  activeRowRect?: { top: number; height: number } | null
  activeColRect?: { left: number; width: number } | null
  showRightBar?: boolean
  showBottomBar?: boolean
  containerOffset?: { x: number; y: number }
  onAddColumn: (e: React.MouseEvent) => void
  onAddRow: (e: React.MouseEvent) => void
  onHoverKeepAlive: () => void
}

export const TableAddBar: React.FC<TableAddBarProps> = ({
  tableRect,
  activeRowRect,
  activeColRect,
  showRightBar = true,
  showBottomBar = true,
  containerOffset = { x: 0, y: 0 },
  onAddColumn,
  onAddRow,
  onHoverKeepAlive,
}) => {
  const rightBarTop = activeRowRect ? activeRowRect.top : tableRect.top
  const rightBarHeight = activeRowRect ? Math.max(activeRowRect.height, 24) : 28

  const bottomBarLeft = activeColRect ? activeColRect.left : tableRect.left
  const bottomBarWidth = activeColRect ? Math.max(activeColRect.width, 24) : 28

  const ox = containerOffset.x
  const oy = containerOffset.y

  return (
    <>
      {/* 1. Right Column Add Button: Sized to current row height */}
      {showRightBar && (
        <button
          type="button"
          className="fixed z-[30] pointer-events-auto flex items-center justify-center p-0 transition-all duration-150 rounded-full cursor-pointer group bg-zinc-500/10 hover:bg-[color-mix(in_srgb,var(--editor-primary)_90%,transparent)] dark:bg-white/10 dark:hover:bg-[color-mix(in_srgb,var(--editor-primary)_90%,transparent)] backdrop-blur-md border border-black/[0.06] dark:border-white/10 text-zinc-500 dark:text-zinc-300 hover:text-white dark:hover:text-white shadow-2xs"
          style={{
            top: rightBarTop - oy,
            left: tableRect.right + 4 - ox,
            height: rightBarHeight,
            width: 14,
          }}
          onMouseDown={e => {
            e.preventDefault()
            e.stopPropagation()
          }}
          onClick={onAddColumn}
          onMouseEnter={onHoverKeepAlive}
          title="Add column at end"
          aria-label="Add column at end"
        >
          <Icon name="Plus" className="w-3.5 h-3.5 stroke-[2.5]" />
        </button>
      )}

      {/* 2. Bottom Row Add Button: Sized to current column width - z-index: 30 (above blur & shield) */}
      {showBottomBar && (
        <button
          type="button"
          className="fixed z-[30] pointer-events-auto flex items-center justify-center p-0 transition-all duration-150 rounded-full cursor-pointer group bg-zinc-500/10 hover:bg-[color-mix(in_srgb,var(--editor-primary)_90%,transparent)] dark:bg-white/10 dark:hover:bg-[color-mix(in_srgb,var(--editor-primary)_90%,transparent)] backdrop-blur-md border border-black/[0.06] dark:border-white/10 text-zinc-500 dark:text-zinc-300 hover:text-white dark:hover:text-white shadow-2xs"
          style={{
            top: tableRect.bottom + 4 - oy,
            left: bottomBarLeft - ox,
            width: bottomBarWidth,
            height: 14,
          }}
          onMouseDown={e => {
            e.preventDefault()
            e.stopPropagation()
          }}
          onClick={onAddRow}
          onMouseEnter={onHoverKeepAlive}
          title="Add row at end"
          aria-label="Add row at end"
        >
          <Icon name="Plus" className="w-3.5 h-3.5 stroke-[2.5]" />
        </button>
      )}
    </>
  )
}

export default TableAddBar
