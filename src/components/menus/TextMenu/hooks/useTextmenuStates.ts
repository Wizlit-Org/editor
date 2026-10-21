import { Editor, useEditorState } from '@tiptap/react'
import { useCallback } from 'react'
import { ShouldShowProps } from '../../types'
import { isCustomNodeSelected, isTextSelected } from '@/lib/utils'

export const useTextmenuStates = (editor: Editor) => {
  const states = useEditorState({
    editor,
    selector: ctx => {
      return {
        isBold: ctx.editor.isActive('bold'),
        isItalic: ctx.editor.isActive('italic'),
        isStrike: ctx.editor.isActive('strike'),
        isUnderline: ctx.editor.isActive('underline'),
        isCode: ctx.editor.isActive('code'),
      }
    },
  })

  const shouldShow = useCallback(
    ({ view, from }: ShouldShowProps) => {
      if (!view || editor.view.dragging || !editor.isEditable) {
        return false
      }

      const domAtPos = view.domAtPos(from || 0).node as HTMLElement
      const nodeDOM = view.nodeDOM(from || 0) as HTMLElement
      const node = nodeDOM || domAtPos

      if (isCustomNodeSelected(editor, node)) {
        return false
      }

      return isTextSelected({ editor })
    },
    [editor],
  )

  return {
    shouldShow,
    ...states,
  }
}

export default useTextmenuStates
