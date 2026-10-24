import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import type { JSONContent } from '@tiptap/core'
import {
  CodeBlock,
  Document,
  Heading,
  HorizontalRule,
  ImageBlock,
  Link,
  StarterKit,
  TaskItem,
  TaskList,
  Underline,
  Youtube,
} from '@/extensions'
import { SmartPasteEventDetail } from '../SmartPasteMenu/types'

export interface LivePreviewCanvasProps {
  data: SmartPasteEventDetail
  selectedId: string
  isDark?: boolean
}

/**
 * Builds the exact ProseMirror JSON document that will be inserted into the main editor
 * for the currently selected Smart Paste tab option.
 */
export const buildPreviewDoc = (
  data: SmartPasteEventDetail,
  selectedId: string,
): JSONContent => {
  const rawText = data.text || ''

  // 1) Plain text (Safely truncate massive Base64 or multi-megabyte strings for preview rendering)
  if (selectedId === 'plain-text') {
    const displayRaw =
      rawText.length > 600
        ? `${rawText.slice(0, 360)} … ${rawText.slice(-120)} (총 ${rawText.length.toLocaleString()}자 텍스트)`
        : rawText
    const lines = displayRaw.split('\n')
    return {
      type: 'doc',
      content: lines.map(line => ({
        type: 'paragraph',
        content: line ? [{ type: 'text', text: line }] : [],
      })),
    }
  }

  // 2) Hyperlink
  if (selectedId === 'link') {
    return {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: rawText,
              marks: [{ type: 'link', attrs: { href: rawText } }],
            },
          ],
        },
      ],
    }
  }

  // 3) External Image or Server Image Upload or Base64 Image
  if (selectedId === 'image-external' || selectedId === 'image-upload') {
    const isDataUri = rawText.startsWith('data:image/')
    // For 'image-upload', use BFF proxy path so ImageBlockView renders cleanly without the '외부 이미지' badge
    // For 'image-external', keep original http(s) URL so ImageBlockView displays the '외부 이미지' badge 1:1
    const previewSrc = isDataUri
      ? rawText
      : selectedId === 'image-upload'
        ? `/api/image-proxy?url=${encodeURIComponent(rawText)}`
        : rawText

    return {
      type: 'doc',
      content: [
        {
          type: 'imageBlock',
          attrs: {
            src: previewSrc,
            width: '100%',
            align: 'center',
            caption: '',
          },
        },
      ],
    }
  }

  // 4) YouTube Video Embed
  if (selectedId === 'youtube-video') {
    const videoId = data.meta?.videoId || ''
    const embedSrc = videoId ? `https://www.youtube.com/embed/${videoId}` : rawText
    return {
      type: 'doc',
      content: [
        {
          type: 'youtube',
          attrs: {
            src: embedSrc,
            width: '100%',
            align: 'center',
          },
        },
      ],
    }
  }

  // 5) Code Block
  if (selectedId === 'code-block') {
    let cleanCode = rawText
    if (cleanCode.startsWith('```') && cleanCode.endsWith('```')) {
      cleanCode = cleanCode.replace(/^```[a-zA-Z0-9_-]*\n?/, '').replace(/\n?```$/, '')
    }
    return {
      type: 'doc',
      content: [
        {
          type: 'codeBlock',
          content: cleanCode ? [{ type: 'text', text: cleanCode }] : [],
        },
      ],
    }
  }

  // 6) Markdown List (Bullet / Ordered)
  if (selectedId === 'list-items') {
    const lines = rawText.split('\n').filter(l => l.trim().length > 0)
    const isOrdered = lines.length > 0 && /^\s*\d+\.\s+/.test(lines[0])
    const items: JSONContent[] = lines.map(line => {
      const cleanText = isOrdered
        ? line.replace(/^\s*\d+\.\s+/, '')
        : line.replace(/^\s*[-*+]\s+(\[[ xX]\]\s+)?/, '')
      return {
        type: 'listItem',
        content: [
          {
            type: 'paragraph',
            content: cleanText ? [{ type: 'text', text: cleanText }] : [],
          },
        ],
      }
    })

    return {
      type: 'doc',
      content: [
        {
          type: isOrdered ? 'orderedList' : 'bulletList',
          content:
            items.length > 0
              ? items
              : [{ type: 'listItem', content: [{ type: 'paragraph' }] }],
        },
      ],
    }
  }

  // Fallback
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: rawText ? [{ type: 'text', text: rawText }] : [],
      },
    ],
  }
}

const PREVIEW_EXTENSIONS = [
  Document,
  TaskList,
  TaskItem.configure({ nested: true }),
  Heading.configure({ levels: [1, 2, 3] }),
  HorizontalRule,
  StarterKit.configure({
    document: false,
    dropcursor: false,
    heading: false,
    horizontalRule: false,
    codeBlock: false,
    link: false,
    underline: false,
  }),
  CodeBlock,
  Underline,
  Link.configure({
    openOnClick: false,
    autolink: true,
    defaultProtocol: 'https',
    HTMLAttributes: {
      rel: 'noopener noreferrer',
      target: '_blank',
    },
  }),
  ImageBlock,
  Youtube.configure({
    nocookie: true,
  }),
]

export const LivePreviewCanvas: React.FC<LivePreviewCanvasProps> = ({
  data,
  selectedId,
  isDark = true,
}) => {
  const viewportRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState<number>(1)
  const [animReady, setAnimReady] = useState<boolean>(false)

  const previewDoc = useMemo(() => buildPreviewDoc(data, selectedId), [data, selectedId])

  const isBlockMedia =
    selectedId === 'image-external' ||
    selectedId === 'image-upload' ||
    selectedId === 'youtube-video' ||
    selectedId === 'code-block'

  // Trigger smooth crossfade + morph animation every time selectedId or data changes
  useEffect(() => {
    setAnimReady(false)
    let raf2 = 0
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        setAnimReady(true)
      })
    })
    return () => {
      window.cancelAnimationFrame(raf1)
      if (raf2) window.cancelAnimationFrame(raf2)
    }
  }, [selectedId, data])

  const previewEditor = useEditor(
    {
      editable: false,
      immediatelyRender: false,
      shouldRerenderOnTransaction: false,
      extensions: PREVIEW_EXTENSIONS,
      content: previewDoc,
      editorProps: {
        attributes: {
          class: '!min-h-0 !p-0 !m-0 focus:outline-none pointer-events-auto break-all !bg-transparent',
        },
      },
    },
    [],
  )

  const recomputeScale = useCallback(() => {
    const viewportEl = viewportRef.current
    const contentEl = contentRef.current
    if (!viewportEl || !contentEl) return

    const availH = Math.max(140, viewportEl.clientHeight - 32)
    const availW = Math.max(220, Math.min(720, viewportEl.clientWidth - 48))

    const naturalH = Math.max(1, contentEl.scrollHeight || contentEl.offsetHeight)
    const naturalW = Math.max(1, contentEl.offsetWidth || 1)

    const nextScale = Math.min(1, availH / naturalH, availW / naturalW)
    const rounded = Math.max(0.18, Math.round(nextScale * 1000) / 1000)
    setScale(prev => (Math.abs(prev - rounded) > 0.005 ? rounded : prev))
  }, [])

  useEffect(() => {
    if (previewEditor && !previewEditor.isDestroyed) {
      setScale(1)
      previewEditor.commands.setContent(previewDoc, { emitUpdate: false })
      requestAnimationFrame(() => {
        recomputeScale()
      })
    }
  }, [previewEditor, previewDoc, recomputeScale])

  useEffect(() => {
    const contentEl = contentRef.current
    const viewportEl = viewportRef.current
    if (!contentEl || !viewportEl) return

    recomputeScale()

    const ro = new ResizeObserver(() => {
      recomputeScale()
    })
    ro.observe(contentEl)
    ro.observe(viewportEl)

    const mo = new MutationObserver(() => {
      recomputeScale()
    })
    mo.observe(contentEl, { childList: true, subtree: true, attributes: true })

    const handleAssetLoad = () => {
      recomputeScale()
      setTimeout(recomputeScale, 50)
    }
    contentEl.addEventListener('load', handleAssetLoad, true)

    const t1 = setTimeout(recomputeScale, 60)
    const t2 = setTimeout(recomputeScale, 220)

    return () => {
      ro.disconnect()
      mo.disconnect()
      contentEl.removeEventListener('load', handleAssetLoad, true)
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [recomputeScale, selectedId, data])

  return (
    <div
      ref={viewportRef}
      onScrollCapture={e => e.stopPropagation()}
      onWheelCapture={e => e.stopPropagation()}
      style={{
        width: '100%',
        height: '100%',
        flex: 1,
        minHeight: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        backgroundColor: 'transparent',
        padding: '16px 24px',
        color: isDark ? '#f4f4f5' : '#18181b',
      }}
      className={`w-full h-full flex-1 min-h-0 overflow-hidden flex items-center justify-center !bg-transparent ${
        isDark ? 'dark theme-dark text-zinc-100' : 'theme-light text-zinc-900'
      } [&_figure]:!my-0 [&_.node-imageBlock]:!my-0 [&_[data-node-view-wrapper]]:!my-0 [&_.ProseMirror]:!bg-transparent`}
    >
      {/* Frameless Center Stage Preview: Auto-Scaled & Animated on Option Switch Without Box Frame */}
      <div
        ref={contentRef}
        onClick={e => e.stopPropagation()}
        style={{
          width: isBlockMedia ? 'min(672px, 90vw)' : 'fit-content',
          maxWidth: 'min(672px, 90vw)',
          opacity: animReady ? 1 : 0,
          filter: animReady ? 'blur(0px)' : 'blur(6px)',
          transform: `${scale < 1 ? `scale(${scale}) ` : ''}${
            animReady ? 'translateY(0px) scale(1)' : 'translateY(10px) scale(0.96)'
          }`,
          transformOrigin: 'center center',
          transition: animReady
            ? 'opacity 260ms cubic-bezier(0.16, 1, 0.3, 1), transform 260ms cubic-bezier(0.16, 1, 0.3, 1), filter 260ms cubic-bezier(0.16, 1, 0.3, 1)'
            : 'none',
          backgroundColor: 'transparent',
        }}
        className={`shrink-0 !bg-transparent ${
          isBlockMedia
            ? ''
            : '[&_.ProseMirror]:!w-fit [&_.ProseMirror]:!max-w-[672px] [&_.ProseMirror]:!mx-auto'
        }`}
      >
        <EditorContent editor={previewEditor} className="w-full focus:outline-none !bg-transparent" />
      </div>
    </div>
  )
}

export default LivePreviewCanvas
