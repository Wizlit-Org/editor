import { Editor } from '@tiptap/react'
import { EditorState } from '@tiptap/pm/state'
import { EditorView } from '@tiptap/pm/view'
import { TableMap } from '@tiptap/pm/tables'

import { isCellSelection, isColumnSelected, isTableSelected } from '../../utils'
import { Table } from '../..'

export const isColumnGripSelected = ({
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

  // 1. If currently dragging anything (block or handle), suppress all menus
  if (view.dragging || (typeof document !== 'undefined' && document.querySelector('[data-dragging="true"]'))) {
    return false
  }

  const { selection } = state

  // 2. Suppress if full table is selected
  if (isTableSelected(selection)) {
    return false
  }

  // 3. Ensure it's purely a single column selection
  if (isCellSelection(selection)) {
    try {
      const map = TableMap.get(selection.$anchorCell.node(-1))
      const start = selection.$anchorCell.start(-1)
      const rect = map.findCell(selection.$anchorCell.pos - start)
      const isSingleCol = rect.right - rect.left === 1 && rect.bottom - rect.top === map.height
      return isSingleCol
    } catch {
      return false
    }
  }

  return false
}

export default isColumnGripSelected
