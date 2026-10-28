import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Icon } from '@/components/ui/Icon'

export type LinkPreviewPanelProps = {
  url: string
  onEdit: () => void
  onClear: () => void
  onOpen: (url: string) => boolean | void
  editable: boolean
  disableDefaultAction?: boolean | ((url: string) => boolean)
  onUpdatePosition?: () => void
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
  onUpdatePosition,
}) => {
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [faviconError, setFaviconError] = useState(false)
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
    setImageError(false)
    setFaviconError(false)
    if (!url) {
      setMeta(null)
      setLoading(false)
      return
    }
    if (previewCache.has(url)) {
      setMeta(previewCache.get(url)!)
      setLoading(false)
      return
    }

    let isMounted = true
    setLoading(true)

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

  // Floating UI position sync when metadata, loading, or image state transitions
  useEffect(() => {
    onUpdatePosition?.()
  }, [meta, loading, imageError, onUpdatePosition])

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
    let preventDefault = false
    if (disableDefaultAction && typeof disableDefaultAction === 'function') {
      if (disableDefaultAction(sanitizedLink || '')) {
        preventDefault = true
      }
    } else if (disableDefaultAction) {
      preventDefault = true
    }

    if (onOpen) {
      const handled = onOpen(sanitizedLink || '')
      if (Boolean(handled)) {
        preventDefault = true
      }
    }

    if (preventDefault) {
      e.preventDefault()
    } else if (typeof window !== 'undefined' && (sanitizedLink || url)) {
      e.preventDefault()
      window.open(sanitizedLink || url, '_blank', 'noopener,noreferrer')
    }
  }

  const titleText = meta?.title || domain || url
  const descText = meta?.description || ''
  const hasImage = Boolean(meta?.image && !imageError)

  return (
    <div
      data-ignore-external-label="true"
      className="link-preview-panel w-[320px] bg-white dark:bg-[#202020]/95 backdrop-blur-xl border border-zinc-200/80 dark:border-white/10 shadow-[0_12px_32px_rgba(0,0,0,0.18)] dark:shadow-[0_16px_36px_rgba(0,0,0,0.55),inset_0_1px_0_0_rgba(255,255,255,0.08)] rounded-xl text-zinc-800 dark:text-zinc-200 animate-in fade-in-0 zoom-in-95 duration-150 overflow-hidden flex flex-col select-none"
    >
      {/* 1. Top Notion-style Inline Action Toolbar */}
      <div className="h-9 px-2.5 flex items-center justify-between gap-1.5 border-b border-zinc-200/60 dark:border-white/10 bg-zinc-50/70 dark:bg-white/[0.03]">
        {/* Left: Favicon + Clickable Link / Domain */}
        <div className="inline-flex items-center gap-1.5 min-w-0 flex-1">
          <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center">
            {loading ? (
              <span className="w-3.5 h-3.5 rounded bg-black/[0.08] dark:bg-white/[0.08] animate-pulse" />
            ) : faviconUrl && !faviconError ? (
              <img
                src={faviconUrl}
                alt=""
                className="w-3.5 h-3.5 object-contain"
                onError={() => setFaviconError(true)}
              />
            ) : (
              <Icon name="Globe" className="w-3.5 h-3.5 text-zinc-400" />
            )}
          </span>

          {loading ? (
            <div className="h-2.5 w-24 rounded bg-black/[0.08] dark:bg-white/[0.08] animate-pulse" />
          ) : (
            <a
              {...(!disableDefaultAction ? defaultProps : {})}
              onClick={handleLinkClick}
              className="text-xs leading-none font-medium text-zinc-700 dark:text-zinc-200 hover:text-[var(--editor-primary)] hover:underline truncate transition-colors cursor-pointer"
              title={url}
            >
              {domain || url}
            </a>
          )}
        </div>

        {/* Vertical divider */}
        <div className="w-[1px] h-3.5 bg-zinc-200 dark:bg-zinc-700/80 shrink-0 mx-0.5" />

        {/* Right: 4-Action Button Group with Pixel-Perfect Alignment */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onMouseDown={e => {
              e.preventDefault()
              e.stopPropagation()
            }}
            onClick={handleLinkClick}
            className="w-6 h-6 p-0 m-0 rounded flex items-center justify-center text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
            title="새 창에서 열기"
          >
            <Icon name="ExternalLink" className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onMouseDown={e => {
              e.preventDefault()
              e.stopPropagation()
            }}
            onClick={handleCopy}
            className={`w-6 h-6 p-0 m-0 rounded flex items-center justify-center transition-colors cursor-pointer ${
              copied
                ? 'text-emerald-500 bg-emerald-500/15 dark:bg-emerald-500/20'
                : 'text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-black/5 dark:hover:bg-white/10'
            }`}
            title={copied ? '복사 완료' : '링크 복사'}
          >
            <Icon name={copied ? 'Check' : 'Copy'} className="w-3.5 h-3.5" />
          </button>

          {editable && (
            <>
              <button
                type="button"
                onMouseDown={e => {
                  e.preventDefault()
                  e.stopPropagation()
                  onEdit?.()
                }}
                onClick={e => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                className="w-6 h-6 p-0 m-0 rounded flex items-center justify-center text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                title="링크 편집"
              >
                <Icon name="Pen" className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onMouseDown={e => {
                  e.preventDefault()
                  e.stopPropagation()
                  onClear?.()
                }}
                onClick={e => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                className="w-6 h-6 p-0 m-0 rounded flex items-center justify-center text-zinc-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                title="링크 제거"
              >
                <Icon name="Unlink" className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* 2. Notion-style Glass Skeleton or Rich Bookmark Card */}
      {loading ? (
        <div className="flex flex-col animate-pulse">
          <div className="w-full h-24 bg-black/[0.04] dark:bg-white/[0.04] border-b border-zinc-200/50 dark:border-white/10 flex items-center justify-center">
            <Icon name="Globe" className="w-6 h-6 text-zinc-300 dark:text-zinc-600 opacity-60" />
          </div>
          <div className="p-3 flex flex-col gap-2">
            <div className="h-3.5 w-3/4 rounded bg-black/[0.08] dark:bg-white/[0.08]" />
            <div className="flex flex-col gap-1.5 pt-0.5">
              <div className="h-2.5 w-full rounded bg-black/[0.05] dark:bg-white/[0.05]" />
              <div className="h-2.5 w-4/5 rounded bg-black/[0.05] dark:bg-white/[0.05]" />
            </div>
          </div>
        </div>
      ) : (
        <>
          {hasImage && (
            <a
              {...(!disableDefaultAction ? defaultProps : {})}
              onClick={handleLinkClick}
              className="relative w-full h-32 bg-zinc-100 dark:bg-zinc-800/40 overflow-hidden block group cursor-pointer border-b border-zinc-200/60 dark:border-white/10"
            >
              <img
                src={meta!.image!}
                alt={titleText}
                onLoad={() => onUpdatePosition?.()}
                onError={() => setImageError(true)}
                className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent pointer-events-none" />
            </a>
          )}

          {(titleText || descText) && (
            <div className="p-3 flex flex-col gap-1">
              <a
                {...(!disableDefaultAction ? defaultProps : {})}
                onClick={handleLinkClick}
                className="text-[12.5px] font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-1 leading-snug hover:text-[var(--editor-primary)] cursor-pointer transition-colors"
                title={titleText}
              >
                {titleText}
              </a>

              {descText && (
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-[1.45]">
                  {descText}
                </p>
              )}

              {!descText && (
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate font-mono">
                  {url}
                </span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default LinkPreviewPanel
