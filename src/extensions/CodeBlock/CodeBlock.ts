import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import { all, createLowlight } from 'lowlight'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { Selection, TextSelection, Plugin } from 'prosemirror-state'
import { CodeBlockView } from './components/CodeBlockView'

const lowlight = createLowlight(all)

export const CodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView as any)
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
        const { $from, empty } = state.selection
        if (!empty) {
          return originalEnter ? originalEnter({ editor }) : false
        }

        const text = $from.parent.textContent
        const textBefore = text.slice(0, $from.parentOffset)
        const textAfter = text.slice($from.parentOffset)
        const lastNL = textBefore.lastIndexOf('\n')
        const lineOff = lastNL < 0 ? 0 : lastNL + 1
        const currentLine = textBefore.slice(lineOff)
        const nextNL = text.indexOf('\n', $from.parentOffset)
        const fullCurrentLine = text.slice(lineOff, nextNL < 0 ? text.length : nextNL)

        // 1) 커서 뒤에 코드가 없고(코드 블록 끝), 직전 줄들이 공백/탭만 있는 빈 줄(2줄 이상 연속)이면
        //    끝에 쌓인 모든 공백/빈 줄을 제거하고 코드 블록 밖 하단에 새 paragraph를 생성하여 탈출
        if (textAfter.trim() === '') {
          const linesBefore = textBefore.split('\n')
          const trailingBlankCount = (() => {
            let count = 0
            for (let i = linesBefore.length - 1; i >= 0; i--) {
              if (linesBefore[i].trim() === '') {
                count++
              } else {
                break
              }
            }
            return count
          })()

          if (trailingBlankCount >= 2) {
            const blockStart = $from.start()
            const keptLines = linesBefore.slice(0, linesBefore.length - trailingBlankCount)
            const cleanTextEndOffset = keptLines.length > 0 ? keptLines.join('\n').length : 0
            const deleteFrom = blockStart + cleanTextEndOffset
            const deleteTo = blockStart + text.length

            const tr = state.tr
            if (deleteTo > deleteFrom) {
              tr.delete(deleteFrom, deleteTo)
            }

            const codeBlockEndAfterDelete = tr.mapping.map($from.after())
            const paragraphType = state.schema.nodes.paragraph
            if (paragraphType) {
              tr.insert(codeBlockEndAfterDelete, paragraphType.create())
              tr.setSelection(TextSelection.create(tr.doc, codeBlockEndAfterDelete + 1))
              view.dispatch(tr.scrollIntoView())
              return true
            }
          }
        }

        // 2) 현재 줄이 공백/탭만 있는 인덴트 빈 줄인 경우:
        //    현재 줄의 불필요한 공백을 비우고 새 줄(동일 인덴트 유지 또는 빈 줄)을 추가하여 다음 Enter 시 탈출 가능하게 함
        const match = currentLine.match(/^[\t ]+/)
        if (match) {
          const indent = match[0]
          if (fullCurrentLine.trim() === '') {
            const blockStart = $from.start()
            const lineStartPos = blockStart + lineOff
            const lineEndPos = blockStart + (nextNL < 0 ? text.length : nextNL)
            const tr = state.tr.replaceWith(
              lineStartPos,
              lineEndPos,
              state.schema.text('\n' + indent),
            )
            view.dispatch(tr.scrollIntoView())
            return true
          }
          view.dispatch(state.tr.insertText('\n' + indent).scrollIntoView())
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

        // 2) 첫 번째 줄이고 비어있거나 커서가 맨 앞(offset 0)이면 기본 Backspace(블록 해제/삭제)로 위임
        if (beforeNL < 0) {
          if (line.length === 0 || $from.parentOffset === 0) {
            return originalBackspace ? originalBackspace({ editor }) : false
          }
          if (/^[\t ]+$/.test(line)) {
            const tr = state.tr.delete(from, to)
            tr.setSelection(TextSelection.create(tr.doc, from))
            view.dispatch(tr)
            return true
          }
          return originalBackspace ? originalBackspace({ editor }) : false
        }

        // 3) 둘째 줄 이상에서 현재 줄이 공백(스페이스/탭)만 있으면 직전 개행(\n)과 해당 줄 공백을 함께 삭제하여 이전 줄 끝으로 이동
        if (/^[\t ]*$/.test(line)) {
          const deleteFrom = blockStart + beforeNL
          const tr = state.tr.delete(deleteFrom, to)
          tr.setSelection(TextSelection.create(tr.doc, deleteFrom))
          view.dispatch(tr)
          return true
        }
        
        return originalBackspace ? originalBackspace({ editor }) : false
      },

      'ArrowUp': ({ editor }) => {
        const { state, view } = editor
        const { selection, schema, doc } = state
        const { $from, empty } = selection

        if (!empty) {
          return false
        }

        // Case 1: 커서가 codeBlock 내부에 있는 경우 -> 상단으로 탈출
        if ($from.parent.type === this.type) {
          const textBefore = $from.parent.textBetween(0, $from.parentOffset, null, '\ufffc')
          const isFirstLine = !textBefore.includes('\n')
          if (!isFirstLine) {
            return false
          }

          const blockStart = $from.before()

          // 1-1) 문서의 맨 첫 번째 블록인 경우: 상단에 빈 paragraph 삽입 후 이동
          if (blockStart <= 1) {
            const tr = state.tr.insert(0, schema.nodes.paragraph.create())
            tr.setSelection(TextSelection.create(tr.doc, 1))
            view.dispatch(tr)
            return true
          }

          // 1-2) 이전 블록이 이미 존재하는 경우: 이전 블록의 끝 위치로 이동
          const prevBlockPos = doc.resolve(blockStart - 1)
          const tr = state.tr.setSelection(Selection.near(prevBlockPos, -1))
          view.dispatch(tr)
          return true
        }

        // Case 2: 커서가 codeBlock 바로 아래 텍스트블록의 첫 줄에 있는 경우 -> codeBlock 끝으로 진입
        if ($from.parent.isTextblock && $from.parent.type !== this.type) {
          const textBefore = $from.parent.textBetween(0, $from.parentOffset, null, '\ufffc')
          const isFirstLine = !textBefore.includes('\n')
          if (isFirstLine) {
            const before = $from.before()
            if (before > 0) {
              const prevNode = doc.resolve(before).nodeBefore
              if (prevNode && prevNode.type === this.type) {
                const tr = state.tr.setSelection(TextSelection.create(doc, before - 1))
                view.dispatch(tr)
                return true
              }
            }
          }
        }

        return false
      },

      'ArrowDown': ({ editor }) => {
        const { state, view } = editor
        const { selection, schema, doc } = state
        const { $from, empty } = selection

        if (!empty) {
          return false
        }

        // Case 1: 커서가 codeBlock 내부에 있는 경우 -> 하단으로 탈출
        if ($from.parent.type === this.type) {
          const textAfter = $from.parent.textBetween($from.parentOffset, $from.parent.nodeSize - 2, null, '\ufffc')
          const isLastLine = !textAfter.includes('\n')
          if (!isLastLine) {
            return false
          }

          const blockEnd = $from.after()
          if (blockEnd === undefined) return false

          const nodeAfter = doc.nodeAt(blockEnd)
          if (nodeAfter) {
            // 다음 블록 시작 위치로 이동
            const tr = state.tr.setSelection(Selection.near(doc.resolve(blockEnd + 1), 1))
            view.dispatch(tr)
            return true
          } else {
            // 문서 맨 끝인 경우: 하단에 빈 paragraph 삽입 후 이동
            const tr = state.tr.insert(blockEnd, schema.nodes.paragraph.create())
            tr.setSelection(TextSelection.create(tr.doc, blockEnd + 1))
            view.dispatch(tr)
            return true
          }
        }

        // Case 2: 커서가 codeBlock 바로 위 텍스트블록의 마지막 줄에 있는 경우 -> codeBlock 첫 줄로 진입
        if ($from.parent.isTextblock && $from.parent.type !== this.type) {
          const textAfter = $from.parent.textBetween($from.parentOffset, $from.parent.nodeSize - 2, null, '\ufffc')
          const isLastLine = !textAfter.includes('\n')
          if (isLastLine) {
            const after = $from.after()
            if (after !== undefined) {
              const nextNode = doc.nodeAt(after)
              if (nextNode && nextNode.type === this.type) {
                const tr = state.tr.setSelection(TextSelection.create(doc, after + 1))
                view.dispatch(tr)
                return true
              }
            }
          }
        }

        return false
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
