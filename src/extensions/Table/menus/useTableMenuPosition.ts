import { Editor } from '@tiptap/react'

/**
 * Returns a virtual element anchored to the top of the currently selected column,
 * precisely near the top column grip bar.
 */
export const getColumnAnchorVirtualElement = (editor: Editor) => {
  const { view } = editor
  if (typeof window === 'undefined' || !view?.dom) return null

  const selectedCells = Array.from(
    view.dom.querySelectorAll('.selectedCell'),
  ) as HTMLElement[]

  if (selectedCells.length === 0) return null

  // Find the top-most cell among selected column cells
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
  const top = rect.top - 16
  const height = 14

  return {
    getBoundingClientRect: () =>
      ({
        top,
        bottom: rect.top,
        left: rect.left,
        right: rect.right,
        width: rect.width,
        height,
        x: rect.left,
        y: top,
      }) as DOMRect,
  }
}

/**
 * Returns a virtual element anchored to the left of the currently selected row,
 * precisely near the left row grip bar.
 */
export const getRowAnchorVirtualElement = (editor: Editor) => {
  const { view } = editor
  if (typeof window === 'undefined' || !view?.dom) return null

  const selectedCells = Array.from(
    view.dom.querySelectorAll('.selectedCell'),
  ) as HTMLElement[]

  if (selectedCells.length === 0) return null

  // Find the left-most cell among selected row cells
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
  const left = rect.left - 16
  const width = 14

  return {
    getBoundingClientRect: () =>
      ({
        top: rect.top,
        bottom: rect.bottom,
        left,
        right: rect.left,
        width,
        height: rect.height,
        x: left,
        y: rect.top,
      }) as DOMRect,
  }
}
