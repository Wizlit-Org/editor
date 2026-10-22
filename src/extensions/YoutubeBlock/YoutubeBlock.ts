import { ReactNodeViewRenderer } from '@tiptap/react'
import { mergeAttributes, Range } from '@tiptap/core'
import { Youtube, getEmbedUrlFromYoutubeUrl } from '@tiptap/extension-youtube'
import { YoutubeBlockView } from './components/YoutubeBlockView'

export function formatYoutubeEmbedUrl(rawUrl: string): string {
  if (!rawUrl) return ''
  try {
    const url = new URL(rawUrl)
    url.searchParams.set('controls', '0')
    url.searchParams.set('modestbranding', '1')
    url.searchParams.set('rel', '0')
    url.searchParams.set('iv_load_policy', '3')
    return url.toString()
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
          let finalUrl = ''

          if (rawSrc) {
            const embedUrl = getEmbedUrlFromYoutubeUrl({
              url: rawSrc,
              allowFullscreen: this.options.allowFullscreen ?? true,
              autoplay: this.options.autoplay ?? false,
              ccLanguage: this.options.ccLanguage,
              ccLoadPolicy: this.options.ccLoadPolicy,
              disableKBcontrols: this.options.disableKBcontrols,
              enableIFrameApi: this.options.enableIFrameApi,
              endTime: this.options.endTime,
              interfaceLanguage: this.options.interfaceLanguage,
              ivLoadPolicy: this.options.ivLoadPolicy ?? 3,
              loop: this.options.loop,
              modestBranding: this.options.modestBranding ?? true,
              nocookie: this.options.nocookie ?? true,
              origin: this.options.origin,
              playlist: this.options.playlist,
              progressBarColor: this.options.progressBarColor,
              startAt: options?.start || 0,
            })

            finalUrl = formatYoutubeEmbedUrl(embedUrl || rawSrc)
          }

          return commands.insertContent({
            type: this.name,
            attrs: {
              src: finalUrl,
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
          const embedUrl = getEmbedUrlFromYoutubeUrl({
            url,
            allowFullscreen: this.options.allowFullscreen ?? true,
            autoplay: this.options.autoplay ?? false,
            nocookie: this.options.nocookie ?? true,
            ivLoadPolicy: 3,
            modestBranding: true,
          })
          const finalUrl = formatYoutubeEmbedUrl(embedUrl || url)
          return commands.updateAttributes(this.name, { src: finalUrl })
        },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(YoutubeBlockView as any)
  },
})

export default YoutubeBlock
