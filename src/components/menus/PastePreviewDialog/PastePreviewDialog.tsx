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

  // Pure cancel/close (without modifying editor content)
  const handleClose = useCallback(() => {
    setData(null)
    setSelectedId('')
    setImgError(false)
    setOgMeta(null)
  }, [])

  // Build options based on detected type
  const options = useMemo<PasteOptionItem[]>(() => {
    if (!data) return []

    const plainTextOpt: PasteOptionItem = { id: 'plain-text', label: '일반 텍스트', icon: 'Type', insert: () => insertPlainText(editor, data.text) }

    switch (data.type) {
      case 'image_url':
        return [
          plainTextOpt,
          { id: 'link', label: '하이퍼링크', icon: 'Link', insert: () => insertHyperlink(editor, data.text) },
          { id: 'image-external', label: '외부 이미지 연동', icon: 'ExternalLink', insert: () => insertImage(editor, data.text) },
          {
            id: 'image-upload',
            label: '서버에 이미지 업로드',
            icon: 'Upload',
            isPrimary: true,
            insert: () => {
              const uploadCmd = (editor.commands as any).uploadImageByUrl
              if (typeof uploadCmd === 'function') {
                const handled = uploadCmd({ url: data.text })
                if (!handled) {
                  insertImage(editor, data.text)
                }
              } else {
                insertImage(editor, data.text)
              }
            },
          },
        ]

      case 'youtube_url': {
        const videoId = data.meta?.videoId || ''
        return [
          plainTextOpt,
          { id: 'link', label: '하이퍼링크', icon: 'Link', insert: () => insertHyperlink(editor, data.text) },
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
          { id: 'link', label: '하이퍼링크', icon: 'Link', isPrimary: true, insert: () => insertHyperlink(editor, data.text) },
        ]

      case 'code':
        return [
          plainTextOpt,
          { id: 'code-block', label: '코드 블록', icon: 'Code', isPrimary: true, insert: () => insertCodeBlock(editor, data.text) },
        ]

      case 'list':
        return [
          plainTextOpt,
          { id: 'list-items', label: '리스트', icon: 'List', isPrimary: true, insert: () => insertMarkdownList(editor, data.text) },
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

  // Header icon and title metadata
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
        return { title: '스마트 붙여넣기', icon: 'Type' }
    }
  })()

  // Dynamic preview rendering inside fixed-height box (h-[180px])
  const renderVisualPreview = () => {
    // 1. Plain text preview
    if (selectedId === 'plain-text') {
      return (
        <div className="w-full h-full p-3 bg-zinc-950/60 rounded-xl border border-zinc-800/80 overflow-y-auto">
          <p className="text-xs font-mono text-zinc-300 whitespace-pre-wrap break-all leading-relaxed">
            {data.text}
          </p>
        </div>
      )
    }

    // 2. Hyperlink preview
    if (selectedId === 'link') {
      return (
        <div className="w-full p-4 bg-zinc-950/60 rounded-xl border border-zinc-800/80 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0 text-indigo-400">
            <Icon name="Link" className="w-5 h-5" />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs font-medium text-indigo-400 underline underline-offset-2 truncate">
              {data.text}
            </span>
            <span className="text-[11px] text-zinc-400 mt-0.5">
              클릭 시 웹페이지로 이동하는 하이퍼링크로 본문에 삽입합니다.
            </span>
          </div>
        </div>
      )
    }

    // 3. Image URL options (External vs Upload)
    if (selectedId === 'image-external' || selectedId === 'image-upload') {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-2 rounded-xl bg-zinc-950/60 border border-zinc-800/80 overflow-hidden relative">
          <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded text-[10px] font-medium bg-black/60 backdrop-blur-xs text-zinc-300 border border-white/10 flex items-center gap-1">
            <Icon name={selectedId === 'image-upload' ? 'Upload' : 'ExternalLink'} className="w-3 h-3 text-indigo-400" />
            <span>{selectedId === 'image-upload' ? '서버 최적화 업로드' : '외부 원본 링크 직접 연결'}</span>
          </div>
          {!imgError ? (
            <img
              src={data.text}
              alt="Preview"
              onError={() => setImgError(true)}
              className="max-h-[135px] max-w-full object-contain rounded shadow-xs"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-zinc-500 gap-1">
              <Icon name="Image" className="w-8 h-8 opacity-40" />
              <span className="text-xs">미리보기 로드 실패 (삽입 시 정상 작동)</span>
            </div>
          )}
        </div>
      )
    }

    // 4. Other rich format previews
    switch (data.type) {
      case 'youtube_url': {
        const videoId = data.meta?.videoId
        const thumbUrl = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null
        return (
          <div className="w-full h-full rounded-xl bg-zinc-950/60 border border-zinc-800/80 overflow-hidden relative flex items-center justify-center">
            {thumbUrl ? (
              <img src={thumbUrl} alt="YouTube Preview" className="w-full h-full object-cover opacity-75" />
            ) : null}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <div className="w-12 h-8 bg-red-600 rounded-lg flex items-center justify-center shadow-lg">
                <div className="w-0 h-0 border-y-4 border-y-transparent border-l-8 border-l-white ml-0.5" />
              </div>
            </div>
          </div>
        )
      }

      case 'web_url': {
        const domain = ogMeta?.domain || data.text
        return (
          <div className="w-full h-full p-3 bg-zinc-950/60 rounded-xl border border-zinc-800/80 flex flex-col justify-center">
            <div className="flex items-center gap-3 p-3 bg-zinc-900/90 rounded-lg border border-zinc-800 shadow-xs">
              <div className="w-9 h-9 rounded-md bg-zinc-800 flex items-center justify-center shrink-0">
                <Icon name="Globe" className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs font-semibold text-zinc-200 truncate">
                  {ogMeta?.title || domain}
                </span>
                <span className="text-[11px] text-zinc-400 font-mono truncate">
                  {data.text}
                </span>
              </div>
            </div>
          </div>
        )
      }

      case 'code': {
        const lines = data.text.split('\n')
        const displayLines = lines.slice(0, 8)
        return (
          <div className="w-full h-full rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 flex flex-col">
            <div className="flex items-center justify-between px-3 py-1 bg-zinc-900/90 border-b border-zinc-800">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500/80" />
                <span className="w-2 h-2 rounded-full bg-yellow-500/80" />
                <span className="w-2 h-2 rounded-full bg-green-500/80" />
              </div>
              <span className="text-[10px] font-mono text-zinc-400">Code Snippet</span>
            </div>
            <pre className="p-2.5 text-xs font-mono leading-relaxed overflow-auto flex-1 text-emerald-400/90">
              {displayLines.join('\n')}
              {lines.length > 8 ? `\n... (+${lines.length - 8} lines)` : ''}
            </pre>
          </div>
        )
      }

      case 'list': {
        const lines = data.text.split('\n').filter(Boolean)
        const displayLines = lines.slice(0, 5)
        return (
          <div className="w-full h-full p-3 bg-zinc-950/60 rounded-xl border border-zinc-800/80 overflow-y-auto">
            <ul className="flex flex-col gap-1 text-xs text-zinc-200">
              {displayLines.map((line, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-indigo-400 select-none">•</span>
                  <span className="flex-1 truncate">{line.replace(/^[-*+]\s+/, '').replace(/^\d+\.\s+/, '')}</span>
                </li>
              ))}
              {lines.length > 5 && (
                <li className="text-[11px] text-zinc-500 italic">...외 {lines.length - 5}개 항목</li>
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
      className="fixed inset-0 z-[1450] bg-black/40 backdrop-blur-xs flex items-end justify-center p-4 sm:p-6 animate-in fade-in-0 duration-150"
      onClick={handleClose}
    >
      <div
        className="w-[92%] max-w-2xl bg-zinc-900/90 backdrop-blur-xl border border-zinc-700/60 shadow-2xl rounded-2xl overflow-hidden flex flex-col text-zinc-100 select-none animate-in slide-in-from-bottom-4 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* 1. Header Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800/80 bg-zinc-950/40">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Icon name={headerInfo.icon as any} className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-semibold text-zinc-200">
              {headerInfo.title}
            </span>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="w-5 h-5 rounded flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-white/10 transition-colors cursor-pointer"
            title="닫기 (Esc)"
          >
            <Icon name="X" className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 2. Fixed-Height Visual Preview Box (h-[180px] - Zero Layout Shaking) */}
        <div className="h-[180px] w-full p-3 flex items-center justify-center bg-black/25 overflow-hidden">
          {renderVisualPreview()}
        </div>

        {/* 3. Fixed Bottom Action Bar */}
        <div className="px-3.5 py-2.5 bg-zinc-950/60 border-t border-zinc-800/80 flex items-center justify-between gap-3">
          {/* Left: Mode Selection Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto min-w-0 flex-1">
            {options.map(opt => {
              const isSelected = opt.id === selectedId
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSelectedId(opt.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-white/5 text-zinc-300 border border-white/5 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon name={opt.icon as any} className="w-3.5 h-3.5" />
                  <span>{opt.label}</span>
                </button>
              )
            })}
          </div>

          {/* Right: Cancel & Final Confirm Primary Button */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleClose}
              className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-lg shadow-md transition-all cursor-pointer flex items-center gap-1.5"
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
