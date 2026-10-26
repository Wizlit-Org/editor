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
      'bg-white/85 dark:bg-[#202020]/90 backdrop-blur-md rounded-lg text-zinc-800 dark:text-zinc-200',
      withShadow ? 'shadow-lg' : '',
      withBorder ? 'border border-black/5 dark:border-white/10' : '',
    )

    return (
      <div className={surfaceClass} data-surface="true" {...props} ref={ref}>
        {children}
      </div>
    )
  },
)

Surface.displayName = 'Surface'
