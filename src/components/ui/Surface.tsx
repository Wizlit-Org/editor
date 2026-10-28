import { cn } from '@/lib/utils'
import { HTMLProps, forwardRef } from 'react'

export type SurfaceProps = HTMLProps<HTMLDivElement> & {
  withShadow?: boolean
  withBorder?: boolean
}

export const Surface = forwardRef<HTMLDivElement, SurfaceProps>(
  ({ children, className, withShadow = true, withBorder = true, ...props }, ref) => {
    const surfaceClass = cn(
      className,
      'bg-white/85 dark:bg-[#202020]/95 backdrop-blur-xl rounded-lg text-zinc-800 dark:text-[#e3e3e3]',
      withShadow ? 'shadow-lg dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)]' : '',
      withBorder ? 'border border-black/5 dark:border-white/10 ring-1 ring-black/5 dark:ring-white/5' : '',
    )

    return (
      <div className={surfaceClass} data-surface="true" {...props} ref={ref}>
        {children}
      </div>
    )
  },
)

Surface.displayName = 'Surface'
