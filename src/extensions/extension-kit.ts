'use client'

// import { HocuspocusProvider } from '@hocuspocus/provider'

import {
  BlockquoteFigure,
  CharacterCount,
  CodeBlock,
  // Color,
  Document,
  Dropcursor,
  // Emoji,
  Figcaption,
  // FileHandler,
  Focus,
  // FontFamily,
  // FontSize,
  Heading,
  Highlight,
  HorizontalRule,
  ImageBlock,
  Link,
  Placeholder,
  Selection,
  SlashCommand,
  StarterKit,
  Subscript,
  Superscript,
  Table,
  TableCell,
  TableHeader,
  TableRow,
  // TextAlign,
  TextStyle,
  TrailingNode,
  Typography,
  Underline,
  // emojiSuggestion,
  Columns,
  Column,
  TaskItem,
  TaskList,
  // UniqueID,
  History,
  Youtube,
  ColorHighlighter,
  SmilieReplacer,
  LimitEmbedsPlugin,
} from '.'

import { isChangeOrigin } from '@tiptap/extension-collaboration'
import drawIoExtension from '@rcode-link/tiptap-drawio'
import { ImageUpload } from './ImageUpload'

interface ExtensionKitProps {
  // provider?: HocuspocusProvider | null
  limit?: number
  editable?: boolean
  onUploadImage?: (file: File) => Promise<string>
  maxSize?: number
  maxEmbeddings?: number
}

export const ExtensionKit = ({ 
  editable, 
  limit,
  onUploadImage,
  maxSize,
  maxEmbeddings,
}: ExtensionKitProps) => [
  Document,
  Columns,
  TaskList,
  TaskItem.configure({
    nested: true,
  }),
  Column,
  Selection,
  Heading.configure({
    levels: [1, 2],
  }),
  HorizontalRule,
  // UniqueID.configure({
  //   types: ['paragraph', 'heading', 'blockquote', 'codeBlock', 'table'],
  //   filterTransaction: transaction => !isChangeOrigin(transaction),
  // }),
  StarterKit.configure({
    document: false,
    dropcursor: false,
    heading: false,
    horizontalRule: false,
    blockquote: false,
    history: false,
    codeBlock: false,
  }),
  CodeBlock,
  TextStyle,
  // FontSize,
  // FontFamily,
  // Color,
  TrailingNode,
  Link.configure({
    openOnClick: !editable,
    autolink: true,
    defaultProtocol: 'https',
  }),
  Highlight.configure({ multicolor: true }),
  Underline,
  CharacterCount.configure({ limit }),
  ImageBlock,
  ImageUpload.configure({
    onUpload: onUploadImage,
    maxSize,
    maxEmbeddings,
    maxImagesPerAction: 3,
  }),
  // FileHandler.configure({
  //   allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
  //   onDrop: (currentEditor, files, pos) => {
  //     files.forEach(async file => {
  //       const url = await API.uploadImage(file)

  //       currentEditor.chain().setImageBlockAt({ pos, src: url }).focus().run()
  //     })
  //   },
  //   onPaste: (currentEditor, files) => {
  //     files.forEach(async file => {
  //       const url = await API.uploadImage(file)

  //       return currentEditor
  //         .chain()
  //         .setImageBlockAt({ pos: currentEditor.state.selection.anchor, src: url })
  //         .focus()
  //         .run()
  //     })
  //   },
  // }),
  // Emoji.configure({
  //   enableEmoticons: true,
  //   suggestion: emojiSuggestion,
  // }),
  // TextAlign.extend({
  //   addKeyboardShortcuts() {
  //     return {}
  //   },
  // }).configure({
  //   types: ['heading', 'paragraph'],
  // }),
  Subscript,
  Superscript,
  Table,
  TableCell,
  TableHeader,
  TableRow,
  Typography,
  Placeholder.configure({
    includeChildren: true,
    showOnlyCurrent: false,
    placeholder: () => '',
  }),
  SlashCommand,
  Focus,
  Figcaption,
  BlockquoteFigure,
  Dropcursor.configure({
    width: 2,
    class: 'ProseMirror-dropcursor border-black',
  }),
  History,
  Youtube.configure({
    nocookie: true,
  }),
  // drawIoExtension.configure({
  //   openDialog: 'dblclick',
  // }),
  ColorHighlighter,
  SmilieReplacer,
  LimitEmbedsPlugin(maxEmbeddings),
]

export default ExtensionKit
