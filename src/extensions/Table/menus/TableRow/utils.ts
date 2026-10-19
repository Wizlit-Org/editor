import { Editor } from '@tiptap/react'
import { EditorState } from '@tiptap/pm/state'
import { EditorView } from '@tiptap/pm/view'
import { TableMap } from '@tiptap/pm/tables'

import { isCellSelection, isRowSelected, isTableSelected } from '../../utils'
import { Table } from '../..'

export const isRowGripSelected = ({
  editor,
  view,
  state,
  from,
}: {
  editor: Editor
  view: EditorView
  state: EditorState
  from: number
}) => {
  if (!editor.isActive(Table.name) || !state) {
    return false
  }

  const { selection } = state

  // 1. High-precision ProseMirror CellSelection check
  if (isCellSelection(selection)) {
    try {
      const map = TableMap.get(selection.$anchorCell.node(-1))
      const start = selection.$anchorCell.start(-1)
      const rect = map.findCell(selection.$anchorCell.pos - start)
      if (isRowSelected(rect.top)(selection)) {
        return true
      }
    } catch {
      // Fall through to DOM fallback
    }
  }

  // 2. Fallback via DOM grip widget
  if (isTableSelected(selection)) {
    return false
  }

  const domAtPos = view.domAtPos(from)?.node as HTMLElement | undefined
  const nodeDOM = view.nodeDOM(from) as HTMLElement | undefined
  const node = nodeDOM || domAtPos

  if (!node) {
    return false
  }

  let container: HTMLElement | null = node

  while (container && !['TD', 'TH'].includes(container.tagName)) {
    container = container.parentElement
  }

  const gripRow = container?.querySelector?.('a.grip-row.selected')

  return !!gripRow
}

export default isRowGripSelected
