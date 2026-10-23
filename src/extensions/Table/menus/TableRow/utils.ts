import { Editor } from '@tiptap/react'
import { EditorState } from '@tiptap/pm/state'
import { EditorView } from '@tiptap/pm/view'
import { TableMap } from '@tiptap/pm/tables'

import { isCellSelection, isTableSelected } from '../../utils'
import { Table } from '../..'

export const isRowGripSelected = ({
  editor,
  view,
  state,
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

  // 3. Row selection is active if all columns are selected across 1 or more rows (single, merged, or multi-row)
  if (isCellSelection(selection)) {
    try {
      const map = TableMap.get(selection.$anchorCell.node(-1))
      const start = selection.$anchorCell.start(-1)
      const rect = map.rectBetween(selection.$anchorCell.pos - start, selection.$headCell.pos - start)
      const isFullWidth = rect.right - rect.left === map.width
      const isNotFullTable = rect.bottom - rect.top < map.height
      return isFullWidth && isNotFullTable
    } catch {
      return false
    }
  }

  return false
}

export default isRowGripSelected
