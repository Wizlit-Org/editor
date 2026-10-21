import { ReactNodeViewRenderer } from '@tiptap/react'
import { mergeAttributes, Range } from '@tiptap/core'
import { Youtube, getEmbedUrlFromYoutubeUrl } from '@tiptap/extension-youtube'
import { YoutubeBlockView } from './components/YoutubeBlockView'

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

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: element => {
          return (
            element.getAttribute('src') ||
            element.querySelector('iframe')?.getAttribute('src') ||
            null
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
          src: HTMLAttributes.src,
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
          if (!options.src) {
            return false
          }

          const embedUrl = getEmbedUrlFromYoutubeUrl({
            url: options.src,
            allowFullscreen: this.options.allowFullscreen ?? true,
            autoplay: this.options.autoplay ?? false,
            ccLanguage: this.options.ccLanguage,
            ccLoadPolicy: this.options.ccLoadPolicy,
            disableKBcontrols: this.options.disableKBcontrols,
            enableIFrameApi: this.options.enableIFrameApi,
            endTime: this.options.endTime,
            interfaceLanguage: this.options.interfaceLanguage,
            ivLoadPolicy: this.options.ivLoadPolicy,
            loop: this.options.loop,
            modestBranding: this.options.modestBranding,
            nocookie: this.options.nocookie ?? true,
            origin: this.options.origin,
            playlist: this.options.playlist,
            progressBarColor: this.options.progressBarColor,
            startAt: options.start || 0,
          })

          return commands.insertContent({
            type: this.name,
            attrs: {
              src: embedUrl || options.src,
              width: options.width || '100%',
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
          })
          return commands.updateAttributes(this.name, { src: embedUrl || url })
        },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(YoutubeBlockView as any)
  },
})

export default YoutubeBlock
