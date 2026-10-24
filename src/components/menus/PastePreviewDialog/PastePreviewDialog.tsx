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
  const [isEntered, setIsEntered] = useState<boolean>(false)
  const [isExiting, setIsExiting] = useState<boolean>(false)
  const [descAnim, setDescAnim] = useState<boolean>(true)
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
    if (isExiting) return
    setIsExiting(true)
    setTimeout(() => {
      setIsEntered(false)
      setIsExiting(false)
      setData(null)
      setSelectedId('')
    }, 200)
  }, [isExiting])

  // Trigger smooth entrance animation when dialog opens
  useEffect(() => {
    if (!data) {
      setIsEntered(false)
      setIsExiting(false)
      return
    }
    setIsExiting(false)
    let raf2 = 0
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => setIsEntered(true))
    })
    return () => {
      window.cancelAnimationFrame(raf1)
      if (raf2) window.cancelAnimationFrame(raf2)
    }
  }, [data])

  // Subtle crossfade on description text when selectedId changes
  useEffect(() => {
    if (!data) return
    setDescAnim(false)
    let raf2 = 0
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => setDescAnim(true))
    })
    return () => { window.cancelAnimationFrame(raf1); if (raf2) window.cancelAnimationFrame(raf2) }
  }, [selectedId, data])

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
      id: 'plain-text', label: '텍스트', description: '서식 없는 일반 텍스트로 본문에 삽입합니다', icon: 'Type',
      insert: () => { restoreSelection(); insertPlainText(editor, data.text) },
    }
    const linkOpt: PasteOptionItem = {
      id: 'link', label: '링크', description: '클릭하여 이동할 수 있는 하이퍼링크로 삽입합니다', icon: 'Link',
      insert: () => { restoreSelection(); insertHyperlink(editor, data.text) },
    }

    switch (data.type) {
      case 'image_data':
        return [{
          id: 'image-upload', label: '이미지 업로드', description: '이미지를 서버에 업로드하여 영구 보관합니다', icon: 'Upload', isPrimary: true,
          insert: () => {
            restoreSelection()
            const cmd = (editor.commands as any).uploadImageByBase64
            if (typeof cmd === 'function' ? !cmd({ base64: data.text, pos: targetPos }) : true) insertImage(editor, data.text)
          },
        }]
      case 'image_url':
        return [
          plainTextOpt, linkOpt,
          {
            id: 'image-external', label: '외부 이미지', description: '외부 이미지 주소를 직접 연결하여 본문에 표시합니다', icon: 'ExternalLink',
            insert: () => { restoreSelection(); insertImage(editor, data.text) },
          },
          {
            id: 'image-upload', label: '이미지 업로드', description: '이미지를 서버에 업로드하여 영구 보관합니다', icon: 'Upload', isPrimary: true,
            insert: () => {
              restoreSelection()
              const cmd = (editor.commands as any).uploadImageByUrl
              if (typeof cmd === 'function' ? !cmd({ url: data.text, pos: targetPos }) : true) insertImage(editor, data.text)
            },
          },
        ]
      case 'youtube_url': {
        const videoId = data.meta?.videoId || ''
        return [
          plainTextOpt, linkOpt,
          {
            id: 'youtube-video', label: '유튜브', description: '본문에서 바로 재생 가능한 유튜브 동영상 플레이어로 삽입합니다', icon: 'Youtube', isPrimary: true,
            insert: () => { restoreSelection(); if (videoId) insertYoutube(editor, videoId); else insertHyperlink(editor, data.text) },
          },
        ]
      }
      case 'web_url':
        return [plainTextOpt, { ...linkOpt, isPrimary: true }]
      case 'code':
        return [
          plainTextOpt,
          {
            id: 'code-block', label: '코드', description: '구문 강조가 적용된 코드 블록으로 삽입합니다', icon: 'Code', isPrimary: true,
            insert: () => { restoreSelection(); insertCodeBlock(editor, data.text) },
          },
        ]
      case 'list':
        return [
          plainTextOpt,
          {
            id: 'list-items', label: '목록', description: '줄바꿈 항목들을 정리된 에디터 목록으로 변환하여 삽입합니다', icon: 'List', isPrimary: true,
            insert: () => { restoreSelection(); insertMarkdownList(editor, data.text) },
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
    if (isExiting) return
    setIsExiting(true)
    setTimeout(() => {
      if (currentOption) currentOption.insert()
      setIsEntered(false)
      setIsExiting(false)
      setData(null)
      setSelectedId('')
    }, 200)
  }, [currentOption, isExiting])

  // Listen ONLY to tiptap:smart-paste (NEVER close on tiptap:close-menus scroll events)
  useEffect(() => {
    const handleSmartPaste = (e: Event) => {
      const customEvent = e as CustomEvent<SmartPasteEventDetail>
      if (customEvent.detail) setData(customEvent.detail)
    }
    window.addEventListener('tiptap:smart-paste', handleSmartPaste)
    return () => window.removeEventListener('tiptap:smart-paste', handleSmartPaste)
  }, [])

  useEffect(() => {
    if (options.length > 0) {
      const primary = options.find(o => o.isPrimary)
      setSelectedId(primary ? primary.id : options[options.length - 1].id)
    }
  }, [options])

  // Keyboard navigation: Tab / Shift+Tab / Left / Right to cycle, Enter to confirm, Escape to cancel
  useEffect(() => {
    if (!data || isExiting) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (isExiting) return
      const curIdx = options.findIndex(o => o.id === selectedId)
      if (e.key === 'Tab') {
        e.preventDefault(); e.stopPropagation()
        const step = e.shiftKey ? -1 : 1
        setSelectedId(options[(curIdx + step + options.length) % options.length].id)
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault(); e.stopPropagation()
        setSelectedId(options[(curIdx + 1) % options.length].id)
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault(); e.stopPropagation()
        setSelectedId(options[(curIdx - 1 + options.length) % options.length].id)
      } else if (e.key === 'Enter') {
        e.preventDefault(); e.stopPropagation(); handleConfirm()
      } else if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation(); handleClose()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [data, isExiting, options, selectedId, handleConfirm, handleClose])

  if (!data || options.length === 0 || typeof document === 'undefined') {
    return null
  }

  const isVisible = isEntered && !isExiting
  const animTiming = isExiting
    ? '200ms cubic-bezier(0.16, 1, 0.3, 1)'
    : '260ms cubic-bezier(0.16, 1, 0.3, 1)'

  const renderKbd = (keyText: string) => (
    <kbd
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        minWidth: '18px', height: '18px', padding: '0 4.5px', borderRadius: '5px',
        fontSize: '10.5px', fontWeight: 600, lineHeight: 1,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.07)',
        border: isDark ? '1px solid rgba(255, 255, 255, 0.16)' : '1px solid rgba(0, 0, 0, 0.12)',
        boxShadow: isDark
          ? '0 1px 2px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
          : '0 1px 2px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
        color: isDark ? '#fafafa' : '#0f172a',
      }}
    >
      {keyText}
    </kbd>
  )

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
        padding: '32px 24px 28px', userSelect: 'none',
        pointerEvents: isExiting ? 'none' : 'auto',
        opacity: isVisible ? 1 : 0,
        backgroundColor: isDark ? 'rgba(9, 9, 11, 0.68)' : 'rgba(248, 250, 252, 0.66)',
        backgroundImage: isDark
          ? 'radial-gradient(circle at 50% 18%, rgba(79, 70, 229, 0.14) 0%, rgba(9, 9, 11, 0.78) 70%)'
          : 'radial-gradient(circle at 50% 18%, rgba(224, 231, 255, 0.55) 0%, rgba(255, 255, 255, 0.72) 70%)',
        backdropFilter: isVisible ? 'blur(24px) saturate(160%)' : 'blur(0px) saturate(100%)',
        WebkitBackdropFilter: isVisible ? 'blur(24px) saturate(160%)' : 'blur(0px) saturate(100%)',
        transition: `opacity ${animTiming}, backdrop-filter ${animTiming}, -webkit-backdrop-filter ${animTiming}`,
      }}
      className="fixed inset-0 z-[1450] flex flex-col items-center justify-between select-none"
    >
      {/* 1단 & 2단 (상단 중앙): [1단: 제목 + 설명] + [2단: 제목 바로 밑 선택지 탭 글라스 캡슐 독] */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          textAlign: 'center', gap: '12px', flexShrink: 0, maxWidth: '94vw',
          opacity: isVisible ? 1 : 0,
          transform: isVisible
            ? 'translateY(0px) scale(1)'
            : isExiting
              ? 'translateY(-8px) scale(0.96)'
              : 'translateY(-10px) scale(0.96)',
          transition: `opacity ${animTiming}, transform ${animTiming}`,
        }}
      >
        {/* 1단: 상단 위 제목 및 선택된 삽입 방식 1줄 설명 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
          <span
            style={{
              fontSize: '19px', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2,
              color: isDark ? '#fafafa' : '#0f172a',
              textShadow: isDark ? '0 2px 10px rgba(0,0,0,0.45)' : '0 1px 2px rgba(255,255,255,0.8)',
            }}
          >
            붙여넣기 형식 선택
          </span>
          <p
            style={{
              margin: 0, fontSize: '13px', fontWeight: 500, lineHeight: 1.4,
              color: isDark ? 'rgba(228, 228, 231, 0.85)' : 'rgba(51, 65, 85, 0.88)',
              opacity: descAnim ? 1 : 0,
              transform: descAnim ? 'translateY(0px)' : 'translateY(3px)',
              transition: descAnim ? 'opacity 200ms ease-out, transform 200ms ease-out' : 'none',
            }}
          >
            {currentOption?.description || '에디터에 삽입될 실제 모습입니다'}
          </p>
        </div>

        {/* 2단: 제목 바로 밑 선택지 플로팅 글라스모피즘 캡슐 독 */}
        <div
          role="tablist"
          aria-label="삽입 방식 선택"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
            padding: '6px', borderRadius: '18px', maxWidth: '92vw', overflowX: 'auto',
            backgroundColor: isDark ? 'rgba(24, 24, 27, 0.52)' : 'rgba(255, 255, 255, 0.56)',
            backgroundImage: isDark
              ? 'linear-gradient(135deg, rgba(39, 39, 42, 0.62) 0%, rgba(24, 24, 27, 0.44) 100%)'
              : 'linear-gradient(135deg, rgba(255, 255, 255, 0.72) 0%, rgba(241, 245, 249, 0.48) 100%)',
            backdropFilter: 'blur(22px) saturate(190%)', WebkitBackdropFilter: 'blur(22px) saturate(190%)',
            border: isDark ? '1px solid rgba(255, 255, 255, 0.16)' : '1px solid rgba(255, 255, 255, 0.88)',
            boxShadow: isDark
              ? '0 14px 34px -6px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(0, 0, 0, 0.3), inset 0 1px 0 0 rgba(255, 255, 255, 0.16)'
              : '0 12px 30px -6px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(148, 163, 184, 0.22), inset 0 1px 0 0 rgba(255, 255, 255, 0.95)',
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
                  height: '34px', padding: '0 15px', borderRadius: '12px', fontSize: '12.5px', fontWeight: 600,
                  cursor: 'pointer', flexShrink: 0,
                  backgroundColor: isSelected ? 'rgba(79, 70, 229, 0.82)' : 'transparent',
                  backgroundImage: isSelected ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.92) 0%, rgba(79, 70, 229, 0.78) 100%)' : 'none',
                  color: isSelected ? '#ffffff' : isDark ? '#d4d4d8' : '#334155',
                  border: isSelected ? '1px solid rgba(165, 180, 252, 0.55)' : '1px solid transparent',
                  boxShadow: isSelected ? '0 6px 16px -2px rgba(79, 70, 229, 0.45), inset 0 1px 0 0 rgba(255, 255, 255, 0.45)' : 'none',
                  transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
                }}
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

      {/* 3단 (중앙 한가운데): 박스 틀 없는 1:1 라이브 미리보기 (선택지 변경 시 모핑 애니메이션 내장) */}
      <div
        style={{
          flex: 1, width: '100%', minHeight: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'scale(1)' : 'scale(0.96)',
          transition: `opacity ${animTiming}, transform ${animTiming}`,
        }}
      >
        <LivePreviewCanvas data={data} selectedId={selectedId} isDark={isDark} />
      </div>

      {/* 4단 & 5단 (하단 중앙): [4단: 취소/삽입 버튼 바로 위 단축키 안내] + [5단: 하단 중앙 취소/삽입 글라스 버튼] */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '12px', flexShrink: 0, maxWidth: '95vw',
          opacity: isVisible ? 1 : 0,
          transform: isVisible
            ? 'translateY(0px) scale(1)'
            : isExiting
              ? 'translateY(8px) scale(0.96)'
              : 'translateY(10px) scale(0.96)',
          transition: `opacity ${animTiming}, transform ${animTiming}`,
        }}
      >
        {/* 4단 (삽입+취소 버튼 바로 위): 단축키 안내 글라스 캡슐 배지 */}
        <div
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            padding: '5px 14px', borderRadius: '9999px',
            fontSize: '11.5px', fontWeight: 500, lineHeight: 1.2,
            color: isDark ? 'rgba(212, 212, 216, 0.88)' : 'rgba(71, 85, 105, 0.92)',
            backgroundColor: isDark ? 'rgba(24, 24, 27, 0.48)' : 'rgba(255, 255, 255, 0.54)',
            backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            border: isDark ? '1px solid rgba(255, 255, 255, 0.14)' : '1px solid rgba(255, 255, 255, 0.88)',
            boxShadow: isDark
              ? '0 4px 16px rgba(0, 0, 0, 0.35), inset 0 1px 0 0 rgba(255, 255, 255, 0.12)'
              : '0 4px 16px rgba(15, 23, 42, 0.08), inset 0 1px 0 0 rgba(255, 255, 255, 0.9)',
          }}
        >
          {options.length > 1 ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              {renderKbd('←')}
              {renderKbd('→')}
              <span>또는</span>
              {renderKbd('Tab')}
              <span>옵션 전환</span>
              <span style={{ opacity: 0.45, margin: '0 3px' }}>·</span>
              {renderKbd('↵')}
              <span>삽입</span>
              <span style={{ opacity: 0.45, margin: '0 3px' }}>·</span>
              {renderKbd('Esc')}
              <span>취소</span>
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              {renderKbd('↵')}
              <span>삽입</span>
              <span style={{ opacity: 0.45, margin: '0 3px' }}>·</span>
              {renderKbd('Esc')}
              <span>취소</span>
            </span>
          )}
        </div>

        {/* 5단 (하단 중앙): [취소] + [삽입 ↵] 프로스티드 글라스 버튼 */}
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={handleClose}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
              height: '38px', padding: '0 20px', borderRadius: '9999px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              backgroundColor: isDark ? 'rgba(39, 39, 42, 0.55)' : 'rgba(255, 255, 255, 0.62)',
              backgroundImage: isDark ? 'linear-gradient(135deg, rgba(63, 63, 70, 0.58) 0%, rgba(24, 24, 27, 0.48) 100%)' : 'linear-gradient(135deg, rgba(255, 255, 255, 0.78) 0%, rgba(241, 245, 249, 0.52) 100%)',
              backdropFilter: 'blur(20px) saturate(190%)', WebkitBackdropFilter: 'blur(20px) saturate(190%)',
              color: isDark ? '#f4f4f5' : '#334155',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.18)' : '1px solid rgba(255, 255, 255, 0.9)',
              boxShadow: isDark ? '0 8px 20px -4px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(0, 0, 0, 0.25), inset 0 1px 0 0 rgba(255, 255, 255, 0.18)' : '0 8px 20px -4px rgba(15, 23, 42, 0.1), 0 0 0 1px rgba(148, 163, 184, 0.22), inset 0 1px 0 0 rgba(255, 255, 255, 0.95)',
              transition: 'all 180ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            className="hover:scale-[1.03] active:scale-95"
          >
            취소
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', lineHeight: 1,
              height: '38px', padding: '0 24px', borderRadius: '9999px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              backgroundColor: 'rgba(79, 70, 229, 0.84)',
              backgroundImage: 'linear-gradient(135deg, rgba(99, 102, 241, 0.92) 0%, rgba(79, 70, 229, 0.76) 100%)',
              backdropFilter: 'blur(20px) saturate(190%)', WebkitBackdropFilter: 'blur(20px) saturate(190%)',
              color: '#ffffff',
              border: '1px solid rgba(165, 180, 252, 0.58)',
              boxShadow: '0 10px 26px -4px rgba(79, 70, 229, 0.52), 0 0 0 1px rgba(79, 70, 229, 0.25), inset 0 1px 0 0 rgba(255, 255, 255, 0.48)',
              transition: 'all 180ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            className="hover:scale-[1.03] active:scale-95"
          >
            <span>삽입</span>
            <span style={{ fontSize: '12px', opacity: 0.92 }} className="font-mono">↵</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default PastePreviewDialog
