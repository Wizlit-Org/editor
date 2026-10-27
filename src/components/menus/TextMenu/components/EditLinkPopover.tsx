import { LinkEditorPanel } from '@/components/panels'
import { Icon } from '@/components/ui/Icon'
import { Toolbar } from '@/components/ui/Toolbar'
import * as Popover from '@radix-ui/react-popover'
import { Editor } from '@tiptap/react'
import { useCallback, useState, useEffect } from 'react'

export type EditLinkPopoverProps = {
  editor?: Editor
  onSetLink: (link: string, text?: string, openInNewTab?: boolean) => void
}

export const EditLinkPopover = ({ editor, onSetLink }: EditLinkPopoverProps) => {
  const [open, setOpen] = useState(false)
  const [initialText, setInitialText] = useState('')
  const [initialUrl, setInitialUrl] = useState('')

  useEffect(() => {
    const handleClose = (e: Event) => {
      if ((e as CustomEvent).detail !== 'editLink') {
        setOpen(false)
      }
    }
    window.addEventListener('tiptap:close-menus', handleClose)
    return () => window.removeEventListener('tiptap:close-menus', handleClose)
  }, [])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        window.dispatchEvent(new CustomEvent('tiptap:close-menus', { detail: 'editLink' }))
      }
      if (nextOpen && editor && !editor.isDestroyed) {
        const { from, to, empty } = editor.state.selection
        const rawText = !empty ? editor.state.doc.textBetween(from, to, ' ').trim() : ''
        const existingUrl = editor.getAttributes('link')?.href || ''

        const isUrlLike = (str: string) => {
          const trimmed = str.trim()
          if (!trimmed) return false
          if (/^(https?:\/\/|www\.)\S+$/i.test(trimmed)) return true
          if (/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/\S*)?$/i.test(trimmed)) return true
          return false
        }

        setInitialText(rawText)
        setInitialUrl(existingUrl || (isUrlLike(rawText) ? rawText : ''))
      }
      setOpen(nextOpen)
    },
    [editor],
  )

  const handleSetLink = useCallback(
    (link: string, text?: string, openInNewTab?: boolean) => {
      onSetLink(link, text, openInNewTab)
      setOpen(false)
    },
    [onSetLink],
  )

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <Toolbar.Button
          className="h-7 w-7 p-0 inline-flex items-center justify-center leading-none text-zinc-700 hover:text-zinc-950 dark:text-zinc-200 dark:hover:text-white hover:bg-white/60 active:bg-white/80 dark:hover:bg-white/[0.1] dark:active:bg-white/[0.16] rounded-lg border border-transparent hover:border-white/50 dark:hover:border-white/[0.08] transition-all duration-150"
          activeClassname="bg-black/10 text-neutral-800 dark:bg-white/20 dark:text-neutral-200"
          tooltip="Set link"
        >
          <Icon name="Link" className="w-3.5 h-3.5" />
        </Toolbar.Button>
      </Popover.Trigger>
      <Popover.Content
        side="top"
        align="center"
        sideOffset={10}
        collisionPadding={12}
        className="z-[1360] outline-none"
      >
        <LinkEditorPanel
          initialText={initialText}
          initialUrl={initialUrl}
          onSetLink={handleSetLink}
          onCancel={() => setOpen(false)}
        />
      </Popover.Content>
    </Popover.Root>
  )
}
