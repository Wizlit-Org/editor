import { Editor } from '@tiptap/react'
import { TableMap } from '@tiptap/pm/tables'
import { findTable, isCellSelection } from '../../utils'

export const getSelectedRowIndex = (editor: Editor): number => {
  const { selection } = editor.state
  const table = findTable(selection)
  if (!table) return -1

  const map = TableMap.get(table.node)
  if (isCellSelection(selection)) {
    const start = selection.$anchorCell.start(-1)
    const rect = map.findCell(selection.$anchorCell.pos - start)
    return rect.top
  }

  const $pos = selection.$from
  for (let d = $pos.depth; d > 0; d--) {
    const n = $pos.node(d)
    if (n.type.spec.tableRole === 'cell' || n.type.spec.tableRole === 'header_cell') {
      const cellPos = $pos.before(d)
      const rect = map.findCell(cellPos - table.start)
      return rect.top
    }
  }

  return 0
}

export const clearRowContents = (editor: Editor, rowIndex: number) => {
  const { state, view } = editor
  const table = findTable(state.selection)
  if (!table) return

  const map = TableMap.get(table.node)
  if (rowIndex < 0 || rowIndex >= map.height) return

  const cells = map.cellsInRect({
    left: 0,
    right: map.width,
    top: rowIndex,
    bottom: rowIndex + 1,
  })

  const { tr } = state
  const sortedPos = [...cells].sort((a, b) => b - a)
  for (const pos of sortedPos) {
    const cellNodePos = table.start + pos
    const cellNode = state.doc.nodeAt(cellNodePos)
    if (cellNode) {
      const emptyParagraph = state.schema.nodes.paragraph.create()
      tr.replaceWith(cellNodePos + 1, cellNodePos + cellNode.nodeSize - 1, emptyParagraph)
    }
  }

  view.dispatch(tr)
}
