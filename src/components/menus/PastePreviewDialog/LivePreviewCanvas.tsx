import React, { useEffect, useMemo } from 'react'
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

  // 1) Plain text
  if (selectedId === 'plain-text') {
    const lines = rawText.split('\n')
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
  const previewDoc = useMemo(() => buildPreviewDoc(data, selectedId), [data, selectedId])

  const previewEditor = useEditor(
    {
      editable: false,
      immediatelyRender: false,
      shouldRerenderOnTransaction: false,
      extensions: PREVIEW_EXTENSIONS,
      content: previewDoc,
      editorProps: {
        attributes: {
          class: '!min-h-0 focus:outline-none pointer-events-auto',
        },
      },
    },
    [],
  )

  useEffect(() => {
    if (previewEditor && !previewEditor.isDestroyed) {
      previewEditor.commands.setContent(previewDoc, { emitUpdate: false })
    }
  }, [previewEditor, previewDoc])

  const themeCanvasClass = isDark
    ? 'dark theme-dark notion-dark-canvas'
    : 'theme-light notion-light-canvas'

  return (
    <div
      className={`w-full px-4 py-3 ${
        isDark ? 'bg-[#141417]' : 'bg-zinc-100/75'
      }`}
    >
      {/* Preview Section Caption */}
      <div className="flex items-center justify-between mb-1.5 px-1">
        <span
          className={`text-[11px] font-semibold tracking-tight ${
            isDark ? 'text-zinc-400' : 'text-zinc-500'
          }`}
        >
          에디터 미리보기
        </span>
        <span
          className={`text-[10px] ${
            isDark ? 'text-zinc-500' : 'text-zinc-400'
          }`}
        >
          실제 본문에 삽입될 화면
        </span>
      </div>

      {/* Strictly Fixed-Height 260px Viewport (0px dialog height jitter on tab switch) */}
      <div
        className={`h-[260px] min-h-[260px] max-h-[260px] w-full overflow-y-auto overflow-x-hidden rounded-xl border px-5 py-4 ${themeCanvasClass} ${
          isDark
            ? 'bg-[#191919] border-white/[0.08] text-[#e3e3e3] shadow-inner'
            : 'bg-white border-black/[0.08] text-[#222325] shadow-inner'
        } [&_figure]:!my-0 [&_.node-imageBlock]:!my-0 [&_[data-node-view-wrapper]]:!my-0 [&_img]:!max-h-[210px] [&_img]:!w-auto [&_img]:!mx-auto`}
      >
        <EditorContent editor={previewEditor} className="w-full focus:outline-none" />
      </div>
    </div>
  )
}

export default LivePreviewCanvas
