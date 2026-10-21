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
  showRightBar?: boolean
  showBottomBar?: boolean
  onAddColumn: (e: React.MouseEvent) => void
  onAddRow: (e: React.MouseEvent) => void
  onHoverKeepAlive: () => void
}

export const TableAddBar: React.FC<TableAddBarProps> = ({
  tableRect,
  showRightBar = true,
  showBottomBar = true,
  onAddColumn,
  onAddRow,
  onHoverKeepAlive,
}) => {
  return (
    <>
      {/* 1. Right Column Add Bar: Full table height 12px glass pill */}
      {showRightBar && (
        <div
          className="fixed z-[1400] flex items-center justify-center transition-all duration-150 rounded-full cursor-pointer group bg-zinc-500/10 hover:bg-indigo-600/90 dark:bg-white/10 dark:hover:bg-violet-500/90 backdrop-blur-md border border-black/[0.06] dark:border-white/10 text-zinc-500 dark:text-zinc-300 hover:text-white dark:hover:text-white shadow-2xs"
          style={{
            top: tableRect.top,
            left: tableRect.right + 4,
            height: tableRect.height,
            width: 12,
            zIndex: 1400,
          }}
          onClick={onAddColumn}
          onMouseEnter={onHoverKeepAlive}
          title="Add column at end"
          aria-label="Add column at end"
        >
          <Icon name="Plus" className="w-3.5 h-3.5 stroke-[2.5]" />
        </div>
      )}

      {/* 2. Bottom Row Add Bar: Full table width 12px glass pill */}
      {showBottomBar && (
        <div
          className="fixed z-[1400] flex items-center justify-center transition-all duration-150 rounded-full cursor-pointer group bg-zinc-500/10 hover:bg-indigo-600/90 dark:bg-white/10 dark:hover:bg-violet-500/90 backdrop-blur-md border border-black/[0.06] dark:border-white/10 text-zinc-500 dark:text-zinc-300 hover:text-white dark:hover:text-white shadow-2xs"
          style={{
            top: tableRect.bottom + 4,
            left: tableRect.left,
            width: tableRect.width,
            height: 12,
            zIndex: 1400,
          }}
          onClick={onAddRow}
          onMouseEnter={onHoverKeepAlive}
          title="Add row at end"
          aria-label="Add row at end"
        >
          <Icon name="Plus" className="w-3.5 h-3.5 stroke-[2.5]" />
        </div>
      )}
    </>
  )
}

export default TableAddBar
