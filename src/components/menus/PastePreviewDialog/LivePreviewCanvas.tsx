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

  // 3) External Image or Server Image Upload
  if (selectedId === 'image-external' || selectedId === 'image-upload') {
    // Use proxy URL for server-upload preview if external CORS blocks direct img load,
    // while keeping wizlit:// badge distinction clear in the live ImageBlockView
    const previewSrc =
      selectedId === 'image-upload'
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
          class: 'min-h-full focus:outline-none pointer-events-auto',
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
      className={`relative w-full h-full overflow-y-auto overflow-x-hidden rounded-xl border transition-colors ${
        isDark
          ? 'bg-[#191919] border-white/[0.08] text-[#e3e3e3] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]'
          : 'bg-white border-black/[0.08] text-[#222325] shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)]'
      }`}
    >
      {/* Subtle Live Editor Canvas Badge */}
      <div className="sticky top-2.5 right-3 z-30 flex justify-end px-3 pointer-events-none">
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium tracking-tight backdrop-blur-md border ${
            isDark
              ? 'bg-black/55 text-zinc-300 border-white/10'
              : 'bg-white/80 text-zinc-600 border-black/10'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>
            {selectedId === 'image-upload'
              ? '서버 최적화 업로드 · 1:1 본문 미리보기'
              : selectedId === 'image-external'
                ? '외부 이미지 직접 연동 · 1:1 본문 미리보기'
                : '1:1 실제 에디터 결과 미리보기'}
          </span>
        </span>
      </div>

      {/* Actual TipTap ProseMirror Live Canvas */}
      <div className={`px-5 pb-5 pt-1 ${themeCanvasClass}`}>
        <EditorContent editor={previewEditor} className="w-full focus:outline-none" />
      </div>
    </div>
  )
}

export default LivePreviewCanvas
