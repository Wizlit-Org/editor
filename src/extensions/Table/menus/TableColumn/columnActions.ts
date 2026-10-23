import { Editor } from '@tiptap/react'
import { TableMap } from '@tiptap/pm/tables'
import { findTable, isCellSelection } from '../../utils'

export const getSelectedColumnIndex = (editor: Editor): number => {
  const { selection } = editor.state
  const table = findTable(selection)
  if (!table) return -1

  const map = TableMap.get(table.node)
  if (isCellSelection(selection)) {
    const start = selection.$anchorCell.start(-1)
    const rect = map.findCell(selection.$anchorCell.pos - start)
    return rect.left
  }

  // Fallback: cursor position inside a cell
  const $pos = selection.$from
  for (let d = $pos.depth; d > 0; d--) {
    const n = $pos.node(d)
    if (n.type.spec.tableRole === 'cell' || n.type.spec.tableRole === 'header_cell') {
      const cellPos = $pos.before(d)
      const rect = map.findCell(cellPos - table.start)
      return rect.left
    }
  }

  return 0
}

export const clearColumnContents = (editor: Editor, colIndex: number) => {
  const { state, view } = editor
  const table = findTable(state.selection)
  if (!table) return

  const map = TableMap.get(table.node)
  if (colIndex < 0 || colIndex >= map.width) return

  const cells = map.cellsInRect({
    left: colIndex,
    right: colIndex + 1,
    top: 0,
    bottom: map.height,
  })

  const { tr } = state
  // Clear from end to start to preserve positions
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
      if (cell.type.spec.tableRole === 'header_cell') {
        isHeader = true
      }
      if (cIdx === colIndex) {
        cellText = cell.textContent || ''
      }
    })

    if (index === 0 && isHeader) {
      startRow = 1
    }

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
  const { state, view } = editor
  const table = findTable(state.selection)
  if (!table) return

  const map = TableMap.get(table.node)
  if (colIndex < 0 || colIndex >= map.width) return

  const newRows: any[] = []
  table.node.forEach(rowNode => {
    const cells: any[] = []
    rowNode.forEach(cell => cells.push(cell))
    if (colIndex < cells.length) {
      const targetCell = cells[colIndex]
      const clonedCell = targetCell.type.create(targetCell.attrs, targetCell.content)
      cells.splice(colIndex + 1, 0, clonedCell)
    }
    newRows.push(rowNode.type.create(rowNode.attrs, cells))
  })

  const newTable = table.node.type.create(table.node.attrs, newRows)
  const tr = state.tr.replaceWith(table.pos, table.pos + table.node.nodeSize, newTable)
  view.dispatch(tr)
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

  const map = TableMap.get(table.node)
  if (colIndex < 0 || colIndex >= map.width) return

  const newRows: any[] = []
  table.node.forEach(rowNode => {
    const cells: any[] = []
    rowNode.forEach((cell, _, cIdx) => {
      if (cIdx === colIndex) {
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
  // Prevent moving column into or swapping with header column (index 0)
  if (colIndex <= 1) return
  const { state, view } = editor
  const table = findTable(state.selection)
  if (!table) return

  const newRows: any[] = []
  table.node.forEach(rowNode => {
    const cells: any[] = []
    rowNode.forEach(cell => cells.push(cell))
    if (colIndex < cells.length) {
      const temp = cells[colIndex]
      cells[colIndex] = cells[colIndex - 1]
      cells[colIndex - 1] = temp
    }
    newRows.push(rowNode.type.create(rowNode.attrs, cells))
  })

  const newTable = table.node.type.create(table.node.attrs, newRows)
  const tr = state.tr.replaceWith(table.pos, table.pos + table.node.nodeSize, newTable)
  view.dispatch(tr)
}

export const moveColumnRight = (editor: Editor, colIndex: number) => {
  const { state, view } = editor
  const table = findTable(state.selection)
  if (!table) return

  const map = TableMap.get(table.node)
  if (colIndex < 0 || colIndex >= map.width - 1) return

  const newRows: any[] = []
  table.node.forEach(rowNode => {
    const cells: any[] = []
    rowNode.forEach(cell => cells.push(cell))
    if (colIndex < cells.length - 1) {
      const temp = cells[colIndex]
      cells[colIndex] = cells[colIndex + 1]
      cells[colIndex + 1] = temp
    }
    newRows.push(rowNode.type.create(rowNode.attrs, cells))
  })

  const newTable = table.node.type.create(table.node.attrs, newRows)
  const tr = state.tr.replaceWith(table.pos, table.pos + table.node.nodeSize, newTable)
  view.dispatch(tr)
}

