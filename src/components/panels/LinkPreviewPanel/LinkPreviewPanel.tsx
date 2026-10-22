import React, { useState, useCallback, useMemo } from 'react'
import { Icon } from '@/components/ui/Icon'

export type LinkPreviewPanelProps = {
  url: string
  onEdit: () => void
  onClear: () => void
  onOpen: (url: string) => void
  editable: boolean
  disableDefaultAction?: boolean | ((url: string) => boolean)
}

export const LinkPreviewPanel: React.FC<LinkPreviewPanelProps> = ({
  onClear,
  onEdit,
  onOpen,
  url,
  editable,
  disableDefaultAction,
}) => {
  const [copied, setCopied] = useState(false)
  const sanitizedLink = url?.startsWith('javascript:') ? '' : url

  const domain = useMemo(() => {
    if (!url) return ''
    try {
      const parsed = new URL(
        url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`,
      )
      return parsed.hostname
    } catch {
      return url
    }
  }, [url])

  const faviconUrl =
    domain && domain.includes('.')
      ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
      : null

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (url) {
        navigator.clipboard?.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 1800)
      }
    },
    [url],
  )

  const defaultProps = {
    href: sanitizedLink,
    target: '_blank',
    rel: 'noopener noreferrer',
  }

  const handleLinkClick = (e: React.MouseEvent) => {
    if (disableDefaultAction && typeof disableDefaultAction === 'function') {
      if (disableDefaultAction(sanitizedLink || '')) {
        e.preventDefault()
      }
    } else if (disableDefaultAction) {
      e.preventDefault()
    }
    onOpen(sanitizedLink || '')
  }

  return (
    <div className="flex items-center gap-2 p-2 px-3 bg-white/90 dark:bg-zinc-900/95 backdrop-blur-md border border-black/10 dark:border-white/10 shadow-2xl rounded-xl text-zinc-800 dark:text-zinc-200 animate-in fade-in-0 zoom-in-95 duration-150">
      {/* Favicon & Domain Badge */}
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="flex items-center justify-center w-5 h-5 rounded-md bg-black/[0.04] dark:bg-white/[0.06] overflow-hidden border border-black/[0.06] dark:border-white/[0.08]">
          {faviconUrl ? (
            <img
              src={faviconUrl}
              alt=""
              className="w-3.5 h-3.5 object-contain"
              onError={e => {
                ;(e.currentTarget as HTMLElement).style.display = 'none'
              }}
            />
          ) : (
            <Icon name="Globe" className="w-3.5 h-3.5 text-zinc-400" />
          )}
        </div>
        {domain && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase bg-indigo-500/10 text-indigo-600 dark:bg-violet-500/20 dark:text-violet-300 border border-indigo-500/20 dark:border-violet-500/30">
            {domain}
          </span>
        )}
      </div>

      {/* Main URL Text (clickable preview) */}
      <a
        {...(!disableDefaultAction ? defaultProps : {})}
        onClick={handleLinkClick}
        className="text-xs font-normal text-zinc-600 hover:text-indigo-600 dark:text-zinc-300 dark:hover:text-violet-400 transition-colors max-w-[200px] truncate cursor-pointer underline-offset-2 hover:underline"
        title={url}
      >
        {url}
      </a>

      {/* Divider */}
      <div className="h-4 w-[1px] bg-black/10 dark:bg-white/15 mx-0.5 shrink-0" />

      {/* Action Buttons Group */}
      <div className="flex items-center gap-0.5 shrink-0">
        {/* Open in New Tab */}
        <a
          {...defaultProps}
          className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all"
          title="새 창에서 열기"
        >
          <Icon name="ExternalLink" className="w-3.5 h-3.5" />
        </a>

        {/* Copy URL */}
        <button
          type="button"
          onClick={handleCopy}
          className={`p-1.5 rounded-md transition-all active:scale-95 cursor-pointer flex items-center gap-1 ${
            copied
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-medium'
              : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10'
          }`}
          title={copied ? '클립보드 복사 완료!' : '링크 복사'}
        >
          <Icon name={copied ? 'Check' : 'Copy'} className="w-3.5 h-3.5" />
          {copied && <span className="text-[10px] pr-0.5 animate-in fade-in-0 duration-150">복사됨</span>}
        </button>

        {editable && (
          <>
            {/* Minimal Edit Button */}
            <button
              type="button"
              onClick={onEdit}
              className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
              title="링크 및 텍스트 편집"
            >
              <Icon name="Pen" className="w-3.5 h-3.5" />
            </button>

            {/* Remove Link Button */}
            <button
              type="button"
              onClick={onClear}
              className="p-1.5 rounded-md text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400 hover:bg-red-500/10 active:scale-95 transition-all cursor-pointer"
              title="링크 제거"
            >
              <Icon name="Unlink" className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default LinkPreviewPanel
