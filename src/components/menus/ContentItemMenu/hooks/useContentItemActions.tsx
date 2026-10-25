import { Node } from '@tiptap/pm/model'
import { NodeSelection, Selection, TextSelection } from '@tiptap/pm/state'
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
  let listNode = node

  if (isCurrentList) {
    currentListType = node.type.name
  } else {
    for (let d = $pos.depth; d > 0; d--) {
      const ancestor = $pos.node(d)
      if (['bulletList', 'orderedList', 'taskList'].includes(ancestor.type.name)) {
        currentListType = ancestor.type.name
        listPos = $pos.before(d)
        listNode = ancestor
        break
      }
    }
  }

  // 1. Direct atomic conversion between bulletList and orderedList (including nested sublists)
  if (
    (currentListType === 'orderedList' || currentListType === 'bulletList') &&
    (targetListType === 'bulletList' || targetListType === 'orderedList')
  ) {
    editor.commands.command(({ tr, state }) => {
      const targetType = state.schema.nodes[targetListType]
      if (!targetType) return false
      const attrs = targetListType === 'orderedList' ? { start: 1 } : {}

      // Collect all list positions inside this list (root and any descendant sublists)
      const positions: number[] = []
      if (currentListType !== targetListType) {
        positions.push(listPos)
      }

      listNode.descendants((child, offset) => {
        if (
          (child.type.name === 'orderedList' || child.type.name === 'bulletList') &&
          child.type.name !== targetListType
        ) {
          positions.push(listPos + 1 + offset)
        }
      })

      if (positions.length === 0) return false

      // Sort descending (bottom-up) to safely transform nodes
      positions.sort((a, b) => b - a)

      for (const pos of positions) {
        tr.setNodeMarkup(pos, targetType, attrs)
      }
      return true
    })
    return
  }

  if (currentListType === targetListType) {
    return
  }

  // 2. Conversion involving taskList (converting listItems <-> taskItems across entire list)
  if (currentListType) {
    const $from = editor.state.doc.resolve(listPos)
    const selFrom = Selection.findFrom($from, 1)
    const $to = editor.state.doc.resolve(listPos + listNode.nodeSize)
    const selTo = Selection.findFrom($to, -1)

    if (selFrom && selTo) {
      const sel = TextSelection.create(editor.state.doc, selFrom.from, selTo.to)
      const chain = editor.chain().focus().setTextSelection(sel)
      if (targetListType === 'bulletList') {
        chain.toggleBulletList().run()
      } else if (targetListType === 'orderedList') {
        chain.toggleOrderedList().run()
      } else if (targetListType === 'taskList') {
        chain.toggleTaskList().run()
      }
      return
    }
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
