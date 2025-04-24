import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import { all, createLowlight } from 'lowlight'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { CodeBlockView } from './components/CodeBlockView'

const lowlight = createLowlight(all)

export const CodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView)
  },
}).configure({
  lowlight,
  defaultLanguage: 'javascript',
})
