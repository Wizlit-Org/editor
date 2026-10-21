import { Editor, useEditorState } from '@tiptap/react'
import { ContentPickerOptions } from '../components/ContentTypePicker'

export const useTextmenuContentTypes = (editor: Editor) => {
  return useEditorState({
    editor,
    selector: (ctx): ContentPickerOptions => [
      {
        type: 'category',
        label: 'Hierarchy',
        id: 'hierarchy',
      },
      {
        icon: 'Pilcrow',
        onClick: () =>
          ctx.editor.chain().focus().lift('taskItem').liftListItem('listItem').setParagraph().run(),
        id: 'paragraph',
        disabled: () => !ctx.editor.can().setParagraph(),
        isActive: () =>
          ctx.editor.isActive('paragraph') &&
          !ctx.editor.isActive('orderedList') &&
          !ctx.editor.isActive('bulletList') &&
          !ctx.editor.isActive('taskList') &&
          !ctx.editor.isActive('blockquote') &&
          !ctx.editor.isActive('codeBlock'),
        label: 'Paragraph',
        type: 'option',
      },
      {
        icon: 'Heading1',
        onClick: () =>
          ctx.editor.chain().focus().lift('taskItem').liftListItem('listItem').setHeading({ level: 1 }).run(),
        id: 'heading1',
        disabled: () => !ctx.editor.can().setHeading({ level: 1 }),
        isActive: () => ctx.editor.isActive('heading', { level: 1 }),
        label: 'Heading 1',
        type: 'option',
      },
      {
        icon: 'Heading2',
        onClick: () =>
          ctx.editor.chain().focus().lift('taskItem').liftListItem('listItem').setHeading({ level: 2 }).run(),
        id: 'heading2',
        disabled: () => !ctx.editor.can().setHeading({ level: 2 }),
        isActive: () => ctx.editor.isActive('heading', { level: 2 }),
        label: 'Heading 2',
        type: 'option',
      },
      {
        icon: 'Heading3',
        onClick: () =>
          ctx.editor.chain().focus().lift('taskItem').liftListItem('listItem').setHeading({ level: 3 }).run(),
        id: 'heading3',
        disabled: () => !ctx.editor.can().setHeading({ level: 3 }),
        isActive: () => ctx.editor.isActive('heading', { level: 3 }),
        label: 'Heading 3',
        type: 'option',
      },
      {
        type: 'category',
        label: 'Lists',
        id: 'lists',
      },
      {
        icon: 'List',
        onClick: () => ctx.editor.chain().focus().toggleBulletList().run(),
        id: 'bulletList',
        disabled: () => !ctx.editor.can().toggleBulletList(),
        isActive: () => ctx.editor.isActive('bulletList'),
        label: 'Bullet list',
        type: 'option',
      },
      {
        icon: 'ListOrdered',
        onClick: () => ctx.editor.chain().focus().toggleOrderedList().run(),
        id: 'orderedList',
        disabled: () => !ctx.editor.can().toggleOrderedList(),
        isActive: () => ctx.editor.isActive('orderedList'),
        label: 'Numbered list',
        type: 'option',
      },
      {
        icon: 'ListTodo',
        onClick: () => ctx.editor.chain().focus().toggleTaskList().run(),
        id: 'todoList',
        disabled: () => !ctx.editor.can().toggleTaskList(),
        isActive: () => ctx.editor.isActive('taskList'),
        label: 'Todo list',
        type: 'option',
      },
      {
        type: 'category',
        label: 'Advanced',
        id: 'advanced',
      },
      {
        icon: 'Quote',
        onClick: () => {
          const chain = ctx.editor.chain().focus() as any
          if (typeof chain.toggleBlockquote === 'function') {
            chain.toggleBlockquote().run()
          } else if (typeof chain.setBlockquote === 'function') {
            chain.setBlockquote().run()
          }
        },
        id: 'blockquote',
        disabled: () => {
          const can = ctx.editor.can() as any
          if (typeof can.toggleBlockquote === 'function') {
            return !can.toggleBlockquote()
          }
          if (typeof can.setBlockquote === 'function') {
            return !can.setBlockquote()
          }
          return false
        },
        isActive: () => ctx.editor.isActive('blockquote'),
        label: 'Quote',
        type: 'option',
      },
      {
        icon: 'SquareCode',
        onClick: () => {
          const chain = ctx.editor.chain().focus() as any
          if (typeof chain.toggleCodeBlock === 'function') {
            chain.toggleCodeBlock().run()
          } else if (typeof chain.setCodeBlock === 'function') {
            chain.setCodeBlock().run()
          }
        },
        id: 'codeBlock',
        disabled: () => {
          const can = ctx.editor.can() as any
          if (typeof can.toggleCodeBlock === 'function') {
            return !can.toggleCodeBlock()
          }
          if (typeof can.setCodeBlock === 'function') {
            return !can.setCodeBlock()
          }
          return false
        },
        isActive: () => ctx.editor.isActive('codeBlock'),
        label: 'Code block',
        type: 'option',
      },
    ],
  })
}

export default useTextmenuContentTypes
