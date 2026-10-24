import React from 'react'

export interface DragGhostData {
  type: 'col' | 'row'
  index: number
  label: string
  x: number
  y: number
  snippets: string[]
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

interface TableDragOverlaysProps {
  dragGhost: DragGhostData | null
  draggingSource: DraggingSourceData | null
  dragIndicator: DragIndicatorData | null
  resizingGuideX: number | null
  tableRectTop: number
  tableRectHeight: number
}

export const TableDragOverlays: React.FC<TableDragOverlaysProps> = ({
  dragGhost,
  draggingSource,
  dragIndicator,
  resizingGuideX,
  tableRectTop,
  tableRectHeight,
}) => {
  return (
    <>
      {/* 1. Drag Source Highlight Overlay (Diagonal stripes + glass dim) */}
      {draggingSource && (
        <div
          className="fixed pointer-events-none z-[1390] rounded-md transition-all duration-75 overflow-hidden"
          style={{
            left: draggingSource.left,
            top: draggingSource.top,
            width: draggingSource.width,
            height: draggingSource.height,
            backgroundColor: 'rgba(99, 102, 241, 0.12)',
            backgroundImage:
              'repeating-linear-gradient(45deg, rgba(99, 102, 241, 0.15) 0, rgba(99, 102, 241, 0.15) 8px, transparent 8px, transparent 16px)',
            boxShadow: 'inset 0 0 0 2px rgba(99, 102, 241, 0.65)',
            backdropFilter: 'blur(1px)',
          }}
        />
      )}

      {/* 2. Drag Cursor-Following Ghost Preview Badge & Mini Slice Card */}
      {dragGhost && (
        <div
          className={`fixed pointer-events-none z-[1450] flex flex-col gap-1.5 p-2 rounded-xl shadow-2xl backdrop-blur-md select-none -translate-x-1/2 -translate-y-12 transition-colors duration-150 min-w-[130px] max-w-[220px] ${
            dragGhost.isBlocked
              ? 'bg-rose-950/95 border border-rose-500/80 text-white shadow-rose-950/50'
              : 'bg-slate-900/95 dark:bg-zinc-900/95 border border-indigo-500/50 text-white shadow-indigo-950/50'
          }`}
          style={{ left: dragGhost.x, top: dragGhost.y }}
        >
          {/* Header Status Pill */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 font-medium text-xs">
              <span
                className={`w-2 h-2 rounded-full ${
                  dragGhost.isBlocked ? 'bg-rose-400 animate-ping' : 'bg-indigo-400 animate-pulse'
                }`}
              />
              <span className="font-semibold">
                {dragGhost.isBlocked
                  ? '이동 불가'
                  : dragGhost.targetIdx >= 0 && dragGhost.targetIdx !== dragGhost.index
                    ? `${dragGhost.type === 'col' ? 'Col' : 'Row'} ${dragGhost.index + 1} → ${dragGhost.targetIdx + 1}`
                    : dragGhost.label}
              </span>
            </div>
            {dragGhost.isBlocked && (
              <span className="text-[10px] px-1 py-0.2 rounded bg-rose-500/30 text-rose-300 font-bold">
                BLOCKED
              </span>
            )}
          </div>

          {/* Mini Cell Preview Grid */}
          {dragGhost.snippets.length > 0 && (
            <div
              className={`grid gap-1 pt-1 border-t ${
                dragGhost.isBlocked ? 'border-rose-500/30' : 'border-white/10'
              } ${dragGhost.type === 'col' ? 'grid-flow-row' : 'grid-flow-col auto-cols-fr'}`}
            >
              {dragGhost.snippets.map((snip, i) => (
                <div
                  key={i}
                  className="px-1.5 py-0.5 rounded bg-white/10 dark:bg-white/5 border border-white/10 text-[10px] font-mono text-zinc-200 truncate max-w-[90px] text-center"
                >
                  {snip}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. Drag Drop Position Indicator Guide Bar (3px neon glow + diamond markers) */}
      {dragIndicator && (
        <div
          className={`fixed pointer-events-none z-[1400] transition-all duration-75 ${
            dragIndicator.isBlocked
              ? 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.95)]'
              : 'bg-indigo-600 dark:bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.95)]'
          }`}
          style={{
            left: dragIndicator.left,
            top: dragIndicator.top,
            width: dragIndicator.width,
            height: dragIndicator.height,
          }}
        >
          {/* Top/Left Diamond Marker */}
          <div
            className={`absolute w-3 h-3 rotate-45 ${
              dragIndicator.isBlocked
                ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,1)]'
                : 'bg-indigo-600 shadow-[0_0_8px_rgba(99,102,241,1)]'
            }`}
            style={
              dragIndicator.type === 'col'
                ? { top: -6, left: '50%', transform: 'translateX(-50%) rotate(45deg)' }
                : { left: -6, top: '50%', transform: 'translateY(-50%) rotate(45deg)' }
            }
          />

          {/* Bottom/Right Diamond Marker */}
          <div
            className={`absolute w-3 h-3 rotate-45 ${
              dragIndicator.isBlocked
                ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,1)]'
                : 'bg-indigo-600 shadow-[0_0_8px_rgba(99,102,241,1)]'
            }`}
            style={
              dragIndicator.type === 'col'
                ? { bottom: -6, left: '50%', transform: 'translateX(-50%) rotate(45deg)' }
                : { right: -6, top: '50%', transform: 'translateY(-50%) rotate(45deg)' }
            }
          />

          {/* Block Warning Tooltip Badge */}
          {dragIndicator.isBlocked && dragIndicator.blockMessage && (
            <div
              className="absolute z-[1450] whitespace-nowrap px-2.5 py-1 rounded-md bg-rose-600 text-white font-medium text-xs shadow-xl flex items-center gap-1.5 -translate-x-1/2 -translate-y-1/2"
              style={{
                left: dragIndicator.type === 'col' ? '50%' : '50%',
                top: dragIndicator.type === 'col' ? '50%' : '50%',
              }}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{dragIndicator.blockMessage}</span>
            </div>
          )}
        </div>
      )}

      {/* 4. Real-time Column Resizing Full-Height Vertical Guide Line */}
      {resizingGuideX !== null && (
        <div
          className="fixed pointer-events-none bg-indigo-500 dark:bg-violet-400 z-[1400] shadow-[0_0_10px_rgba(99,102,241,0.95)] rounded-full transition-none"
          style={{
            left: resizingGuideX - 1.5,
            top: tableRectTop,
            width: 3,
            height: tableRectHeight,
          }}
        />
      )}
    </>
  )
}
