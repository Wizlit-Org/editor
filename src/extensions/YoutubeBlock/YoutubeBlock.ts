import { ReactNodeViewRenderer } from '@tiptap/react'
import { mergeAttributes } from '@tiptap/core'
import { Youtube } from '@tiptap/extension-youtube'
import { YoutubeBlockView } from './components/YoutubeBlockView'

export function formatYoutubeEmbedUrl(rawUrl: string): string {
  if (!rawUrl) return ''
  try {
    const parsed = new URL(rawUrl)
    const listId = parsed.searchParams.get('list')

    if (parsed.pathname.includes('/embed/')) {
      parsed.searchParams.set('controls', '0')
      parsed.searchParams.set('modestbranding', '1')
      parsed.searchParams.set('rel', '0')
      parsed.searchParams.set('iv_load_policy', '3')
      return parsed.toString()
    }

    const regExp = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    const match = rawUrl.match(regExp)
    const videoId = match && match[1]?.length === 11 ? match[1] : null

    let embedBase = ''
    if (videoId) {
      embedBase = `https://www.youtube.com/embed/${videoId}`
    } else if (listId) {
      embedBase = `https://www.youtube.com/embed/videoseries`
    } else {
      return rawUrl
    }

    const embedUrl = new URL(embedBase)
    if (listId) {
      embedUrl.searchParams.set('list', listId)
    }
    embedUrl.searchParams.set('controls', '0')
    embedUrl.searchParams.set('modestbranding', '1')
    embedUrl.searchParams.set('rel', '0')
    embedUrl.searchParams.set('iv_load_policy', '3')
    return embedUrl.toString()
  } catch {
    const joiner = rawUrl.includes('?') ? '&' : '?'
    return `${rawUrl}${joiner}controls=0&modestbranding=1&rel=0&iv_load_policy=3`
  }
}

export interface YoutubeBlockOptions {
  nocookie?: boolean
  allowFullscreen?: boolean
  autoplay?: boolean
  ccLanguage?: string
  ccLoadPolicy?: boolean
  disableKBcontrols?: boolean
  enableIFrameApi?: boolean
  endTime?: number
  interfaceLanguage?: string
  ivLoadPolicy?: number
  loop?: boolean
  playlist?: string
  modestBranding?: boolean
  origin?: string
  playlistId?: string
  progressBarColor?: string
  HTMLAttributes?: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    youtubeBlock: {
      setYoutubeVideo: (options: { src: string; start?: number; width?: string }) => ReturnType
      setYoutubeAlign: (align: 'left' | 'center' | 'right') => ReturnType
      setYoutubeWidth: (width: number) => ReturnType
      setYoutubeCaption: (caption: string) => ReturnType
      updateYoutubeUrl: (url: string) => ReturnType
    }
  }
}

export const YoutubeBlock = Youtube.extend<YoutubeBlockOptions>({
  name: 'youtube',

  marks: '',

  addAttributes() {
    return {
      src: {
        default: '',
        parseHTML: element => {
          return (
            element.getAttribute('src') ||
            element.querySelector('iframe')?.getAttribute('src') ||
            ''
          )
        },
      },
      start: {
        default: 0,
      },
      width: {
        default: '100%',
        parseHTML: element => element.getAttribute('data-width') || '100%',
        renderHTML: attributes => ({
          'data-width': attributes.width,
        }),
      },
      align: {
        default: 'center',
        parseHTML: element => element.getAttribute('data-align') || 'center',
        renderHTML: attributes => ({
          'data-align': attributes.align,
        }),
      },
      caption: {
        default: '',
        parseHTML: element => element.getAttribute('data-caption') || '',
        renderHTML: attributes =>
          attributes.caption ? { 'data-caption': attributes.caption } : {},
      },
      isEditing: {
        default: false,
        renderHTML: () => ({}),
      },
      nocookie: {
        default: true,
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-youtube-video] iframe',
      },
      {
        tag: 'div[data-youtube-video]',
      },
      {
        tag: 'iframe[src*="youtube.com"]',
      },
      {
        tag: 'iframe[src*="youtu.be"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      {
        'data-youtube-video': '',
        'data-width': HTMLAttributes.width || '100%',
        'data-align': HTMLAttributes.align || 'center',
        'data-caption': HTMLAttributes.caption || '',
      },
      [
        'iframe',
        mergeAttributes(this.options.HTMLAttributes || {}, HTMLAttributes, {
          src: formatYoutubeEmbedUrl(HTMLAttributes.src),
          width: '100%',
          height: '100%',
          allowfullscreen: 'true',
        }),
      ],
    ]
  },

  addCommands() {
    return {
      ...this.parent?.(),

      setYoutubeVideo:
        options =>
        ({ commands }) => {
          const rawSrc = options?.src || ''

          return commands.insertContent({
            type: this.name,
            attrs: {
              src: rawSrc,
              width: options?.width || '100%',
            },
          })
        },

      setYoutubeAlign:
        align =>
        ({ commands }) =>
          commands.updateAttributes(this.name, { align }),

      setYoutubeWidth:
        width =>
        ({ commands }) =>
          commands.updateAttributes(this.name, { width: `${Math.max(20, Math.min(100, width))}%` }),

      setYoutubeCaption:
        caption =>
        ({ commands }) =>
          commands.updateAttributes(this.name, { caption }),

      updateYoutubeUrl:
        url =>
        ({ commands }) => {
          return commands.updateAttributes(this.name, { src: url })
        },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(YoutubeBlockView as any)
  },
})

export default YoutubeBlock
