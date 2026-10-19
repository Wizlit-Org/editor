import React from 'react'
import { Editor } from '@tiptap/react'
import { Icon } from '@/components/ui/Icon'

export interface ColorPickerSubmenuProps {
  editor: Editor
  currentNodePos: number
  onBack: () => void
  onClose: () => void
}

interface ColorOption {
  label: string
  color?: string
}

const TEXT_COLORS: ColorOption[] = [
  { label: 'Default', color: undefined },
  { label: 'Gray', color: '#9b9a97' },
  { label: 'Brown', color: '#9f6b53' },
  { label: 'Orange', color: '#d9730d' },
  { label: 'Yellow', color: '#dfab01' },
  { label: 'Green', color: '#0f7b6c' },
  { label: 'Blue', color: '#0b6e99' },
  { label: 'Purple', color: '#6940a5' },
  { label: 'Pink', color: '#ad1a72' },
  { label: 'Red', color: '#e03e3e' },
]

const BG_COLORS: ColorOption[] = [
  { label: 'Default background', color: undefined },
  { label: 'Gray background', color: 'rgba(155, 154, 151, 0.2)' },
  { label: 'Brown background', color: 'rgba(159, 107, 83, 0.2)' },
  { label: 'Orange background', color: 'rgba(217, 115, 13, 0.2)' },
  { label: 'Yellow background', color: 'rgba(223, 171, 1, 0.2)' },
  { label: 'Green background', color: 'rgba(15, 123, 108, 0.2)' },
  { label: 'Blue background', color: 'rgba(11, 110, 153, 0.2)' },
  { label: 'Purple background', color: 'rgba(105, 64, 165, 0.2)' },
  { label: 'Pink background', color: 'rgba(173, 26, 114, 0.2)' },
  { label: 'Red background', color: 'rgba(224, 62, 62, 0.2)' },
]

export const ColorPickerSubmenu: React.FC<ColorPickerSubmenuProps> = ({
  editor,
  currentNodePos,
  onBack,
  onClose,
}) => {
  const handleTextColor = (color?: string) => {
    const chain = editor.chain().focus().setNodeSelection(currentNodePos)
    if (!color) {
      chain.unsetMark('textStyle').run()
    } else {
      chain.setMark('textStyle', { color }).run()
    }
    onClose()
  }

  const handleBgColor = (color?: string) => {
    const chain = editor.chain().focus().setNodeSelection(currentNodePos)
    if (!color) {
      chain.unsetHighlight().run()
    } else {
      chain.setHighlight({ color }).run()
    }
    onClose()
  }

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        onClick={onBack}
        className="w-full flex items-center gap-1.5 px-2 py-1 mb-1 text-xs font-semibold text-[#9b9b9b] hover:text-[#e3e3e3] hover:bg-white/[0.06] rounded border border-transparent transition-colors text-left"
      >
        <Icon name="ArrowLeft" className="w-3.5 h-3.5" />
        <span>Color</span>
      </button>

      <div className="px-2 py-1 text-[11px] font-semibold tracking-wider text-[#9b9b9b] uppercase">
        Color
      </div>
      <div className="flex flex-col gap-0.5">
        {TEXT_COLORS.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => handleTextColor(item.color)}
            className="w-full flex items-center gap-2.5 px-2 py-1.5 text-sm text-[#e3e3e3] hover:text-white hover:bg-white/[0.06] active:bg-white/[0.1] rounded border border-transparent transition-colors text-left"
          >
            <span
              className="w-4 h-4 rounded-full flex items-center justify-center font-bold text-xs shrink-0"
              style={{ color: item.color || '#e3e3e3' }}
            >
              A
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      <div className="h-[1px] bg-white/10 my-1.5 w-full" />

      <div className="px-2 py-1 text-[11px] font-semibold tracking-wider text-[#9b9b9b] uppercase">
        Background
      </div>
      <div className="flex flex-col gap-0.5">
        {BG_COLORS.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => handleBgColor(item.color)}
            className="w-full flex items-center gap-2.5 px-2 py-1.5 text-sm text-[#e3e3e3] hover:text-white hover:bg-white/[0.06] active:bg-white/[0.1] rounded border border-transparent transition-colors text-left"
          >
            <span
              className="w-4 h-4 rounded border border-white/20 shrink-0"
              style={{ backgroundColor: item.color || 'transparent' }}
            />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default ColorPickerSubmenu
