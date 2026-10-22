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
  action: () => void
}

export const PastePreviewDialog: React.FC<PastePreviewDialogProps> = ({ editor }) => {
  const [data, setData] = useState<SmartPasteEventDetail | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [imgError, setImgError] = useState(false)
  const [ogMeta, setOgMeta] = useState<{ title?: string; image?: string; domain?: string } | null>(null)

  const handleClose = useCallback(
    (fallbackToPlainText = false) => {
      if (fallbackToPlainText && data) {
        insertPlainText(editor, data.text)
      }
      setData(null)
      setSelectedIndex(0)
      setImgError(false)
      setOgMeta(null)
    },
    [data, editor],
  )

  // Listen to tiptap:smart-paste and tiptap:close-menus
  useEffect(() => {
    const handleSmartPaste = (e: Event) => {
      const customEvent = e as CustomEvent<SmartPasteEventDetail>
      if (customEvent.detail) {
        setData(customEvent.detail)
        setSelectedIndex(0)
        setImgError(false)
        setOgMeta(null)
      }
    }

    const handleCloseMenus = () => {
      if (data) {
        handleClose(true)
      }
    }

    window.addEventListener('tiptap:smart-paste', handleSmartPaste)
    window.addEventListener('tiptap:close-menus', handleCloseMenus)
    return () => {
      window.removeEventListener('tiptap:smart-paste', handleSmartPaste)
      window.removeEventListener('tiptap:close-menus', handleCloseMenus)
    }
  }, [data, handleClose])

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

  // Build options based on detected type
  const options = useMemo<PasteOptionItem[]>(() => {
    if (!data) return []

    const plainTextOpt: PasteOptionItem = {
      id: 'plain-text',
      label: '일반 텍스트',
      icon: 'Type',
      action: () => {
        insertPlainText(editor, data.text)
        handleClose(false)
      },
    }

    switch (data.type) {
      case 'image_url':
        return [
          plainTextOpt,
          {
            id: 'link',
            label: '하이퍼링크',
            icon: 'Link',
            action: () => {
              insertHyperlink(editor, data.text)
              handleClose(false)
            },
          },
          {
            id: 'image-block',
            label: '이미지로 삽입',
            icon: 'Image',
            isPrimary: true,
            action: () => {
              insertImage(editor, data.text)
              handleClose(false)
            },
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
            action: () => {
              insertHyperlink(editor, data.text)
              handleClose(false)
            },
          },
          {
            id: 'youtube-video',
            label: 'YouTube 임베드',
            icon: 'Youtube',
            isPrimary: true,
            action: () => {
              if (videoId) {
                insertYoutube(editor, videoId)
              } else {
                insertHyperlink(editor, data.text)
              }
              handleClose(false)
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
            action: () => {
              insertHyperlink(editor, data.text)
              handleClose(false)
            },
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
            action: () => {
              insertCodeBlock(editor, data.text)
              handleClose(false)
            },
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
            action: () => {
              insertMarkdownList(editor, data.text)
              handleClose(false)
            },
          },
        ]

      default:
        return [plainTextOpt]
    }
  }, [data, editor, handleClose])

  // Select primary option by default
  useEffect(() => {
    if (options.length > 0) {
      const primaryIdx = options.findIndex(o => o.isPrimary)
      setSelectedIndex(primaryIdx >= 0 ? primaryIdx : options.length - 1)
    }
  }, [options])

  // Keyboard navigation: Escape, Enter, Arrow keys
  useEffect(() => {
    if (!data) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => (prev + 1) % options.length)
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => (prev - 1 + options.length) % options.length)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (options[selectedIndex]) {
          options[selectedIndex].action()
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        handleClose(true)
      }
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
    }
  }, [data, options, selectedIndex, handleClose])

  if (!data || options.length === 0 || typeof document === 'undefined') {
    return null
  }

  // Type header text & badge
  const headerInfo = (() => {
    switch (data.type) {
      case 'image_url':
        return { title: '이미지 URL 감지됨', icon: 'Image' }
      case 'youtube_url':
        return { title: 'YouTube 동영상 감지됨', icon: 'Youtube' }
      case 'web_url':
        return { title: '웹 링크 감지됨', icon: 'Globe' }
      case 'code':
        return { title: '코드 스니펫 감지됨', icon: 'Code' }
      case 'list':
        return { title: '마크다운 리스트 감지됨', icon: 'List' }
      default:
        return { title: '붙여넣기 옵션', icon: 'Type' }
    }
  })()

  // Render Visual Preview Box
  const renderVisualPreview = () => {
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
              <span className="text-[10px] font-mono text-zinc-400">Code Preview</span>
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
      onClick={() => handleClose(true)}
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
            onClick={() => handleClose(true)}
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
            <span className="text-[10px] text-zinc-400">원하는 삽입 방식을 선택하세요</span>
          </div>

          {renderVisualPreview()}
        </div>

        {/* Action Button Choices */}
        <div className="p-3 bg-zinc-50 dark:bg-zinc-900/60 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-end gap-2">
          {options.map((opt, idx) => {
            const isSelected = idx === selectedIndex
            return (
              <button
                key={opt.id}
                type="button"
                onClick={opt.action}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  opt.isPrimary
                    ? isSelected
                      ? 'bg-indigo-600 text-white dark:bg-violet-600 shadow-sm ring-2 ring-indigo-400 dark:ring-violet-400'
                      : 'bg-indigo-500 text-white dark:bg-violet-500 hover:bg-indigo-600 dark:hover:bg-violet-600 shadow-2xs'
                    : isSelected
                    ? 'bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100 ring-1 ring-zinc-300 dark:ring-zinc-600'
                    : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border border-zinc-200/80 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-750'
                }`}
              >
                <Icon name={opt.icon as any} className="w-3.5 h-3.5" />
                <span>{opt.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default PastePreviewDialog
