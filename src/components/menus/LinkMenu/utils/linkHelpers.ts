import { Editor } from '@tiptap/react'

/**
 * Safe mark range extension supporting split text nodes, hashes, and image URLs
 */
export function safeExtendLinkRange(editor: Editor): void {
  try {
    const { state } = editor
    const { selection, schema } = state
    const linkType = schema.marks.link
    if (!linkType) {
      editor.chain().focus().extendMarkRange('link').run()
      return
    }

    const { from, to, $from } = selection
    const markFound =
      $from.marks().find(m => m.type === linkType) ||
      $from.nodeBefore?.marks?.find(m => m.type === linkType) ||
      $from.nodeAfter?.marks?.find(m => m.type === linkType)

    const targetHref = markFound?.attrs?.href

    let startPos = from
    let endPos = to

    // Scan contiguous nodes within parent that share the link mark
    if ($from.parent) {
      const parentStart = $from.start()
      $from.parent.forEach((child, offset) => {
        const childMark = child.marks?.find(m => m.type === linkType)
        if (childMark && (!targetHref || childMark.attrs?.href === targetHref)) {
          const nodeStart = parentStart + offset
          const nodeEnd = nodeStart + child.nodeSize
          if (
            (from >= nodeStart && from <= nodeEnd) ||
            (to >= nodeStart && to <= nodeEnd) ||
            (nodeStart >= from && nodeEnd <= to) ||
            Math.abs(from - nodeEnd) <= 1 ||
            Math.abs(to - nodeStart) <= 1
          ) {
            startPos = Math.min(startPos, nodeStart)
            endPos = Math.max(endPos, nodeEnd)
          }
        }
      })
    }

    if (startPos < endPos) {
      editor.chain().focus().setTextSelection({ from: startPos, to: endPos }).run()
    } else {
      editor.chain().focus().extendMarkRange('link').run()
    }
  } catch {
    try {
      editor.chain().focus().extendMarkRange('link').run()
    } catch {}
  }
}

/**
 * Extract current link text from the editor document at selection
 */
export function getCurrentLinkText(editor: Editor): string {
  try {
    const { state } = editor
    const { from, to, $from } = state.selection
    const markType = state.schema.marks.link
    if (!markType) return ''

    // If user has a non-empty text selection, return that text
    if (from !== to) {
      return state.doc.textBetween(from, to)
    }

    // Find the exact link node at cursor
    const node =
      $from.parent.childAfter($from.parentOffset).node ||
      $from.parent.childBefore($from.parentOffset).node
    if (node && node.marks?.some(m => m.type === markType) && node.text) {
      return node.text
    }

    let linkText = ''
    state.doc.nodesBetween(
      Math.max(0, from - 2),
      Math.min(state.doc.content.size, to + 2),
      n => {
        const mark = n.marks?.find(m => m.type === markType)
        if (mark && n.text && !linkText) {
          linkText = n.text
        }
      },
    )
    return linkText
  } catch {
    return ''
  }
}

/**
 * Apply updated hyperlink attributes or insert text with link
 */
export function applySetLink(
  editor: Editor,
  url: string,
  text?: string,
  openInNewTab?: boolean,
): void {
  try {
    editor.chain().focus().extendMarkRange('link').run()
    const { from, to } = editor.state.selection
    const currentText = editor.state.doc.textBetween(from, to)

    if (text && text !== currentText) {
      editor
        .chain()
        .focus()
        .insertContentAt(
          { from, to },
          {
            type: 'text',
            text,
            marks: [
              {
                type: 'link',
                attrs: {
                  href: url,
                  target: openInNewTab ? '_blank' : '',
                },
              },
            ],
          },
        )
        .run()
    } else {
      editor
        .chain()
        .focus()
        .extendMarkRange('link')
        .setLink({ href: url, target: openInNewTab ? '_blank' : '' })
        .run()
    }
  } catch (err) {
    console.error('Error setting link:', err)
  }
}

/**
 * Unset link mark from active selection
 */
export function applyUnsetLink(editor: Editor): void {
  try {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
  } catch {}
}


/**
 * Calculate 1:1 precision anchor rect docking to clicked mouse coordinates
 * and the specific DOM line boundary of the link
 */
export function getLinkReferenceClientRect(editor: Editor): DOMRect {
  let linkEl: HTMLAnchorElement | null =
    (editor.storage as any)?.link?.clickedElement as HTMLAnchorElement | null

  if (!linkEl || !linkEl.isConnected) {
    const { from } = editor.state.selection
    try {
      const domAtPos = editor.view.domAtPos(from)
      const el = domAtPos.node as HTMLElement
      linkEl =
        el?.nodeType === 1
          ? (el as HTMLElement).closest('a')
          : (el?.parentElement?.closest('a') as HTMLAnchorElement | null)
    } catch {}
  }

  const clickedCoords = (editor.storage as any)?.link?.clickedCoords as
    | { x: number; y: number }
    | null
    | undefined

  if (linkEl && linkEl.isConnected) {
    const linkRect = linkEl.getBoundingClientRect()

    if (
      clickedCoords &&
      typeof clickedCoords.x === 'number' &&
      typeof clickedCoords.y === 'number'
    ) {
      // Multi-line link support: inspect getClientRects() to find the specific line rect clicked
      const clientRects = Array.from(linkEl.getClientRects())
      let targetLineRect = linkRect

      if (clientRects.length > 1) {
        const matchingRect =
          clientRects.find(
            r =>
              clickedCoords.y >= r.top - 4 &&
              clickedCoords.y <= r.bottom + 4 &&
              clickedCoords.x >= r.left - 8 &&
              clickedCoords.x <= r.right + 8,
          ) ||
          clientRects.find(
            r => clickedCoords.y >= r.top - 4 && clickedCoords.y <= r.bottom + 4,
          )
        if (matchingRect) {
          targetLineRect = matchingRect
        }
      }

      // Clamp clicked mouse X strictly within target link's horizontal boundary
      const clampedX = Math.max(
        targetLineRect.left,
        Math.min(clickedCoords.x, targetLineRect.right),
      )

      // Precision 1:1 anchor rect directly docked to clicked mouse coordinates
      // and link DOM boundary
      return new DOMRect(
        clampedX,
        targetLineRect.top,
        1,
        Math.max(1, targetLineRect.bottom - targetLineRect.top),
      )
    }

    return linkRect
  }

  try {
    const { from } = editor.state.selection
    const coords = editor.view.coordsAtPos(from)
    return new DOMRect(
      coords.left,
      coords.top,
      Math.max(1, coords.right - coords.left),
      Math.max(1, coords.bottom - coords.top),
    )
  } catch {
    return new DOMRect(-1000, -1000, 0, 0)
  }
}
