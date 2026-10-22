import { Icon } from '@/components/ui/Icon'
import { DragHandle } from '@tiptap/extension-drag-handle-react'
import { Editor } from '@tiptap/react'

import * as Popover from '@radix-ui/react-popover'
import useContentItemActions from './hooks/useContentItemActions'
import { useData } from './hooks/useData'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import TurnIntoSubmenu from './components/TurnIntoSubmenu'

export type ContentItemMenuProps = {
  editor: Editor
  isEditable?: boolean
  appendTo?: React.RefObject<any>
}

type MenuView = 'main' | 'turnInto'

export const ContentItemMenu = ({ editor, isEditable = true, appendTo }: ContentItemMenuProps) => {
  const [mounted, setMounted] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuView, setMenuView] = useState<MenuView>('main')
  const isDraggingRef = useRef(false)
  const prevMenuOpenRef = useRef(false)
  const data = useData()
  const actions = useContentItemActions(editor, data.currentNode, data.currentNodePos)

  useEffect(() => {
    setMounted(true)
  }, [])

  const currentNodeRef = useRef(data.currentNode)
  const currentNodePosRef = useRef(data.currentNodePos)
  currentNodeRef.current = data.currentNode
  currentNodePosRef.current = data.currentNodePos

  const setDragHandleLocked = useCallback(
    (locked: boolean) => {
      try {
        if (editor?.view) {
          editor.view.dispatch(editor.state.tr.setMeta('lockDragHandle', locked))
        }
      } catch {}
    },
    [editor],
  )

  const handleNodeChange = useCallback(
    (info: any) => {
      if (info?.pos !== currentNodePosRef.current) {
        setMenuOpen(false)
        setMenuView('main')
        setDragHandleLocked(false)
      }
      currentNodeRef.current = info?.node
      currentNodePosRef.current = info?.pos
      data.handleNodeChange(info)
    },
    [data, setDragHandleLocked],
  )

  useEffect(() => {
    if (!mounted) return
    if (prevMenuOpenRef.current === menuOpen) return
    prevMenuOpenRef.current = menuOpen

    if (menuOpen) {
      setDragHandleLocked(true)
    } else {
      setDragHandleLocked(false)
      setMenuView('main')
    }
  }, [menuOpen, mounted, setDragHandleLocked])

  // Close menu immediately on any scroll (window, document, or scrollable container)
  useEffect(() => {
    const handleScroll = () => {
      setMenuOpen(false)
      setMenuView('main')
      setDragHandleLocked(false)
    }

    window.addEventListener('scroll', handleScroll, { capture: true, passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true })
    }
  }, [setDragHandleLocked])

  const copyAnchorLink = useCallback(() => {
    if (typeof window !== 'undefined') {
      const node = data.currentNode
      let id = node?.attrs?.id

      if (!id) {
        id =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : "pos-" + data.currentNodePos
        if (data.currentNodePos !== -1 && node) {
          editor.commands.command(({ tr }) => {
            tr.setNodeMarkup(data.currentNodePos, undefined, {
              ...node.attrs,
              id,
            })
            return true
          })
        }
      }

      const url = new URL(window.location.href)
      url.hash = id
      navigator.clipboard.writeText(url.toString())
    }
    setMenuOpen(false)
  }, [data.currentNode, data.currentNodePos, editor])

  // Detect whether current node is inside a table cell (tableRow / tableCell / tableHeader)
  const isInsideTableCell = useMemo(() => {
    if (!data.currentNode || data.currentNodePos === -1) return false
    const nodeType = data.currentNode.type.name
    if (
      nodeType === 'tableRow' ||
      nodeType === 'tableCell' ||
      nodeType === 'tableHeader'
    ) {
      return true
    }

    try {
      const resolved = editor.state.doc.resolve(data.currentNodePos)
      for (let d = resolved.depth; d > 0; d--) {
        const name = resolved.node(d).type.name
        if (
          name === 'tableCell' ||
          name === 'tableHeader' ||
          name === 'tableRow'
        ) {
          return true
        }
      }
      return false
    } catch {
      return false
    }
  }, [data.currentNode, data.currentNodePos, editor])

  // Hide handle inside table cell only if it's NOT the table block itself
  const shouldHideHandle = isInsideTableCell && data.currentNode?.type?.name !== 'table'

  useEffect(() => {
    if (shouldHideHandle && menuOpen) {
      setMenuOpen(false)
    }
  }, [shouldHideHandle, menuOpen])

  useEffect(() => {
    const handleCloseMenus = (e: any) => {
      if (e.detail !== 'contentItem') {
        setMenuOpen(false)
        setMenuView('main')
        setDragHandleLocked(false)
      }
    }
    const handleResetScrollLock = () => {
      setMenuOpen(false)
      setMenuView('main')
      setDragHandleLocked(false)
    }
    window.addEventListener('tiptap:close-menus', handleCloseMenus)
    window.addEventListener('tiptap:reset-scroll-lock', handleResetScrollLock)
    return () => {
      window.removeEventListener('tiptap:close-menus', handleCloseMenus)
      window.removeEventListener('tiptap:reset-scroll-lock', handleResetScrollLock)
    }
  }, [setDragHandleLocked])

  // Mousemove guard: whenever cursor enters a table cell/header/row, hide DragHandle immediately
  // Nested configuration with blockStructureGuard:
  // Excludes table cells/rows so the entire table gets a stationary handle at top-left.
  // Prioritizes list containers (bulletList, orderedList, taskList) so the entire list gets a single top-level handle.
  const nestedConfig = useMemo(
    () => ({
      enabled: true,
      rules: [
        {
          id: 'blockStructureGuard',
          evaluate: ({ node, parent, depth, $pos }: any) => {
            const name = node?.type?.name

            // 1. Table containers vs table internal cells
            if (name === 'table') {
              return 0
            }
            if (['tableCell', 'tableHeader', 'tableRow'].includes(name)) {
              return 1000
            }

            // 2. List containers: Entire list gets top priority (score 0)
            if (['bulletList', 'orderedList', 'taskList'].includes(name)) {
              return 0
            }

            // 3. Inside table: Suppress all child nodes
            if ($pos?.node) {
              for (let d = depth; d > 0; d--) {
                const typeName = $pos.node(d)?.type?.name
                if (['tableCell', 'tableHeader', 'tableRow'].includes(typeName)) {
                  return 1000
                }
              }
            }

            // 4. Inside list: Demote listItem and its direct child contents (score 100)
            // so the parent bulletList/orderedList container wins the drag handle
            if (['listItem', 'taskItem'].includes(name) || (parent && ['listItem', 'taskItem'].includes(parent.type.name))) {
              return 100
            }

            if ($pos?.node) {
              for (let d = depth; d > 0; d--) {
                const typeName = $pos.node(d)?.type?.name
                if (['bulletList', 'orderedList', 'taskList'].includes(typeName)) {
                  return 100
                }
              }
            }

            return 0
          },
        },
      ],
    }),
    [],
  )

  // Floating UI position configuration with gutterAlignMiddleware
  // Stable reference [editor] alone prevents unregisterPlugin -> view.destroyPluginViews() cascade
  const positionConfig = useMemo(() => {
    return {
      placement: 'left-start' as const,
      middleware: [
        {
          name: 'gutterAlign',
          fn({ x, y, rects, elements }: any) {
            const pos = currentNodePosRef.current
            const currentNode = currentNodeRef.current
            const nodeType = currentNode?.type?.name

            let dom: HTMLElement | null = null
            if (pos >= 0 && editor?.view) {
              try {
                const nodeDom = editor.view.nodeDOM(pos)
                if (nodeDom instanceof HTMLElement) {
                  dom = nodeDom
                } else {
                  const domAt = editor.view.domAtPos(pos)
                  dom = (domAt?.node instanceof HTMLElement ? domAt.node : domAt?.node?.parentElement) || null
                }
              } catch {
                dom = null
              }
            }

            // Viewport rect of the reference element (VirtualElement or DOM element)
            const refEl = elements?.reference as any
            const refViewportRect: { top: number; left: number; width: number; height: number } | null =
              refEl && typeof refEl.getBoundingClientRect === 'function'
                ? refEl.getBoundingClientRect()
                : null

            // Viewport rect of the ProseMirror editor container
            const prosemirrorEl = editor?.view?.dom
            const pmRect = prosemirrorEl?.getBoundingClientRect?.()

            // Calculate horizontal deltaX to align handle at editor gutter (pmRect.left - 56px)
            const floatingWidth = rects?.floating?.width || 48
            let targetX = x
            if (pmRect && refViewportRect) {
              const defaultHandleViewportX = refViewportRect.left - floatingWidth
              const desiredHandleViewportX = pmRect.left - 52
              const deltaX = desiredHandleViewportX - defaultHandleViewportX
              targetX = x + deltaX
            } else {
              targetX = x - 52
            }

            // Vertical Y alignment:
            // Case A: Table block (single stationary handle at table top-left)
            if (nodeType === 'table' || dom?.closest('table')) {
              const tableEl = dom?.closest('table') || dom
              if (tableEl && refViewportRect) {
                const targetViewportTop = tableEl.getBoundingClientRect().top
                const deltaY = targetViewportTop - refViewportRect.top
                return {
                  x: targetX,
                  y: y + deltaY,
                }
              }
              return { x: targetX, y }
            }

            // Case B: List container (bulletList, orderedList, taskList - single handle at list top-left)
            if (
              nodeType === 'bulletList' ||
              nodeType === 'orderedList' ||
              nodeType === 'taskList' ||
              dom?.closest('ul, ol, div[data-type="taskList"]')
            ) {
              const listEl = dom?.closest('ul, ol, div[data-type="taskList"]') || dom
              if (listEl && refViewportRect) {
                const targetViewportTop = listEl.getBoundingClientRect().top
                const deltaY = targetViewportTop - refViewportRect.top
                return {
                  x: targetX,
                  y: y + deltaY,
                }
              }
              return { x: targetX, y }
            }

            // Case C: Standard block - aligned to fixed gutter
            return { x: targetX, y }
          },
        },
      ],
    }
  }, [editor])

  if (!mounted || !isEditable) {
    return null
  }

  return (
    <DragHandle
      pluginKey="ContentItemMenu"
      editor={editor}
      nested={false}
      onNodeChange={handleNodeChange}
      computePositionConfig={positionConfig}
    >
      <div
        className={`w-[48px] h-[32px] flex items-center gap-0 select-none relative after:content-[''] after:absolute after:top-0 after:bottom-0 after:-right-6 after:w-6 after:pointer-events-auto transition-opacity duration-150 ease-out ${
          shouldHideHandle ? 'hidden pointer-events-none opacity-0 !w-0 !h-0 overflow-hidden' : ''
        }`}
        style={shouldHideHandle ? { display: 'none', pointerEvents: 'none', visibility: 'hidden' } : undefined}
      >
        <button
          type="button"
          onClick={actions.handleAdd}
          className="w-[24px] h-[32px] rounded-[10px] p-0 flex items-center justify-center transition-colors duration-150 hover:bg-black/[0.06] dark:hover:bg-white/[0.08] hover:backdrop-blur-sm cursor-pointer outline-none"
          title="Click to add a block below"
          aria-label="Add block below"
        >
          <Icon name="Plus" className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
        </button>

        <Popover.Root
          modal={false}
          open={menuOpen}
          onOpenChange={(open) => {
            if (open) {
              window.dispatchEvent(new CustomEvent('tiptap:close-menus', { detail: 'contentItem' }))
            }
            setMenuOpen(open)
          }}
        >
          <Popover.Trigger asChild>
            <button
              type="button"
              onDragStart={() => {
                isDraggingRef.current = true
              }}
              onDragEnd={() => {
                setTimeout(() => {
                  isDraggingRef.current = false
                }, 100)
              }}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                if (isDraggingRef.current) return
                setDragHandleLocked(false)
                setMenuOpen((prev) => !prev)
              }}
              className="w-[24px] h-[32px] rounded-[10px] p-0 flex items-center justify-center transition-colors duration-150 hover:bg-black/[0.06] dark:hover:bg-white/[0.08] hover:backdrop-blur-sm cursor-grab active:cursor-grabbing outline-none"
              title="Drag to move, click for options"
              aria-label="Drag handle and block menu"
            >
              <Icon name="GripVertical" className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
            </button>
          </Popover.Trigger>
          <Popover.Portal container={appendTo?.current || (typeof document !== 'undefined' ? document.body : undefined)}>
            <Popover.Content
              side="bottom"
              align="start"
              sideOffset={6}
              collisionPadding={16}
              className="z-50 outline-none animate-in fade-in-0 zoom-in-95 duration-150"
              style={{ zIndex: 50 }}
            >
              <div className="glass-menu p-1.5 flex flex-col min-w-[15rem] max-h-[24rem] overflow-y-auto bg-white/85 dark:bg-[#202020]/90 backdrop-blur-md border border-black/5 dark:border-white/10 text-zinc-800 dark:text-zinc-200 shadow-xl rounded-xl transition-all duration-150">
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
                        actions.copyNodeToClipboard()
                        setMenuOpen(false)
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-[#e3e3e3] hover:text-zinc-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.06] active:bg-black/10 dark:active:bg-white/[0.1] rounded border border-transparent transition-colors text-left"
                    >
                      <Icon name="Clipboard" className="w-4 h-4 text-zinc-400 dark:text-[#9b9b9b]" />
                      <span>Copy to clipboard</span>
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
          </Popover.Portal>
        </Popover.Root>
      </div>
    </DragHandle>
  )
}

export default ContentItemMenu
