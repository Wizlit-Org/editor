import { Icon } from '@/components/ui/Icon'
import { DragHandle } from '@tiptap/extension-drag-handle-react'
import { Editor } from '@tiptap/react'

import * as Popover from '@radix-ui/react-popover'
import useContentItemActions from './hooks/useContentItemActions'
import { useData } from './hooks/useData'
import { useCallback, useEffect, useMemo, useState } from 'react'
import TurnIntoSubmenu from './components/TurnIntoSubmenu'

const DRAG_HANDLE_POSITION_CONFIG = {
  placement: 'left-start' as const,
}

export type ContentItemMenuProps = {
  editor: Editor
  isEditable?: boolean
}

type MenuView = 'main' | 'turnInto'

export const ContentItemMenu = ({ editor, isEditable = true }: ContentItemMenuProps) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuView, setMenuView] = useState<MenuView>('main')
  const data = useData()
  const actions = useContentItemActions(editor, data.currentNode, data.currentNodePos)

  useEffect(() => {
    if (menuOpen) {
      editor.commands.setMeta('lockDragHandle', true)
    } else {
      editor.commands.setMeta('lockDragHandle', false)
      setMenuView('main')
    }
  }, [editor, menuOpen])

  const copyAnchorLink = useCallback(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.hash = `pos-${data.currentNodePos}`
      navigator.clipboard.writeText(url.toString())
    }
    setMenuOpen(false)
  }, [data.currentNodePos])

  // Detect whether current node is a list item or inside a list (bulletList / orderedList / taskList)
  const isListItem = useMemo(() => {
    if (!data.currentNode || data.currentNodePos === -1) return false
    const nodeType = data.currentNode.type.name
    if (nodeType === 'listItem' || nodeType === 'taskItem') return true

    try {
      const resolved = editor.state.doc.resolve(data.currentNodePos)
      for (let d = resolved.depth; d > 0; d--) {
        const name = resolved.node(d).type.name
        if (
          name === 'listItem' ||
          name === 'taskItem' ||
          name === 'bulletList' ||
          name === 'orderedList' ||
          name === 'taskList'
        ) {
          return true
        }
      }
      return false
    } catch {
      return false
    }
  }, [data.currentNode, data.currentNodePos, editor])

  if (!isEditable) {
    return null
  }

  const DRAG_BTN_CLASS =
    'w-6 h-6 p-0 flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:text-[#9b9b9b] dark:hover:text-[#e3e3e3] hover:bg-black/5 dark:hover:bg-white/[0.06] active:bg-black/10 dark:active:bg-white/[0.1] rounded border border-transparent transition-all duration-150'

  return (
    <DragHandle
      pluginKey="ContentItemMenu"
      editor={editor}
      onNodeChange={data.handleNodeChange}
      computePositionConfig={DRAG_HANDLE_POSITION_CONFIG}
      nested
    >
      <div
        className={`flex items-center gap-0.5 transition-transform duration-150 ease-out pr-3 -mr-3 ${
          isListItem ? '-translate-x-6' : ''
        }`}
      >
        <button
          type="button"
          onClick={actions.handleAdd}
          className={`${DRAG_BTN_CLASS} cursor-pointer`}
          title="Click to add a block below"
          aria-label="Add block below"
        >
          <Icon name="Plus" className="w-3.5 h-3.5" />
        </button>

        <Popover.Root open={menuOpen} onOpenChange={setMenuOpen}>
          <Popover.Trigger asChild>
            <button
              type="button"
              className={`${DRAG_BTN_CLASS} cursor-grab active:cursor-grabbing`}
              title="Drag to move, click for options"
              aria-label="Drag handle and block menu"
            >
              <Icon name="GripVertical" className="w-3.5 h-3.5" />
            </button>
          </Popover.Trigger>
          <Popover.Content
            side="bottom"
            align="start"
            sideOffset={6}
            className="z-50 outline-none animate-in fade-in-0 zoom-in-95 duration-150"
          >
            <div className="glass-menu p-1.5 flex flex-col min-w-[15rem] max-h-[24rem] overflow-y-auto text-zinc-800 dark:text-[#e3e3e3] shadow-2xl transition-all duration-150">
              {menuView === 'main' && (
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => setMenuView('turnInto')}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-[#e3e3e3] hover:text-zinc-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.06] active:bg-black/10 dark:active:bg-white/[0.1] rounded border border-transparent transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Icon name="RefreshCw" className="w-4 h-4 text-zinc-400 dark:text-[#9b9b9b]" />
                      <span>Turn into</span>
                    </div>
                    <Icon name="ChevronRight" className="w-3.5 h-3.5 text-zinc-400 dark:text-[#9b9b9b]" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      actions.copyNodeToClipboard()
                      setMenuOpen(false)
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-[#e3e3e3] hover:text-zinc-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.06] active:bg-black/10 dark:active:bg-white/[0.1] rounded border border-transparent transition-colors text-left"
                  >
                    <Icon name="Clipboard" className="w-4 h-4 text-zinc-400 dark:text-[#9b9b9b]" />
                    <span>Copy to clipboard</span>
                  </button>

                  <button
                    type="button"
                    onClick={copyAnchorLink}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-[#e3e3e3] hover:text-zinc-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.06] active:bg-black/10 dark:active:bg-white/[0.1] rounded border border-transparent transition-colors text-left"
                  >
                    <Icon name="Link" className="w-4 h-4 text-zinc-400 dark:text-[#9b9b9b]" />
                    <span>Copy anchor link</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      actions.duplicateNode()
                      setMenuOpen(false)
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-[#e3e3e3] hover:text-zinc-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.06] active:bg-black/10 dark:active:bg-white/[0.1] rounded border border-transparent transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Icon name="Copy" className="w-4 h-4 text-zinc-400 dark:text-[#9b9b9b]" />
                      <span>Duplicate</span>
                    </div>
                    <span className="text-[10px] text-zinc-400 dark:text-[#787774]">Ctrl+D</span>
                  </button>

                  <div className="h-[1px] bg-black/5 dark:bg-white/10 my-1 w-full" />

                  <button
                    type="button"
                    onClick={() => {
                      actions.deleteNode()
                      setMenuOpen(false)
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-medium text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-500/10 active:bg-red-500/20 rounded border border-transparent transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Icon name="Trash2" className="w-4 h-4 text-red-500 dark:text-red-400" />
                      <span>Delete</span>
                    </div>
                    <span className="text-[10px] text-red-400/80">Del</span>
                  </button>
                </div>
              )}

              {menuView === 'turnInto' && (
                <TurnIntoSubmenu
                  editor={editor}
                  currentNodePos={data.currentNodePos}
                  onBack={() => setMenuView('main')}
                  onClose={() => setMenuOpen(false)}
                />
              )}
            </div>
          </Popover.Content>
        </Popover.Root>
      </div>
    </DragHandle>
  )
}

export default ContentItemMenu
