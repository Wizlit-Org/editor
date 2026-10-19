import { Icon } from '@/components/ui/Icon'
import { icons } from 'lucide-react'
import { useMemo } from 'react'
import * as Dropdown from '@radix-ui/react-dropdown-menu'
import { Toolbar } from '@/components/ui/Toolbar'

export type ContentTypePickerOption = {
  label: string
  id: string
  type: 'option'
  disabled: () => boolean
  isActive: () => boolean
  onClick: () => void
  icon: keyof typeof icons
}

export type ContentTypePickerCategory = {
  label: string
  id: string
  type: 'category'
}

export type ContentPickerOptions = Array<ContentTypePickerOption | ContentTypePickerCategory>

export type ContentTypePickerProps = {
  options: ContentPickerOptions
}

const isOption = (option: ContentTypePickerOption | ContentTypePickerCategory): option is ContentTypePickerOption =>
  option.type === 'option'
const isCategory = (option: ContentTypePickerOption | ContentTypePickerCategory): option is ContentTypePickerCategory =>
  option.type === 'category'

export const ContentTypePicker = ({ options }: ContentTypePickerProps) => {
  const activeItem = useMemo(() => options.find(option => option.type === 'option' && option.isActive()), [options])

  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <Toolbar.Button
          active={activeItem?.id !== 'paragraph' && !!activeItem?.type}
          className="text-zinc-500 hover:text-zinc-800 dark:text-[#9b9b9b] dark:hover:text-[#e3e3e3] hover:bg-black/5 dark:hover:bg-white/[0.06] active:bg-black/10 dark:active:bg-white/[0.1] border border-transparent transition-colors"
          activeClassname="bg-black/10 dark:bg-white/[0.1] text-zinc-900 dark:text-white"
        >
          <Icon name={(activeItem?.type === 'option' && activeItem.icon) || 'Pilcrow'} className="w-4 h-4" />
          <Icon name="ChevronDown" className="w-2.5 h-2.5 opacity-60" />
        </Toolbar.Button>
      </Dropdown.Trigger>
      <Dropdown.Content asChild sideOffset={6} className="z-50 outline-none">
        <div className="glass-menu flex flex-col gap-0.5 p-1.5 min-w-[12rem] shadow-2xl">
          {options.map(option => {
            if (isOption(option)) {
              const isActive = option.isActive()
              return (
                <button
                  type="button"
                  key={option.id}
                  onClick={option.onClick}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium rounded border border-transparent transition-colors text-left ${
                    isActive
                      ? 'bg-black/10 text-zinc-900 dark:bg-white/[0.1] dark:text-white'
                      : 'text-zinc-700 hover:text-zinc-900 hover:bg-black/5 dark:text-[#e3e3e3] dark:hover:text-white dark:hover:bg-white/[0.06] active:bg-black/10 dark:active:bg-white/[0.1]'
                  }`}
                >
                  <Icon name={option.icon} className="w-3.5 h-3.5 text-zinc-400 dark:text-[#9b9b9b] shrink-0" />
                  <span>{option.label}</span>
                </button>
              )
            } else if (isCategory(option)) {
              return (
                <div
                  className="text-[10px] font-semibold text-zinc-400 dark:text-[#9b9b9b] px-2 py-1 uppercase tracking-wider mt-1.5 first:mt-0"
                  key={option.id}
                >
                  {option.label}
                </div>
              )
            }
          })}
        </div>
      </Dropdown.Content>
    </Dropdown.Root>
  )
}
