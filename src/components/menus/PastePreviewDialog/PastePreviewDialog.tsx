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
      aria-label="붙여넣기 형식 선택"
      data-paste-preview-dialog="true"
      onScrollCapture={e => e.stopPropagation()}
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1450,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
        padding: '36px 24px 32px', userSelect: 'none',
        backgroundColor: isDark ? 'rgba(9, 9, 11, 0.72)' : 'rgba(255, 255, 255, 0.72)',
        backdropFilter: 'blur(24px) saturate(160%)', WebkitBackdropFilter: 'blur(24px) saturate(160%)',
      }}
      className="fixed inset-0 z-[1450] flex flex-col items-center justify-between select-none transition-opacity duration-150"
    >
      {/* 1. 상단 위 (Top Center): 제목 및 선택된 삽입 방식 설명 */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          textAlign: 'center', gap: '6px', flexShrink: 0, maxWidth: '92vw',
        }}
      >
        <span
          style={{
            fontSize: '18px', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2,
            color: isDark ? '#fafafa' : '#18181b',
          }}
        >
          붙여넣기 형식 선택
        </span>
        <p
          style={{
            margin: 0, fontSize: '13px', fontWeight: 500, lineHeight: 1.4,
            color: isDark ? 'rgba(228, 228, 231, 0.8)' : 'rgba(63, 63, 70, 0.85)',
          }}
        >
          {currentOption?.description || '에디터에 삽입될 실제 모습입니다'}
        </p>
        <span
          style={{
            fontSize: '11px', fontWeight: 500, lineHeight: 1.2,
            color: isDark ? 'rgba(161, 161, 170, 0.75)' : 'rgba(113, 113, 122, 0.8)',
          }}
        >
          {options.length > 1
            ? '←/→ 또는 Tab 형식 전환 · Enter 삽입 · Esc 취소'
            : 'Enter 삽입 · Esc 취소'}
        </span>
      </div>

      {/* 2. 중앙 한가운데 (Center Stage): 박스 틀 없는 1:1 라이브 미리보기 */}
      <div
        style={{
          flex: 1, width: '100%', minHeight: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        }}
      >
        <LivePreviewCanvas data={data} selectedId={selectedId} isDark={isDark} />
      </div>

      {/* 3 & 4. 하단 중앙 컨트롤 영역: [선택지 바로 위: 취소 / 삽입 버튼] + [하단 중앙: 선택지 탭 독] */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '14px', flexShrink: 0, maxWidth: '95vw',
        }}
      >
        {/* 3. 선택지 바로 위 (Just Above Options): [취소] / [삽입 ↵] 버튼 */}
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={handleClose}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
              height: '36px', padding: '0 18px', borderRadius: '9999px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              backgroundColor: isDark ? 'rgba(39, 39, 42, 0.65)' : 'rgba(255, 255, 255, 0.75)',
              backdropFilter: 'blur(16px) saturate(180%)', WebkitBackdropFilter: 'blur(16px) saturate(180%)',
              color: isDark ? '#e4e4e7' : '#3f3f46',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.16)' : '1px solid rgba(203, 213, 225, 0.9)',
              boxShadow: isDark ? '0 4px 14px rgba(0, 0, 0, 0.35)' : '0 4px 14px rgba(15, 23, 42, 0.08)',
            }}
            className="transition-all duration-150 hover:scale-[1.02] active:scale-95"
          >
            취소
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', lineHeight: 1,
              height: '36px', padding: '0 22px', borderRadius: '9999px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              backgroundColor: '#4f46e5', color: '#ffffff',
              border: '1px solid rgba(129, 140, 248, 0.45)',
              boxShadow: '0 6px 20px -2px rgba(79, 70, 229, 0.45)',
            }}
            className="transition-all duration-150 hover:bg-indigo-500 hover:scale-[1.02] active:scale-95"
          >
            <span>삽입</span>
            <span style={{ fontSize: '12px', opacity: 0.9 }} className="font-mono">↵</span>
          </button>
        </div>

        {/* 4. 하단 중앙 (Bottom Center): 선택지 플로팅 캡슐 독 */}
        <div
          role="tablist"
          aria-label="삽입 방식 선택"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
            padding: '6px', borderRadius: '16px', maxWidth: '92vw', overflowX: 'auto',
            backgroundColor: isDark ? 'rgba(24, 24, 27, 0.62)' : 'rgba(255, 255, 255, 0.62)',
            backdropFilter: 'blur(20px) saturate(190%)', WebkitBackdropFilter: 'blur(20px) saturate(190%)',
            border: isDark ? '1px solid rgba(255, 255, 255, 0.16)' : '1px solid rgba(203, 213, 225, 0.85)',
            boxShadow: isDark
              ? '0 12px 32px -4px rgba(0, 0, 0, 0.55), inset 0 1px 0 0 rgba(255, 255, 255, 0.14)'
              : '0 10px 28px -4px rgba(15, 23, 42, 0.12), inset 0 1px 0 0 rgba(255, 255, 255, 0.9)',
          }}
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
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', lineHeight: 1,
                  height: '34px', padding: '0 14px', borderRadius: '11px', fontSize: '12.5px', fontWeight: 600,
                  cursor: 'pointer', flexShrink: 0,
                  backgroundColor: isSelected ? '#4f46e5' : 'transparent',
                  color: isSelected ? '#ffffff' : isDark ? '#d4d4d8' : '#3f3f46',
                  border: isSelected ? '1px solid rgba(129, 140, 248, 0.4)' : '1px solid transparent',
                  boxShadow: isSelected ? '0 2px 8px rgba(79, 70, 229, 0.35)' : 'none',
                }}
                className="transition-colors duration-150"
              >
                <Icon
                  name={opt.icon as any}
                  className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'opacity-75'}`}
                />
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
