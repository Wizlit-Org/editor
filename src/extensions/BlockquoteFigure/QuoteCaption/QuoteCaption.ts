import { mergeAttributes, Node } from '@tiptap/core'

export const QuoteCaption = Node.create({
  name: 'quoteCaption',

  group: 'block',

  content: 'text*',

  defining: true,

  isolating: true,

  parseHTML() {
    return [
      {
        tag: 'figcaption',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['figcaption', mergeAttributes(HTMLAttributes), 0]
  },
  
  addNodeView() {
    return ({ node }) => {
      // Create the root element
      const dom = document.createElement('figcaption')
      dom.classList.add('quote-caption')

      // Create a container for editable content
      const contentDOM = document.createElement('div')
      dom.appendChild(contentDOM)

      // Initial empty check
      if (node.textContent.trim().length === 0) {
        dom.classList.add('empty-content')
      }

      return {
        dom,
        contentDOM,
        update(updatedNode) {
          const isEmpty = updatedNode.textContent.trim().length === 0
          dom.classList.toggle('empty-content', isEmpty)
          return true
        },
      }
    }
  },

  addKeyboardShortcuts() {
    return {
      // On Enter at the end of line, create new paragraph and focus
      Enter: ({ editor }) => {
        const {
          state: {
            selection: { $from, empty },
          },
        } = editor

        if (!empty || $from.parent.type !== this.type) {
          return false
        }

        const isAtEnd = $from.parentOffset === $from.parent.nodeSize - 2

        if (!isAtEnd) {
          return false
        }

        const pos = editor.state.selection.$from.end()

        return editor.chain().focus(pos).insertContentAt(pos, { type: 'paragraph' }).run()
      },
    }
  },
})

export default QuoteCaption
