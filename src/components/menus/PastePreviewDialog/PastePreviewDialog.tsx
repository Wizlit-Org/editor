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
  description: string
  icon: string
  isPrimary?: boolean
  insert: () => void
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

  // Build options with concise labels and 1-line descriptions
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
      label: '텍스트',
      description: '서식 없는 일반 텍스트로 본문에 삽입합니다',
      icon: 'Type',
      insert: () => {
        restoreSelection()
        insertPlainText(editor, data.text)
      },
    }

    const linkOpt: PasteOptionItem = {
      id: 'link',
      label: '링크',
      description: '클릭하여 이동할 수 있는 하이퍼링크로 삽입합니다',
      icon: 'Link',
      insert: () => {
        restoreSelection()
        insertHyperlink(editor, data.text)
      },
    }

    switch (data.type) {
      case 'image_data':
        return [
          {
            id: 'image-upload',
            label: '이미지 업로드',
            description: '이미지를 서버에 업로드하여 영구 보관합니다',
            icon: 'Upload',
            isPrimary: true,
            insert: () => {
              restoreSelection()
              const uploadBase64Cmd = (editor.commands as any).uploadImageByBase64
              if (typeof uploadBase64Cmd === 'function') {
                if (!uploadBase64Cmd({ base64: data.text, pos: targetPos })) {
                  insertImage(editor, data.text)
                }
              } else {
                insertImage(editor, data.text)
              }
            },
          },
          {
            id: 'image-external',
            label: '외부 이미지',
            description: '원본 이미지 데이터를 변환 없이 본문에 바로 삽입합니다',
            icon: 'Image',
            insert: () => {
              restoreSelection()
              insertImage(editor, data.text)
            },
          },
        ]

      case 'image_url':
        return [
          plainTextOpt,
          linkOpt,
          {
            id: 'image-external',
            label: '외부 이미지',
            description: '외부 이미지 주소를 직접 연결하여 본문에 표시합니다',
            icon: 'ExternalLink',
            insert: () => {
              restoreSelection()
              insertImage(editor, data.text)
            },
          },
          {
            id: 'image-upload',
            label: '이미지 업로드',
            description: '이미지를 서버에 업로드하여 영구 보관합니다',
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
            label: '유튜브',
            description: '본문에서 바로 재생 가능한 유튜브 동영상 플레이어로 삽입합니다',
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
            label: '코드',
            description: '구문 강조가 적용된 코드 블록으로 삽입합니다',
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
            description: '줄바꿈 항목들을 정리된 에디터 목록으로 변환하여 삽입합니다',
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

  const currentOption = useMemo(
    () => options.find(o => o.id === selectedId) || options[options.length - 1],
    [options, selectedId],
  )

  const handleConfirm = useCallback(() => {
    if (currentOption) currentOption.insert()
    handleClose()
  }, [currentOption, handleClose])

  // Listen ONLY to tiptap:smart-paste (NEVER close on tiptap:close-menus scroll events)
  useEffect(() => {
    const handleSmartPaste = (e: Event) => {
      const customEvent = e as CustomEvent<SmartPasteEventDetail>
      if (customEvent.detail) setData(customEvent.detail)
    }
    window.addEventListener('tiptap:smart-paste', handleSmartPaste)
    return () => {
      window.removeEventListener('tiptap:smart-paste', handleSmartPaste)
    }
  }, [])

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

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="붙여넣기 미리보기"
      data-paste-preview-dialog="true"
      onScrollCapture={e => e.stopPropagation()}
      className={`fixed inset-0 z-[1450] flex items-end justify-center p-4 sm:pb-6 transition-opacity duration-150 ${
        isDark ? 'bg-black/50 backdrop-blur-sm' : 'bg-black/25 backdrop-blur-xs'
      }`}
      onClick={handleClose}
    >
      {/* Bottom-Sheet Docked Container: Matches exact 42rem (672px) editor column width + 48px padding = 720px */}
      <div
        data-paste-preview-dialog="true"
        onScrollCapture={e => e.stopPropagation()}
        className={`w-[720px] max-w-[95vw] rounded-2xl overflow-hidden flex flex-col select-none ${
          isDark
            ? 'bg-[#1c1c20] border border-white/[0.14] text-zinc-100 shadow-[0_24px_64px_-12px_rgba(0,0,0,0.85)]'
            : 'bg-white border border-black/[0.12] text-zinc-900 shadow-[0_24px_64px_-12px_rgba(0,0,0,0.25)]'
        }`}
        onClick={e => e.stopPropagation()}
      >
        {/* 1. Top Mini Header: Clear Dialog Identity & Selected Mode Description */}
        <div
          className={`flex items-center justify-between gap-3 px-4 py-2.5 border-b ${
            isDark
              ? 'border-white/[0.08] bg-[#222226]'
              : 'border-black/[0.07] bg-zinc-50'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div
              className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border ${
                isDark
                  ? 'bg-indigo-500/20 border-indigo-400/30 text-indigo-300'
                  : 'bg-indigo-50 border-indigo-200 text-indigo-600'
              }`}
            >
              <Icon name="Clipboard" className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-bold tracking-tight shrink-0">
              붙여넣기 미리보기
            </span>
            <span
              className={`text-xs truncate ${
                isDark ? 'text-zinc-400' : 'text-zinc-500'
              }`}
            >
              — {currentOption?.description || '에디터에 삽입될 실제 모습입니다'}
            </span>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <span
              className={`hidden md:inline-block text-[11px] font-medium ${
                isDark ? 'text-zinc-400' : 'text-zinc-500'
              }`}
            >
              ←/→ 형식 전환 · Enter 삽입 · Esc 취소
            </span>
            <button
              type="button"
              onClick={handleClose}
              className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                isDark
                  ? 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.08]'
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-black/[0.06]'
              }`}
              title="닫기 (Esc)"
            >
              <Icon name="X" className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 2. Center: 1:1 Real Editor Aspect Ratio Live Preview Canvas (Internal Scrollable) */}
        <LivePreviewCanvas data={data} selectedId={selectedId} isDark={isDark} />

        {/* 3. Bottom Control Dock: Left [삽입 방식 + Short Option Tabs] | Right [취소] + [삽입 ↵] */}
        <div
          className={`px-4 py-3 border-t flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 ${
            isDark
              ? 'bg-[#222226] border-white/[0.09]'
              : 'bg-zinc-50 border-black/[0.08]'
          }`}
        >
          {/* Left: Mode Selector Segmented Dock */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span
              className={`text-[11px] font-semibold shrink-0 ${
                isDark ? 'text-zinc-400' : 'text-zinc-500'
              }`}
            >
              삽입 방식
            </span>

            <div
              role="tablist"
              aria-label="삽입 방식 선택"
              className={`flex items-center gap-1 p-1 rounded-xl overflow-x-auto ${
                isDark
                  ? 'bg-black/45 border border-white/[0.08]'
                  : 'bg-zinc-200/70 border border-black/[0.06]'
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
                    className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 cursor-pointer border ${
                      isSelected
                        ? isDark
                          ? 'bg-indigo-600 text-white border-indigo-400/40 shadow-xs'
                          : 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : isDark
                          ? 'bg-transparent text-zinc-400 border-transparent hover:text-zinc-200 hover:bg-white/[0.06]'
                          : 'bg-transparent text-zinc-600 border-transparent hover:text-zinc-900 hover:bg-black/[0.05]'
                    }`}
                  >
                    <Icon
                      name={opt.icon as any}
                      className={`w-3.5 h-3.5 ${
                        isSelected ? 'text-white' : 'opacity-75'
                      }`}
                    />
                    <span>{opt.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Right: Distinct [취소] & [삽입 ↵] Action Buttons */}
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            <button
              type="button"
              onClick={handleClose}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                isDark
                  ? 'border-zinc-600 bg-zinc-800/80 text-zinc-200 hover:bg-zinc-700 hover:text-white'
                  : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900'
              }`}
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-lg border border-indigo-400/30 shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span>삽입</span>
              <span className="text-[11px] opacity-90 font-mono">↵</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default PastePreviewDialog
