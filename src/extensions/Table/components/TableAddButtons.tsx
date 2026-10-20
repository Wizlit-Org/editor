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
      {/* 1. Right Column Add Bar: Vertical 12px bar along table right edge with col-resize cursor */}
      <div
        className="fixed z-20 flex items-center justify-center transition-all duration-150 rounded-r cursor-col-resize group hover:bg-blue-500/10 dark:hover:bg-blue-400/10"
        style={{
          top: tableRect.top,
          left: tableRect.right + 2,
          height: tableRect.height,
          width: 12,
        }}
        onClick={onAddColumnAtEnd}
        onMouseEnter={() => setIsHovered(true)}
        title="Add column at end"
        aria-label="Add column at end"
      >
        <div className="w-3 h-6 rounded-full bg-black/5 group-hover:bg-blue-500 group-hover:text-white dark:bg-white/10 dark:group-hover:bg-blue-500 dark:group-hover:text-white border border-black/10 dark:border-white/15 text-zinc-400 flex items-center justify-center transition-all shadow-sm">
          <Icon name="Plus" className="w-2.5 h-2.5 stroke-[2.5]" />
        </div>
      </div>

      {/* 2. Bottom Row Add Bar: Horizontal 12px bar along table bottom edge with row-resize cursor */}
      <div
        className="fixed z-20 flex items-center justify-center transition-all duration-150 rounded-b cursor-row-resize group hover:bg-blue-500/10 dark:hover:bg-blue-400/10"
        style={{
          top: tableRect.bottom + 2,
          left: tableRect.left,
          width: tableRect.width,
          height: 12,
        }}
        onClick={onAddRowAtEnd}
        onMouseEnter={() => setIsHovered(true)}
        title="Add row at end"
        aria-label="Add row at end"
      >
        <div className="h-3 w-6 rounded-full bg-black/5 group-hover:bg-blue-500 group-hover:text-white dark:bg-white/10 dark:group-hover:bg-blue-500 dark:group-hover:text-white border border-black/10 dark:border-white/15 text-zinc-400 flex items-center justify-center transition-all shadow-sm">
          <Icon name="Plus" className="w-2.5 h-2.5 stroke-[2.5]" />
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default TableAddButtons
