import { Editor } from '@tiptap/react'

import { Figcaption, HorizontalRule, ImageBlock, Link, CodeBlock, Youtube } from '@/extensions'
import drawIoExtension from '@rcode-link/tiptap-drawio'

export const isTableGripSelected = (node: HTMLElement) => {
  let container = node

  while (container && !['TD', 'TH'].includes(container.tagName)) {
    container = container.parentElement!
  }

  const gripColumn = container && container.querySelector && container.querySelector('a.grip-column.selected')
  const gripRow = container && container.querySelector && container.querySelector('a.grip-row.selected')

  if (gripColumn || gripRow) {
    return true
  }

  return false
}

export const isCustomNodeSelected = (editor: Editor, node: HTMLElement) => {
  const customNodes = [
    HorizontalRule.name,
    ImageBlock.name,
    CodeBlock.name,
    Link.name,
    // AiWriter.name,
    // AiImage.name,
    Figcaption.name,
    Youtube.name,
    drawIoExtension.name,
  ]

  return customNodes.some(type => editor.isActive(type)) || isTableGripSelected(node)
}

export default isCustomNodeSelected
