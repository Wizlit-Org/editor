import { mergeAttributes } from '@tiptap/core'
import TiptapHeading from '@tiptap/extension-heading'
import type { Level } from '@tiptap/extension-heading'
import { Plugin, PluginKey } from '@tiptap/pm/state'

const generateDeterministicId = (text: string, index = 0): string => {
  const clean = (text || '').trim().toLowerCase()
  if (!clean) return `h-${index}-${Math.random().toString(36).substring(2, 9)}`
  let h1 = 0x811c9dc5 ^ index
  let h2 = 0x5f356495
  for (let i = 0; i < clean.length; i++) {
    const c = clean.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 0x01000193)
    h2 = Math.imul(h2 ^ (c << 1), 0x01000193)
  }
  const hex1 = ((h1 >>> 0) + 0x100000000).toString(16).substring(1)
  const hex2 = ((h2 >>> 0) + 0x100000000).toString(16).substring(1)
  const hex3 = (Math.imul(h1 ^ h2, 0x01000193) >>> 0).toString(16).padStart(8, '0')
  const hex4 = (Math.imul(h2, 0x27d4eb2d) >>> 0).toString(16).padStart(8, '0')
  const full = (hex1 + hex2 + hex3 + hex4).substring(0, 32)
  return `${full.slice(0, 8)}-${full.slice(8, 12)}-4${full.slice(13, 16)}-a${full.slice(17, 20)}-${full.slice(20, 32)}`
}

const getHeadingIndex = (element: HTMLElement): number => {
  let idx = 0
  let prev = element.previousElementSibling
  while (prev) {
    if (/^H[1-6]$/i.test(prev.tagName) && prev.textContent?.trim() === element.textContent?.trim()) {
      idx++
    }
    prev = prev.previousElementSibling
  }
  return idx
}

export const Heading = TiptapHeading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      id: {
        default: () => generateDeterministicId('', 0),
        rendered: true,
        keepOnSplit: false,
        parseHTML: element =>
          element.getAttribute('id') ||
          element.getAttribute('data-id') ||
          element.getAttribute('data-toc-id') ||
          generateDeterministicId(element.textContent || '', getHeadingIndex(element as HTMLElement)),
        renderHTML: attributes => {
          if (!attributes.id) {
            return {}
          }
          return {
            id: attributes.id,
            'data-id': attributes.id,
            'data-toc-id': attributes.id,
          }
        },
      },
    }
  },

  renderHTML({ node, HTMLAttributes }) {
    const nodeLevel = parseInt(node.attrs.level, 10) as Level
    const hasLevel = this.options.levels.includes(nodeLevel)
    const level = hasLevel ? nodeLevel : this.options.levels[0]

    return [`h${level}`, mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('heading-id-generator'),
        appendTransaction: (transactions, _oldState, newState) => {
          const docChanged = transactions.some(tr => tr.docChanged)
          if (!docChanged) return null

          const tr = newState.tr
          let modified = false
          let count = 0

          newState.doc.descendants((node, pos) => {
            if (node.type.name === this.name) {
              if (!node.attrs.id) {
                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  id: generateDeterministicId(node.textContent, count),
                })
                modified = true
              }
              count++
            }
          })

          return modified ? tr.setMeta('addToHistory', false).setMeta('headingIdGeneration', true) : null
        },
      }),
    ]
  },
})

export default Heading
