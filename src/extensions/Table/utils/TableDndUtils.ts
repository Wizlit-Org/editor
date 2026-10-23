import { Editor } from '@tiptap/core'
import { TableMap } from '@tiptap/pm/tables'

/**
 * Move / Swap column from sourceIndex to targetIndex in the table at tablePos
 */
export function moveTableColumn(editor: Editor, tablePos: number, fromIndex: number, toIndex: number): boolean {
  // Prevent moving header column (index 0) or moving another column into the header position
  if (fromIndex === toIndex || tablePos < 0 || fromIndex === 0 || toIndex === 0) return false
  const { state, view } = editor
  const tableNode = state.doc.nodeAt(tablePos)
  if (!tableNode || tableNode.type.name !== 'table') return false

  try {
    const map = TableMap.get(tableNode)
    if (fromIndex < 0 || fromIndex >= map.width || toIndex < 0 || toIndex >= map.width) return false

    const rows: any[] = []
    tableNode.forEach(rowNode => {
      if (rowNode.type.name === 'tableRow') {
        const cells: any[] = []
        rowNode.forEach(cell => cells.push(cell))
        if (fromIndex < cells.length && toIndex < cells.length) {
          const [movedCell] = cells.splice(fromIndex, 1)
          cells.splice(toIndex, 0, movedCell)
        }
        rows.push(rowNode.type.create(rowNode.attrs, cells))
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
 * Move / Swap row from sourceIndex to targetIndex in the table at tablePos
 */
export function moveTableRow(editor: Editor, tablePos: number, fromIndex: number, toIndex: number): boolean {
  // Prevent moving header row (index 0) or moving another row into the header position
  if (fromIndex === toIndex || tablePos < 0 || fromIndex === 0 || toIndex === 0) return false
  const { state, view } = editor
  const tableNode = state.doc.nodeAt(tablePos)
  if (!tableNode || tableNode.type.name !== 'table') return false

  try {
    const rows: any[] = []
    tableNode.forEach(row => rows.push(row))
    if (fromIndex < 0 || fromIndex >= rows.length || toIndex < 0 || toIndex >= rows.length) return false

    const [movedRow] = rows.splice(fromIndex, 1)
    rows.splice(toIndex, 0, movedRow)

    const newTableNode = tableNode.type.create(tableNode.attrs, rows)
    const tr = state.tr.replaceWith(tablePos, tablePos + tableNode.nodeSize, newTableNode)
    view.dispatch(tr)
    return true
  } catch (err) {
    console.error('Failed to move table row', err)
    return false
  }
}
