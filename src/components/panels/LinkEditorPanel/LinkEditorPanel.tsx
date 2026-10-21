import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Surface } from '@/components/ui/Surface'
import { useState, useCallback, useMemo } from 'react'

export type LinkEditorPanelProps = {
  initialUrl?: string
  initialOpenInNewTab?: boolean
  onSetLink: (url: string, openInNewTab?: boolean) => void
}

export const useLinkEditorState = ({ initialUrl, initialOpenInNewTab, onSetLink }: LinkEditorPanelProps) => {
  const [url, setUrl] = useState(initialUrl || '')
  const [openInNewTab, setOpenInNewTab] = useState(initialOpenInNewTab || true)

  const onChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(event.target.value)
  }, [])

  const isValidUrl = useMemo(() => /^(\S+):(\/\/)?\S+$/.test(url) || url.startsWith('/') || url.startsWith('#'), [url])

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (isValidUrl) {
        onSetLink(url, openInNewTab)
      }
    },
    [url, isValidUrl, openInNewTab, onSetLink],
  )

  return {
    url,
    setUrl,
    openInNewTab,
    setOpenInNewTab,
    onChange,
    handleSubmit,
    isValidUrl,
  }
}

export const LinkEditorPanel = ({ onSetLink, initialOpenInNewTab, initialUrl }: LinkEditorPanelProps) => {
  const state = useLinkEditorState({ onSetLink, initialOpenInNewTab, initialUrl })

  return (
    <Surface className="p-2 bg-white/90 dark:bg-[#202020]/95 backdrop-blur-xl border border-black/5 dark:border-white/10 shadow-2xl rounded-xl">
      <form onSubmit={state.handleSubmit} className="flex items-center gap-1.5">
        <label className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 cursor-text focus-within:border-black/25 dark:focus-within:border-white/25 transition-colors">
          <Icon name="Link" className="w-3.5 h-3.5 flex-none text-zinc-500 dark:text-zinc-400" />
          <input
            type="text"
            className="flex-1 bg-transparent outline-none min-w-[13rem] text-zinc-800 dark:text-zinc-100 text-xs placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
            placeholder="링크 URL 입력..."
            value={state.url}
            onChange={state.onChange}
            autoFocus
          />
        </label>
        <button
          type="submit"
          disabled={!state.isValidUrl}
          className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-white disabled:opacity-40 disabled:pointer-events-none transition-colors shadow-sm"
        >
          적용
        </button>
      </form>
    </Surface>
  )
}

export default LinkEditorPanel
