import { Editor } from '@tiptap/react'
import { TableMap } from '@tiptap/pm/tables'
import { findTable, isCellSelection } from '../../utils'
import { moveTableRow } from '../../utils/TableDndUtils'
import { isHeaderStraddling, hasMergedCellsInRowSelection } from '../../utils/TableHeaderStraddleUtils'
import {
  getClusterRowRange,
  duplicateRowCluster,
  deleteRowCluster,
  findJumpMoveIndex,
} from '../../utils/TableClusterUtils'

export const getSelectedRowRange = (editor: Editor): { min: number; max: number } => {
  const { selection } = editor.state
  const table = findTable(selection)
  if (!table) return { min: 0, max: 0 }

  const map = TableMap.get(table.node)
  if (isCellSelection(selection)) {
    const start = selection.$anchorCell.start(-1)
    const rect = map.rectBetween(selection.$anchorCell.pos - start, selection.$headCell.pos - start)
    return { min: rect.top, max: rect.bottom - 1 }
  }

  const $pos = selection.$from
  for (let d = $pos.depth; d > 0; d--) {
    const n = $pos.node(d)
    if (n.type.spec.tableRole === 'cell' || n.type.spec.tableRole === 'header_cell') {
      const cellPos = $pos.before(d)
      const rect = map.findCell(cellPos - table.start)
      const cluster = getClusterRowRange(table.node, rect.top)
      return { min: cluster.start, max: cluster.start + cluster.count - 1 }
    }
  }

  return { min: 0, max: 0 }
}

export const getSelectedRowIndex = (editor: Editor): number => {
  return getSelectedRowRange(editor).min
}

export const clearRowContents = (editor: Editor, rowIndex: number) => {
  const { state, view } = editor
  const table = findTable(state.selection)
  if (!table) return

  const map = TableMap.get(table.node)
  const range = getSelectedRowRange(editor)
  const fromRow = Math.max(0, Math.min(rowIndex, range.min))
  const toRow = Math.min(map.height - 1, Math.max(rowIndex, range.max))

  const cells = map.cellsInRect({
    left: 0,
    right: map.width,
    top: fromRow,
    bottom: toRow + 1,
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
  const range = getSelectedRowRange(editor)
  const min = Math.min(rowIndex, range.min)
  const max = Math.max(rowIndex, range.max)
  duplicateRowCluster(editor, min, max)
}

export const deleteRow = (editor: Editor, rowIndex?: number) => {
  const range = getSelectedRowRange(editor)
  const min = typeof rowIndex === 'number' ? Math.min(rowIndex, range.min) : range.min
  const max = typeof rowIndex === 'number' ? Math.max(rowIndex, range.max) : range.max
  deleteRowCluster(editor, min, max)
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

  const range = getSelectedRowRange(editor)
  for (let r = range.min; r <= range.max; r++) {
    const targetRow = rows[r]
    const updatedCells: any[] = []
    targetRow.forEach((cell: any) => {
      const newAttrs = { ...cell.attrs, [type]: value }
      updatedCells.push(cell.type.create(newAttrs, cell.content))
    })
    rows[r] = targetRow.type.create(targetRow.attrs, updatedCells)
  }

  const newTable = table.node.type.create(table.node.attrs, rows)
  const tr = state.tr.replaceWith(table.pos, table.pos + table.node.nodeSize, newTable)
  view.dispatch(tr)
}

export const moveRowUp = (editor: Editor, rowIndex: number) => {
  const table = findTable(editor.state.selection)
  if (!table) return
  const range = getSelectedRowRange(editor)
  if (hasMergedCellsInRowSelection(table.node, range.min, range.max)) return
  const targetIdx = findJumpMoveIndex(table.node, 'row', range.min, 'prev')
  if (targetIdx >= 0) {
    if (isHeaderStraddling(table.node, 'row', range.min, targetIdx)) return
    const count = range.max - range.min + 1
    moveTableRow(editor, table.pos, range.min, targetIdx, count)
  }
}

export const moveRowDown = (editor: Editor, rowIndex: number) => {
  const table = findTable(editor.state.selection)
  if (!table) return
  const range = getSelectedRowRange(editor)
  if (hasMergedCellsInRowSelection(table.node, range.min, range.max)) return
  const targetIdx = findJumpMoveIndex(table.node, 'row', range.max, 'next')
  if (targetIdx >= 0) {
    if (isHeaderStraddling(table.node, 'row', range.max, targetIdx)) return
    const count = range.max - range.min + 1
    moveTableRow(editor, table.pos, range.min, targetIdx, count)
  }
}
