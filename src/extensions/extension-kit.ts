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
  TextAlign,
  // TextStyle,
  TrailingNode,
  Typography,
  Underline,
  // emojiSuggestion,
  TaskItem,
  TaskList,
  // UniqueID,
  History,
  Youtube,
  // ColorHighlighter,
  SmilieReplacer,
  LimitEmbedsPlugin,
} from '.'

import { ImageUpload } from './ImageUpload'
import { ConvertSrc, OnImageClick } from './ImageBlock/components/ImageBlockView'
import { ListMaxDepthGuard } from './ListMaxDepthGuard/ListMaxDepthGuard'

interface ExtensionKitProps {
  // provider?: HocuspocusProvider | null
  limit?: number
  onUploadImage?: (file: File) => Promise<string>
  convertSrc?: ConvertSrc
  onImageClick?: OnImageClick
  imageProxyUrl?: (url: string) => string
  maxSize?: number
  maxEmbeddings?: number
}

export const ExtensionKit = ({ 
  limit,
  onUploadImage,
  maxSize,
  maxEmbeddings,
  convertSrc,
  onImageClick,
  imageProxyUrl,
}: ExtensionKitProps) => [
  Document,
  TaskList,
  TaskItem.configure({
    nested: true,
  }),
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
    undoRedo: false,
    codeBlock: false,
    link: false,
    trailingNode: false,
    underline: false,
  }),
  CodeBlock,
  // FontSize,
  // FontFamily,
  // Color,
  TrailingNode,
  Link.configure({
    openOnClick: false,
    autolink: true,
    defaultProtocol: 'https',
    HTMLAttributes: {
      rel: null,
      target: null,
    },
  }),
  Underline,
  CharacterCount.configure({ limit }),
  ImageBlock.configure({
    convertSrc,
    onImageClick,
  }),
  ImageUpload.configure({
    onUpload: onUploadImage,
    maxSize,
    maxEmbeddings,
    maxImagesPerAction: 3,
    imageProxyUrl,
  }),
  // FileHandler.configure({
  //   allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
  //   onDrop: (currentEditor, files, pos) => {
  //     files.forEach(async file => {
  //       const url = await API.uploadImage(file)
  //
  //       currentEditor.chain().setImageBlockAt({ pos, src: url }).focus().run()
  //     })
  //   },
  //   onPaste: (currentEditor, files) => {
  //     files.forEach(async file => {
  //       const url = await API.uploadImage(file)
  //
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
  TextAlign.extend({
    addKeyboardShortcuts() {
      return {}
    },
  }).configure({
    types: ['heading', 'paragraph'],
  }),
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
    color: 'var(--editor-primary, #faaf2d)',
    class: 'ProseMirror-dropcursor',
  }),
  History,
  Youtube.configure({
    nocookie: true,
  }),
  // drawIoExtension.configure({
  //   openDialog: 'dblclick',
  // }),
  SmilieReplacer,
  LimitEmbedsPlugin(maxEmbeddings),
  ListMaxDepthGuard,
]

export default ExtensionKit
