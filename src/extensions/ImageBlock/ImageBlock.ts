import { ReactNodeViewRenderer } from '@tiptap/react'
import { mergeAttributes, Range } from '@tiptap/core'

import { ConvertSrc, ImageBlockView, OnImageClick } from './components/ImageBlockView'
import { Image } from '../Image'

export interface ImageBlockOptions {
  convertSrc?: ConvertSrc
  onImageClick?: OnImageClick
  HTMLAttributes?: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    imageBlock: {
      setImageBlock: (attributes: { src: string }) => ReturnType
      setImageBlockAt: (attributes: { src: string; pos: number | Range }) => ReturnType
      setImageBlockAlign: (align: 'left' | 'center' | 'right') => ReturnType
      setImageBlockWidth: (width: number) => ReturnType
    }
  }
}

export const ImageBlock = Image.extend<ImageBlockOptions>({
  name: 'imageBlock',

  group: 'block',

  defining: true,

  isolating: true,

  draggable: true,

  addOptions() {
    return {
      ...this.parent?.(),
      convertSrc: undefined,
      onImageClick: undefined,
    }
  },

  addAttributes() {
    return {
      src: {
        default: '',
        parseHTML: element => element.getAttribute('src'),
        renderHTML: attributes => ({
          src: attributes.src,
        }),
      },
      width: {
        default: '100%',
        parseHTML: element => element.getAttribute('data-width'),
        renderHTML: attributes => ({
          'data-width': attributes.width,
        }),
      },
      align: {
        default: 'center',
        parseHTML: element => element.getAttribute('data-align'),
        renderHTML: attributes => ({
          'data-align': attributes.align,
        }),
      },
      alt: {
        default: undefined,
        parseHTML: element => element.getAttribute('alt'),
        renderHTML: attributes => ({
          alt: attributes.alt,
        }),
      },
    }
  },

  // parseHTML() {
  //   return [
  //     {
  //       tag: 'img[src*="tiptap.dev"]:not([src^="data:"]), img[src*="windows.net"]:not([src^="data:"])',
  //     },
  //   ]
  // },

  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(this.options.HTMLAttributes || {}, HTMLAttributes)]
  },

  addCommands() {
    return {
      setImageBlock:
        attrs =>
        ({ commands }) => {
          return commands.insertContent({ type: 'imageBlock', attrs: { src: attrs.src } })
        },

      setImageBlockAt:
        attrs =>
        ({ commands }) => {
          return commands.insertContentAt(attrs.pos, { type: 'imageBlock', attrs: { src: attrs.src } })
        },

      setImageBlockAlign:
        align =>
        ({ commands }) =>
          commands.updateAttributes('imageBlock', { align }),

      setImageBlockWidth:
        width =>
        ({ commands }) =>
          commands.updateAttributes('imageBlock', { width: `${Math.max(0, Math.min(100, width))}%` }),
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageBlockView as any)
  },
})

export default ImageBlock
