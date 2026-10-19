import React, { useCallback, useEffect, useRef, useState } from 'react'

import { Command, MenuListProps } from './types'
import { Icon } from '@/components/ui/Icon'

export const MenuList = React.forwardRef((props: MenuListProps, ref) => {
  const scrollContainer = useRef<HTMLDivElement>(null)
  const activeItem = useRef<HTMLButtonElement>(null)
  const [selectedGroupIndex, setSelectedGroupIndex] = useState(0)
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0)

  // Anytime the groups change, i.e. the user types to narrow it down, we want to
  // reset the current selection to the first menu item
  useEffect(() => {
    setSelectedGroupIndex(0)
    setSelectedCommandIndex(0)
  }, [props.items])

  const selectItem = useCallback(
    (groupIndex: number, commandIndex: number) => {
      const command = props.items[groupIndex].commands[commandIndex]
      props.command(command)
    },
    [props],
  )

  React.useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: React.KeyboardEvent }) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        event.nativeEvent?.stopImmediatePropagation?.()
        return true
      }

      if (event.key === 'ArrowDown') {
        if (!props.items.length) {
          return false
        }

        const commands = props.items[selectedGroupIndex].commands

        let newCommandIndex = selectedCommandIndex + 1
        let newGroupIndex = selectedGroupIndex

        if (commands.length - 1 < newCommandIndex) {
          newCommandIndex = 0
          newGroupIndex = selectedGroupIndex + 1
        }

        if (props.items.length - 1 < newGroupIndex) {
          newGroupIndex = 0
        }

        setSelectedCommandIndex(newCommandIndex)
        setSelectedGroupIndex(newGroupIndex)

        return true
      }

      if (event.key === 'ArrowUp') {
        if (!props.items.length) {
          return false
        }

        let newCommandIndex = selectedCommandIndex - 1
        let newGroupIndex = selectedGroupIndex

        if (newCommandIndex < 0) {
          newGroupIndex = selectedGroupIndex - 1
          newCommandIndex = props.items[newGroupIndex]?.commands.length - 1 || 0
        }

        if (newGroupIndex < 0) {
          newGroupIndex = props.items.length - 1
          newCommandIndex = props.items[newGroupIndex].commands.length - 1
        }

        setSelectedCommandIndex(newCommandIndex)
        setSelectedGroupIndex(newGroupIndex)

        return true
      }

      if (event.key === 'Enter') {
        if (!props.items.length || selectedGroupIndex === -1 || selectedCommandIndex === -1) {
          return false
        }

        selectItem(selectedGroupIndex, selectedCommandIndex)

        return true
      }

      return false
    },
  }))

  useEffect(() => {
    if (activeItem.current && scrollContainer.current) {
      const offsetTop = activeItem.current.offsetTop
      const offsetHeight = activeItem.current.offsetHeight

      scrollContainer.current.scrollTop = offsetTop - offsetHeight
    }
  }, [selectedCommandIndex, selectedGroupIndex])

  const createCommandClickHandler = useCallback(
    (groupIndex: number, commandIndex: number) => {
      return () => {
        selectItem(groupIndex, commandIndex)
      }
    },
    [selectItem],
  )

  if (!props.items.length) {
    return null
  }

  return (
    <div
      ref={scrollContainer}
      className="glass-menu text-[#e3e3e3] max-h-[min(75vh,20rem)] min-w-[15.5rem] overflow-y-auto mb-8 p-1 shadow-2xl z-50 outline-none rounded-xl"
    >
      <div className="flex flex-col gap-0.5">
        {props.items.map((group, groupIndex: number) => (
          <React.Fragment key={`${group.title}-wrapper`}>
            {groupIndex > 0 && <div className="h-[1px] bg-black/5 dark:bg-white/10 my-1 mx-1" />}
            <div
              className="text-zinc-400 dark:text-[#9b9b9b] text-[9px] mx-2 mt-1.5 mb-0.5 font-semibold tracking-wider select-none uppercase first:mt-0.5"
              key={`${group.title}`}
            >
              {group.title}
            </div>
            {group.commands.map((command: Command, commandIndex: number) => {
              const isSelected = selectedGroupIndex === groupIndex && selectedCommandIndex === commandIndex
              return (
                <button
                  type="button"
                  key={`${command.label}`}
                  ref={isSelected ? activeItem : null}
                  onClick={createCommandClickHandler(groupIndex, commandIndex)}
                  className={`w-full flex items-center gap-2 px-2 py-1 rounded-md border border-transparent transition-colors text-left select-none ${
                    isSelected
                      ? 'bg-black/10 text-zinc-900 dark:bg-white/[0.1] dark:text-white'
                      : 'text-zinc-700 hover:text-zinc-900 hover:bg-black/5 dark:text-[#e3e3e3] dark:hover:text-white dark:hover:bg-white/[0.06] active:bg-black/10 dark:active:bg-white/[0.1]'
                  }`}
                >
                  <div className="w-5 h-5 rounded flex items-center justify-center bg-black/[0.04] dark:bg-white/[0.04] border border-black/5 dark:border-white/10 shrink-0">
                    <Icon name={command.iconName} className="w-3 h-3 text-zinc-500 dark:text-[#9b9b9b]" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium text-[11.5px] truncate leading-tight">{command.label}</span>
                    {command.description && (
                      <span className="text-[10px] text-zinc-400 dark:text-[#9b9b9b] truncate leading-none">
                        {command.description}
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
})

MenuList.displayName = 'MenuList'

export default MenuList
