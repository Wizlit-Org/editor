import { mergeAttributes } from '@tiptap/core'
import TiptapLink from '@tiptap/extension-link'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { EditorView } from '@tiptap/pm/view'

export const Link = TiptapLink.extend({
  inclusive: false,

  addStorage() {
    return {
      clickedCoords: null as { x: number; y: number } | null,
      clickedElement: null as HTMLAnchorElement | null,
    }
  },

  parseHTML() {
    return [
      {
        tag: 'a[href]:not([data-type="button"]):not([href *= "javascript:" i])',
        getAttrs: element => {
          // check if link starts with javascript:
          if (element.getAttribute('href')?.toLowerCase().startsWith('javascript:')) {
            return false
          }

          return null
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const { editor, options } = this
    const isEditable = editor?.isEditable
    const openOnClick = options.openOnClick

    const finalCursorStyle = (!isEditable && !openOnClick) ? "cursor: pointer" : ""

    if (HTMLAttributes.href?.toLowerCase().startsWith('javascript:') || !isEditable) {
      return ['a', mergeAttributes({ ...HTMLAttributes, href: null }, this.options.HTMLAttributes, { class: 'link', style: finalCursorStyle }), 0]
    }

    return ['a', mergeAttributes(HTMLAttributes, this.options.HTMLAttributes, { class: 'link',  style: finalCursorStyle }), 0]
  },

  addProseMirrorPlugins() {
    const { editor } = this

    return [
      new Plugin({
        key: new PluginKey('linkFastActivationHandler'),
        props: {
          handleDOMEvents: {
            mousedown: (view: EditorView, event: MouseEvent) => {
              if (event.button !== 0) return false
              const target = event.target as HTMLElement | null
              const linkEl = (target?.closest?.('a') as HTMLAnchorElement | null) || null
              if (!linkEl || !view.dom.contains(linkEl)) return false

              // Instantly clear scroll-lock before ProseMirror transaction starts
              window.dispatchEvent(new CustomEvent('tiptap:reset-scroll-lock'))

              const linkStorage = (editor.storage as any)?.link
              if (linkStorage) {
                linkStorage.clickedCoords = { x: event.clientX, y: event.clientY }
                linkStorage.clickedElement = linkEl
              }

              return false
            },
          },
          handleClick: (view: EditorView, pos: number, event: MouseEvent) => {
            if (event.button !== 0) return false
            const target = event.target as HTMLElement | null
            const linkEl = (target?.closest?.('a') as HTMLAnchorElement | null) || null
            if (!linkEl || !view.dom.contains(linkEl)) return false

            // Prevent native browser link navigation / drag inside contenteditable
            event.preventDefault()

            // Instantly clear scroll-lock
            window.dispatchEvent(new CustomEvent('tiptap:reset-scroll-lock'))

            const linkStorage = (editor.storage as any)?.link
            if (linkStorage) {
              linkStorage.clickedCoords = { x: event.clientX, y: event.clientY }
              linkStorage.clickedElement = linkEl
            }

            try {
              if (editor.isEditable) {
                editor.chain().focus().setTextSelection(pos).run()
              } else {
                editor.commands.setTextSelection(pos)
              }
            } catch {
              try {
                editor.commands.setTextSelection(pos)
              } catch {}
            }

            // Force BubbleMenu to show and dock immediately on 1st click
            requestAnimationFrame(() => {
              try {
                view.dispatch(
                  view.state.tr
                    .setMeta('linkMenu', 'show')
                    .setMeta('linkMenu', 'updatePosition'),
                )
              } catch {}
            })

            return true
          },
          handleKeyDown: (_view: EditorView, event: KeyboardEvent) => {
            const { selection } = editor.state

            if (event.key === 'Escape' && selection.empty !== true) {
              editor.commands.focus(selection.to, { scrollIntoView: false })
            }

            return false
          },
        },
      }),
      ...(this.parent?.() || []),
    ]
  },
})

export default Link
