import { Node } from '@tiptap/pm/model'
import { NodeSelection, Selection } from '@tiptap/pm/state'
import { Editor } from '@tiptap/react'
import { useCallback } from 'react'

export function turnIntoList(
  editor: Editor,
  pos: number,
  targetListType: 'bulletList' | 'orderedList' | 'taskList',
) {
  if (pos < 0 || !editor || pos >= editor.state.doc.content.size) return

  const node = editor.state.doc.nodeAt(pos)
  if (!node) return

  const $pos = editor.state.doc.resolve(pos)
  const isCurrentList = ['bulletList', 'orderedList', 'taskList'].includes(node.type.name)

  let currentListType: string | null = null
  let listPos = pos

  if (isCurrentList) {
    currentListType = node.type.name
  } else {
    for (let d = $pos.depth; d > 0; d--) {
      const ancestor = $pos.node(d)
      if (['bulletList', 'orderedList', 'taskList'].includes(ancestor.type.name)) {
        currentListType = ancestor.type.name
        listPos = $pos.before(d)
        break
      }
    }
  }

  if (currentListType === targetListType) {
    return
  }

  if (currentListType) {
    const $listPos = editor.state.doc.resolve(listPos)
    const innerSel = Selection.findFrom($listPos, 1)
    const targetPos = innerSel ? innerSel.from : listPos + 1

    const chain = editor.chain().focus().setTextSelection(targetPos)
    if (targetListType === 'bulletList') {
      chain.toggleBulletList().run()
    } else if (targetListType === 'orderedList') {
      chain.toggleOrderedList().run()
    } else if (targetListType === 'taskList') {
      chain.toggleTaskList().run()
    }
    return
  }

  const chain = editor.chain().focus().setNodeSelection(pos)
  if (targetListType === 'bulletList') {
    chain.toggleBulletList().run()
  } else if (targetListType === 'orderedList') {
    chain.toggleOrderedList().run()
  } else if (targetListType === 'taskList') {
    chain.toggleTaskList().run()
  }
}

const useContentItemActions = (editor: Editor, currentNode: Node | null, currentNodePos: number) => {
  const resetTextFormatting = useCallback(() => {
    const chain = editor.chain()

    chain.setNodeSelection(currentNodePos).unsetAllMarks()

    if (currentNode?.type.name !== 'paragraph') {
      chain.setParagraph()
    }

    chain.run()
  }, [editor, currentNodePos, currentNode?.type.name])

  const duplicateNode = useCallback(() => {
    editor.commands.setNodeSelection(currentNodePos)

    const { $anchor } = editor.state.selection
    const selectedNode = $anchor.node(1) || (editor.state.selection as NodeSelection).node

    editor
      .chain()
      .setMeta('hideDragHandle', true)
      .insertContentAt(currentNodePos + (currentNode?.nodeSize || 0), selectedNode.toJSON())
      .run()
  }, [editor, currentNodePos, currentNode?.nodeSize])

  const copyNodeToClipboard = useCallback(() => {
    editor.chain().setMeta('hideDragHandle', true).setNodeSelection(currentNodePos).run()

    document.execCommand('copy')
  }, [editor, currentNodePos])

  const deleteNode = useCallback(() => {
    editor.chain().setMeta('hideDragHandle', true).setNodeSelection(currentNodePos).deleteSelection().run()
  }, [editor, currentNodePos])

  const handleAdd = useCallback(() => {
    if (currentNodePos !== -1) {
      const currentNodeSize = currentNode?.nodeSize || 0
      const insertPos = currentNodePos + currentNodeSize
      const currentNodeIsEmptyParagraph = currentNode?.type.name === 'paragraph' && currentNode?.content?.size === 0
      const focusPos = currentNodeIsEmptyParagraph ? currentNodePos + 2 : insertPos + 2

      editor
        .chain()
        .command(({ dispatch, tr, state }) => {
          if (dispatch) {
            if (currentNodeIsEmptyParagraph) {
              tr.insertText('/', currentNodePos, currentNodePos + 1)
            } else {
              tr.insert(insertPos, state.schema.nodes.paragraph.create(null, [state.schema.text('/')]))
            }

            return dispatch(tr)
          }

          return true
        })
        .focus(focusPos)
        .run()
    }
  }, [currentNode, currentNodePos, editor])

  const handleTurnIntoList = useCallback(
    (targetListType: 'bulletList' | 'orderedList' | 'taskList', pos = currentNodePos) => {
      turnIntoList(editor, pos, targetListType)
    },
    [editor, currentNodePos],
  )

  return {
    resetTextFormatting,
    duplicateNode,
    copyNodeToClipboard,
    deleteNode,
    handleAdd,
    turnIntoList: handleTurnIntoList,
  }
}

export default useContentItemActions
