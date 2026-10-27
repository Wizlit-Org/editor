import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
import { PastePreviewHeader } from './PastePreviewHeader'
import { PastePreviewFooter } from './PastePreviewFooter'
import { PasteOptionItem, PastePreviewDialogProps } from './types'

export type { PastePreviewDialogProps, PasteOptionItem }

export const PastePreviewDialog: React.FC<PastePreviewDialogProps> = ({ editor }) => {
  const [data, setData] = useState<SmartPasteEventDetail | null>(null)
  const [selectedId, setSelectedId] = useState<string>('')
  const [isEntered, setIsEntered] = useState<boolean>(false)
  const [isExiting, setIsExiting] = useState<boolean>(false)
  const [descAnim, setDescAnim] = useState<boolean>(true)
  const dialogRef = useRef<HTMLDivElement>(null)
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof document !== 'undefined') {
      const editorDom = editor?.view?.dom as HTMLElement | undefined
      if (editorDom?.closest('.editor-theme-dark')) return true
      if (editorDom?.closest('.editor-theme-light')) return false
      if (editorDom?.closest('.dark, .theme-dark, .notion-dark-canvas')) return true
      if (editorDom?.closest('.theme-light, .notion-light-canvas')) return false
      return false
    }
    return false
  })

  // Synchronize light/dark theme with editor container
  useEffect(() => {
    if (typeof document === 'undefined' || !data) return
    const editorDom = editor?.view?.dom as HTMLElement | undefined
    if (editorDom?.closest('.editor-theme-dark')) {
      setIsDark(true)
    } else if (editorDom?.closest('.editor-theme-light')) {
      setIsDark(false)
    } else if (editorDom?.closest('.dark, .theme-dark, .notion-dark-canvas')) {
      setIsDark(true)
    } else if (editorDom?.closest('.theme-light, .notion-light-canvas')) {
      setIsDark(false)
    } else {
      setIsDark(false)
    }
  }, [data, editor])

  // Freeze background editor & trap IME / input events while dialog is active
  useEffect(() => {
    if (!data) return
    const prevEditable = editor?.isEditable ?? true
    const editorDom = editor?.view?.dom as HTMLElement | undefined
    editorDom?.blur()
    dialogRef.current?.focus()

    if (prevEditable && editor && !editor.isDestroyed) {
      editor.setEditable(false)
    }

    const trapInput = (e: Event) => {
      e.preventDefault()
      e.stopPropagation()
    }

    window.addEventListener('beforeinput', trapInput, true)
    window.addEventListener('compositionstart', trapInput, true)

    return () => {
      window.removeEventListener('beforeinput', trapInput, true)
      window.removeEventListener('compositionstart', trapInput, true)
      if (prevEditable && editor && !editor.isDestroyed) {
        editor.setEditable(true)
      }
    }
  }, [data, editor])

  const handleClose = useCallback(() => {
    if (isExiting) return
    setIsExiting(true)
    setTimeout(() => {
      if (editor && !editor.isDestroyed && !editor.isEditable) {
        editor.setEditable(true)
      }
      setIsEntered(false)
      setIsExiting(false)
      setData(null)
      setSelectedId('')
    }, 200)
  }, [editor, isExiting])

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
    return () => {
      window.cancelAnimationFrame(raf1)
      if (raf2) window.cancelAnimationFrame(raf2)
    }
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
              const cmd = (editor.commands as any).uploadImageByBase64
              if (typeof cmd === 'function' ? !cmd({ base64: data.text, pos: targetPos }) : true)
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
              const cmd = (editor.commands as any).uploadImageByUrl
              if (typeof cmd === 'function' ? !cmd({ url: data.text, pos: targetPos }) : true)
                insertImage(editor, data.text)
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

  const imageProxyUrl = useMemo<((url: string) => string) | undefined>(() => {
    const uploadExt = editor?.extensionManager?.extensions?.find(e => e.name === 'imageUpload')
    return uploadExt?.options?.imageProxyUrl
  }, [editor])

  const handleConfirm = useCallback(() => {
    if (isExiting) return
    setIsExiting(true)
    setTimeout(() => {
      if (editor && !editor.isDestroyed && !editor.isEditable) {
        editor.setEditable(true)
      }
      if (currentOption) currentOption.insert()
      setIsEntered(false)
      setIsExiting(false)
      setData(null)
      setSelectedId('')
    }, 200)
  }, [currentOption, editor, isExiting])

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

  // Keyboard guard & navigation: trap all keystrokes while dialog is active/exiting, route only allowed shortcuts
  useEffect(() => {
    if (!data) return
    const onKeyDown = (e: KeyboardEvent) => {
      // Trap all keystrokes unconditionally at capture phase to protect background editor
      e.preventDefault()
      e.stopPropagation()

      if (isExiting) return

      const curIdx = options.findIndex(o => o.id === selectedId)
      if (e.key === 'Tab') {
        const step = e.shiftKey ? -1 : 1
        setSelectedId(options[(curIdx + step + options.length) % options.length].id)
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        setSelectedId(options[(curIdx + 1) % options.length].id)
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        setSelectedId(options[(curIdx - 1 + options.length) % options.length].id)
      } else if (e.key === 'Enter') {
        handleConfirm()
      } else if (e.key === 'Escape') {
        handleClose()
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
    ? '200ms cubic-bezier(0.4, 0, 0.2, 1)'
    : '260ms cubic-bezier(0.16, 1, 0.3, 1)'

  return createPortal(
    <div
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="붙여넣기 형식 선택"
      data-paste-preview-dialog="true"
      onScrollCapture={e => e.stopPropagation()}
      onClick={handleClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1450,
        outline: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '32px 24px 28px',
        userSelect: 'none',
        pointerEvents: isExiting ? 'none' : 'auto',
        opacity: isVisible ? 1 : 0,
        backgroundColor: isDark ? 'rgba(9, 9, 11, 0.68)' : 'rgba(248, 250, 252, 0.66)',
        backgroundImage: isDark
          ? 'radial-gradient(circle at 50% 18%, color-mix(in srgb, var(--editor-primary, #faaf2d) 14%, transparent) 0%, rgba(9, 9, 11, 0.78) 70%)'
          : 'radial-gradient(circle at 50% 18%, color-mix(in srgb, var(--editor-primary, #faaf2d) 20%, transparent) 0%, rgba(255, 255, 255, 0.72) 70%)',
        backdropFilter: 'blur(24px) saturate(160%)',
        WebkitBackdropFilter: 'blur(24px) saturate(160%)',
        transition: `opacity ${animTiming}`,
      }}
      className="fixed inset-0 z-[1450] flex flex-col items-center justify-between select-none"
    >
      {/* 1단 & 2단: 헤더 (제목 + 1줄 설명 + 선택지 탭 독) */}
      <PastePreviewHeader
        isVisible={isVisible}
        isExiting={isExiting}
        animTiming={animTiming}
        isDark={isDark}
        descAnim={descAnim}
        description={currentOption?.description || '에디터에 삽입될 실제 모습입니다'}
        options={options}
        selectedId={selectedId}
        onSelectOption={setSelectedId}
      />

      {/* 3단: 박스 틀 없는 1:1 라이브 미리보기 */}
      <div
        data-live-preview-container="true"
        style={{
          flex: 1,
          width: '100%',
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          backgroundColor: 'transparent',
          opacity: isVisible ? 1 : 0,
          transform: isVisible
            ? 'translateY(0px) scale(1)'
            : isExiting
              ? 'translateY(6px) scale(0.96)'
              : 'scale(0.96)',
          transition: `opacity ${animTiming}, transform ${animTiming}`,
        }}
        className="w-full flex-1 min-h-0 flex items-center justify-center overflow-hidden bg-transparent"
      >
        <LivePreviewCanvas
          data={data}
          selectedId={selectedId}
          isDark={isDark}
          imageProxyUrl={imageProxyUrl}
        />
      </div>

      {/* 4단 & 5단: 푸터 (단축키 안내 + 취소/삽입 버튼) */}
      <PastePreviewFooter
        isVisible={isVisible}
        isExiting={isExiting}
        animTiming={animTiming}
        isDark={isDark}
        hasMultipleOptions={options.length > 1}
        onClose={handleClose}
        onConfirm={handleConfirm}
      />
    </div>,
    document.body,
  )
}

export default PastePreviewDialog
