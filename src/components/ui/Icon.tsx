import { cn } from '@/lib/utils'
import { icons } from 'lucide-react'
import { memo } from 'react'

export type IconProps = {
  name: keyof typeof icons
  className?: string
  strokeWidth?: number
  style?: React.CSSProperties
}

export const Icon = memo(({ name, className, strokeWidth, style }: IconProps) => {
  const IconComponent = icons[name]

  if (!IconComponent) {
    return null
  }

  return <IconComponent className={cn('w-4 h-4', className)} strokeWidth={strokeWidth || 2.5} style={style} />
})

Icon.displayName = 'Icon'
