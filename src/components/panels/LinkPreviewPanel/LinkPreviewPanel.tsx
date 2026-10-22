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
    <div className="w-[330px] bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border border-zinc-200/80 dark:border-zinc-800/80 shadow-[0_16px_36px_rgba(0,0,0,0.16)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.5)] rounded-2xl text-zinc-800 dark:text-zinc-200 animate-in fade-in-0 zoom-in-95 duration-150 overflow-hidden flex flex-col ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
      {/* Top Banner / OG Thumbnail Image */}
      {hasImage && (
        <a
          {...(!disableDefaultAction ? defaultProps : {})}
          onClick={handleLinkClick}
          className="relative w-full h-32 bg-zinc-100 dark:bg-zinc-800/40 overflow-hidden block group cursor-pointer border-b border-zinc-200/60 dark:border-zinc-800/60"
        >
          <img
            src={meta!.image!}
            alt={titleText}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent pointer-events-none" />
        </a>
      )}

      {/* Main Content Area */}
      <div className="p-3.5 flex flex-col gap-2.5">
        {/* Header: Favicon + Domain Badge + Actions */}
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-zinc-100/90 dark:bg-zinc-800/80 border border-zinc-200/70 dark:border-zinc-700/60 shadow-2xs">
              <div className="flex items-center justify-center w-3.5 h-3.5 overflow-hidden shrink-0">
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
                <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-300 tracking-tight truncate max-w-[130px]">
                  {domain}
                </span>
              )}
            </div>
            {loading && (
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse shrink-0 ml-0.5" />
            )}
          </div>

          {/* Quick Action Icons */}
          <div className="flex items-center gap-1 shrink-0">
            <a
              {...defaultProps}
              className="w-6 h-6 rounded-md flex items-center justify-center text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-all cursor-pointer"
              title="새 창에서 열기"
            >
              <Icon name="ExternalLink" className="w-3.5 h-3.5" />
            </a>

            <button
              type="button"
              onClick={handleCopy}
              className={`w-6 h-6 rounded-md flex items-center justify-center transition-all cursor-pointer ${
                copied
                  ? 'text-emerald-500 bg-emerald-500/15 dark:bg-emerald-500/20 shadow-2xs'
                  : 'text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/80'
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
                  className="w-6 h-6 rounded-md flex items-center justify-center text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-all cursor-pointer"
                  title="링크 편집"
                >
                  <Icon name="Pen" className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={onClear}
                  className="w-6 h-6 rounded-md flex items-center justify-center text-zinc-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
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
            className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-1 leading-snug hover:text-indigo-600 dark:hover:text-violet-400 cursor-pointer transition-colors"
            title={titleText}
          >
            {titleText}
          </a>

          {descText && (
            <p className="text-[11.5px] text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-[1.45] font-normal">
              {descText}
            </p>
          )}

          {!descText && !loading && (
            <span className="text-[10.5px] text-zinc-400 dark:text-zinc-500 truncate font-mono">
              {url}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default LinkPreviewPanel
