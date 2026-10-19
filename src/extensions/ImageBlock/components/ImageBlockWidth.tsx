import { memo, useCallback, useEffect, useState } from 'react'

export type ImageBlockWidthProps = {
  onChange: (value: number) => void
  value: number
}

export const ImageBlockWidth = memo(({ onChange, value }: ImageBlockWidthProps) => {
  const [currentValue, setCurrentValue] = useState(value)

  useEffect(() => {
    setCurrentValue(value)
  }, [value])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const nextValue = parseInt(e.target.value)
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
      <span className="text-xs font-semibold text-zinc-500 dark:text-[#9b9b9b] select-none min-w-[2.2rem] text-right">{value}%</span>
    </div>
  )
})

ImageBlockWidth.displayName = 'ImageBlockWidth'
