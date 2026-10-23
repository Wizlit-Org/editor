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
import { LivePreviewCanvas } from './LivePreviewCanvas'

export interface PastePreviewDialogProps {
  editor: Editor
}

export interface PasteOptionItem {
  id: string
  label: string
  icon: string
  isPrimary?: boolean
  insert: () => void
}

const getHeaderInfo = (type?: string) => {
  switch (type) {
    case 'image_url':
      return { title: '이미지 URL 붙여넣기', icon: 'Image' }
    case 'youtube_url':
      return { title: 'YouTube 동영상 붙여넣기', icon: 'Youtube' }
    case 'web_url':
      return { title: '웹 링크 붙여넣기', icon: 'Globe' }
    case 'code':
      return { title: '코드 스니펫 붙여넣기', icon: 'Code' }
    case 'list':
      return { title: '목록 붙여넣기', icon: 'List' }
    default:
      return { title: '스마트 붙여넣기', icon: 'Type' }
  }
}

export const PastePreviewDialog: React.FC<PastePreviewDialogProps> = ({ editor }) => {
  const [data, setData] = useState<SmartPasteEventDetail | null>(null)
  const [selectedId, setSelectedId] = useState<string>('')
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof document !== 'undefined') {
      return (
        document.documentElement.classList.contains('dark') ||
        document.body.classList.contains('dark') ||
        Boolean(editor?.view?.dom?.closest('.dark, .theme-dark, .notion-dark-canvas'))
      )
    }
    return true
  })

  // Synchronize light/dark theme with editor container or document root
  useEffect(() => {
    if (typeof document === 'undefined' || !data) return
    const editorDom = editor?.view?.dom as HTMLElement | undefined
    if (editorDom?.closest('.dark, .theme-dark, .notion-dark-canvas')) {
      setIsDark(true)
    } else if (editorDom?.closest('.theme-light, .notion-light-canvas')) {
      setIsDark(false)
    } else {
      setIsDark(
        document.documentElement.classList.contains('dark') ||
          document.body.classList.contains('dark'),
      )
    }
  }, [data, editor])

  const handleClose = useCallback(() => {
    setData(null)
    setSelectedId('')
  }, [])

  // Build options based on detected type
  const options = useMemo<PasteOptionItem[]>(() => {
    if (!data) return []

    const targetPos = data.selection?.from
    const restoreSelection = () => {
      if (data.selection && editor && !editor.isDestroyed) {
        const docSize = editor.state.doc.content.size
        const from = Math.max(0, Math.min(data.selection.from, docSize))
        const to = Math.max(from, Math.min(data.selection.to, docSize))
        editor.commands.setTextSelection({ from, to })
      }
    }

    const plainTextOpt: PasteOptionItem = {
      id: 'plain-text',
      label: '일반 텍스트',
      icon: 'Type',
      insert: () => {
        restoreSelection()
        insertPlainText(editor, data.text)
      },
    }

    const linkOpt: PasteOptionItem = {
      id: 'link',
      label: '하이퍼링크',
      icon: 'Link',
      insert: () => {
        restoreSelection()
        insertHyperlink(editor, data.text)
      },
    }

    switch (data.type) {
      case 'image_url':
        return [
          plainTextOpt,
          linkOpt,
          {
            id: 'image-external',
            label: '외부 이미지 연동',
            icon: 'ExternalLink',
            insert: () => {
              restoreSelection()
              insertImage(editor, data.text)
            },
          },
          {
            id: 'image-upload',
            label: '서버에 이미지 업로드',
            icon: 'Upload',
            isPrimary: true,
            insert: () => {
              restoreSelection()
              const uploadCmd = (editor.commands as any).uploadImageByUrl
              if (typeof uploadCmd === 'function') {
                if (!uploadCmd({ url: data.text, pos: targetPos })) {
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
          linkOpt,
          {
            id: 'youtube-video',
            label: '유튜브 임베드',
            icon: 'Youtube',
            isPrimary: true,
            insert: () => {
              restoreSelection()
              if (videoId) insertYoutube(editor, videoId)
              else insertHyperlink(editor, data.text)
            },
          },
        ]
      }

      case 'web_url':
        return [plainTextOpt, { ...linkOpt, isPrimary: true }]

      case 'code':
        return [
          plainTextOpt,
          {
            id: 'code-block',
            label: '코드 블록',
            icon: 'Code',
            isPrimary: true,
            insert: () => {
              restoreSelection()
              insertCodeBlock(editor, data.text)
            },
          },
        ]

      case 'list':
        return [
          plainTextOpt,
          {
            id: 'list-items',
            label: '목록',
            icon: 'List',
            isPrimary: true,
            insert: () => {
              restoreSelection()
              insertMarkdownList(editor, data.text)
            },
          },
        ]

      default:
        return [plainTextOpt]
    }
  }, [data, editor])

  const handleConfirm = useCallback(() => {
    const currentOpt = options.find(o => o.id === selectedId) || options[options.length - 1]
    if (currentOpt) currentOpt.insert()
    handleClose()
  }, [options, selectedId, handleClose])

  useEffect(() => {
    const handleSmartPaste = (e: Event) => {
      const customEvent = e as CustomEvent<SmartPasteEventDetail>
      if (customEvent.detail) setData(customEvent.detail)
    }
    const handleCloseMenus = () => {
      if (data) handleClose()
    }
    window.addEventListener('tiptap:smart-paste', handleSmartPaste)
    window.addEventListener('tiptap:close-menus', handleCloseMenus)
    return () => {
      window.removeEventListener('tiptap:smart-paste', handleSmartPaste)
      window.removeEventListener('tiptap:close-menus', handleCloseMenus)
    }
  }, [data, handleClose])

  useEffect(() => {
    if (options.length > 0) {
      const primary = options.find(o => o.isPrimary)
      setSelectedId(primary ? primary.id : options[options.length - 1].id)
    }
  }, [options])

  // Keyboard navigation: Tab / Shift+Tab / Left / Right to cycle, Enter to confirm, Escape to cancel
  useEffect(() => {
    if (!data) return
    const onKeyDown = (e: KeyboardEvent) => {
      const curIdx = options.findIndex(o => o.id === selectedId)
      if (e.key === 'Tab') {
        e.preventDefault()
        e.stopPropagation()
        const step = e.shiftKey ? -1 : 1
        setSelectedId(options[(curIdx + step + options.length) % options.length].id)
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        e.stopPropagation()
        setSelectedId(options[(curIdx + 1) % options.length].id)
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        setSelectedId(options[(curIdx - 1 + options.length) % options.length].id)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        handleConfirm()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        handleClose()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [data, options, selectedId, handleConfirm, handleClose])

  if (!data || options.length === 0 || typeof document === 'undefined') {
    return null
  }

  const headerInfo = getHeaderInfo(data.type)
  const kbdClass = `px-1.5 py-0.5 text-[10px] font-mono rounded border ${
    isDark
      ? 'bg-white/[0.06] border-white/[0.1] text-zinc-300'
      : 'bg-black/[0.04] border-black/[0.1] text-zinc-700'
  }`

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={headerInfo.title}
      className={`fixed inset-0 z-[1450] flex items-center justify-center p-4 sm:p-6 transition-opacity duration-150 ${
        isDark ? 'bg-black/45 backdrop-blur-md' : 'bg-black/25 backdrop-blur-sm'
      }`}
      onClick={handleClose}
    >
      <div
        className={`w-[94%] max-w-[680px] rounded-2xl overflow-hidden flex flex-col select-none transition-all duration-200 ${
          isDark
            ? 'bg-[#1e1e22]/85 backdrop-blur-2xl border border-white/[0.12] text-zinc-100 shadow-[0_24px_64px_-12px_rgba(0,0,0,0.65),inset_0_1px_0_0_rgba(255,255,255,0.08)]'
            : 'bg-white/90 backdrop-blur-2xl border border-black/[0.09] text-zinc-900 shadow-[0_24px_64px_-12px_rgba(0,0,0,0.18),inset_0_1px_0_0_rgba(255,255,255,0.9)]'
        }`}
        onClick={e => e.stopPropagation()}
      >
        {/* 1. Top Bar: Title + Slim Glass Pill Segmented Control Tab Bar */}
        <div
          className={`flex flex-col gap-2.5 px-4 pt-3.5 pb-3 border-b ${
            isDark
              ? 'border-white/[0.08] bg-white/[0.02]'
              : 'border-black/[0.06] bg-black/[0.015]'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border ${
                  isDark
                    ? 'bg-indigo-500/15 border-indigo-400/25 text-indigo-300'
                    : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-600'
                }`}
              >
                <Icon name={headerInfo.icon as any} className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold tracking-tight truncate">
                {headerInfo.title}
              </span>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors cursor-pointer border border-transparent ${
                isDark
                  ? 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.08]'
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-black/[0.06]'
              }`}
              title="닫기 (Esc)"
            >
              <Icon name="X" className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Slim Glass Pill Segmented Control (0px CLS via constant border) */}
          <div
            role="tablist"
            className={`flex items-center gap-1 p-1 rounded-xl overflow-x-auto ${
              isDark
                ? 'bg-black/40 border border-white/[0.07]'
                : 'bg-zinc-100/90 border border-black/[0.06]'
            }`}
          >
            {options.map(opt => {
              const isSelected = opt.id === selectedId
              return (
                <button
                  key={opt.id}
                  role="tab"
                  aria-selected={isSelected}
                  type="button"
                  onClick={() => setSelectedId(opt.id)}
                  className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 cursor-pointer border ${
                    isSelected
                      ? isDark
                        ? 'bg-white/[0.13] text-white border-white/[0.16] shadow-xs'
                        : 'bg-white text-zinc-900 border-black/[0.08] shadow-xs'
                      : isDark
                        ? 'bg-transparent text-zinc-400 border-transparent hover:text-zinc-200 hover:bg-white/[0.05]'
                        : 'bg-transparent text-zinc-600 border-transparent hover:text-zinc-900 hover:bg-black/[0.04]'
                  }`}
                >
                  <Icon
                    name={opt.icon as any}
                    className={`w-3.5 h-3.5 ${
                      isSelected
                        ? isDark
                          ? 'text-indigo-300'
                          : 'text-indigo-600'
                        : 'opacity-75'
                    }`}
                  />
                  <span>{opt.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 2. Center: Live Editor Canvas (Read-only TipTap Instance with 1:1 .ProseMirror rendering) */}
        <div
          className={`h-[260px] w-full p-3.5 flex items-center justify-center overflow-hidden ${
            isDark ? 'bg-black/25' : 'bg-zinc-50/70'
          }`}
        >
          <LivePreviewCanvas data={data} selectedId={selectedId} isDark={isDark} />
        </div>

        {/* 3. Bottom Bar: Keyboard Shortcut Hints (Left) + Cancel / Insert Action Buttons (Right) */}
        <div
          className={`px-4 py-2.5 border-t flex items-center justify-between gap-3 ${
            isDark
              ? 'bg-white/[0.02] border-white/[0.08]'
              : 'bg-black/[0.015] border-black/[0.06]'
          }`}
        >
          <div
            className={`hidden sm:flex items-center gap-2 text-[11px] ${
              isDark ? 'text-zinc-400' : 'text-zinc-500'
            }`}
          >
            <span className="inline-flex items-center gap-1">
              <kbd className={kbdClass}>Tab</kbd>
              <span>전환</span>
            </span>
            <span className="opacity-40">·</span>
            <span className="inline-flex items-center gap-1">
              <kbd className={kbdClass}>Enter</kbd>
              <span>삽입</span>
            </span>
            <span className="opacity-40">·</span>
            <span className="inline-flex items-center gap-1">
              <kbd className={kbdClass}>Esc</kbd>
              <span>닫기</span>
            </span>
          </div>

          <div className="flex items-center gap-2 ml-auto shrink-0">
            <button
              type="button"
              onClick={handleClose}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border border-transparent transition-colors cursor-pointer ${
                isDark
                  ? 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.08]'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-black/[0.05]'
              }`}
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-lg border border-indigo-400/30 shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span>삽입</span>
              <span className="text-[10px] opacity-85 font-mono">↵</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default PastePreviewDialog
