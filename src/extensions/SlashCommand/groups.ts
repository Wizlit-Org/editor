import { Group } from './types'

export const GROUPS: Group[] = [
  // {
  //   name: 'ai',
  //   title: 'AI',
  //   commands: [
  //     {
  //       name: 'aiWriter',
  //       label: 'AI Writer',
  //       iconName: 'Sparkles',
  //       description: 'Let AI finish your thoughts',
  //       shouldBeHidden: editor => editor.isActive('columns'),
  //       action: () => {}
  //       // action: editor => editor.chain().focus().setAiWriter().run(),
  //     },
  //     {
  //       name: 'aiImage',
  //       label: 'AI Image',
  //       iconName: 'Sparkles',
  //       description: 'Generate an image from text',
  //       shouldBeHidden: editor => editor.isActive('columns'),
  //       action: () => {}
  //       // action: editor => editor.chain().focus().setAiImage().run(),
  //     },
  //   ],
  // },
  {
    name: 'format',
    title: 'Format',
    commands: [
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
    name: 'insert',
    title: 'Insert',
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
          // Create a hidden file input
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          input.multiple = true;
          
          // Handle file selection
          input.onchange = async (e) => {
            const files = Array.from((e.target as HTMLInputElement).files || []);
            if (files.length > 0) {
              editor.commands.uploadImages({ files });
            }
          };
          
          // Trigger file selection dialog
          input.click();
        },
      },
      {
        name: 'columns',
        label: 'Columns',
        iconName: 'Columns2',
        description: 'Add two column content',
        aliases: ['cols'],
        shouldBeHidden: editor => editor.isActive('columns'),
        action: editor => {
          editor
            .chain()
            .focus()
            .setColumns()
            .focus(editor.state.selection.head - 1)
            .run()
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
  {
    name: 'external',
    title: 'External',
    commands: [
      {
        name: 'youtube',
        label: 'Youtube',
        iconName: 'Youtube',
        description: 'Insert a youtube video',
        aliases: ['iframe'],
        action: editor => {
          const url = prompt('Enter YouTube URL')
      
          if (url) {
            editor.commands.setYoutubeVideo({
              src: url,
              // width: 640,
              // height: 360,
            })
          }
        },
      },
      // {
      //   name: 'drawio',
      //   label: 'Drawio',
      //   iconName: 'Blocks',
      //   description: 'Insert a drawio diagram',
      //   action: editor => {
      //     editor.chain().focus().insertDrawIo().run()
      //   },
      // },
    ],
  },
]

export default GROUPS
