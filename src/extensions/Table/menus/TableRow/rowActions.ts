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

export const duplicateRow = (editor: Editor, rowIndex: number) => {
  const { state, view } = editor
  const table = findTable(state.selection)
  if (!table) return

  const rows: any[] = []
  table.node.forEach(row => rows.push(row))
  if (rowIndex < 0 || rowIndex >= rows.length) return

  const targetRow = rows[rowIndex]
  const cellType = state.schema.nodes.tableCell || targetRow.type

  // Deep clone all cells in target row with contents and attributes
  const clonedCells: any[] = []
  targetRow.forEach((cell: any) => {
    // If duplicating a header row, convert duplicated cells to regular tableCells
    const targetType = cell.type.spec.tableRole === 'header_cell' ? cellType : cell.type
    const cloned = targetType.create(cell.attrs, cell.content)
    clonedCells.push(cloned)
  })

  const newRow = targetRow.type.create(targetRow.attrs, clonedCells)
  const newRows = [...rows.slice(0, rowIndex + 1), newRow, ...rows.slice(rowIndex + 1)]
  const newTable = table.node.type.create(table.node.attrs, newRows)
  const tr = state.tr.replaceWith(table.pos, table.pos + table.node.nodeSize, newTable)
  view.dispatch(tr)
}

export const setRowAlignment = (
  editor: Editor,
  rowIndex: number,
  type: 'textAlign' | 'verticalAlign',
  value: string,
) => {
  const { state, view } = editor
  const table = findTable(state.selection)
  if (!table) return

  const rows: any[] = []
  table.node.forEach(row => rows.push(row))
  if (rowIndex < 0 || rowIndex >= rows.length) return

  const targetRow = rows[rowIndex]
  const updatedCells: any[] = []
  targetRow.forEach((cell: any) => {
    const newAttrs = { ...cell.attrs, [type]: value }
    updatedCells.push(cell.type.create(newAttrs, cell.content))
  })

  rows[rowIndex] = targetRow.type.create(targetRow.attrs, updatedCells)
  const newTable = table.node.type.create(table.node.attrs, rows)
  const tr = state.tr.replaceWith(table.pos, table.pos + table.node.nodeSize, newTable)
  view.dispatch(tr)
}

export const moveRowUp = (editor: Editor, rowIndex: number) => {
  if (rowIndex <= 0) return
  const { state, view } = editor
  const table = findTable(state.selection)
  if (!table) return

  const rows: any[] = []
  table.node.forEach(row => rows.push(row))
  if (rowIndex < rows.length) {
    const temp = rows[rowIndex]
    rows[rowIndex] = rows[rowIndex - 1]
    rows[rowIndex - 1] = temp
  }

  const newTable = table.node.type.create(table.node.attrs, rows)
  const tr = state.tr.replaceWith(table.pos, table.pos + table.node.nodeSize, newTable)
  view.dispatch(tr)
}

export const moveRowDown = (editor: Editor, rowIndex: number) => {
  const { state, view } = editor
  const table = findTable(state.selection)
  if (!table) return

  const rows: any[] = []
  table.node.forEach(row => rows.push(row))
  if (rowIndex < rows.length - 1) {
    const temp = rows[rowIndex]
    rows[rowIndex] = rows[rowIndex + 1]
    rows[rowIndex + 1] = temp
  }

  const newTable = table.node.type.create(table.node.attrs, rows)
  const tr = state.tr.replaceWith(table.pos, table.pos + table.node.nodeSize, newTable)
  view.dispatch(tr)
}

