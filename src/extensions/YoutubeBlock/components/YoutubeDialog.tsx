import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Editor } from '@tiptap/react'
import { Icon } from '@/components/ui/Icon'

export interface YoutubeDialogProps {
  editor: Editor
  appendTo?: React.RefObject<HTMLElement | null>
}

export interface OpenYoutubeDialogDetail {
  mode?: 'insert' | 'edit'
  src?: string
}

function getYoutubeVideoId(url: string): string | null {
  if (!url) return null
  const regExp = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  const match = url.match(regExp)
  return match && match[1]?.length === 11 ? match[1] : null
}

function getYoutubePlaylistId(url: string): string | null {
  if (!url) return null
  try {
    return new URL(url).searchParams.get('list')
  } catch {
    const match = url.match(/[?&]list=([a-zA-Z0-9_-]+)/)
    return match ? match[1] : null
  }
}

export const YoutubeDialog: React.FC<YoutubeDialogProps> = ({ editor, appendTo }) => {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'insert' | 'edit'>('insert')
  const [url, setUrl] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleClose = useCallback(() => {
    setOpen(false)
    setUrl('')
  }, [])

  useEffect(() => {
    const handleOpen = (e: CustomEvent<OpenYoutubeDialogDetail>) => {
      const targetMode = e.detail?.mode || 'insert'
      const initialSrc = e.detail?.src || ''
      setMode(targetMode)
      setUrl(initialSrc)
      setOpen(true)
    }

    window.addEventListener('tiptap:open-youtube-dialog', handleOpen as EventListener)

    return () => {
      window.removeEventListener('tiptap:open-youtube-dialog', handleOpen as EventListener)
    }
  }, [])

  // Auto-focus input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 50)
    }
  }, [open])

  const videoId = useMemo(() => getYoutubeVideoId(url.trim()), [url])
  const playlistId = useMemo(() => getYoutubePlaylistId(url.trim()), [url])
  const isValid = Boolean(videoId || playlistId)
  const isDirty = url.trim().length > 0
  const thumbnailUrl = videoId ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : null

  const handleConfirm = useCallback(() => {
    const trimmed = url.trim()
    if (!trimmed || !isValid) return

    if (mode === 'insert') {
      editor.chain().focus().setYoutubeVideo({ src: trimmed }).run()
    } else {
      editor.chain().focus().updateAttributes('youtube', { src: trimmed, isEditing: false }).run()
    }
    handleClose()
  }, [editor, handleClose, isValid, mode, url])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.stopPropagation()
      if (e.key === 'Escape') {
        e.preventDefault()
        handleClose()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (isValid) {
          handleConfirm()
        }
      }
    },
    [handleClose, handleConfirm, isValid],
  )

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-0 duration-150"
      onClick={handleClose}
      onKeyDown={handleKeyDown}
      onPaste={e => e.stopPropagation()}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white/95 dark:bg-[#18181b]/95 backdrop-blur-2xl border border-black/10 dark:border-white/15 shadow-2xl p-5 flex flex-col gap-4 text-zinc-800 dark:text-zinc-100 animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
        onPaste={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-1 border-b border-black/5 dark:border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-600/10 text-red-600 dark:bg-red-500/20 dark:text-red-400 flex items-center justify-center">
              <Icon name="Video" className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
                {mode === 'edit' ? 'YouTube 동영상 링크 수정' : 'YouTube 동영상 추가'}
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                YouTube 동영상 URL을 입력하여 본문에 임베드합니다
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            title="닫기 (Esc)"
          >
            <Icon name="X" className="w-4 h-4" />
          </button>
        </div>

        {/* Input */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 focus-within:border-red-500/80 dark:focus-within:border-red-500/80 transition-all">
            <Icon name="Link2" className="w-4 h-4 text-zinc-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onPaste={e => e.stopPropagation()}
              onKeyDown={handleKeyDown}
              placeholder="https://www.youtube.com/watch?v=..."
              className="flex-1 bg-transparent text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 outline-none"
            />
            {url && (
              <button
                type="button"
                onClick={() => setUrl('')}
                className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <Icon name="X" className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Validation Feedback */}
          {isDirty && !isValid && (
            <p className="text-[11px] text-red-500 dark:text-red-400 flex items-center gap-1 pl-1">
              <Icon name="AlertCircle" className="w-3 h-3" />
              <span>올바른 YouTube 영상 주소를 입력해주세요 (watch?v=, youtu.be/ 또는 shorts/)</span>
            </p>
          )}
        </div>

        {/* Live Preview Thumbnail */}
        {isValid && thumbnailUrl && (
          <div className="rounded-xl overflow-hidden border border-black/10 dark:border-white/15 bg-black/5 dark:bg-black/40 relative aspect-video flex items-center justify-center group">
            <img
              src={thumbnailUrl}
              alt="YouTube Preview"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg">
                <Icon name="Play" className="w-5 h-5 ml-0.5 fill-current" />
              </div>
            </div>
            <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/70 text-white text-[10px] font-mono">
              ID: {videoId}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-black/5 dark:border-white/10">
          <button
            type="button"
            onClick={handleClose}
            className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isValid}
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md ${
              isValid
                ? 'bg-red-600 hover:bg-red-500 active:bg-red-700 text-white shadow-red-600/25 cursor-pointer'
                : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed shadow-none'
            }`}
          >
            <span>{mode === 'edit' ? '동영상 변경' : '동영상 삽입'}</span>
            <span className="text-[10px] opacity-75 font-mono">↵</span>
          </button>
        </div>
      </div>
    </div>,
    (appendTo?.current as HTMLElement) || (typeof document !== 'undefined' ? document.body : (null as any)),
  )
}

export default YoutubeDialog
