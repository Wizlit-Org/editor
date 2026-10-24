import { Table as TiptapTable } from '@tiptap/extension-table'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { CellSelection, TableMap } from '@tiptap/pm/tables'
import { findTable, isCellSelection } from './utils'
import { expandRectToMergedCells } from './utils/TableClusterUtils'

export interface TableGripSelectionState {
  tablePos: number
  type: 'col' | 'row'
  min: number
  max: number
}

export const tableGripPluginKey = new PluginKey<TableGripSelectionState | null>('tableGripPlugin')

export const Table = TiptapTable.extend({
  addProseMirrorPlugins() {
    return [
      ...(this.parent?.() || []),
      new Plugin({
        key: tableGripPluginKey,
        state: {
          init() {
            return null
          },
          apply(tr, prev) {
            const meta = tr.getMeta(tableGripPluginKey) || tr.getMeta('gripSelection')
            if (meta !== undefined) {
              return meta
            }
            if (tr.selectionSet && !tr.getMeta('isGripSelection') && !tr.getMeta('gripSelection')) {
              return null
            }
            return prev
          },
        },
      }),
      new Plugin({
        key: new PluginKey('tableMergedSelectionExpander'),
        appendTransaction(transactions, oldState, newState) {
          // If transaction marked as grip selection, or not CellSelection, do not expand
          const gripSel = tableGripPluginKey.getState(newState)
          const isGripSelection = transactions.some(tr => tr.getMeta('isGripSelection') || tr.getMeta('gripSelection'))
          const { selection, doc } = newState
          if (gripSel || isGripSelection || !isCellSelection(selection)) return null

          const table = findTable(selection)
          if (!table) return null

          try {
            const map = TableMap.get(table.node)
            const tableStart = selection.$anchorCell.start(-1)
            const curAnchorOffset = selection.$anchorCell.pos - tableStart
            const curHeadOffset = selection.$headCell.pos - tableStart
            const rawRect = map.rectBetween(curAnchorOffset, curHeadOffset)

            const expRect = expandRectToMergedCells(table.node, rawRect)
            const isExpanded =
              expRect.left !== rawRect.left ||
              expRect.right !== rawRect.right ||
              expRect.top !== rawRect.top ||
              expRect.bottom !== rawRect.bottom

            if (!isExpanded) return null

            // Find diagonal cell positions whose rectBetween exactly encloses expRect
            let anchorOffset = map.map[expRect.top * map.width + expRect.left]
            let headOffset = map.map[(expRect.bottom - 1) * map.width + (expRect.right - 1)]
            const testRect = map.rectBetween(anchorOffset, headOffset)

            if (
              testRect.left !== expRect.left ||
              testRect.right !== expRect.right ||
              testRect.top !== expRect.top ||
              testRect.bottom !== expRect.bottom
            ) {
              const trOffset = map.map[expRect.top * map.width + (expRect.right - 1)]
              const blOffset = map.map[(expRect.bottom - 1) * map.width + expRect.left]
              const trblRect = map.rectBetween(trOffset, blOffset)
              if (
                trblRect.left === expRect.left &&
                trblRect.right === expRect.right &&
                trblRect.top === expRect.top &&
                trblRect.bottom === expRect.bottom
              ) {
                anchorOffset = trOffset
                headOffset = blOffset
              }
            }

            const anchorPos = tableStart + anchorOffset
            const headPos = tableStart + headOffset

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
