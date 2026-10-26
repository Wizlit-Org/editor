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
  resizingGuideX?: number | null
  tableRectLeft: number
  tableRectTop: number
  tableRectWidth: number
  tableRectHeight: number
  containerOffset?: { x: number; y: number }
}

export const TableDragOverlays: React.FC<TableDragOverlaysProps> = ({
  dragGhost,
  dragIndicator,
  containerOffset = { x: 0, y: 0 },
}) => {
  const ox = containerOffset.x
  const oy = containerOffset.y

  return (
    <>
      {/* 1. Drop Position Indicator Guide: Single clean 2px theme line */}
      {dragIndicator && !dragIndicator.isBlocked && (
        <div
          className="fixed pointer-events-none z-[25] bg-[var(--editor-primary)] shadow-[0_0_6px_var(--editor-primary)] rounded-full transition-all duration-75"
          style={{
            left: dragIndicator.left - ox,
            top: dragIndicator.top - oy,
            width: dragIndicator.width,
            height: dragIndicator.height,
            zIndex: 25,
          }}
        />
      )}

      {/* 2. Drag Cursor-Following Ghost: Minimal single capsule badge */}
      {dragGhost && (
        <div
          className={`fixed pointer-events-none z-[30] px-3 py-1 rounded-full text-xs font-medium shadow-lg backdrop-blur-sm select-none -translate-x-1/2 -translate-y-9 transition-colors flex items-center gap-1.5 ${
            dragGhost.isBlocked
              ? 'bg-rose-950/95 border border-rose-500/80 text-rose-200 shadow-rose-950/50'
              : 'bg-zinc-900/95 dark:bg-zinc-800/95 border border-white/10 text-white shadow-black/40'
          }`}
          style={{ left: dragGhost.x - ox, top: dragGhost.y - oy, zIndex: 30 }}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${dragGhost.isBlocked ? 'bg-rose-400' : 'bg-[var(--editor-primary)]'}`} />
          <span>{dragGhost.label}</span>
        </div>
      )}
    </>
  )
}
