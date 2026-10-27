import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Editor } from '@tiptap/react'
import { Icon } from '@/components/ui/Icon'
import { SmartPasteEventDetail, SmartPasteOption } from './types'
import {
  insertCodeBlock,
  insertHyperlink,
  insertImage,
  insertMarkdownList,
  insertPlainText,
  insertYoutube,
} from './utils'

export interface SmartPasteMenuProps {
  editor: Editor
}

export const SmartPasteMenu: React.FC<SmartPasteMenuProps> = ({ editor }) => {
  const [data, setData] = useState<SmartPasteEventDetail | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)

  const handleClose = useCallback(
    (fallbackToPlainText = true) => {
      if (fallbackToPlainText && data) {
        insertPlainText(editor, data.text)
      }
      setData(null)
      setSelectedIndex(0)
    },
    [data, editor],
  )

  // Listen to custom smart-paste trigger event
  useEffect(() => {
    const handleSmartPaste = (e: Event) => {
      const customEvent = e as CustomEvent<SmartPasteEventDetail>
      if (customEvent.detail) {
        setData(customEvent.detail)
        setSelectedIndex(0)
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

  // Build options based on detected type
  const options = useMemo<SmartPasteOption[]>(() => {
    if (!data) return []

    const plainTextOpt: SmartPasteOption = {
      id: 'plain-text',
      label: '일반 텍스트',
      description: '포맷 없이 원본 텍스트로 삽입',
      icon: 'Type',
      action: () => {
        insertPlainText(editor, data.text)
        handleClose(false)
      },
    }

    switch (data.type) {
      case 'image_url':
        return [
          {
            id: 'image-block',
            label: '이미지 블록',
            description: '이미지 뷰어로 에디터에 삽입',
            icon: 'Image',
            action: () => {
              insertImage(editor, data.text)
              handleClose(false)
            },
          },
          {
            id: 'link',
            label: '하이퍼링크',
            description: '클릭 가능한 링크로 삽입',
            icon: 'Link',
            action: () => {
              insertHyperlink(editor, data.text)
              handleClose(false)
            },
          },
          plainTextOpt,
        ]

      case 'youtube_url':
        return [
          {
            id: 'youtube-video',
            label: 'YouTube 영상',
            description: '반응형 임베드 플레이어로 삽입',
            icon: 'Youtube',
            action: () => {
              if (data.meta?.videoId) {
                insertYoutube(editor, data.meta.videoId)
              } else {
                insertHyperlink(editor, data.text)
              }
              handleClose(false)
            },
          },
          {
            id: 'link',
            label: '하이퍼링크',
            description: '클릭 가능한 링크로 삽입',
            icon: 'Link',
            action: () => {
              insertHyperlink(editor, data.text)
              handleClose(false)
            },
          },
          plainTextOpt,
        ]

      case 'web_url':
        return [
          {
            id: 'link',
            label: '하이퍼링크',
            description: '클릭 가능한 링크로 삽입',
            icon: 'Link',
            action: () => {
              insertHyperlink(editor, data.text)
              handleClose(false)
            },
          },
          plainTextOpt,
        ]

      case 'code':
        return [
          {
            id: 'code-block',
            label: '코드 블록',
            description: '구문 강조 지원 코드 박스로 삽입',
            icon: 'Code',
            action: () => {
              insertCodeBlock(editor, data.text)
              handleClose(false)
            },
          },
          plainTextOpt,
        ]

      case 'list':
        return [
          {
            id: 'list-items',
            label: '리스트',
            description: '구조화된 리스트 서식으로 삽입',
            icon: 'List',
            action: () => {
              insertMarkdownList(editor, data.text)
              handleClose(false)
            },
          },
          plainTextOpt,
        ]

      default:
        return [plainTextOpt]
    }
  }, [data, editor, handleClose])

  // Keyboard navigation
  useEffect(() => {
    if (!data) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => (prev + 1) % options.length)
      } else if (e.key === 'ArrowUp') {
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

  if (!data || options.length === 0) return null

  // Calculate position with viewport boundary guards
  const left = Math.min(Math.max(16, data.coords.left), window.innerWidth - 280)
  const top = data.coords.bottom + 8 > window.innerHeight - 240
    ? Math.max(16, data.coords.top - 220)
    : data.coords.bottom + 8

  return createPortal(
    <>
      {/* Invisible backdrop to capture outside clicks */}
      <div
        className="fixed inset-0 z-[1349]"
        onClick={() => handleClose(true)}
      />

      {/* Popover Menu Container */}
      <div
        ref={menuRef}
        style={{ top: `${top}px`, left: `${left}px` }}
        className="fixed z-[1350] min-w-[240px] max-w-[320px] p-1.5 shadow-2xl rounded-xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-black/10 dark:border-white/10 text-zinc-800 dark:text-zinc-200 animate-in fade-in-0 zoom-in-95 duration-150 select-none"
      >
        {/* Header Indicator */}
        <div className="flex items-center justify-between px-2.5 py-1.5 mb-1 border-b border-black/5 dark:border-white/10">
          <span className="text-[11px] font-semibold tracking-wide text-zinc-500 dark:text-zinc-400">
            붙여넣기 옵션 선택
          </span>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
            Esc로 일반 삽입
          </span>
        </div>

        {/* Option Buttons */}
        <div className="flex flex-col gap-0.5">
          {options.map((opt, idx) => {
            const isSelected = idx === selectedIndex
            return (
              <button
                key={opt.id}
                type="button"
                onClick={opt.action}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[color-mix(in_srgb,var(--editor-primary)_10%,transparent)] text-[var(--editor-primary)] dark:bg-[color-mix(in_srgb,var(--editor-primary)_20%,transparent)] font-medium'
                    : 'text-zinc-700 dark:text-[#e3e3e3] hover:bg-black/5 dark:hover:bg-white/[0.06]'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                    isSelected
                      ? 'bg-[var(--editor-primary)] text-white'
                      : 'bg-black/5 dark:bg-white/10 text-zinc-600 dark:text-zinc-300'
                  }`}
                >
                  <Icon name={opt.icon as any} className="w-3.5 h-3.5" />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-xs font-medium leading-none mb-0.5">
                    {opt.label}
                  </span>
                  {opt.description && (
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 leading-tight truncate">
                      {opt.description}
                    </span>
                  )}
                </div>
                {isSelected && (
                  <span className="text-[10px] text-[var(--editor-primary)] font-mono shrink-0">
                    ↵
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </>,
    document.body,
  )
}

export default SmartPasteMenu
