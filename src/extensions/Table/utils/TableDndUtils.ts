import { Editor } from '@tiptap/core'
import { TableMap } from '@tiptap/pm/tables'
import { Node } from '@tiptap/pm/model'

/**
 * Returns the unified row index range [start, count] including all interconnected merged cells (rowspan > 1).
 */
export function getMergedRowRange(tableNode: Node, rowIndex: number): { start: number; count: number } {
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
 * Returns the unified column index range [start, count] including all interconnected merged cells (colspan > 1).
 */
export function getMergedColRange(tableNode: Node, colIndex: number): { start: number; count: number } {
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
 * Move / Swap column from sourceIndex to targetIndex in the table at tablePos.
 * Automatically bundles merged columns and preserves tableHeader / tableCell structure based on dynamic slot positions.
 */
export function moveTableColumn(editor: Editor, tablePos: number, fromIndex: number, toIndex: number): boolean {
  if (fromIndex === toIndex || tablePos < 0) return false
  const { state, view } = editor
  const tableNode = state.doc.nodeAt(tablePos)
  if (!tableNode || tableNode.type.name !== 'table') return false

  try {
    const map = TableMap.get(tableNode)
    if (fromIndex < 0 || fromIndex >= map.width || toIndex < 0 || toIndex >= map.width) return false

    const cellType = state.schema.nodes.tableCell
    const headerType = state.schema.nodes.tableHeader || cellType

    const firstRow = tableNode.child(0)
    const hasHeaderRow = firstRow.child(0).type.spec.tableRole === 'header_cell'
    let hasHeaderCol = true
    tableNode.forEach(row => {
      if (row.child(0).type.spec.tableRole !== 'header_cell') hasHeaderCol = false
    })

    const bundle = getMergedColRange(tableNode, fromIndex)
    const rows: any[] = []

    tableNode.forEach((rowNode, _, rIdx) => {
      if (rowNode.type.name === 'tableRow') {
        const cells: any[] = []
        rowNode.forEach(cell => cells.push(cell))

        if (bundle.start < cells.length) {
          const movedCells = cells.splice(bundle.start, bundle.count)
          const insertIdx = toIndex > bundle.start ? Math.max(0, toIndex - bundle.count + 1) : toIndex
          cells.splice(insertIdx, 0, ...movedCells)
        }

        const normalizedCells: any[] = []
        cells.forEach((cell, cIdx) => {
          const isHeader = (hasHeaderRow && rIdx === 0) || (hasHeaderCol && cIdx === 0)
          const targetType = isHeader ? headerType : cellType
          normalizedCells.push(targetType.create(cell.attrs, cell.content))
        })

        rows.push(rowNode.type.create(rowNode.attrs, normalizedCells))
      }
    })

    const newTableNode = tableNode.type.create(tableNode.attrs, rows)
    const tr = state.tr.replaceWith(tablePos, tablePos + tableNode.nodeSize, newTableNode)
    view.dispatch(tr)
    return true
  } catch (err) {
    console.error('Failed to move table column', err)
    return false
  }
}

/**
 * Move / Swap row from sourceIndex to targetIndex in the table at tablePos.
 * Automatically bundles merged rows and preserves tableHeader / tableCell structure based on dynamic slot positions.
 */
export function moveTableRow(editor: Editor, tablePos: number, fromIndex: number, toIndex: number): boolean {
  if (fromIndex === toIndex || tablePos < 0) return false
  const { state, view } = editor
  const tableNode = state.doc.nodeAt(tablePos)
  if (!tableNode || tableNode.type.name !== 'table') return false

  try {
    const map = TableMap.get(tableNode)
    if (fromIndex < 0 || fromIndex >= map.height || toIndex < 0 || toIndex >= map.height) return false

    const cellType = state.schema.nodes.tableCell
    const headerType = state.schema.nodes.tableHeader || cellType

    const firstRow = tableNode.child(0)
    const hasHeaderRow = firstRow.child(0).type.spec.tableRole === 'header_cell'
    let hasHeaderCol = true
    tableNode.forEach(row => {
      if (row.child(0).type.spec.tableRole !== 'header_cell') hasHeaderCol = false
    })

    const bundle = getMergedRowRange(tableNode, fromIndex)
    const rows: any[] = []
    tableNode.forEach(row => rows.push(row))

    if (bundle.start < rows.length) {
      const movedRows = rows.splice(bundle.start, bundle.count)
      const insertIdx = toIndex > bundle.start ? Math.max(0, toIndex - bundle.count + 1) : toIndex
      rows.splice(insertIdx, 0, ...movedRows)
    }

    const normalizedRows: any[] = []
    rows.forEach((rowNode, rIdx) => {
      const normalizedCells: any[] = []
      rowNode.forEach((cell: any, _: any, cIdx: number) => {
        const isHeader = (hasHeaderRow && rIdx === 0) || (hasHeaderCol && cIdx === 0)
        const targetType = isHeader ? headerType : cellType
        normalizedCells.push(targetType.create(cell.attrs, cell.content))
      })
      normalizedRows.push(rowNode.type.create(rowNode.attrs, normalizedCells))
    })

    const newTableNode = tableNode.type.create(tableNode.attrs, normalizedRows)
    const tr = state.tr.replaceWith(tablePos, tablePos + tableNode.nodeSize, newTableNode)
    view.dispatch(tr)
    return true
  } catch (err) {
    console.error('Failed to move table row', err)
    return false
  }
}
