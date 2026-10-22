import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Icon } from '@/components/ui/Icon'

export type LinkPreviewPanelProps = {
  url: string
  onEdit: () => void
  onClear: () => void
  onOpen: (url: string) => void
  editable: boolean
  disableDefaultAction?: boolean | ((url: string) => boolean)
}

interface LinkMetadata {
  title: string
  description: string
  image: string | null
  favicon: string | null
  domain: string
  url: string
}

// Memory cache for fetched link previews to eliminate redundant fetches
const previewCache = new Map<string, LinkMetadata>()

export const LinkPreviewPanel: React.FC<LinkPreviewPanelProps> = ({
  onClear,
  onEdit,
  onOpen,
  url,
  editable,
  disableDefaultAction,
}) => {
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [meta, setMeta] = useState<LinkMetadata | null>(() => previewCache.get(url) || null)

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

  // Fetch OpenGraph metadata from /api/link-preview
  useEffect(() => {
    if (!url) return
    if (previewCache.has(url)) {
      setMeta(previewCache.get(url)!)
      setLoading(false)
      return
    }

    let isMounted = true
    setLoading(true)
    setImageError(false)

    const fetchMeta = async () => {
      try {
        const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
        if (res.ok) {
          const data: LinkMetadata = await res.json()
          if (isMounted) {
            previewCache.set(url, data)
            setMeta(data)
          }
        }
      } catch {
        // Fallback handled gracefully
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchMeta()
    return () => {
      isMounted = false
    }
  }, [url])

  const faviconUrl =
    meta?.favicon ||
    (domain && domain.includes('.')
      ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
      : null)

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

  const titleText = meta?.title || domain || url
  const descText = meta?.description || ''
  const hasImage = Boolean(meta?.image && !imageError)

  return (
    <div className="w-[320px] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-black/10 dark:border-white/10 shadow-2xl rounded-xl text-zinc-800 dark:text-zinc-200 animate-in fade-in-0 zoom-in-95 duration-150 overflow-hidden flex flex-col">
      {/* Top Banner / OG Thumbnail Image */}
      {hasImage && (
        <a
          {...(!disableDefaultAction ? defaultProps : {})}
          onClick={handleLinkClick}
          className="relative w-full h-32 bg-black/5 dark:bg-white/5 overflow-hidden block group cursor-pointer border-b border-black/5 dark:border-white/10"
        >
          <img
            src={meta!.image!}
            alt={titleText}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </a>
      )}

      {/* Main Content Area */}
      <div className="p-3 flex flex-col gap-2">
        {/* Header: Favicon + Domain Badge + Actions */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="flex items-center justify-center w-4 h-4 rounded bg-black/[0.04] dark:bg-white/[0.06] overflow-hidden shrink-0">
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
              <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 truncate">
                {domain}
              </span>
            )}
            {loading && (
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping shrink-0 ml-1" />
            )}
          </div>

          {/* Quick Action Icons */}
          <div className="flex items-center gap-0.5 shrink-0">
            <a
              {...defaultProps}
              className="p-1 rounded text-zinc-400 hover:text-zinc-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              title="새 창에서 열기"
            >
              <Icon name="ExternalLink" className="w-3.5 h-3.5" />
            </a>

            <button
              type="button"
              onClick={handleCopy}
              className={`p-1 rounded transition-colors cursor-pointer ${
                copied
                  ? 'text-emerald-500 bg-emerald-500/10'
                  : 'text-zinc-400 hover:text-zinc-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10'
              }`}
              title={copied ? '복사 완료' : '링크 복사'}
            >
              <Icon name={copied ? 'Check' : 'Copy'} className="w-3.5 h-3.5" />
            </button>

            {editable && (
              <>
                <button
                  type="button"
                  onClick={onEdit}
                  className="p-1 rounded text-zinc-400 hover:text-zinc-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                  title="링크 편집"
                >
                  <Icon name="Pen" className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={onClear}
                  className="p-1 rounded text-zinc-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                  title="링크 제거"
                >
                  <Icon name="Unlink" className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Title & 2-line Description */}
        <div className="flex flex-col gap-1">
          <a
            {...(!disableDefaultAction ? defaultProps : {})}
            onClick={handleLinkClick}
            className="text-xs font-semibold text-zinc-800 dark:text-zinc-100 line-clamp-1 hover:text-indigo-600 dark:hover:text-violet-400 cursor-pointer transition-colors"
            title={titleText}
          >
            {titleText}
          </a>

          {descText && (
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
              {descText}
            </p>
          )}

          {!descText && !loading && (
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate font-mono">
              {url}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default LinkPreviewPanel
