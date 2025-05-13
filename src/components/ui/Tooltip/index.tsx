'use client'

import React, { useState, useCallback, JSX } from 'react'
import {
  useFloating,
  offset,
  flip,
  shift,
  autoUpdate,
  useInteractions,
  useHover,
  useFocus,
  FloatingPortal,
} from '@floating-ui/react'

import { TooltipProps, TippyProps } from './types'

const isMac = typeof window !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0

const ShortcutKey = ({ children }: { children: string }): JSX.Element => {
  const className =
    'inline-flex items-center justify-center w-5 h-5 p-1 text-[0.625rem] rounded font-semibold leading-none border border-neutral-200 text-neutral-500 border-b-2'

  switch (children) {
    case 'Mod':
      return <kbd className={className}>{isMac ? '⌘' : 'Ctrl'}</kbd>
    case 'Shift':
      return <kbd className={className}>⇧</kbd>
    case 'Alt':
      return <kbd className={className}>{isMac ? '⌥' : 'Alt'}</kbd>
    default:
      return <kbd className={className}>{children}</kbd>
  }
}

export const Tooltip = ({
  children,
  enabled = true,
  title,
  shortcut,
  tippyOptions = {},
}: TooltipProps): JSX.Element => {
  const [isOpen, setIsOpen] = useState(false)

  const { refs, floatingStyles, context } = useFloating({
    placement: 'top',
    middleware: [offset({ mainAxis: 0, crossAxis: 8 }), flip(), shift()],
    open: isOpen,
    onOpenChange: setIsOpen,
    whileElementsMounted: autoUpdate,
  })

  const hover = useHover(context, { enabled })
  const focus = useFocus(context, { enabled })
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, focus])

  const renderContent = useCallback(() => (
    <span className="flex items-center gap-2 px-2.5 py-1 bg-white border border-neutral-100 rounded-lg shadow-sm">
      {title && <span className="text-xs font-medium text-neutral-500">{title}</span>}
      {shortcut && (
        <span className="flex items-center gap-0.5">
          {shortcut.map(key => (
            <ShortcutKey key={key}>{key}</ShortcutKey>
          ))}
        </span>
      )}
    </span>
  ), [title, shortcut])

  if (!enabled) {
    return <>{children}</>
  }

  return (
    <>
      <span
        ref={refs.setReference}
        {...getReferenceProps({
          ...tippyOptions,
          onMouseEnter: () => setIsOpen(true),
          onMouseLeave: () => setIsOpen(false),
        })}
      >
        {children}
      </span>

      <FloatingPortal>
        {isOpen && (
          <div
            ref={refs.setFloating}
            style={{
              ...floatingStyles,
              zIndex: 99999,
            }}
            {...getFloatingProps()}
          >
            {renderContent()}
          </div>
        )}
      </FloatingPortal>
    </>
  )
}

export default Tooltip
