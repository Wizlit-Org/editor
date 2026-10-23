import { Editor } from '@tiptap/core'
import { TableMap } from '@tiptap/pm/tables'
import { getClusterRowRange, getClusterColRange } from './TableClusterUtils'

export { getClusterRowRange as getMergedRowRange, getClusterColRange as getMergedColRange } from './TableClusterUtils'

/**
 * Move / Swap column from sourceIndex to targetIndex in the table at tablePos.
 * Strictly enforces TableMap coordinate mapping (no row.child(colIndex) calls) to support merged cells flawlessly.
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

    const bundle = getClusterColRange(tableNode, fromIndex)

    // Build reordered column indices array
    const originalCols: number[] = []
    for (let c = 0; c < map.width; c++) originalCols.push(c)
    const movedCols = originalCols.splice(bundle.start, bundle.count)
    const insertIdx = toIndex > bundle.start ? Math.max(0, toIndex - bundle.count + 1) : toIndex
    originalCols.splice(insertIdx, 0, ...movedCols)
    const newColOrder = originalCols

    const rows: any[] = []
    for (let r = 0; r < map.height; r++) {
      const cells: any[] = []
      const seenPos = new Set<number>()

      newColOrder.forEach((oldCol, newColIdx) => {
        const cellPos = map.map[r * map.width + oldCol]
        const rect = map.findCell(cellPos)

        if (rect.top === r && !seenPos.has(cellPos)) {
          seenPos.add(cellPos)
          const cellNode = tableNode.nodeAt(cellPos)
          if (cellNode) {
            const isHeader = (hasHeaderRow && r === 0) || (hasHeaderCol && newColIdx === 0)
            const targetType = isHeader ? headerType : cellType
            cells.push(targetType.create(cellNode.attrs, cellNode.content))
          }
        }
      })

      const rowNode = tableNode.child(r)
      rows.push(rowNode.type.create(rowNode.attrs, cells))
    }

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
 * Bundles merged rows and preserves tableHeader / tableCell structure based on dynamic slot positions.
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

    const bundle = getClusterRowRange(tableNode, fromIndex)
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
