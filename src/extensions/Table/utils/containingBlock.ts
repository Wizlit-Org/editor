import React, { useState, useLayoutEffect, RefObject, forwardRef } from 'react'

export interface ContainingBlockOffset {
  x: number
  y: number
}

/**
 * Measures the viewport offset (x, y) of the nearest containing block established by
 * ancestor elements with transform, filter, perspective, or backdrop-filter.
 * An anchor element with `position: fixed; left: 0; top: 0` is measured:
 * its getBoundingClientRect() is precisely the origin of the containing block in viewport coordinates.
 */
export function useContainingBlockOffset(anchorRef: RefObject<HTMLElement | null>): ContainingBlockOffset {
  const [offset, setOffset] = useState<ContainingBlockOffset>({ x: 0, y: 0 })

  useLayoutEffect(() => {
    const el = anchorRef.current
    if (!el) return

    const update = () => {
      const r = el.getBoundingClientRect()
      setOffset(prev => (prev.x === r.left && prev.y === r.top ? prev : { x: r.left, y: r.top }))
    }

    update()
    window.addEventListener('resize', update, { passive: true })
    window.addEventListener('scroll', update, { passive: true, capture: true })
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, { capture: true })
    }
  }, [anchorRef])

  return offset
}

/**
 * Zero-size hidden element placed inside a portal to establish the fixed coordinate probe.
 */
export const ContainingBlockAnchor = forwardRef<HTMLDivElement>((_, ref) =>
  React.createElement('div', {
    ref,
    style: {
      position: 'fixed',
      left: 0,
      top: 0,
      width: 0,
      height: 0,
      pointerEvents: 'none',
      visibility: 'hidden',
      zIndex: -1,
    },
  }),
)

ContainingBlockAnchor.displayName = 'ContainingBlockAnchor'
