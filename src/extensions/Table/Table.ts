import { Table as TiptapTable } from '@tiptap/extension-table'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { CellSelection, TableMap } from '@tiptap/pm/tables'
import { findTable, isCellSelection } from './utils'
import { expandRectToMergedCells } from './utils/TableClusterUtils'

export const Table = TiptapTable.extend({
  addProseMirrorPlugins() {
    return [
      ...(this.parent?.() || []),
      new Plugin({
        key: new PluginKey('tableMergedSelectionExpander'),
        appendTransaction(transactions, oldState, newState) {
          // If transaction marked as grip selection, or not CellSelection, do not expand
          const isGripSelection = transactions.some(tr => tr.getMeta('isGripSelection'))
          const { selection, doc } = newState
          if (isGripSelection || !isCellSelection(selection)) return null

          // If it is a full row or full col selection from grip, do not auto-expand
          if (selection.isRowSelection() || selection.isColSelection()) return null

          const table = findTable(selection)
          if (!table) return null

          try {
            const map = TableMap.get(table.node)
            const tableStart = selection.$anchorCell.start(-1)
            const anchorOffset = selection.$anchorCell.pos - tableStart
            const headOffset = selection.$headCell.pos - tableStart
            const rawRect = map.rectBetween(anchorOffset, headOffset)

            const expRect = expandRectToMergedCells(table.node, rawRect)
            const isExpanded =
              expRect.left !== rawRect.left ||
              expRect.right !== rawRect.right ||
              expRect.top !== rawRect.top ||
              expRect.bottom !== rawRect.bottom

            if (!isExpanded) return null

            // Find top-left and bottom-right cell positions in expanded rect
            const topLeftOffset = map.map[expRect.top * map.width + expRect.left]
            const bottomRightOffset = map.map[(expRect.bottom - 1) * map.width + (expRect.right - 1)]
            const anchorPos = tableStart + topLeftOffset
            const headPos = tableStart + bottomRightOffset

            if (selection.$anchorCell.pos === anchorPos && selection.$headCell.pos === headPos) {
              return null
            }

            const newSel = new CellSelection(doc.resolve(anchorPos), doc.resolve(headPos))
            if (newSel.eq(selection)) return null

            return newState.tr.setSelection(newSel)
          } catch {
            return null
          }
        },
      }),
    ]
  },
}).configure({ resizable: true, lastColumnResizable: false })

export default Table
