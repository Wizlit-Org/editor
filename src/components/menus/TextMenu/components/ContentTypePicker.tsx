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
  const activeItem = useMemo(
    () => options.find(option => option.type === 'option' && option.isActive()) as ContentTypePickerOption | undefined,
    [options],
  )

  const activeLabel = activeItem?.label || 'Paragraph'
  const activeIcon = activeItem?.icon || 'Pilcrow'

  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <Toolbar.Button
          active={activeItem?.id !== 'paragraph' && !!activeItem?.type}
          className="h-7 px-2.5 inline-flex items-center justify-center gap-1.5 leading-none text-zinc-700 hover:text-zinc-950 dark:text-zinc-200 dark:hover:text-white hover:bg-white/60 active:bg-white/80 dark:hover:bg-white/[0.1] dark:active:bg-white/[0.16] rounded-lg border border-transparent hover:border-white/50 dark:hover:border-white/[0.08] transition-all duration-150 text-xs font-medium"
          activeClassname="bg-[var(--editor-accent)] text-[var(--editor-primary)] border-[var(--editor-accent-border)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5)]"
        >
          <Icon name={activeIcon} className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate max-w-[5.5rem] leading-none">{activeLabel}</span>
          <Icon name="ChevronDown" className="w-2.5 h-2.5 opacity-60 shrink-0" />
        </Toolbar.Button>
      </Dropdown.Trigger>
      <Dropdown.Content
        asChild
        side="top"
        align="start"
        sideOffset={10}
        collisionPadding={12}
        className="z-[1350] outline-none animate-in fade-in-0 zoom-in-95 duration-150"
      >
        <div
          style={{
            backdropFilter: 'blur(20px) saturate(190%)',
            WebkitBackdropFilter: 'blur(20px) saturate(190%)',
          }}
          className="glass-menu flex flex-col gap-0.5 p-1.5 min-w-[13rem] max-h-[22rem] overflow-y-auto rounded-2xl bg-white/70 dark:bg-zinc-900/75 backdrop-blur-2xl backdrop-saturate-150 border border-white/75 dark:border-white/[0.14] ring-1 ring-slate-900/[0.06] dark:ring-black/50 shadow-[0_12px_36px_-4px_rgba(0,0,0,0.16),inset_0_1px_0_0_rgba(255,255,255,0.85)] dark:shadow-[0_12px_36px_-4px_rgba(0,0,0,0.65),inset_0_1px_0_0_rgba(255,255,255,0.14)] text-zinc-800 dark:text-zinc-100"
        >
          {options.map(option => {
            if (isOption(option)) {
              const isActive = option.isActive()
              return (
                <button
                  type="button"
                  key={option.id}
                  onClick={option.onClick}
                  disabled={option.disabled()}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-medium rounded-lg border border-transparent transition-colors text-left select-none ${
                    isActive
                      ? 'bg-black/10 text-zinc-900 dark:bg-white/[0.12] dark:text-white'
                      : 'text-zinc-700 hover:text-zinc-900 hover:bg-black/5 dark:text-zinc-300 dark:hover:text-white dark:hover:bg-white/[0.08] active:bg-black/10 dark:active:bg-white/[0.12]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon name={option.icon} className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 shrink-0" />
                    <span>{option.label}</span>
                  </div>
                  {isActive && <Icon name="Check" className="w-3.5 h-3.5 text-[var(--editor-primary)] shrink-0" />}
                </button>
              )
            } else if (isCategory(option)) {
              return (
                <div
                  className="text-[10px] font-semibold tracking-wider text-zinc-400 dark:text-zinc-500 uppercase px-2 pt-2 pb-0.5 mt-1 first:mt-0 select-none"
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

export default ContentTypePicker
