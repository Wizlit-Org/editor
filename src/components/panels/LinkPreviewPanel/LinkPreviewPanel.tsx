import { Icon } from '@/components/ui/Icon'
import { Surface } from '@/components/ui/Surface'
import { Toolbar } from '@/components/ui/Toolbar'
import Tooltip from '@/components/ui/Tooltip'
import { useMemo } from 'react'

export type LinkPreviewPanelProps = {
  url: string
  onEdit: () => void
  onClear: () => void
  onOpen: (url: string) => void
  editable: boolean
  disableDefaultAction?: boolean | ((url: string) => boolean)
}

export const LinkPreviewPanel = ({ onClear, onEdit, onOpen, url, editable, disableDefaultAction }: LinkPreviewPanelProps) => {
  const sanitizedLink = url?.startsWith('javascript:') ? '' : url

  const defaultProps = {
    href: sanitizedLink,
    target: '_blank',
    rel: 'noopener noreferrer',
  }

  return (
    <Surface className="flex items-center gap-2 p-2">
      <a
        {...(!(disableDefaultAction && typeof disableDefaultAction === 'function' ? disableDefaultAction(sanitizedLink || '') : disableDefaultAction) ? defaultProps : {})}
        onClick={() => onOpen(sanitizedLink || '')}
        className="text-sm underline break-all cursor-pointer"
      >
        {url}
      </a>
      {editable ? (
        <>
          <Toolbar.Divider />
          <Tooltip title="Edit link">
            <Toolbar.Button onClick={onEdit}>
              <Icon name="Pen" />
            </Toolbar.Button>
          </Tooltip>
          <Tooltip title="Remove link">
            <Toolbar.Button onClick={onClear}>
              <Icon name="Trash2" />
            </Toolbar.Button>
          </Tooltip>
        </>
      ) : (
        <>
          <Toolbar.Divider />
          <Tooltip title="Open in new tab">
            <a {...defaultProps}>
              <Toolbar.Button>
                <Icon name="ExternalLink" />
              </Toolbar.Button>
            </a>
          </Tooltip>
        </>
      )}
    </Surface>
  )
}
