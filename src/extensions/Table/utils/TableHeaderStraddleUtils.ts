import { Node } from '@tiptap/pm/model'
import { Editor } from '@tiptap/core'
import { TableMap } from '@tiptap/pm/tables'
import { findTable, isCellSelection } from '../utils'
import { getClusterRowRange, getClusterColRange } from './TableClusterUtils'

/**
 * Checks if the table has a header row (first row consists of tableHeader cells).
 */
export function hasHeaderRow(tableNode: Node): boolean {
  try {
    if (!tableNode || tableNode.childCount === 0) return false
    const firstRow = tableNode.child(0)
    if (!firstRow || firstRow.childCount === 0) return false
    return firstRow.child(0).type.spec.tableRole === 'header_cell'
  } catch {
    return false
  }
}

/**
 * Checks if the table has a header column (first column in all rows consists of tableHeader cells).
 */
export function hasHeaderCol(tableNode: Node): boolean {
  try {
    if (!tableNode || tableNode.childCount === 0) return false
    let hasCol = true
    tableNode.forEach(row => {
      if (row.childCount === 0 || row.child(0).type.spec.tableRole !== 'header_cell') {
        hasCol = false
      }
    })
    return hasCol
  } catch {
    return false
  }
}

/**
 * Checks if moving a row or column bundle from sourceIndex to targetIndex would straddle the header/body boundary.
 *
 * Rules:
 * - If hasHeaderRow and moving rows:
 *   A merged row cluster (count > 1) cannot span both row 0 (header) and row >= 1 (body).
 *   Target destination span will be [targetStart, targetStart + count - 1].
 *   If targetStart <= 0 && targetStart + count - 1 >= 1, it straddles!
 * - If hasHeaderCol and moving cols:
 *   A merged col cluster (count > 1) cannot span both col 0 (header) and col >= 1 (body).
 *   Target destination span will be [targetStart, targetStart + count - 1].
 *   If targetStart <= 0 && targetStart + count - 1 >= 1, it straddles!
 */
export function isHeaderStraddling(
  tableNode: Node,
  type: 'col' | 'row',
  sourceIndex: number,
  targetIndex: number,
): boolean {
  try {
    if (type === 'row') {
      if (!hasHeaderRow(tableNode)) return false
      const cluster = getClusterRowRange(tableNode, sourceIndex)
      if (cluster.count <= 1) {
        return false
      }
      const targetStart = targetIndex
      const targetEnd = targetIndex + cluster.count - 1
      if (targetStart <= 0 && targetEnd >= 1) {
        return true
      }
      return false
    } else {
      if (!hasHeaderCol(tableNode)) return false
      const cluster = getClusterColRange(tableNode, sourceIndex)
      if (cluster.count <= 1) {
        return false
      }
      const targetStart = targetIndex
      const targetEnd = targetIndex + cluster.count - 1
      if (targetStart <= 0 && targetEnd >= 1) {
        return true
      }
      return false
    }
  } catch {
    return false
  }
}

/**
 * Checks if the current CellSelection straddles the header boundary for merging.
 * Merging within header row (row 0 to row 0) is ALLOWED.
 * Merging within header col (col 0 to col 0) is ALLOWED.
 * Merging that spans row 0 and row >= 1 (with header row) is BLOCKED.
 * Merging that spans col 0 and col >= 1 (with header col) is BLOCKED.
 */
export function isSelectionStraddlingHeader(editor: Editor): boolean {
  const { selection } = editor.state
  const table = findTable(selection)
  if (!table || !isCellSelection(selection)) return false

  try {
    const map = TableMap.get(table.node)
    const start = selection.$anchorCell.start(-1)
    const rect = map.rectBetween(selection.$anchorCell.pos - start, selection.$headCell.pos - start)

    // Check row header straddling: rect.top == 0 and rect.bottom > 1
    if (hasHeaderRow(table.node)) {
      if (rect.top === 0 && rect.bottom > 1) {
        return true
      }
    }

    // Check col header straddling: rect.left == 0 and rect.right > 1
    if (hasHeaderCol(table.node)) {
      if (rect.left === 0 && rect.right > 1) {
        return true
      }
    }

    return false
  } catch {
    return false
  }
}

/**
 * Extracts snippet text from cells in the specified row or col cluster for the drag ghost preview.
 */
export function extractCellTextSnippets(
  tableNode: Node,
  type: 'col' | 'row',
  index: number,
  maxSnippets = 4,
): string[] {
  const snippets: string[] = []
  try {
    const map = TableMap.get(tableNode)
    if (type === 'row') {
      const r = Math.max(0, Math.min(index, map.height - 1))
      for (let c = 0; c < map.width && snippets.length < maxSnippets; c++) {
        const cellPos = map.map[r * map.width + c]
        const cellNode = tableNode.nodeAt(cellPos)
        if (cellNode) {
          const rawText = cellNode.textContent.trim()
          snippets.push(rawText.length > 8 ? `${rawText.slice(0, 8)}…` : rawText || '(빈 셀)')
        }
      }
    } else {
      const c = Math.max(0, Math.min(index, map.width - 1))
      for (let r = 0; r < map.height && snippets.length < maxSnippets; r++) {
        const cellPos = map.map[r * map.width + c]
        const cellNode = tableNode.nodeAt(cellPos)
        if (cellNode) {
          const rawText = cellNode.textContent.trim()
          snippets.push(rawText.length > 8 ? `${rawText.slice(0, 8)}…` : rawText || '(빈 셀)')
        }
      }
    }
  } catch {}
  return snippets
}

/**
 * Checks if the row selection [startRow..endRow] contains any merged cells (rowspan > 1 or colspan > 1).
 * If true, row move is strictly blocked.
 */
/**
 * Checks if any merged cell straddles (crosses) the row selection boundary [startRow..endRow].
 * If a merged cell is entirely contained within the selection, it is allowed to move!
 * Only blocked if a merged cell partially sticks out (rect.top < minR || rect.bottom - 1 > maxR).
 */
export function hasMergedCellsInRowSelection(tableNode: Node, startRow: number, endRow: number): boolean {
  try {
    const map = TableMap.get(tableNode)
    const minR = Math.max(0, Math.min(startRow, endRow))
    const maxR = Math.min(map.height - 1, Math.max(startRow, endRow))

    for (let r = minR; r <= maxR; r++) {
      for (let c = 0; c < map.width; c++) {
        const cellPos = map.map[r * map.width + c]
        const rect = map.findCell(cellPos)
        if (rect.top < minR || rect.bottom - 1 > maxR) {
          return true
        }
      }
    }
    return false
  } catch {
    return false
  }
}

/**
 * Checks if any merged cell straddles (crosses) the col selection boundary [startCol..endCol].
 * If a merged cell is entirely contained within the selection, it is allowed to move!
 * Only blocked if a merged cell partially sticks out (rect.left < minC || rect.right - 1 > maxC).
 */
export function hasMergedCellsInColSelection(tableNode: Node, startCol: number, endCol: number): boolean {
  try {
    const map = TableMap.get(tableNode)
    const minC = Math.max(0, Math.min(startCol, endCol))
    const maxC = Math.min(map.width - 1, Math.max(startCol, endCol))

    for (let c = minC; c <= maxC; c++) {
      for (let r = 0; r < map.height; r++) {
        const cellPos = map.map[r * map.width + c]
        const rect = map.findCell(cellPos)
        if (rect.left < minC || rect.right - 1 > maxC) {
          return true
        }
      }
    }
    return false
  } catch {
    return false
  }
}

/**
 * Checks if targetIndex cuts through the middle of any merged cell in the table.
 * If targetIndex splits any cell (rect.top < targetIndex && targetIndex < rect.bottom for row,
 * or rect.left < targetIndex && targetIndex < rect.right for col), return true.
 */
export function isTargetSplittingMergedCell(
  tableNode: Node,
  type: 'col' | 'row',
  targetIndex: number,
): boolean {
  try {
    const map = TableMap.get(tableNode)
    if (type === 'row') {
      for (let r = 0; r < map.height; r++) {
        for (let c = 0; c < map.width; c++) {
          const cellPos = map.map[r * map.width + c]
          const rect = map.findCell(cellPos)
          if (rect.top < targetIndex && targetIndex < rect.bottom) {
            return true
          }
        }
      }
    } else {
      for (let r = 0; r < map.height; r++) {
        for (let c = 0; c < map.width; c++) {
          const cellPos = map.map[r * map.width + c]
          const rect = map.findCell(cellPos)
          if (rect.left < targetIndex && targetIndex < rect.right) {
            return true
          }
        }
      }
    }
    return false
  } catch {
    return false
  }
}

/**
 * Checks if the current selection contains at least one merged cell (for batch split).
 * Inspects all cells in the selection rectangle via TableMap 2D grid coordinates.
 */
export function hasMergedCellsInSelection(editor: Editor): boolean {
  const { selection } = editor.state
  const table = findTable(selection)
  if (!table) return false

  if (isCellSelection(selection)) {
    try {
      const map = TableMap.get(table.node)
      const selStart = selection.$anchorCell.start(-1)
      const rect = map.rectBetween(
        selection.$anchorCell.pos - selStart,
        selection.$headCell.pos - selStart,
      )
      for (let r = rect.top; r < rect.bottom; r++) {
        for (let c = rect.left; c < rect.right; c++) {
          const cellPos = map.map[r * map.width + c]
          const cellRect = map.findCell(cellPos)
          if (cellRect.right - cellRect.left > 1 || cellRect.bottom - cellRect.top > 1) {
            return true
          }
          const cellNode = table.node.nodeAt(cellPos)
          if (cellNode && ((cellNode.attrs.colspan && cellNode.attrs.colspan > 1) || (cellNode.attrs.rowspan && cellNode.attrs.rowspan > 1))) {
            return true
          }
        }
      }
    } catch {}

    let hasMerged = false
    selection.forEachCell((node: any) => {
      if ((node.attrs.colspan && node.attrs.colspan > 1) || (node.attrs.rowspan && node.attrs.rowspan > 1)) {
        hasMerged = true
      }
    })
    return hasMerged
  }

  const $pos = selection.$from
  for (let d = $pos.depth; d > 0; d--) {
    const n = $pos.node(d)
    if (n.type.spec.tableRole === 'cell' || n.type.spec.tableRole === 'header_cell') {
      return (n.attrs.colspan && n.attrs.colspan > 1) || (n.attrs.rowspan && n.attrs.rowspan > 1)
    }
  }
  return false
}

