import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import { all, createLowlight } from 'lowlight'
import { NodeViewProps, ReactNodeViewRenderer } from '@tiptap/react'
import { TextSelection } from 'prosemirror-state'
import { CodeBlockView } from './components/CodeBlockView'

const lowlight = createLowlight(all)

export const CodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView as React.ComponentType<NodeViewProps>)
  },

  addKeyboardShortcuts() {
    const parentShortcuts = this.parent?.() || {}

    return {
      ...parentShortcuts,
      
      Tab: ({ editor }) => {
        const event = window.event as KeyboardEvent
        if (event) {
          event.preventDefault()
          event.stopPropagation()
        }

        const { state, view } = editor
        const { $from, $to, empty } = state.selection

        // 1) No selection: insert a tab at the cursor
        if (empty) {
          view.dispatch(
            state.tr.insertText('\t', state.selection.from, state.selection.to)
          )
          return true
        }

        // 2) With selection: expand to full lines, indent, and re-select
        const blockStart = $from.start()
        const text       = $from.parent.textContent
        const before     = text.lastIndexOf('\n', $from.parentOffset - 1)
        const startOff   = before < 0 ? 0 : before + 1
        const after      = text.indexOf('\n', $to.parentOffset)
        const endOff     = after  < 0 ? text.length : after

        const from   = blockStart + startOff
        const to     = blockStart + endOff
        const block  = text.slice(startOff, endOff)
        const indented = block
          .split('\n')
          .map(line => '\t' + line)
          .join('\n')

        const tr = state.tr.insertText(indented, from, to)
        tr.setSelection(
          TextSelection.create(tr.doc, from, from + indented.length)
        )
        view.dispatch(tr)
        return true
      },

      'Shift-Tab': ({ editor }) => {
        const event = window.event as KeyboardEvent
        if (event) {
          event.preventDefault()
          event.stopPropagation()
        }

        const { state, view } = editor
        const { $from, $to, empty } = state.selection

        // 1) No selection: outdent single line
        if (empty) {
          const blockStart = $from.start()
          const text       = $from.parent.textContent
          const lastNL     = text.lastIndexOf('\n', $from.parentOffset - 1)
          const lineOff    = lastNL < 0 ? 0 : lastNL + 1
          const lineStart  = blockStart + lineOff

          // If it starts with a tab, remove it
          if (state.doc.textBetween(lineStart, lineStart + 1) === '\t') {
            view.dispatch(state.tr.delete(lineStart, lineStart + 1))
            return true
          }

          // Otherwise remove up to 4 leading spaces
          const nextChars = state.doc.textBetween(lineStart, lineStart + 4)
          const match     = nextChars.match(/^ +/)
          if (match) {
            const removeCount = Math.min(match[0].length, 4)
            view.dispatch(
              state.tr.delete(lineStart, lineStart + removeCount)
            )
            return true
          }
          return false
        }

        // 2) With selection: expand to full lines, outdent, and re-select
        const blockStart = $from.start()
        const text       = $from.parent.textContent
        const before     = text.lastIndexOf('\n', $from.parentOffset - 1)
        const startOff   = before < 0 ? 0 : before + 1
        const after      = text.indexOf('\n', $to.parentOffset)
        const endOff     = after  < 0 ? text.length : after

        const from  = blockStart + startOff
        const to    = blockStart + endOff
        const block = text.slice(startOff, endOff)

        const outdented = block
          .split('\n')
          .map(line => {
            if (line.startsWith('\t')) {
              return line.slice(1)
            }
            return line.replace(/^ {1,4}/, '')
          })
          .join('\n')

        const tr = state.tr.insertText(outdented, from, to)
        tr.setSelection(
          TextSelection.create(tr.doc, from, from + outdented.length)
        )
        view.dispatch(tr)
        return true
      },
    }
  },
})
  .configure({
    lowlight,
    defaultLanguage: 'javascript',
    exitOnArrowDown: true,
    exitOnTripleEnter: true,
  })
