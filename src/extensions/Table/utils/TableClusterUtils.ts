import { Editor } from '@tiptap/core'
import { TableMap, CellSelection } from '@tiptap/pm/tables'
import { Node } from '@tiptap/pm/model'
import { Transaction, TextSelection } from '@tiptap/pm/state'
import { findTable, selectColumn, selectRow, isCellSelection } from '../utils'

/**
 * Returns transitive-closure row range [start, count] including all interconnected merged cells (rowspan > 1).
 * Uses TableMap.map grid coordinate scan to ensure 100% bidirectional accuracy.
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
      for (let r = minRow; r < maxRow; r++) {
        for (let c = 0; c < map.width; c++) {
          const cellPos = map.map[r * map.width + c]
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
    }
    return { start: minRow, count: maxRow - minRow }
  } catch {
    return { start: rowIndex, count: 1 }
  }
}

/**
 * Returns transitive-closure column range [start, count] including all interconnected merged cells (colspan > 1).
 * Uses TableMap.map grid coordinate scan to ensure 100% bidirectional accuracy.
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
      for (let c = minCol; c < maxCol; c++) {
        for (let r = 0; r < map.height; r++) {
          const cellPos = map.map[r * map.width + c]
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
 * Deep clones col cluster [minCol, maxCol] using TableMap coordinate mapping and inserts after maxCol.
 */
export function duplicateColCluster(editor: Editor, minCol: number, maxCol: number): boolean {
  const { state, view } = editor
  const table = findTable(state.selection)
  if (!table) return false

  const map = TableMap.get(table.node)
  if (minCol < 0 || maxCol >= map.width || minCol > maxCol) return false

  const cloneCount = maxCol - minCol + 1
  const newColIndices: number[] = []
  for (let c = 0; c <= maxCol; c++) newColIndices.push(c)
  for (let c = minCol; c <= maxCol; c++) newColIndices.push(c)
  for (let c = maxCol + 1; c < map.width; c++) newColIndices.push(c)

  const rows: any[] = []
  for (let r = 0; r < map.height; r++) {
    const cells: any[] = []
    const seenPos = new Set<number>()

    for (const c of newColIndices) {
      const cellPos = map.map[r * map.width + c]
      const rect = map.findCell(cellPos)
      if (rect.top === r && !seenPos.has(cellPos)) {
        seenPos.add(cellPos)
        const cellNode = table.node.nodeAt(cellPos)
        if (cellNode) {
          cells.push(cellNode.type.create(cellNode.attrs, cellNode.content))
        }
      }
    }
    const rowNode = table.node.child(r)
    rows.push(rowNode.type.create(rowNode.attrs, cells))
  }

  const newTable = table.node.type.create(table.node.attrs, rows)
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
 * Batch deletes col cluster [minCol, maxCol] using TableMap coordinate mapping.
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

  const remainingCols: number[] = []
  for (let c = 0; c < map.width; c++) {
    if (c < minCol || c > maxCol) remainingCols.push(c)
  }

  const rows: any[] = []
  for (let r = 0; r < map.height; r++) {
    const cells: any[] = []
    const seenPos = new Set<number>()

    for (const c of remainingCols) {
      const cellPos = map.map[r * map.width + c]
      const rect = map.findCell(cellPos)
      if (rect.top === r && !seenPos.has(cellPos)) {
        seenPos.add(cellPos)
        const cellNode = table.node.nodeAt(cellPos)
        if (cellNode) {
          cells.push(cellNode.type.create(cellNode.attrs, cellNode.content))
        }
      }
    }
    const rowNode = table.node.child(r)
    rows.push(rowNode.type.create(rowNode.attrs, cells))
  }

  const newTable = table.node.type.create(table.node.attrs, rows)
  const tr = state.tr.replaceWith(table.pos, table.pos + table.node.nodeSize, newTable)
  view.dispatch(tr)
  return true
}

/**
 * Selects row range [minRow, maxRow] in transaction using ProseMirror built-in rowSelection.
 */
export function selectRowRange(tr: Transaction, minRow: number, maxRow: number, tablePos?: number): Transaction {
  let table = null
  if (tablePos !== undefined && tablePos >= 0) {
    const node = tr.doc.nodeAt(tablePos)
    if (node && node.type.name === 'table') {
      table = { node, pos: tablePos, start: tablePos + 1 } as any
    }
  }
  if (!table) table = findTable(tr.selection)
  if (!table) return tr

  const map = TableMap.get(table.node)
  const safeMin = Math.max(0, Math.min(minRow, maxRow))
  const safeMax = Math.min(map.height - 1, Math.max(minRow, maxRow))

  const anchorPos = table.start + map.map[safeMin * map.width]
  const headPos = table.start + map.map[safeMax * map.width]
  return tr.setSelection(CellSelection.rowSelection(tr.doc.resolve(anchorPos), tr.doc.resolve(headPos))).setMeta('isGripSelection', true)
}

/**
 * Selects col range [minCol, maxCol] in transaction using ProseMirror built-in colSelection.
 */
export function selectColRange(tr: Transaction, minCol: number, maxCol: number, tablePos?: number): Transaction {
  let table = null
  if (tablePos !== undefined && tablePos >= 0) {
    const node = tr.doc.nodeAt(tablePos)
    if (node && node.type.name === 'table') {
      table = { node, pos: tablePos, start: tablePos + 1 } as any
    }
  }
  if (!table) table = findTable(tr.selection)
  if (!table) return tr

  const map = TableMap.get(table.node)
  const safeMin = Math.max(0, Math.min(minCol, maxCol))
  const safeMax = Math.min(map.width - 1, Math.max(minCol, maxCol))

  const anchorPos = table.start + map.map[safeMin]
  const headPos = table.start + map.map[safeMax]
  return tr.setSelection(CellSelection.colSelection(tr.doc.resolve(anchorPos), tr.doc.resolve(headPos))).setMeta('isGripSelection', true)
}

/**
 * Check if the given row or column grip index is inside the current CellSelection.
 */
export function isGripInCurrentSelection(
  editor: Editor,
  type: 'col' | 'row',
  index: number,
  activeTablePos?: number,
): boolean {
  const { selection } = editor.state
  const table = findTable(selection)
  if (!table || !isCellSelection(selection)) return false
  if (activeTablePos !== undefined && activeTablePos >= 0 && table.pos !== activeTablePos) {
    return false
  }

  try {
    const map = TableMap.get(table.node)
    const start = selection.$anchorCell.start(-1)
    const rect = map.rectBetween(selection.$anchorCell.pos - start, selection.$headCell.pos - start)
    if (type === 'col') {
      return rect.bottom - rect.top === map.height && rect.left <= index && index < rect.right
    } else {
      return rect.right - rect.left === map.width && rect.top <= index && index < rect.bottom
    }
  } catch {
    return false
  }
}

export interface TableRectBoundary {
  left: number
  right: number
  top: number
  bottom: number
}

/**
 * Expands a selection rectangle [left, top, right, bottom] using fixed-point iteration
 * so that any merged cell that straddles the boundary is fully enclosed within the rectangle.
 */
export function expandRectToMergedCells(tableNode: Node, rawRect: TableRectBoundary): TableRectBoundary {
  try {
    const map = TableMap.get(tableNode)
    const rect = { ...rawRect }
    let changed = true
    let iterations = 0

    while (changed && iterations < 15) {
      changed = false
      iterations++
      for (let r = rect.top; r < rect.bottom; r++) {
        for (let c = rect.left; c < rect.right; c++) {
          const pos = map.map[r * map.width + c]
          const cRect = map.findCell(pos)
          if (cRect.left < rect.left) {
            rect.left = cRect.left
            changed = true
          }
          if (cRect.right > rect.right) {
            rect.right = cRect.right
            changed = true
          }
          if (cRect.top < rect.top) {
            rect.top = cRect.top
            changed = true
          }
          if (cRect.bottom > rect.bottom) {
            rect.bottom = cRect.bottom
            changed = true
          }
        }
      }
    }
    return rect
  } catch {
    return rawRect
  }
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
    const currentSelTable = findTable(tr.selection)
    if (!currentSelTable || (tablePos >= 0 && currentSelTable.pos !== tablePos)) {
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
    const newTr =
      type === 'col'
        ? selectColRange(tr, index, index, tablePos)
        : selectRowRange(tr, index, index, tablePos)
    editor.view.dispatch(newTr)
    editor.view.dom.focus({ preventScroll: true })
  } catch (err) {
    console.error(`Error selecting ${type}:`, err)
  }
}

