import React, { useState, useCallback, useMemo } from 'react'
import { Icon } from '@/components/ui/Icon'
import { Surface } from '@/components/ui/Surface'

export type LinkEditorPanelProps = {
  initialUrl?: string
  initialText?: string
  initialOpenInNewTab?: boolean
  onSetLink: (url: string, text?: string, openInNewTab?: boolean) => void
}

export const useLinkEditorState = ({
  initialUrl,
  initialText,
  initialOpenInNewTab = true,
  onSetLink,
}: LinkEditorPanelProps) => {
  const [url, setUrl] = useState(initialUrl || '')
  const [text, setText] = useState(initialText || '')
  const [openInNewTab, setOpenInNewTab] = useState(initialOpenInNewTab)

  const onUrlChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(event.target.value)
  }, [])

  const onTextChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setText(event.target.value)
  }, [])

  const isValidUrl = useMemo(
    () =>
      /^(\S+):(\/\/)?\S+$/.test(url) ||
      url.startsWith('/') ||
      url.startsWith('#') ||
      url.startsWith('mailto:') ||
      url.startsWith('tel:'),
    [url],
  )

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (isValidUrl) {
        onSetLink(url, text.trim() ? text.trim() : undefined, openInNewTab)
      }
    },
    [url, text, isValidUrl, openInNewTab, onSetLink],
  )

  return {
    url,
    setUrl,
    text,
    setText,
    openInNewTab,
    setOpenInNewTab,
    onUrlChange,
    onTextChange,
    handleSubmit,
    isValidUrl,
  }
}

export const LinkEditorPanel: React.FC<LinkEditorPanelProps> = ({
  onSetLink,
  initialOpenInNewTab,
  initialUrl,
  initialText,
}) => {
  const state = useLinkEditorState({
    onSetLink,
    initialOpenInNewTab,
    initialUrl,
    initialText,
  })

  return (
    <Surface className="p-2.5 bg-white/95 dark:bg-[#202020]/95 backdrop-blur-xl border border-black/10 dark:border-white/10 shadow-2xl rounded-xl min-w-[18rem]">
      <form onSubmit={state.handleSubmit} className="flex flex-col gap-2">
        {/* 1. Link Display Text Input */}
        <label className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 cursor-text focus-within:border-indigo-500/50 dark:focus-within:border-violet-400/50 transition-colors">
          <Icon name="Type" className="w-3.5 h-3.5 flex-none text-zinc-500 dark:text-zinc-400" />
          <input
            type="text"
            className="flex-1 bg-transparent outline-none min-w-[13rem] text-zinc-800 dark:text-zinc-100 text-xs placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
            placeholder="표시 텍스트 (이름)..."
            value={state.text}
            onChange={state.onTextChange}
          />
        </label>

        {/* 2. Link Target URL Input */}
        <label className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 cursor-text focus-within:border-indigo-500/50 dark:focus-within:border-violet-400/50 transition-colors">
          <Icon name="Link" className="w-3.5 h-3.5 flex-none text-zinc-500 dark:text-zinc-400" />
          <input
            type="text"
            className="flex-1 bg-transparent outline-none min-w-[13rem] text-zinc-800 dark:text-zinc-100 text-xs placeholder:text-zinc-400 dark:placeholder:text-zinc-500 font-mono"
            placeholder="링크 URL (https://...)..."
            value={state.url}
            onChange={state.onUrlChange}
            autoFocus
          />
        </label>

        {/* 3. Action bar with New Tab toggle and Submit */}
        <div className="flex items-center justify-between pt-0.5">
          <label className="flex items-center gap-1.5 cursor-pointer select-none text-[11px] text-zinc-600 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={state.openInNewTab}
              onChange={e => state.setOpenInNewTab(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-0 cursor-pointer"
            />
            <span>새 탭에서 열기</span>
          </label>

          <button
            type="submit"
            disabled={!state.isValidUrl}
            className="px-3 py-1 rounded-lg text-xs font-medium bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-white disabled:opacity-40 disabled:pointer-events-none transition-colors shadow-xs cursor-pointer"
          >
            적용
          </button>
        </div>
      </form>
    </Surface>
  )
}

export default LinkEditorPanel
