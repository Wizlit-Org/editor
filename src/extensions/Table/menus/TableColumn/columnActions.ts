import { Editor } from '@tiptap/react'
import { TableMap } from '@tiptap/pm/tables'
import { findTable, isCellSelection } from '../../utils'
import { moveTableColumn } from '../../utils/TableDndUtils'
import {
  getClusterColRange,
  duplicateColCluster,
  deleteColCluster,
  findJumpMoveIndex,
} from '../../utils/TableClusterUtils'

export const getSelectedColRange = (editor: Editor): { min: number; max: number } => {
  const { selection } = editor.state
  const table = findTable(selection)
  if (!table) return { min: 0, max: 0 }

  const map = TableMap.get(table.node)
  if (isCellSelection(selection)) {
    const start = selection.$anchorCell.start(-1)
    const rect = map.rectBetween(selection.$anchorCell.pos - start, selection.$headCell.pos - start)
    return { min: rect.left, max: rect.right - 1 }
  }

  const $pos = selection.$from
  for (let d = $pos.depth; d > 0; d--) {
    const n = $pos.node(d)
    if (n.type.spec.tableRole === 'cell' || n.type.spec.tableRole === 'header_cell') {
      const cellPos = $pos.before(d)
      const rect = map.findCell(cellPos - table.start)
      const cluster = getClusterColRange(table.node, rect.left)
      return { min: cluster.start, max: cluster.start + cluster.count - 1 }
    }
  }

  return { min: 0, max: 0 }
}

export const getSelectedColumnIndex = (editor: Editor): number => {
  return getSelectedColRange(editor).min
}

export const clearColumnContents = (editor: Editor, colIndex: number) => {
  const { state, view } = editor
  const table = findTable(state.selection)
  if (!table) return

  const map = TableMap.get(table.node)
  const range = getSelectedColRange(editor)
  const fromCol = Math.max(0, Math.min(colIndex, range.min))
  const toCol = Math.min(map.width - 1, Math.max(colIndex, range.max))

  const cells = map.cellsInRect({
    left: fromCol,
    right: toCol + 1,
    top: 0,
    bottom: map.height,
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

export const sortColumn = (editor: Editor, colIndex: number, direction: 'asc' | 'desc') => {
  const { state, view } = editor
  const table = findTable(state.selection)
  if (!table) return

  const map = TableMap.get(table.node)
  if (colIndex < 0 || colIndex >= map.width) return

  const rows: { rowNode: any; sortValue: string; isHeader: boolean }[] = []
  let startRow = 0

  table.node.forEach((rowNode, _offset, index) => {
    let isHeader = false
    let cellText = ''
    rowNode.forEach((cell, _, cIdx) => {
      if (cell.type.spec.tableRole === 'header_cell') isHeader = true
      if (cIdx === colIndex) cellText = cell.textContent || ''
    })
    if (index === 0 && isHeader) startRow = 1
    rows.push({
      rowNode,
      sortValue: cellText.trim().toLowerCase(),
      isHeader: index === 0 && isHeader,
    })
  })

  if (rows.length <= startRow + 1) return

  const headerRows = rows.slice(0, startRow)
  const bodyRows = rows.slice(startRow)

  bodyRows.sort((a, b) => {
    const res = a.sortValue.localeCompare(b.sortValue, undefined, { numeric: true, sensitivity: 'base' })
    return direction === 'asc' ? res : -res
  })

  const newRows = [...headerRows.map(r => r.rowNode), ...bodyRows.map(r => r.rowNode)]
  const newTable = table.node.type.create(table.node.attrs, newRows)
  const tr = state.tr.replaceWith(table.pos, table.pos + table.node.nodeSize, newTable)
  view.dispatch(tr)
}

export const duplicateColumn = (editor: Editor, colIndex: number) => {
  const range = getSelectedColRange(editor)
  const min = Math.min(colIndex, range.min)
  const max = Math.max(colIndex, range.max)
  duplicateColCluster(editor, min, max)
}

export const deleteColumn = (editor: Editor, colIndex?: number) => {
  const range = getSelectedColRange(editor)
  const min = typeof colIndex === 'number' ? Math.min(colIndex, range.min) : range.min
  const max = typeof colIndex === 'number' ? Math.max(colIndex, range.max) : range.max
  deleteColCluster(editor, min, max)
}

export const setColumnAlignment = (
  editor: Editor,
  colIndex: number,
  type: 'textAlign' | 'verticalAlign',
  value: string,
) => {
  const { state, view } = editor
  const table = findTable(state.selection)
  if (!table) return

  const range = getSelectedColRange(editor)
  const newRows: any[] = []

  table.node.forEach(rowNode => {
    const cells: any[] = []
    rowNode.forEach((cell, _, cIdx) => {
      if (cIdx >= range.min && cIdx <= range.max) {
        const newAttrs = { ...cell.attrs, [type]: value }
        cells.push(cell.type.create(newAttrs, cell.content))
      } else {
        cells.push(cell)
      }
    })
    newRows.push(rowNode.type.create(rowNode.attrs, cells))
  })

  const newTable = table.node.type.create(table.node.attrs, newRows)
  const tr = state.tr.replaceWith(table.pos, table.pos + table.node.nodeSize, newTable)
  view.dispatch(tr)
}

export const moveColumnLeft = (editor: Editor, colIndex: number) => {
  const table = findTable(editor.state.selection)
  if (!table) return
  const range = getSelectedColRange(editor)
  const targetIdx = findJumpMoveIndex(table.node, 'col', range.min, 'prev')
  if (targetIdx >= 0) {
    moveTableColumn(editor, table.pos, range.min, targetIdx)
  }
}

export const moveColumnRight = (editor: Editor, colIndex: number) => {
  const table = findTable(editor.state.selection)
  if (!table) return
  const range = getSelectedColRange(editor)
  const targetIdx = findJumpMoveIndex(table.node, 'col', range.min, 'next')
  if (targetIdx >= 0) {
    moveTableColumn(editor, table.pos, range.min, targetIdx)
  }
}
