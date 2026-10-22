import { Editor } from '@tiptap/react'
import { SmartPasteType } from './types'

export const YOUTUBE_REGEX =
  /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/

export const detectPasteType = (
  text: string,
): { type: SmartPasteType; meta?: Record<string, string> } | null => {
  const trimmed = text.trim()
  if (!trimmed) return null

  // 1) URL Detection
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed)

      // YouTube URL
      const ytMatch = trimmed.match(YOUTUBE_REGEX)
      if (ytMatch) {
        return { type: 'youtube_url', meta: { videoId: ytMatch[1], url: trimmed } }
      }

      // Image URL
      const isImg = /\.(png|jpe?g|gif|webp|svg|bmp|ico|avif|tiff)(\?.*)?$/i.test(url.pathname)
      if (isImg) {
        return { type: 'image_url', meta: { url: trimmed } }
      }

      // General Web URL
      return { type: 'web_url', meta: { url: trimmed } }
    } catch {
      // Not a valid URL, continue to next checks
    }
  }

  // 2) Code Snippet Detection
  // Check for markdown code fences
  if (trimmed.startsWith('```') && trimmed.endsWith('```')) {
    return { type: 'code' }
  }

  const lines = trimmed.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length >= 2) {
    const codePatterns = [
      /^(const|let|var|function|class|import|export|def|return|if|for|while|switch|case|break|try|catch|finally|async|await)\b/,
      /[{};]$/,
      /(=>|===|!==|&&|\|\||\+\+|--|\+=|-=)/,
      /^(public|private|protected|static|final|void|int|string|boolean)\b/i,
      /^(<([a-z][a-z0-9]*)\b[^>]*>|.*<\/[a-z][a-z0-9]*>)$/i,
      /^\s*(\{|\}|\[|\])\s*$/,
      /^[a-zA-Z0-9_]+\s*\([^)]*\)\s*\{?$/,
    ]
    const codeMatches = lines.filter(line => codePatterns.some(p => p.test(line)))
    if (codeMatches.length >= 2 && codeMatches.length / lines.length >= 0.35) {
      return { type: 'code' }
    }

    // 3) Markdown List Detection
    const listRegex = /^\s*([-*+]|\d+\.)(\s+\[[ xX]\])?\s+.+/
    const listMatches = lines.filter(line => listRegex.test(line))
    if (listMatches.length >= 2 && listMatches.length / lines.length >= 0.6) {
      return { type: 'list' }
    }
  }

  return null
}

export const insertPlainText = (editor: Editor, text: string) => {
  editor.chain().focus().insertContent(text).run()
}

export const insertHyperlink = (editor: Editor, url: string) => {
  if (!editor.state.selection.empty) {
    editor.chain().focus().setLink({ href: url }).run()
  } else {
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'text',
        text: url,
        marks: [{ type: 'link', attrs: { href: url } }],
      })
      .run()
  }
}

export const insertYoutube = (editor: Editor, videoId: string) => {
  editor
    .chain()
    .focus()
    .setYoutubeVideo({
      src: `https://www.youtube.com/embed/${videoId}`,
    })
    .run()
}

export const insertImage = (editor: Editor, src: string) => {
  editor.chain().focus().setImageBlock({ src }).run()
}

export const insertCodeBlock = (editor: Editor, rawText: string) => {
  let cleanCode = rawText
  if (cleanCode.startsWith('```') && cleanCode.endsWith('```')) {
    cleanCode = cleanCode.replace(/^```[a-zA-Z0-9_-]*\n?/, '').replace(/\n?```$/, '')
  }
  editor
    .chain()
    .focus()
    .insertContent({
      type: 'codeBlock',
      content: cleanCode ? [{ type: 'text', text: cleanCode }] : [],
    })
    .run()
}

export const insertMarkdownList = (editor: Editor, text: string) => {
  const lines = text.split('\n').filter(l => l.trim().length > 0)
  const isOrdered = /^\s*\d+\.\s+/.test(lines[0])

  const items = lines.map(line => {
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

  editor
    .chain()
    .focus()
    .insertContent({
      type: isOrdered ? 'orderedList' : 'bulletList',
      content: items,
    })
    .run()
}
