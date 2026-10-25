import { mergeAttributes } from '@tiptap/core'
import TiptapHeading from '@tiptap/extension-heading'
import type { Level } from '@tiptap/extension-heading'
import { Plugin, PluginKey } from '@tiptap/pm/state'

const generateUUID = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'h-' + Math.random().toString(36).substring(2, 11)
}

export const Heading = TiptapHeading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      id: {
        default: null,
        rendered: true,
        keepOnSplit: false,
        parseHTML: element =>
          element.getAttribute('id') ||
          element.getAttribute('data-id') ||
          element.getAttribute('data-toc-id'),
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

  onCreate() {
    // Initial document pass: ensure existing headings without id get one
    const tr = this.editor.state.tr
    let modified = false

    this.editor.state.doc.descendants((node, pos) => {
      if (node.type.name === this.name && !node.attrs.id) {
        tr.setNodeMarkup(pos, undefined, {
          ...node.attrs,
          id: generateUUID(),
        })
        modified = true
      }
    })

    if (modified) {
      this.editor.view.dispatch(tr)
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('heading-id-generator'),
        appendTransaction: (transactions, oldState, newState) => {
          const docChanged = transactions.some(tr => tr.docChanged)
          if (!docChanged) return null

          const tr = newState.tr
          let modified = false

          newState.doc.descendants((node, pos) => {
            if (node.type.name === this.name && !node.attrs.id) {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                id: generateUUID(),
              })
              modified = true
            }
          })

          return modified ? tr : null
        },
      }),
    ]
  },
})

export default Heading
