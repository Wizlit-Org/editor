import React, { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Editor } from '@tiptap/react'
import { TableMap } from '@tiptap/pm/tables'
import { Icon } from '@/components/ui/Icon'

export interface TableAddButtonsProps {
  editor: Editor
}

interface TableRectInfo {
  top: number
  left: number
  right: number
  bottom: number
  width: number
  height: number
  pos: number
}

export const TableAddButtons: React.FC<TableAddButtonsProps> = ({ editor }) => {
  const [tableRect, setTableRect] = useState<TableRectInfo | null>(null)
  const [isHovered, setIsHovered] = useState(false)
  const [currentTableEl, setCurrentTableEl] = useState<HTMLTableElement | null>(null)

  const updateTableRect = useCallback(() => {
    if (!currentTableEl || !editor?.view?.dom) {
      setTableRect(null)
      return
    }

    if (!document.body.contains(currentTableEl)) {
      setTableRect(null)
      setCurrentTableEl(null)
      return
    }

    const r = currentTableEl.getBoundingClientRect()
    let tablePos = -1
    try {
      const pos = editor.view.posAtDOM(currentTableEl, 0)
      const resolved = editor.state.doc.resolve(pos)
      for (let d = resolved.depth; d >= 0; d--) {
        if (resolved.node(d).type.name === 'table') {
          tablePos = resolved.before(d)
          break
        }
      }
    } catch {
      tablePos = -1
    }

    setTableRect({
      top: r.top,
      left: r.left,
      right: r.right,
      bottom: r.bottom,
      width: r.width,
      height: r.height,
      pos: tablePos,
    })
  }, [currentTableEl, editor])

  useEffect(() => {
    if (!editor?.view?.dom) return

    const editorDom = editor.view.dom

    const handleMouseMove = (e: MouseEvent) => {
      // Suppress if dragging
      if (editor.view?.dragging || document.querySelector('[data-dragging="true"]')) {
        setTableRect(null)
        setIsHovered(false)
        return
      }

      const target = e.target as HTMLElement | null
      const table = target?.closest('table') as HTMLTableElement | null

      if (table && editorDom.contains(table)) {
        setCurrentTableEl(table)
        setIsHovered(true)
      } else {
        // If mouse is near the active table buttons, keep visible
        const buttonsContainer = document.getElementById('table-add-buttons-portal')
        if (buttonsContainer && buttonsContainer.contains(target)) {
          setIsHovered(true)
        } else {
          setIsHovered(false)
        }
      }
    }

    const handleMouseLeave = () => {
      setIsHovered(false)
    }

    editorDom.addEventListener('mousemove', handleMouseMove, { passive: true })
    editorDom.addEventListener('mouseleave', handleMouseLeave, { passive: true })
    window.addEventListener('scroll', updateTableRect, { passive: true, capture: true })
    window.addEventListener('resize', updateTableRect, { passive: true })

    return () => {
      editorDom.removeEventListener('mousemove', handleMouseMove)
      editorDom.removeEventListener('mouseleave', handleMouseLeave)
      window.removeEventListener('scroll', updateTableRect, { capture: true })
      window.removeEventListener('resize', updateTableRect)
    }
  }, [editor, updateTableRect])

  useEffect(() => {
    updateTableRect()
  }, [currentTableEl, updateTableRect])

  const onAddColumnAtEnd = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (!tableRect || tableRect.pos < 0) {
        editor.chain().focus().addColumnAfter().run()
        return
      }
      try {
        const tableNode = editor.state.doc.nodeAt(tableRect.pos)
        if (tableNode) {
          const map = TableMap.get(tableNode)
          const lastColCellPos = tableRect.pos + 1 + map.map[map.width - 1]
          editor.chain().focus().setTextSelection(lastColCellPos + 1).addColumnAfter().run()
          setTimeout(updateTableRect, 50)
          return
        }
      } catch {
        // Fallback
      }
      editor.chain().focus().addColumnAfter().run()
      setTimeout(updateTableRect, 50)
    },
    [editor, tableRect, updateTableRect],
  )

  const onAddRowAtEnd = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (!tableRect || tableRect.pos < 0) {
        editor.chain().focus().addRowAfter().run()
        return
      }
      try {
        const tableNode = editor.state.doc.nodeAt(tableRect.pos)
        if (tableNode) {
          const map = TableMap.get(tableNode)
          const lastRowCellPos = tableRect.pos + 1 + map.map[(map.height - 1) * map.width]
          editor.chain().focus().setTextSelection(lastRowCellPos + 1).addRowAfter().run()
          setTimeout(updateTableRect, 50)
          return
        }
      } catch {
        // Fallback
      }
      editor.chain().focus().addRowAfter().run()
      setTimeout(updateTableRect, 50)
    },
    [editor, tableRect, updateTableRect],
  )

  if (!tableRect || !isHovered || !editor.isEditable) {
    return null
  }

  if (typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div id="table-add-buttons-portal" className="pointer-events-auto">
      {/* 1. Right Column Add (+) Button: Vertical bar at the right edge of the table */}
      <div
        className="fixed z-20 flex items-center justify-center transition-opacity duration-150"
        style={{
          top: tableRect.top,
          left: tableRect.right + 2,
          height: tableRect.height,
          width: 22,
        }}
        onMouseEnter={() => setIsHovered(true)}
      >
        <button
          type="button"
          onClick={onAddColumnAtEnd}
          className="w-4 h-9 rounded-full bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15 border border-black/10 dark:border-white/15 text-zinc-400 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 flex items-center justify-center transition-all shadow-sm hover:scale-110 active:scale-95 cursor-pointer outline-none"
          title="Add column at end"
          aria-label="Add column at end"
        >
          <Icon name="Plus" className="w-3 h-3 stroke-[2.5]" />
        </button>
      </div>

      {/* 2. Bottom Row Add (+) Button: Horizontal bar at the bottom edge of the table */}
      <div
        className="fixed z-20 flex items-center justify-center transition-opacity duration-150"
        style={{
          top: tableRect.bottom + 2,
          left: tableRect.left,
          width: tableRect.width,
          height: 22,
        }}
        onMouseEnter={() => setIsHovered(true)}
      >
        <button
          type="button"
          onClick={onAddRowAtEnd}
          className="h-4 w-9 rounded-full bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15 border border-black/10 dark:border-white/15 text-zinc-400 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 flex items-center justify-center transition-all shadow-sm hover:scale-110 active:scale-95 cursor-pointer outline-none"
          title="Add row at end"
          aria-label="Add row at end"
        >
          <Icon name="Plus" className="w-3 h-3 stroke-[2.5]" />
        </button>
      </div>
    </div>,
    document.body,
  )
}

export default TableAddButtons
