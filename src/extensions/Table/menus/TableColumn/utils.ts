import { Editor } from '@tiptap/react'
import { EditorState } from '@tiptap/pm/state'
import { EditorView } from '@tiptap/pm/view'
import { TableMap } from '@tiptap/pm/tables'

import { isCellSelection, isTableSelected } from '../../utils'
import { Table, tableGripPluginKey } from '../..'

export const isColumnGripSelected = ({
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

  // Check explicit grip selection state first (100% reliable even with merged cells)
  const gripSel = tableGripPluginKey.getState(state)
  if (gripSel && gripSel.type === 'col') {
    return true
  }

  // 3. Column selection is active if all rows are selected across 1 or more columns (single, merged, or multi-col)
  if (isCellSelection(selection)) {
    try {
      const map = TableMap.get(selection.$anchorCell.node(-1))
      const start = selection.$anchorCell.start(-1)
      const rect = map.rectBetween(selection.$anchorCell.pos - start, selection.$headCell.pos - start)
      const isFullHeight = rect.bottom - rect.top === map.height
      const isNotFullTable = rect.right - rect.left < map.width
      return isFullHeight && isNotFullTable
    } catch {
      return false
    }
  }

  return false
}

export default isColumnGripSelected
