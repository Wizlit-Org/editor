import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import { all, createLowlight } from 'lowlight'
import { NodeViewProps, ReactNodeViewRenderer } from '@tiptap/react'
import { TextSelection } from 'prosemirror-state'
import { CodeBlockView } from './components/CodeBlockView'
import { Plugin } from 'prosemirror-state'

const lowlight = createLowlight(all)

export const CodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView as React.ComponentType<NodeViewProps>)
  },

  addProseMirrorPlugins() {
    const plugins = this.parent?.() || []
    
    return [
      ...plugins,
      new Plugin({
        props: {
          handlePaste: (view, event) => {
            const text = event.clipboardData?.getData('text/plain')
            if (!text) return false

            let lines = text.split('\n')
            if (lines.length <= 1) return false

            // 앞쪽 빈 줄 제거
            while (lines.length > 0 && lines[0].trim() === '') {
              lines = lines.slice(1)
            }
            if (lines.length === 0) return false

            // 각 줄의 앞쪽 공백을 찾아서 최소 공백 수를 계산
            const leadingSpaces = lines
              .map(line => {
                const match = line.match(/^[\t ]*/)
                return match ? match[0] : ''
              })

            // 공백이 있는 줄들만 고려하여 최소 공백 수 계산
            const nonEmptySpaces = leadingSpaces.filter(space => space.length > 0)
            if (nonEmptySpaces.length === 0) return false

            // 최소 공백 수 찾기 (탭은 4칸으로 계산)
            const minSpaces = Math.min(...nonEmptySpaces.map(space => 
              space.split('').reduce((acc, char) => acc + (char === '\t' ? 4 : 1), 0)
            ))

            // 모든 줄에서 최소 공백 수만큼 제거하고, 남은 공백 4개를 탭으로 변환
            const normalizedText = lines
              .map(line => {
                const match = line.match(/^[\t ]*/)
                if (!match) return line
                
                const leading = match[0]
                let remaining = minSpaces
                let i = 0
                
                while (i < leading.length && remaining > 0) {
                  if (leading[i] === '\t') {
                    remaining -= 4
                  } else {
                    remaining -= 1
                  }
                  i++
                }
                
                // 남은 공백을 탭으로 변환
                let remainingSpaces = leading.slice(i)
                const tabs = Math.floor(remainingSpaces.length / 4)
                const spaces = remainingSpaces.length % 4
                const convertedSpaces = '\t'.repeat(tabs) + ' '.repeat(spaces)
                
                return convertedSpaces + line.slice(leading.length)
              })
              .join('\n')

            const { state, dispatch } = view
            const { tr } = state
            const { from, to } = state.selection

            // 코드 블록이 없는 경우, 코드 블록을 생성하고 텍스트를 삽입
            if (!this.editor.isActive('codeBlock')) {
              tr.replaceWith(from, to, this.type.create(null, this.type.schema.text(normalizedText)))
            } else {
              tr.insertText(normalizedText, from, to)
            }
            
            dispatch(tr)
            return true
          },
        },
      }),
    ]
  },

  addKeyboardShortcuts() {
    const parentShortcuts = this.parent?.() || {}
    const originalEnter = parentShortcuts.Enter
    const originalBackspace = parentShortcuts.Delete

    return {
      ...parentShortcuts,
      
      Tab: ({ editor }) => {
        if (!editor.isActive('codeBlock')) {
          return false
        }

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
        if (!editor.isActive('codeBlock')) {
          return false
        }

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

      'Enter': ({ editor }) => {
        if (!editor.isActive('codeBlock')) {
          return false
        }

        const { state, view } = editor
        const { $from } = state.selection

        const text = $from.parent.textContent
        const lastNL = text.lastIndexOf('\n', $from.parentOffset - 1)
        const lineOff = lastNL < 0 ? 0 : lastNL + 1
        const currentLine = text.slice(lineOff, $from.parentOffset)
        
        // Find leading whitespace (tabs or spaces)
        const match = currentLine.match(/^[\t ]+/)
        if (match) {
          const indent = match[0]
          view.dispatch(state.tr.insertText('\n' + indent))
          return true
        }

        return originalEnter ? originalEnter({ editor }) : false
      },

      'Backspace': ({ editor }) => {
        if (!editor.isActive('codeBlock')) {
          return false
        }

        const { state, view } = editor
        const { $from, empty } = state.selection

        // 1) 선택 영역이 있으면 기본 Delete 동작 위임
        if (!empty) {
          return false
        }

        const blockStart = $from.start()
        const text       = $from.parent.textContent
        const beforeNL   = text.lastIndexOf('\n', $from.parentOffset - 1)
        const lineOff    = beforeNL < 0 ? 0 : beforeNL + 1
        const afterNL    = text.indexOf('\n', $from.parentOffset)
        const lineEndOff = afterNL  < 0 ? text.length : afterNL

        const from = blockStart + lineOff
        const to   = blockStart + lineEndOff
        const line = text.slice(lineOff, lineEndOff)

        // 2) 현재 줄이 공백(스페이스/탭)만 있으면 해당 줄+개행 삭제
        if (/^[\t ]*$/.test(line)) {
          const tr = state.tr.delete(from, to + (afterNL >= 0 ? 1 : 0))
          
          // 3) 커서를 이전 줄 끝으로 이동
          const prevLineEnd = beforeNL < 0 ? 0 : beforeNL
          const newPos = blockStart + prevLineEnd
          tr.setSelection(TextSelection.create(tr.doc, newPos))
          view.dispatch(tr)
          return true
        }
        
        return originalBackspace ? originalBackspace({ editor }) : false
      }
    }
  },
})
  .configure({
    lowlight,
    defaultLanguage: 'javascript',
    exitOnArrowDown: true,
    exitOnTripleEnter: true,
  })
