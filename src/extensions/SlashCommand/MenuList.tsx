import React, { useCallback, useEffect, useRef, useState } from 'react'

import { Command, MenuListProps } from './types'
import { Icon } from '@/components/ui/Icon'

export const MenuList = React.forwardRef((props: MenuListProps, ref) => {
  const scrollContainer = useRef<HTMLDivElement>(null)
  const activeItem = useRef<HTMLButtonElement>(null)
  const [selectedGroupIndex, setSelectedGroupIndex] = useState(0)
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0)

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
    <div className="flex flex-col mb-8">
      {/* Glassmorphism Popover Menu */}
      <div
        ref={scrollContainer}
        className="glass-menu text-zinc-800 dark:text-zinc-200 max-h-[min(70vh,22rem)] w-64 min-w-[15rem] overflow-y-auto p-1.5 shadow-2xl z-50 outline-none rounded-2xl bg-white/90 dark:bg-[#202020]/95 backdrop-blur-xl border border-black/5 dark:border-white/10"
      >
        {/* Unified Top Header Caption */}
        <div className="px-2.5 py-1 mb-1 border-b border-black/5 dark:border-white/10 text-[11px] font-mono text-zinc-400 dark:text-zinc-500 flex items-center justify-between select-none">
          <span>명령어 검색</span>
          <span className="text-[10px] opacity-70">/Filter...</span>
        </div>
        <div className="flex flex-col gap-0.5">
          {props.items.map((group, groupIndex: number) => (
            <React.Fragment key={`${group.title}-wrapper`}>
              {groupIndex > 0 && <div className="h-[1px] bg-black/5 dark:bg-white/10 my-1 mx-1.5" />}
              <div
                className="text-zinc-500 dark:text-zinc-400 text-[11px] font-semibold tracking-wider uppercase px-2 pt-1.5 pb-1 select-none"
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
                    className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg border border-transparent transition-colors text-left select-none ${
                      isSelected
                        ? 'bg-black/10 text-zinc-900 dark:bg-white/[0.12] dark:text-white font-medium'
                        : 'text-zinc-700 hover:text-zinc-900 hover:bg-black/5 dark:text-zinc-300 dark:hover:text-white dark:hover:bg-white/[0.08] active:bg-black/10 dark:active:bg-white/[0.12]'
                    }`}
                  >
                    <Icon
                      name={command.iconName}
                      className="w-4 h-4 text-zinc-500 dark:text-zinc-400 shrink-0"
                    />
                    <div className="flex flex-col truncate leading-tight">
                      <span className="font-medium text-[13px] truncate">
                        {command.label}
                      </span>
                      {command.description && (
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate">
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
    </div>
  )
})

MenuList.displayName = 'MenuList'

export default MenuList
