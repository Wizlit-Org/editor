import { memo, useCallback, useEffect, useState } from 'react'

export type ImageBlockWidthProps = {
  onChange: (value: number) => void
  value: number
}

export const ImageBlockWidth = memo(({ onChange, value }: ImageBlockWidthProps) => {
  const safeValue = Number.isFinite(value) && value > 0 ? value : 100
  const [currentValue, setCurrentValue] = useState(safeValue)

  useEffect(() => {
    setCurrentValue(safeValue)
  }, [safeValue])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const parsed = parseInt(e.target.value, 10)
      const nextValue = Number.isFinite(parsed) ? Math.min(100, Math.max(25, parsed)) : 100
      onChange(nextValue)
      setCurrentValue(nextValue)
    },
    [onChange],
  )

  return (
    <div className="flex items-center gap-2 px-1">
      <input
        className="h-1.5 w-24 bg-black/10 dark:bg-white/20 border-0 rounded-lg appearance-none cursor-pointer accent-zinc-700 dark:accent-zinc-300"
        type="range"
        min="25"
        max="100"
        step="1"
        onChange={handleChange}
        value={currentValue}
      />
      <span className="text-xs font-semibold text-zinc-500 dark:text-[#9b9b9b] select-none min-w-[2.2rem] text-right">
        {safeValue}%
      </span>
    </div>
  )
})

ImageBlockWidth.displayName = 'ImageBlockWidth'
