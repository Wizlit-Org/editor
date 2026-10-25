import { LinkEditorPanel } from '@/components/panels'
import { Icon } from '@/components/ui/Icon'
import { Toolbar } from '@/components/ui/Toolbar'
import * as Popover from '@radix-ui/react-popover'

export type EditLinkPopoverProps = {
  onSetLink: (link: string, text?: string, openInNewTab?: boolean) => void
}

export const EditLinkPopover = ({ onSetLink }: EditLinkPopoverProps) => {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Toolbar.Button
          className="h-7 w-7 p-0 inline-flex items-center justify-center leading-none text-zinc-700 hover:text-zinc-950 dark:text-zinc-200 dark:hover:text-white hover:bg-white/60 active:bg-white/80 dark:hover:bg-white/[0.1] dark:active:bg-white/[0.16] rounded-lg border border-transparent hover:border-white/50 dark:hover:border-white/[0.08] transition-all duration-150"
          activeClassname="bg-indigo-500/15 text-indigo-600 dark:bg-indigo-400/20 dark:text-indigo-300 border-indigo-500/25 dark:border-indigo-400/30"
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
        className="z-[1350] outline-none"
      >
        <LinkEditorPanel onSetLink={onSetLink} />
      </Popover.Content>
    </Popover.Root>
  )
}
