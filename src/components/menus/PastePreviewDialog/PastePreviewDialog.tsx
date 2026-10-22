import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Editor } from '@tiptap/react'
import { Icon } from '@/components/ui/Icon'
import { SmartPasteEventDetail } from '../SmartPasteMenu/types'
import {
  insertCodeBlock,
  insertHyperlink,
  insertImage,
  insertMarkdownList,
  insertPlainText,
  insertYoutube,
} from '../SmartPasteMenu/utils'

export interface PastePreviewDialogProps {
  editor: Editor
}

interface PasteOptionItem {
  id: string
  label: string
  icon: string
  isPrimary?: boolean
  insert: () => void
}

export const PastePreviewDialog: React.FC<PastePreviewDialogProps> = ({ editor }) => {
  const [data, setData] = useState<SmartPasteEventDetail | null>(null)
  const [selectedId, setSelectedId] = useState<string>('')
  const [imgError, setImgError] = useState(false)
  const [ogMeta, setOgMeta] = useState<{ title?: string; image?: string; domain?: string } | null>(null)

  // Pure cancel/close (without inserting anything)
  const handleClose = useCallback(() => {
    setData(null)
    setSelectedId('')
    setImgError(false)
    setOgMeta(null)
  }, [])

  // Build options based on detected type
  const options = useMemo<PasteOptionItem[]>(() => {
    if (!data) return []

    const plainTextOpt: PasteOptionItem = {
      id: 'plain-text',
      label: '일반 텍스트',
      icon: 'Type',
      insert: () => insertPlainText(editor, data.text),
    }

    switch (data.type) {
      case 'image_url':
        return [
          plainTextOpt,
          {
            id: 'link',
            label: '하이퍼링크',
            icon: 'Link',
            insert: () => insertHyperlink(editor, data.text),
          },
          {
            id: 'image-block',
            label: '이미지 삽입',
            icon: 'Image',
            isPrimary: true,
            insert: () => insertImage(editor, data.text),
          },
        ]

      case 'youtube_url': {
        const videoId = data.meta?.videoId || ''
        return [
          plainTextOpt,
          {
            id: 'link',
            label: '하이퍼링크',
            icon: 'Link',
            insert: () => insertHyperlink(editor, data.text),
          },
          {
            id: 'youtube-video',
            label: 'YouTube 임베드',
            icon: 'Youtube',
            isPrimary: true,
            insert: () => {
              if (videoId) {
                insertYoutube(editor, videoId)
              } else {
                insertHyperlink(editor, data.text)
              }
            },
          },
        ]
      }

      case 'web_url':
        return [
          plainTextOpt,
          {
            id: 'link',
            label: '하이퍼링크',
            icon: 'Link',
            isPrimary: true,
            insert: () => insertHyperlink(editor, data.text),
          },
        ]

      case 'code':
        return [
          plainTextOpt,
          {
            id: 'code-block',
            label: '코드 블록',
            icon: 'Code',
            isPrimary: true,
            insert: () => insertCodeBlock(editor, data.text),
          },
        ]

      case 'list':
        return [
          plainTextOpt,
          {
            id: 'list-items',
            label: '리스트',
            icon: 'List',
            isPrimary: true,
            insert: () => insertMarkdownList(editor, data.text),
          },
        ]

      default:
        return [plainTextOpt]
    }
  }, [data, editor])

  // Final insertion handler
  const handleConfirm = useCallback(() => {
    const currentOpt = options.find(o => o.id === selectedId) || options[options.length - 1]
    if (currentOpt) {
      currentOpt.insert()
    }
    handleClose()
  }, [options, selectedId, handleClose])

  // Listen to tiptap:smart-paste and tiptap:close-menus
  useEffect(() => {
    const handleSmartPaste = (e: Event) => {
      const customEvent = e as CustomEvent<SmartPasteEventDetail>
      if (customEvent.detail) {
        setData(customEvent.detail)
        setImgError(false)
        setOgMeta(null)
      }
    }

    const handleCloseMenus = () => {
      if (data) {
        handleClose()
      }
    }

    window.addEventListener('tiptap:smart-paste', handleSmartPaste)
    window.addEventListener('tiptap:close-menus', handleCloseMenus)
    return () => {
      window.removeEventListener('tiptap:smart-paste', handleSmartPaste)
      window.removeEventListener('tiptap:close-menus', handleCloseMenus)
    }
  }, [data, handleClose])

  // Set default selected mode to primary option
  useEffect(() => {
    if (options.length > 0) {
      const primary = options.find(o => o.isPrimary)
      setSelectedId(primary ? primary.id : options[options.length - 1].id)
    }
  }, [options])

  // Fetch OpenGraph metadata when web_url is pasted
  useEffect(() => {
    if (!data || data.type !== 'web_url') return
    let isMounted = true
    const fetchOg = async () => {
      try {
        const urlObj = new URL(data.text)
        const domain = urlObj.hostname
        const res = await fetch(`/api/link-preview?url=${encodeURIComponent(data.text)}`)
        if (res.ok) {
          const json = await res.json()
          if (isMounted) {
            setOgMeta({ title: json.title, image: json.image, domain: json.domain || domain })
          }
        } else if (isMounted) {
          setOgMeta({ domain })
        }
      } catch {
        if (isMounted) setOgMeta({ domain: data.text })
      }
    }
    fetchOg()
    return () => {
      isMounted = false
    }
  }, [data])

  // Keyboard navigation: Enter to confirm, Escape to cancel, Left/Right to cycle
  useEffect(() => {
    if (!data) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        const curIdx = options.findIndex(o => o.id === selectedId)
        const nextIdx = (curIdx + 1) % options.length
        setSelectedId(options[nextIdx].id)
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        const curIdx = options.findIndex(o => o.id === selectedId)
        const prevIdx = (curIdx - 1 + options.length) % options.length
        setSelectedId(options[prevIdx].id)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        handleConfirm()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        handleClose()
      }
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
    }
  }, [data, options, selectedId, handleConfirm, handleClose])

  if (!data || options.length === 0 || typeof document === 'undefined') {
    return null
  }

  const headerInfo = ({
    image_url: { title: '이미지 URL 감지됨', icon: 'Image' },
    youtube_url: { title: 'YouTube 동영상 감지됨', icon: 'Youtube' },
    web_url: { title: '웹 링크 감지됨', icon: 'Globe' },
    code: { title: '코드 스니펫 감지됨', icon: 'Code' },
    list: { title: '마크다운 리스트 감지됨', icon: 'List' },
  } as Record<string, { title: string; icon: string }>)[data.type] || { title: '붙여넣기 옵션', icon: 'Type' }

  // Render Dynamic Visual Preview Box depending on selectedId
  const renderVisualPreview = () => {
    // 1. Plain text preview mode
    if (selectedId === 'plain-text') {
      return (
        <div className="p-3 bg-zinc-100 dark:bg-zinc-800/40 rounded-xl border border-zinc-200/70 dark:border-zinc-700/60 max-h-44 overflow-y-auto">
          <p className="text-xs font-mono text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap break-all leading-relaxed">
            {data.text}
          </p>
        </div>
      )
    }

    // 2. Hyperlink preview mode
    if (selectedId === 'link') {
      return (
        <div className="p-3.5 bg-zinc-100 dark:bg-zinc-800/40 rounded-xl border border-zinc-200/70 dark:border-zinc-700/60 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-violet-950/50 flex items-center justify-center shrink-0 text-indigo-600 dark:text-violet-400">
            <Icon name="Link" className="w-4 h-4" />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs font-medium text-indigo-600 dark:text-violet-400 underline underline-offset-2 truncate">
              {data.text}
            </span>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">
              클릭 가능한 하이퍼링크 서식으로 삽입됩니다.
            </span>
          </div>
        </div>
      )
    }

    // 3. Rich format previews
    switch (data.type) {
      case 'image_url':
        return (
          <div className="flex flex-col items-center gap-2 p-3 bg-zinc-100 dark:bg-zinc-800/40 rounded-xl border border-zinc-200/70 dark:border-zinc-700/60 overflow-hidden">
            {!imgError ? (
              <img
                src={data.text}
                alt="Image Preview"
                onError={() => setImgError(true)}
                className="max-h-48 w-auto object-contain rounded-lg shadow-xs"
              />
            ) : (
              <div className="h-28 flex flex-col items-center justify-center text-zinc-400 gap-1">
                <Icon name="Image" className="w-8 h-8 opacity-50" />
                <span className="text-xs">이미지 미리보기를 불러올 수 없음</span>
              </div>
            )}
            <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 truncate max-w-full">
              {data.text}
            </span>
          </div>
        )

      case 'youtube_url': {
        const videoId = data.meta?.videoId
        const thumbUrl = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null
        return (
          <div className="flex flex-col gap-2 p-3 bg-zinc-100 dark:bg-zinc-800/40 rounded-xl border border-zinc-200/70 dark:border-zinc-700/60 overflow-hidden">
            <div className="relative w-full h-44 bg-zinc-900 rounded-lg overflow-hidden flex items-center justify-center group shadow-xs">
              {thumbUrl ? (
                <img src={thumbUrl} alt="YouTube Preview" className="w-full h-full object-cover" />
              ) : null}
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                <div className="w-12 h-8 bg-red-600 rounded-lg flex items-center justify-center shadow-md">
                  <div className="w-0 h-0 border-y-4 border-y-transparent border-l-8 border-l-white ml-0.5" />
                </div>
              </div>
            </div>
            <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 truncate max-w-full">
              {data.text}
            </span>
          </div>
        )
      }

      case 'web_url': {
        const domain = ogMeta?.domain || data.text
        return (
          <div className="flex flex-col gap-2 p-3 bg-zinc-100 dark:bg-zinc-800/40 rounded-xl border border-zinc-200/70 dark:border-zinc-700/60">
            <div className="flex items-center gap-2 p-3 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200/80 dark:border-zinc-700/80 shadow-2xs">
              <div className="w-8 h-8 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                <Icon name="Globe" className="w-4 h-4 text-indigo-500 dark:text-violet-400" />
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                  {ogMeta?.title || domain}
                </span>
                <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono truncate">
                  {data.text}
                </span>
              </div>
            </div>
          </div>
        )
      }

      case 'code': {
        const lines = data.text.split('\n')
        const displayLines = lines.slice(0, 10)
        return (
          <div className="rounded-xl overflow-hidden border border-zinc-300/80 dark:border-zinc-700/80 shadow-xs bg-zinc-950 text-zinc-200">
            <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
              </div>
              <span className="text-[10px] font-mono text-zinc-400">Code Block Preview</span>
            </div>
            <pre className="p-3 text-xs font-mono leading-relaxed overflow-x-auto max-h-40 text-emerald-400/90 dark:text-emerald-300/90">
              {displayLines.join('\n')}
              {lines.length > 10 ? `\n... (+${lines.length - 10} lines)` : ''}
            </pre>
          </div>
        )
      }

      case 'list': {
        const lines = data.text.split('\n').filter(Boolean)
        const displayLines = lines.slice(0, 6)
        return (
          <div className="p-3 bg-zinc-100 dark:bg-zinc-800/40 rounded-xl border border-zinc-200/70 dark:border-zinc-700/60 max-h-44 overflow-y-auto">
            <ul className="flex flex-col gap-1.5 text-xs text-zinc-700 dark:text-zinc-200">
              {displayLines.map((line, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-indigo-500 dark:text-violet-400 select-none">•</span>
                  <span className="flex-1 truncate">{line.replace(/^[-*+]\s+/, '').replace(/^\d+\.\s+/, '')}</span>
                </li>
              ))}
              {lines.length > 6 && (
                <li className="text-[11px] text-zinc-400 italic">...외 {lines.length - 6}개 항목</li>
              )}
            </ul>
          </div>
        )
      }

      default:
        return null
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[1450] bg-black/45 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in-0 duration-150"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150 select-none"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800/80">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-indigo-50 dark:bg-violet-950/40 flex items-center justify-center text-indigo-600 dark:text-violet-400">
              <Icon name={headerInfo.icon as any} className="w-3.5 h-3.5" />
            </div>
            <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              {headerInfo.title}
            </span>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="w-6 h-6 rounded-md flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title="닫기 (Esc)"
          >
            <Icon name="X" className="w-4 h-4" />
          </button>
        </div>

        {/* Visual Preview Area */}
        <div className="p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>미리보기</span>
            <span className="text-[10px] text-zinc-400">하단 포맷을 클릭하여 결과 확인</span>
          </div>

          {renderVisualPreview()}
        </div>

        {/* Action Controls Bar */}
        <div className="p-3 bg-zinc-50 dark:bg-zinc-900/60 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between gap-2">
          {/* Left: Mode Selection Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {options.map(opt => {
              const isSelected = opt.id === selectedId
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSelectedId(opt.id)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white dark:bg-violet-600 shadow-xs'
                      : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-750'
                  }`}
                >
                  <Icon name={opt.icon as any} className="w-3 h-3" />
                  <span>{opt.label}</span>
                </button>
              )
            })}
          </div>

          {/* Right: Cancel & Final Confirm Button */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleClose}
              className="px-2.5 py-1.5 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 dark:bg-violet-600 dark:hover:bg-violet-700 text-white rounded-lg shadow-sm transition-all cursor-pointer flex items-center gap-1"
            >
              <span>삽입</span>
              <span className="text-[10px] opacity-75 font-mono">↵</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default PastePreviewDialog
