import { findParentNode } from '@tiptap/core'
import { Selection, Transaction } from '@tiptap/pm/state'
import { CellSelection, Rect, TableMap } from '@tiptap/pm/tables'
import { Node, ResolvedPos } from '@tiptap/pm/model'

export const isRectSelected = (rect: Rect) => (selection: CellSelection) => {
  const map = TableMap.get(selection.$anchorCell.node(-1))
  const start = selection.$anchorCell.start(-1)
  const cells = map.cellsInRect(rect)
  const selectedCells = map.cellsInRect(
    map.rectBetween(selection.$anchorCell.pos - start, selection.$headCell.pos - start),
  )

  for (let i = 0, count = cells.length; i < count; i += 1) {
    if (selectedCells.indexOf(cells[i]) === -1) {
      return false
    }
  }

  return true
}

export const findTable = (selection: Selection) =>
  findParentNode(node => node.type.spec.tableRole && node.type.spec.tableRole === 'table')(selection)

export const isCellSelection = (selection: any): selection is CellSelection => {
  if (!selection) return false
  if (selection instanceof CellSelection) return true
  if (selection.key?.startsWith('cell') || selection.constructor?.name === 'CellSelection') return true
  if (selection.$anchorCell && selection.$headCell) return true
  return false
}

export const isColumnSelected = (columnIndex: number) => (selection: Selection) => {
  if (isCellSelection(selection)) {
    const map = TableMap.get(selection.$anchorCell.node(-1))

    return isRectSelected({
      left: columnIndex,
      right: columnIndex + 1,
      top: 0,
      bottom: map.height,
    })(selection)
  }

  return false
}

export const isRowSelected = (rowIndex: number) => (selection: Selection) => {
  if (isCellSelection(selection)) {
    const map = TableMap.get(selection.$anchorCell.node(-1))

    return isRectSelected({
      left: 0,
      right: map.width,
      top: rowIndex,
      bottom: rowIndex + 1,
    })(selection)
  }

  return false
}

export const isTableSelected = (selection: Selection) => {
  if (isCellSelection(selection)) {
    const map = TableMap.get(selection.$anchorCell.node(-1))

    return isRectSelected({
      left: 0,
      right: map.width,
      top: 0,
      bottom: map.height,
    })(selection)
  }

  return false
}

export const getCellsInColumn = (columnIndex: number | number[]) => (selection: Selection) => {
  const table = findTable(selection)
  if (table) {
    const map = TableMap.get(table.node)
    const indexes = Array.isArray(columnIndex) ? columnIndex : Array.from([columnIndex])

    return indexes.reduce(
      (acc, index) => {
        if (index >= 0 && index <= map.width - 1) {
          const cells = map.cellsInRect({
            left: index,
            right: index + 1,
            top: 0,
            bottom: map.height,
          })

          return acc.concat(
            cells.map(nodePos => {
              const node = table.node.nodeAt(nodePos)
              const pos = nodePos + table.start

              return { pos, start: pos + 1, node }
            }),
          )
        }

        return acc
      },
      [] as { pos: number; start: number; node: Node | null | undefined }[],
    )
  }
  return null
}

export const getCellsInRow = (rowIndex: number | number[]) => (selection: Selection) => {
  const table = findTable(selection)

  if (table) {
    const map = TableMap.get(table.node)
    const indexes = Array.isArray(rowIndex) ? rowIndex : Array.from([rowIndex])

    return indexes.reduce(
      (acc, index) => {
        if (index >= 0 && index <= map.height - 1) {
          const cells = map.cellsInRect({
            left: 0,
            right: map.width,
            top: index,
            bottom: index + 1,
          })

          return acc.concat(
            cells.map(nodePos => {
              const node = table.node.nodeAt(nodePos)
              const pos = nodePos + table.start
              return { pos, start: pos + 1, node }
            }),
          )
        }

        return acc
      },
      [] as { pos: number; start: number; node: Node | null | undefined }[],
    )
  }

  return null
}

export const getCellsInTable = (selection: Selection) => {
  const table = findTable(selection)

  if (table) {
    const map = TableMap.get(table.node)
    const cells = map.cellsInRect({
      left: 0,
      right: map.width,
      top: 0,
      bottom: map.height,
    })

    return cells.map(nodePos => {
      const node = table.node.nodeAt(nodePos)
      const pos = nodePos + table.start

      return { pos, start: pos + 1, node }
    })
  }

  return null
}

export const findParentNodeClosestToPos = ($pos: ResolvedPos, predicate: (node: Node) => boolean) => {
  for (let i = $pos.depth; i > 0; i -= 1) {
    const node = $pos.node(i)

    if (predicate(node)) {
      return {
        pos: i > 0 ? $pos.before(i) : 0,
        start: $pos.start(i),
        depth: i,
        node,
      }
    }
  }

  return null
}

export const findCellClosestToPos = ($pos: ResolvedPos) => {
  const predicate = (node: Node) => node.type.spec.tableRole && /cell/i.test(node.type.spec.tableRole)

  return findParentNodeClosestToPos($pos, predicate)
}

const select = (type: 'row' | 'column') => (index: number) => (tr: Transaction) => {
  const table = findTable(tr.selection)
  const isRowSelection = type === 'row'

  if (table) {
    const map = TableMap.get(table.node)

    // Check if the index is valid
    if (index >= 0 && index < (isRowSelection ? map.height : map.width)) {
      let minRow: number
      let maxRow: number
      let minCol: number
      let maxCol: number

      if (isRowSelection) {
        minRow = index
        maxRow = index + 1
        minCol = 0
        maxCol = map.width
      } else {
        minCol = index
        maxCol = index + 1
        minRow = 0
        maxRow = map.height
      }

      const head = table.start + map.map[minRow * map.width + minCol]
      const anchor = table.start + map.map[(maxRow - 1) * map.width + (maxCol - 1)]
      const $head = tr.doc.resolve(head)
      const $anchor = tr.doc.resolve(anchor)

      return tr.setSelection(new CellSelection($anchor, $head))
    }
  }
  return tr
}

export const selectColumn = select('column')

export const selectRow = select('row')

export const selectTable = (tr: Transaction) => {
  const table = findTable(tr.selection)

  if (table) {
    const { map } = TableMap.get(table.node)

    if (map && map.length) {
      const head = table.start + map[0]
      const anchor = table.start + map[map.length - 1]
      const $head = tr.doc.resolve(head)
      const $anchor = tr.doc.resolve(anchor)

      return tr.setSelection(new CellSelection($anchor, $head))
    }
  }

  return tr
}
