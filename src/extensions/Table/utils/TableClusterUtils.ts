import { Editor } from '@tiptap/core'
import { TableMap, CellSelection } from '@tiptap/pm/tables'
import { Node } from '@tiptap/pm/model'
import { Transaction, TextSelection } from '@tiptap/pm/state'
import { findTable, selectColumn, selectRow } from '../utils'

/**
 * Returns transitive-closure row range [start, count] including all interconnected merged cells (rowspan > 1).
 */
export function getClusterRowRange(tableNode: Node, rowIndex: number): { start: number; count: number } {
  try {
    const map = TableMap.get(tableNode)
    if (rowIndex < 0 || rowIndex >= map.height) return { start: rowIndex, count: 1 }

    let minRow = rowIndex
    let maxRow = rowIndex + 1

    let changed = true
    while (changed) {
      changed = false
      const cells = map.cellsInRect({ left: 0, right: map.width, top: minRow, bottom: maxRow })
      for (const cellPos of cells) {
        const rect = map.findCell(cellPos)
        if (rect.top < minRow) {
          minRow = rect.top
          changed = true
        }
        if (rect.bottom > maxRow) {
          maxRow = rect.bottom
          changed = true
        }
      }
    }
    return { start: minRow, count: maxRow - minRow }
  } catch {
    return { start: rowIndex, count: 1 }
  }
}

/**
 * Returns transitive-closure column range [start, count] including all interconnected merged cells (colspan > 1).
 */
export function getClusterColRange(tableNode: Node, colIndex: number): { start: number; count: number } {
  try {
    const map = TableMap.get(tableNode)
    if (colIndex < 0 || colIndex >= map.width) return { start: colIndex, count: 1 }

    let minCol = colIndex
    let maxCol = colIndex + 1

    let changed = true
    while (changed) {
      changed = false
      const cells = map.cellsInRect({ left: minCol, right: maxCol, top: 0, bottom: map.height })
      for (const cellPos of cells) {
        const rect = map.findCell(cellPos)
        if (rect.left < minCol) {
          minCol = rect.left
          changed = true
        }
        if (rect.right > maxCol) {
          maxCol = rect.right
          changed = true
        }
      }
    }
    return { start: minCol, count: maxCol - minCol }
  } catch {
    return { start: colIndex, count: 1 }
  }
}

/**
 * Snap target drop index to cluster outer boundary (prevents mid-span split).
 */
export function findSafeDropIndex(tableNode: Node, type: 'row' | 'col', targetIndex: number): number {
  const map = TableMap.get(tableNode)
  const maxLimit = type === 'row' ? map.height : map.width
  if (targetIndex <= 0) return 0
  if (targetIndex >= maxLimit) return maxLimit - 1

  const cluster = type === 'row' ? getClusterRowRange(tableNode, targetIndex) : getClusterColRange(tableNode, targetIndex)
  if (cluster.count > 1 && targetIndex > cluster.start && targetIndex < cluster.start + cluster.count) {
    const mid = cluster.start + cluster.count / 2
    return targetIndex < mid ? cluster.start : Math.min(maxLimit - 1, cluster.start + cluster.count)
  }
  return targetIndex
}

/**
 * Calculates jump-over destination index for menu moves (up/down/left/right) across merged bundles.
 */
export function findJumpMoveIndex(
  tableNode: Node,
  type: 'row' | 'col',
  currentIndex: number,
  direction: 'prev' | 'next',
): number {
  const map = TableMap.get(tableNode)
  const maxLimit = type === 'row' ? map.height : map.width
  const currentCluster =
    type === 'row' ? getClusterRowRange(tableNode, currentIndex) : getClusterColRange(tableNode, currentIndex)

  if (direction === 'prev') {
    const target = currentCluster.start - 1
    if (target < 0) return -1
    const targetCluster = type === 'row' ? getClusterRowRange(tableNode, target) : getClusterColRange(tableNode, target)
    return targetCluster.start
  } else {
    const target = currentCluster.start + currentCluster.count
    if (target >= maxLimit) return -1
    const targetCluster = type === 'row' ? getClusterRowRange(tableNode, target) : getClusterColRange(tableNode, target)
    return targetCluster.start + targetCluster.count - 1
  }
}

/**
 * Deep clones row cluster [minRow, maxRow] and inserts immediately after maxRow.
 */
export function duplicateRowCluster(editor: Editor, minRow: number, maxRow: number): boolean {
  const { state, view } = editor
  const table = findTable(state.selection)
  if (!table) return false

  const rows: any[] = []
  table.node.forEach(row => rows.push(row))
  if (minRow < 0 || maxRow >= rows.length || minRow > maxRow) return false

  const cellType = state.schema.nodes.tableCell
  const clonedRows: any[] = []

  for (let r = minRow; r <= maxRow; r++) {
    const targetRow = rows[r]
    const clonedCells: any[] = []
    targetRow.forEach((cell: any) => {
      const type = cell.type.spec.tableRole === 'header_cell' ? cellType : cell.type
      clonedCells.push(type.create(cell.attrs, cell.content))
    })
    clonedRows.push(targetRow.type.create(targetRow.attrs, clonedCells))
  }

  const newRows = [...rows.slice(0, maxRow + 1), ...clonedRows, ...rows.slice(maxRow + 1)]
  const newTable = table.node.type.create(table.node.attrs, newRows)
  const tr = state.tr.replaceWith(table.pos, table.pos + table.node.nodeSize, newTable)
  view.dispatch(tr)
  return true
}

/**
 * Deep clones col cluster [minCol, maxCol] and inserts immediately after maxCol.
 */
export function duplicateColCluster(editor: Editor, minCol: number, maxCol: number): boolean {
  const { state, view } = editor
  const table = findTable(state.selection)
  if (!table) return false

  const newRows: any[] = []
  table.node.forEach(rowNode => {
    const cells: any[] = []
    rowNode.forEach(cell => cells.push(cell))
    if (minCol < cells.length) {
      const clonedCells: any[] = []
      for (let c = minCol; c <= Math.min(maxCol, cells.length - 1); c++) {
        const targetCell = cells[c]
        clonedCells.push(targetCell.type.create(targetCell.attrs, targetCell.content))
      }
      cells.splice(maxCol + 1, 0, ...clonedCells)
    }
    newRows.push(rowNode.type.create(rowNode.attrs, cells))
  })

  const newTable = table.node.type.create(table.node.attrs, newRows)
  const tr = state.tr.replaceWith(table.pos, table.pos + table.node.nodeSize, newTable)
  view.dispatch(tr)
  return true
}

/**
 * Batch deletes row cluster [minRow, maxRow].
 */
export function deleteRowCluster(editor: Editor, minRow: number, maxRow: number): boolean {
  const { state, view } = editor
  const table = findTable(state.selection)
  if (!table) return false

  const rows: any[] = []
  table.node.forEach(row => rows.push(row))
  if (minRow < 0 || maxRow >= rows.length || minRow > maxRow) return false

  if (minRow === 0 && maxRow === rows.length - 1) {
    editor.chain().focus().deleteTable().run()
    return true
  }

  rows.splice(minRow, maxRow - minRow + 1)
  const newTable = table.node.type.create(table.node.attrs, rows)
  const tr = state.tr.replaceWith(table.pos, table.pos + table.node.nodeSize, newTable)
  view.dispatch(tr)
  return true
}

/**
 * Batch deletes col cluster [minCol, maxCol].
 */
export function deleteColCluster(editor: Editor, minCol: number, maxCol: number): boolean {
  const { state, view } = editor
  const table = findTable(state.selection)
  if (!table) return false

  const map = TableMap.get(table.node)
  if (minCol === 0 && maxCol === map.width - 1) {
    editor.chain().focus().deleteTable().run()
    return true
  }

  const count = maxCol - minCol + 1
  const newRows: any[] = []
  table.node.forEach(rowNode => {
    const cells: any[] = []
    rowNode.forEach(cell => cells.push(cell))
    if (minCol < cells.length) {
      cells.splice(minCol, count)
    }
    newRows.push(rowNode.type.create(rowNode.attrs, cells))
  })

  const newTable = table.node.type.create(table.node.attrs, newRows)
  const tr = state.tr.replaceWith(table.pos, table.pos + table.node.nodeSize, newTable)
  view.dispatch(tr)
  return true
}

/**
 * Selects row range [minRow, maxRow] in transaction.
 */
export function selectRowRange(tr: Transaction, minRow: number, maxRow: number): Transaction {
  const table = findTable(tr.selection)
  if (!table) return tr

  const map = TableMap.get(table.node)
  const safeMin = Math.max(0, Math.min(minRow, maxRow))
  const safeMax = Math.min(map.height - 1, Math.max(minRow, maxRow))

  const cellsFirst = map.cellsInRect({ left: 0, right: map.width, top: safeMin, bottom: safeMin + 1 })
  const cellsLast = map.cellsInRect({ left: 0, right: map.width, top: safeMax, bottom: safeMax + 1 })

  if (cellsFirst.length === 0 || cellsLast.length === 0) return tr
  const head = table.start + cellsFirst[0]
  const anchor = table.start + cellsLast[cellsLast.length - 1]
  return tr.setSelection(new CellSelection(tr.doc.resolve(anchor), tr.doc.resolve(head)))
}

/**
 * Selects col range [minCol, maxCol] in transaction.
 */
export function selectColRange(tr: Transaction, minCol: number, maxCol: number): Transaction {
  const table = findTable(tr.selection)
  if (!table) return tr

  const map = TableMap.get(table.node)
  const safeMin = Math.max(0, Math.min(minCol, maxCol))
  const safeMax = Math.min(map.width - 1, Math.max(minCol, maxCol))

  const cellsFirst = map.cellsInRect({ left: safeMin, right: safeMin + 1, top: 0, bottom: map.height })
  const cellsLast = map.cellsInRect({ left: safeMax, right: safeMax + 1, top: 0, bottom: map.height })

  if (cellsFirst.length === 0 || cellsLast.length === 0) return tr
  const head = table.start + cellsFirst[0]
  const anchor = table.start + cellsLast[cellsLast.length - 1]
  return tr.setSelection(new CellSelection(tr.doc.resolve(anchor), tr.doc.resolve(head)))
}

/**
 * Focus and select a table column or row with table focus recovery.
 */
export function focusTableGrip(
  editor: Editor,
  type: 'col' | 'row',
  index: number,
  currentTableEl: HTMLElement | null,
  tablePos: number,
): void {
  try {
    let tr = editor.state.tr
    if (!findTable(tr.selection)) {
      let targetPos = -1
      if (currentTableEl) {
        const firstCell = currentTableEl.querySelector('td, th')
        if (firstCell) targetPos = editor.view.posAtDOM(firstCell, 0)
      }
      if (targetPos < 0 && tablePos >= 0) targetPos = tablePos + 2
      if (targetPos >= 0) {
        tr = tr.setSelection(TextSelection.near(tr.doc.resolve(targetPos)))
      }
    }
    const newTr = type === 'col' ? selectColumn(index)(tr) : selectRow(index)(tr)
    editor.view.dispatch(newTr)
    editor.view.dom.focus({ preventScroll: true })
  } catch (err) {
    console.error(`Error selecting ${type}:`, err)
  }
}
