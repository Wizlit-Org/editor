import { Node } from '@tiptap/pm/model'
import { Selection, TextSelection } from '@tiptap/pm/state'
import { Editor } from '@tiptap/react'
import { useCallback } from 'react'

export function turnIntoBlock(
  editor: Editor,
  pos: number,
  targetType: 'paragraph' | 'heading' | 'blockquote' | 'codeBlock' | 'bulletList' | 'orderedList' | 'taskList',
  attrs: Record<string, any> = {},
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
    listPos = pos
    listNode = node
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

  const isTargetList = ['bulletList', 'orderedList', 'taskList'].includes(targetType)

  // A. Target is a list
  if (isTargetList) {
    // A-1. Already inside a list -> convert list to target list
    if (currentListType) {
      if (
        (currentListType === 'orderedList' || currentListType === 'bulletList') &&
        (targetType === 'bulletList' || targetType === 'orderedList')
      ) {
        editor.commands.command(({ tr, state }) => {
          const listNodeType = state.schema.nodes[targetType]
          if (!listNodeType) return false
          const listAttrs = targetType === 'orderedList' ? { start: 1 } : {}

          const positions: number[] = []
          if (currentListType !== targetType) {
            positions.push(listPos)
          }

          listNode.descendants((child, offset) => {
            if (
              (child.type.name === 'orderedList' || child.type.name === 'bulletList') &&
              child.type.name !== targetType
            ) {
              positions.push(listPos + 1 + offset)
            }
          })

          if (positions.length === 0) return false
          positions.sort((a, b) => b - a)

          for (const p of positions) {
            tr.setNodeMarkup(p, listNodeType, listAttrs)
          }
          return true
        })
        return
      }

      if (currentListType === targetType) return

      // Involving taskList
      const $from = editor.state.doc.resolve(listPos)
      const selFrom = Selection.findFrom($from, 1)
      const $to = editor.state.doc.resolve(listPos + listNode.nodeSize)
      const selTo = Selection.findFrom($to, -1)

      if (selFrom && selTo) {
        const sel = TextSelection.create(editor.state.doc, selFrom.from, selTo.to)
        const chain = editor.chain().focus().setTextSelection(sel)
        if (targetType === 'bulletList') chain.toggleBulletList().run()
        else if (targetType === 'orderedList') chain.toggleOrderedList().run()
        else if (targetType === 'taskList') chain.toggleTaskList().run()
      }
      return
    }

    // A-2. From blockquote -> list
    if (node.type.name === 'blockquote') {
      editor.commands.command(({ tr, state }) => {
        const itemType = targetType === 'taskList' ? state.schema.nodes.taskItem : state.schema.nodes.listItem
        if (!itemType || !state.schema.nodes[targetType]) return false
        const listItems: any[] = []
        node.forEach((child) => {
          if (child.isTextblock) {
            listItems.push(itemType.create(null, child))
          }
        })
        if (listItems.length === 0) return false
        const listAttrs = targetType === 'orderedList' ? { start: 1 } : {}
        const listNodeNew = state.schema.nodes[targetType].create(listAttrs, listItems)
        tr.replaceWith(pos, pos + node.nodeSize, listNodeNew)
        return true
      })
      return
    }

    // A-3. From non-list node -> list
    const chain = editor.chain().focus().setNodeSelection(pos)
    if (targetType === 'bulletList') chain.toggleBulletList().run()
    else if (targetType === 'orderedList') chain.toggleOrderedList().run()
    else if (targetType === 'taskList') chain.toggleTaskList().run()
    return
  }

  // B. Current node is a list and target is non-list (paragraph, heading, blockquote, codeBlock)
  if (currentListType) {
    editor.commands.command(({ tr, state }) => {
      // Extract all textblocks from the list
      const textBlocks: Node[] = []
      listNode.forEach((itemNode) => {
        itemNode.forEach((block) => {
          if (block.isTextblock) {
            textBlocks.push(block)
          } else {
            block.descendants((child) => {
              if (child.isTextblock) textBlocks.push(child)
            })
          }
        })
      })

      if (textBlocks.length === 0) {
        textBlocks.push(state.schema.nodes.paragraph.create())
      }

      if (targetType === 'paragraph') {
        const paragraphs = textBlocks.map((b) => state.schema.nodes.paragraph.create(null, b.content))
        tr.replaceWith(listPos, listPos + listNode.nodeSize, paragraphs)
        return true
      }

      if (targetType === 'heading') {
        const headingNode = state.schema.nodes.heading.create(attrs, textBlocks[0].content)
        const rest = textBlocks.slice(1).map((b) => state.schema.nodes.paragraph.create(null, b.content))
        tr.replaceWith(listPos, listPos + listNode.nodeSize, [headingNode, ...rest])
        return true
      }

      if (targetType === 'blockquote') {
        const paragraphs = textBlocks.map((b) => state.schema.nodes.paragraph.create(null, b.content))
        const quote = state.schema.nodes.blockquote.create(null, paragraphs)
        tr.replaceWith(listPos, listPos + listNode.nodeSize, quote)
        return true
      }

      if (targetType === 'codeBlock') {
        let codeText = ''
        textBlocks.forEach((b, i) => {
          let line = ''
          b.descendants((c) => {
            if (c.isText) line += c.text
          })
          codeText += (i > 0 ? '\n' : '') + line
        })
        const codeNode = state.schema.nodes.codeBlock.create(null, codeText ? state.schema.text(codeText) : null)
        tr.replaceWith(listPos, listPos + listNode.nodeSize, codeNode)
        return true
      }

      return false
    })
    return
  }

  // C. Non-list -> Non-list
  const chain = editor.chain().focus().setNodeSelection(pos)
  if (targetType === 'paragraph') {
    chain.setParagraph().run()
  } else if (targetType === 'heading') {
    chain.setHeading(attrs as any).run()
  } else if (targetType === 'blockquote') {
    chain.toggleBlockquote().run()
  } else if (targetType === 'codeBlock') {
    chain.toggleCodeBlock().run()
  }
}

export function turnIntoList(
  editor: Editor,
  pos: number,
  targetListType: 'bulletList' | 'orderedList' | 'taskList',
) {
  turnIntoBlock(editor, pos, targetListType)
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
    const selectedNode = $anchor.node(1) || (editor.state.selection as any).node

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

  const handleTurnIntoBlock = useCallback(
    (
      targetType: 'paragraph' | 'heading' | 'blockquote' | 'codeBlock' | 'bulletList' | 'orderedList' | 'taskList',
      attrs: Record<string, any> = {},
      pos = currentNodePos,
    ) => {
      turnIntoBlock(editor, pos, targetType, attrs)
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
    turnIntoBlock: handleTurnIntoBlock,
  }
}

export default useContentItemActions
