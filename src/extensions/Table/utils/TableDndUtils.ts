import { Editor } from '@tiptap/core'
import { TableMap } from '@tiptap/pm/tables'

/**
 * Move / Swap column from sourceIndex to targetIndex in the table at tablePos.
 * Automatically preserves tableHeader / tableCell structure based on dynamic slot positions.
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

    // Check if table currently has header row / column
    const firstRow = tableNode.child(0)
    const hasHeaderRow = firstRow.child(0).type.spec.tableRole === 'header_cell'
    let hasHeaderCol = true
    tableNode.forEach(row => {
      if (row.child(0).type.spec.tableRole !== 'header_cell') hasHeaderCol = false
    })

    const rows: any[] = []
    tableNode.forEach((rowNode, _, rIdx) => {
      if (rowNode.type.name === 'tableRow') {
        const cells: any[] = []
        rowNode.forEach(cell => cells.push(cell))
        if (fromIndex < cells.length && toIndex < cells.length) {
          const [movedCell] = cells.splice(fromIndex, 1)
          cells.splice(toIndex, 0, movedCell)
        }

        // Dynamically normalize cell type to match slot
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
 * Automatically preserves tableHeader / tableCell structure based on dynamic slot positions.
 */
export function moveTableRow(editor: Editor, tablePos: number, fromIndex: number, toIndex: number): boolean {
  if (fromIndex === toIndex || tablePos < 0) return false
  const { state, view } = editor
  const tableNode = state.doc.nodeAt(tablePos)
  if (!tableNode || tableNode.type.name !== 'table') return false

  try {
    const rows: any[] = []
    tableNode.forEach(row => rows.push(row))
    if (fromIndex < 0 || fromIndex >= rows.length || toIndex < 0 || toIndex >= rows.length) return false

    const cellType = state.schema.nodes.tableCell
    const headerType = state.schema.nodes.tableHeader || cellType

    // Check if table currently has header row / column
    const firstRow = tableNode.child(0)
    const hasHeaderRow = firstRow.child(0).type.spec.tableRole === 'header_cell'
    let hasHeaderCol = true
    tableNode.forEach(row => {
      if (row.child(0).type.spec.tableRole !== 'header_cell') hasHeaderCol = false
    })

    const [movedRow] = rows.splice(fromIndex, 1)
    rows.splice(toIndex, 0, movedRow)

    // Dynamically normalize cell type to match slot
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
