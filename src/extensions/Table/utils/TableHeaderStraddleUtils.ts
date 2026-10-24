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
