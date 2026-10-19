import { Icon } from '@/components/ui/Icon'
import { DragHandle } from '@tiptap/extension-drag-handle-react'
import { Editor } from '@tiptap/react'

import * as Popover from '@radix-ui/react-popover'
import useContentItemActions from './hooks/useContentItemActions'
import { useData } from './hooks/useData'
import { useEffect, useState } from 'react'
import TurnIntoSubmenu from './components/TurnIntoSubmenu'
import ColorPickerSubmenu from './components/ColorPickerSubmenu'

const DRAG_HANDLE_POSITION_CONFIG = {
  placement: 'left-start' as const,
}

export type ContentItemMenuProps = {
  editor: Editor
  isEditable?: boolean
}

type MenuView = 'main' | 'turnInto' | 'color'

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

  if (!isEditable) {
    return null
  }

  const DRAG_BTN_CLASS =
    'w-6 h-6 p-0 flex items-center justify-center text-[#9b9b9b] hover:text-[#e3e3e3] hover:bg-white/[0.06] active:bg-white/[0.1] rounded border border-transparent transition-colors duration-150'

  return (
    <DragHandle
      pluginKey="ContentItemMenu"
      editor={editor}
      onNodeChange={data.handleNodeChange}
      computePositionConfig={DRAG_HANDLE_POSITION_CONFIG}
      nested
    >
      <div className="flex items-center gap-0.5">
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
          <Popover.Content side="bottom" align="start" sideOffset={6} className="z-50 outline-none">
            <div className="glass-menu p-1.5 flex flex-col min-w-[15rem] max-h-[24rem] overflow-y-auto text-[#e3e3e3] shadow-2xl">
              {menuView === 'main' && (
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => setMenuView('turnInto')}
                    className="w-full flex items-center justify-between px-2 py-1.5 text-sm font-medium text-[#e3e3e3] hover:text-white hover:bg-white/[0.06] active:bg-white/[0.1] rounded border border-transparent transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Icon name="RefreshCw" className="w-4 h-4 text-[#9b9b9b]" />
                      <span>Turn into</span>
                    </div>
                    <Icon name="ChevronRight" className="w-3.5 h-3.5 text-[#9b9b9b]" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setMenuView('color')}
                    className="w-full flex items-center justify-between px-2 py-1.5 text-sm font-medium text-[#e3e3e3] hover:text-white hover:bg-white/[0.06] active:bg-white/[0.1] rounded border border-transparent transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Icon name="Palette" className="w-4 h-4 text-[#9b9b9b]" />
                      <span>Color</span>
                    </div>
                    <Icon name="ChevronRight" className="w-3.5 h-3.5 text-[#9b9b9b]" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      actions.duplicateNode()
                      setMenuOpen(false)
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm font-medium text-[#e3e3e3] hover:text-white hover:bg-white/[0.06] active:bg-white/[0.1] rounded border border-transparent transition-colors text-left"
                  >
                    <Icon name="Copy" className="w-4 h-4 text-[#9b9b9b]" />
                    <span>Duplicate</span>
                  </button>

                  <div className="h-[1px] bg-white/10 my-1 w-full" />

                  <button
                    type="button"
                    onClick={() => {
                      actions.deleteNode()
                      setMenuOpen(false)
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 active:bg-red-500/20 rounded border border-transparent transition-colors text-left"
                  >
                    <Icon name="Trash2" className="w-4 h-4 text-red-400" />
                    <span>Delete</span>
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

              {menuView === 'color' && (
                <ColorPickerSubmenu
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
