import React from 'react'

export interface DragGhostData {
  type: 'col' | 'row'
  index: number
  label: string
  x: number
  y: number
  snippets?: string[]
  isBlocked: boolean
  targetIdx: number
}

export interface DragIndicatorData {
  type: 'col' | 'row'
  left: number
  top: number
  width: number
  height: number
  isBlocked: boolean
  blockMessage?: string
}

export interface DraggingSourceData {
  type: 'col' | 'row'
  left: number
  top: number
  width: number
  height: number
}

export interface TargetSlotData {
  left: number
  top: number
  width: number
  height: number
}

interface TableDragOverlaysProps {
  dragGhost: DragGhostData | null
  draggingSource?: DraggingSourceData | null
  dragIndicator: DragIndicatorData | null
  targetSlot?: TargetSlotData | null
  resizingGuideX: number | null
  tableRectLeft: number
  tableRectTop: number
  tableRectWidth: number
  tableRectHeight: number
}

export const TableDragOverlays: React.FC<TableDragOverlaysProps> = ({
  dragGhost,
  dragIndicator,
  resizingGuideX,
  tableRectTop,
  tableRectHeight,
}) => {
  return (
    <>
      {/* 1. Drop Position Indicator Guide: Single clean 2px indigo line (AC ⑥) */}
      {dragIndicator && !dragIndicator.isBlocked && (
        <div
          className="fixed pointer-events-none z-[25] bg-indigo-500 dark:bg-indigo-400 shadow-[0_0_6px_rgba(99,102,241,0.6)] rounded-full transition-all duration-75"
          style={{
            left: dragIndicator.left,
            top: dragIndicator.top,
            width: dragIndicator.width,
            height: dragIndicator.height,
            zIndex: 25,
          }}
        />
      )}

      {/* 2. Drag Cursor-Following Ghost: Minimal single capsule badge (AC ⑥) */}
      {dragGhost && (
        <div
          className={`fixed pointer-events-none z-[30] px-3 py-1 rounded-full text-xs font-medium shadow-lg backdrop-blur-sm select-none -translate-x-1/2 -translate-y-9 transition-colors flex items-center gap-1.5 ${
            dragGhost.isBlocked
              ? 'bg-rose-950/95 border border-rose-500/80 text-rose-200 shadow-rose-950/50'
              : 'bg-zinc-900/95 dark:bg-zinc-800/95 border border-white/10 text-white shadow-black/40'
          }`}
          style={{ left: dragGhost.x, top: dragGhost.y, zIndex: 30 }}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${dragGhost.isBlocked ? 'bg-rose-400' : 'bg-indigo-400'}`} />
          <span>{dragGhost.label}</span>
        </div>
      )}

      {/* 3. Column Resizing Guide: Single clean 2px vertical indigo line */}
      {resizingGuideX !== null && (
        <div
          className="fixed pointer-events-none bg-indigo-500 dark:bg-indigo-400 z-[25] shadow-[0_0_6px_rgba(99,102,241,0.6)] rounded-full"
          style={{
            left: resizingGuideX - 1,
            top: tableRectTop,
            width: 2,
            height: tableRectHeight,
            zIndex: 25,
          }}
        />
      )}
    </>
  )
}
