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

  // 1. If currently dragging anything (block or handle), suppress all menus
  if (view.dragging || (typeof document !== 'undefined' && document.querySelector('[data-dragging="true"]'))) {
    return false
  }

  const { selection } = state

  // 2. Suppress if full table is selected
  if (isTableSelected(selection)) {
    return false
  }

  // 3. Must have an active grip-row with .selected class in the DOM
  // (Meaning the user explicitly clicked the ⋮ row grip pill)
  const editorDom = view.dom
  const gripRow = editorDom?.querySelector('a.grip-row.selected')
  if (!gripRow) {
    return false
  }

  // 4. Ensure it's purely a single row selection
  if (isCellSelection(selection)) {
    try {
      const map = TableMap.get(selection.$anchorCell.node(-1))
      const start = selection.$anchorCell.start(-1)
      const rect = map.findCell(selection.$anchorCell.pos - start)
      const isSingleRow = rect.bottom - rect.top === 1 && rect.right - rect.left === map.width
      return isSingleRow
    } catch {
      return false
    }
  }

  return false
}

export default isRowGripSelected
