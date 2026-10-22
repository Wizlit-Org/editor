import { Group } from './types'

export const GROUPS: Group[] = [
  {
    name: 'basic',
    title: '기본 텍스트',
    commands: [
      {
        name: 'paragraph',
        label: 'Text',
        iconName: 'Type',
        description: 'Just start writing with plain text',
        aliases: ['p', 'paragraph', 'text'],
        action: editor => {
          editor.chain().focus().setParagraph().run()
        },
      },
      {
        name: 'heading1',
        label: 'Heading 1',
        iconName: 'Heading1',
        description: 'High priority section title',
        aliases: ['h1'],
        action: editor => {
          editor.chain().focus().setHeading({ level: 1 }).run()
        },
      },
      {
        name: 'heading2',
        label: 'Heading 2',
        iconName: 'Heading2',
        description: 'Medium priority section title',
        aliases: ['h2'],
        action: editor => {
          editor.chain().focus().setHeading({ level: 2 }).run()
        },
      },
      {
        name: 'heading3',
        label: 'Heading 3',
        iconName: 'Heading3',
        description: 'Low priority section title',
        aliases: ['h3'],
        action: editor => {
          editor.chain().focus().setHeading({ level: 3 }).run()
        },
      },
      {
        name: 'blockquote',
        label: 'Blockquote',
        iconName: 'Quote',
        description: 'Element for quoting',
        action: editor => {
          editor.chain().focus().setBlockquote().run()
        },
      },
      {
        name: 'codeBlock',
        label: 'Code Block',
        iconName: 'SquareCode',
        description: 'Code block with syntax highlighting',
        shouldBeHidden: editor => editor.isActive('columns'),
        action: editor => {
          editor.chain().focus().setCodeBlock().run()
        },
      },
    ],
  },
  {
    name: 'lists',
    title: '목록',
    commands: [
      {
        name: 'bulletList',
        label: 'Bullet List',
        iconName: 'List',
        description: 'Unordered list of items',
        aliases: ['ul'],
        action: editor => {
          editor.chain().focus().toggleBulletList().run()
        },
      },
      {
        name: 'numberedList',
        label: 'Numbered List',
        iconName: 'ListOrdered',
        description: 'Ordered list of items',
        aliases: ['ol'],
        action: editor => {
          editor.chain().focus().toggleOrderedList().run()
        },
      },
      {
        name: 'taskList',
        label: 'Task List',
        iconName: 'ListTodo',
        description: 'Task list with todo items',
        aliases: ['todo'],
        action: editor => {
          editor.chain().focus().toggleTaskList().run()
        },
      },
    ],
  },
  {
    name: 'insert',
    title: '미디어/고급',
    commands: [
      {
        name: 'table',
        label: 'Table',
        iconName: 'Table',
        description: 'Insert a table',
        shouldBeHidden: editor => editor.isActive('columns'),
        action: editor => {
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: false }).run()
        },
      },
      {
        name: 'image',
        label: 'Image',
        iconName: 'Image',
        description: 'Insert an image',
        aliases: ['img'],
        action: editor => {
          const input = document.createElement('input')
          input.type = 'file'
          input.accept = 'image/*'
          input.multiple = true
          input.onchange = async e => {
            const files = Array.from((e.target as HTMLInputElement).files || [])
            if (files.length > 0) {
              editor.commands.uploadImages({ files })
            }
          }
          input.click()
        },
      },
      {
        name: 'youtube',
        label: 'YouTube',
        iconName: 'Video',
        description: 'Embed a YouTube video',
        aliases: ['yt', 'youtube', 'video'],
        action: editor => {
          editor.chain().focus().setYoutubeVideo({ src: '' }).run()
        },
      },
      {
        name: 'horizontalRule',
        label: 'Horizontal Rule',
        iconName: 'Minus',
        description: 'Insert a horizontal divider',
        aliases: ['hr'],
        action: editor => {
          editor.chain().focus().setHorizontalRule().run()
        },
      },
    ],
  },
]

export default GROUPS
