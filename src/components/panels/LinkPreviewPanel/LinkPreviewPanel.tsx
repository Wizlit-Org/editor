import React, { useState, useCallback, useMemo } from 'react'
import { Icon } from '@/components/ui/Icon'
import { Surface } from '@/components/ui/Surface'

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

  const handleCopy = useCallback(() => {
    if (url) {
      navigator.clipboard?.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [url])

  const defaultProps = {
    href: sanitizedLink,
    target: '_blank',
    rel: 'noopener noreferrer',
  }

  return (
    <Surface className="flex items-center gap-2 p-1.5 px-2 bg-white/90 dark:bg-[#202020]/95 backdrop-blur-xl border border-black/5 dark:border-white/10 shadow-2xl rounded-xl text-zinc-800 dark:text-zinc-200">
      {/* Favicon / Globe Icon */}
      <div className="flex items-center justify-center w-5 h-5 shrink-0 rounded bg-black/[0.04] dark:bg-white/[0.06]">
        {faviconUrl ? (
          <img
            src={faviconUrl}
            alt=""
            className="w-3.5 h-3.5 object-contain rounded-xs"
            onError={e => {
              ;(e.currentTarget as HTMLElement).style.display = 'none'
            }}
          />
        ) : (
          <Icon name="Globe" className="w-3.5 h-3.5 text-zinc-400" />
        )}
      </div>

      {/* Domain / URL Display */}
      <a
        {...(!(disableDefaultAction && typeof disableDefaultAction === 'function'
          ? disableDefaultAction(sanitizedLink || '')
          : disableDefaultAction)
          ? defaultProps
          : {})}
        onClick={() => onOpen(sanitizedLink || '')}
        className="text-xs font-medium text-zinc-800 dark:text-[#e3e3e3] hover:text-indigo-600 dark:hover:text-violet-400 transition-colors max-w-[200px] truncate underline cursor-pointer"
        title={url}
      >
        {domain || url}
      </a>

      {/* Divider */}
      <div className="h-3.5 w-[1px] bg-black/10 dark:bg-white/15 mx-0.5" />

      {/* Open in New Tab Button */}
      <a
        {...defaultProps}
        className="p-1 rounded text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-[#e3e3e3] hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
        title="새 창에서 열기"
      >
        <Icon name="ExternalLink" className="w-3.5 h-3.5" />
      </a>

      {/* Copy URL Button */}
      <button
        type="button"
        onClick={handleCopy}
        className="p-1 rounded text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-[#e3e3e3] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
        title={copied ? '복사됨!' : '링크 복사'}
      >
        <Icon name={copied ? 'Check' : 'Copy'} className="w-3.5 h-3.5" />
      </button>

      {editable && (
        <>
          {/* Edit Button */}
          <button
            type="button"
            onClick={onEdit}
            className="p-1 rounded text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-[#e3e3e3] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
            title="링크 및 텍스트 편집"
          >
            <Icon name="Pen" className="w-3.5 h-3.5" />
          </button>

          {/* Remove Link Button */}
          <button
            type="button"
            onClick={onClear}
            className="p-1 rounded text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-500/10 transition-colors cursor-pointer"
            title="링크 제거"
          >
            <Icon name="Trash2" className="w-3.5 h-3.5" />
          </button>
        </>
      )}
    </Surface>
  )
}

export default LinkPreviewPanel
