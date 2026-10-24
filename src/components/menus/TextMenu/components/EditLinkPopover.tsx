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
          className="h-7 w-7 p-0 flex items-center justify-center text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white hover:bg-black/5 active:bg-black/10 dark:hover:bg-white/5 dark:active:bg-white/10 rounded border border-transparent transition-colors"
          activeClassname="bg-black/10 text-zinc-900 dark:bg-white/15 dark:text-white"
          tooltip="Set link"
        >
          <Icon name="Link" />
        </Toolbar.Button>
      </Popover.Trigger>
      <Popover.Content
        side="top"
        align="center"
        sideOffset={8}
        collisionPadding={12}
        className="z-[60] outline-none"
      >
        <LinkEditorPanel onSetLink={onSetLink} />
      </Popover.Content>
    </Popover.Root>
  )
}
