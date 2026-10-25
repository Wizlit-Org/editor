import { Editor } from '@tiptap/react'

/**
 * Returns a virtual element anchored to the top of the currently selected column,
 * precisely near the top column grip bar.
 * Follows Floating UI virtual element specification ({ getBoundingClientRect, getClientRects }).
 */
export const getColumnAnchorVirtualElement = (editor: Editor) => {
  const { view } = editor
  if (typeof window === 'undefined' || !view?.dom) return null

  const computeRect = (): DOMRect => {
    const selectedCells = Array.from(
      view.dom.querySelectorAll('.selectedCell'),
    ) as HTMLElement[]

    if (selectedCells.length === 0) {
      return new DOMRect(-1000, -1000, 0, 0)
    }

    let topCell = selectedCells[0]
    let minTop = topCell.getBoundingClientRect().top

    for (let i = 1; i < selectedCells.length; i++) {
      const r = selectedCells[i].getBoundingClientRect()
      if (r.top < minTop) {
        minTop = r.top
        topCell = selectedCells[i]
      }
    }

    const rect = topCell.getBoundingClientRect()
    // Anchor precisely near the top column grip bar (15px above top cell)
    const top = rect.top - 18
    const height = 14

    return new DOMRect(rect.left, top, rect.width, height)
  }

  return {
    getBoundingClientRect: computeRect,
    getClientRects: () => [computeRect()],
  }
}

/**
 * Returns a virtual element anchored to the left of the currently selected row,
 * precisely near the left row grip bar.
 * Follows Floating UI virtual element specification ({ getBoundingClientRect, getClientRects }).
 */
export const getRowAnchorVirtualElement = (editor: Editor) => {
  const { view } = editor
  if (typeof window === 'undefined' || !view?.dom) return null

  const computeRect = (): DOMRect => {
    const selectedCells = Array.from(
      view.dom.querySelectorAll('.selectedCell'),
    ) as HTMLElement[]

    if (selectedCells.length === 0) {
      return new DOMRect(-1000, -1000, 0, 0)
    }

    let leftCell = selectedCells[0]
    let minLeft = leftCell.getBoundingClientRect().left

    for (let i = 1; i < selectedCells.length; i++) {
      const r = selectedCells[i].getBoundingClientRect()
      if (r.left < minLeft) {
        minLeft = r.left
        leftCell = selectedCells[i]
      }
    }

    const rect = leftCell.getBoundingClientRect()
    // Anchor precisely near the left row grip bar (15px left of left cell)
    const left = rect.left - 18
    const width = 14

    return new DOMRect(left, rect.top, width, rect.height)
  }

  return {
    getBoundingClientRect: computeRect,
    getClientRects: () => [computeRect()],
  }
}
