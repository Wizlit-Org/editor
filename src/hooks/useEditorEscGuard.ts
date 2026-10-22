import { useEffect } from 'react'
import { Editor } from '@tiptap/react'
import { isCellSelection } from '@/extensions/Table/utils'

/**
 * Global Escape Key Guard for Block Editor
 * Captures the 'Escape' key before parent dialogs/modals can receive it.
 * If any editor popover, menu, slash-command list, or table-cell selection is active,
 * it closes the editor popover/selection and stops propagation to protect the outer modal.
 */
export function useEditorEscGuard(editor: Editor | null) {
  useEffect(() => {
    if (!editor || typeof window === 'undefined') return

    const handleKeyDownCapture = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return

      // 1. Check for open Radix Popover or Floating menus
      const hasOpenRadixPopper = Boolean(
        document.querySelector('[data-radix-popper-content-wrapper]')
      )
      const hasOpenGlassMenu = Boolean(
        document.querySelector('.glass-menu')
      )
      const hasOpenSlashMenu = Boolean(
        document.querySelector('.slash-command-menu, [data-slash-menu="true"]')
      )
      const hasTableSelection = isCellSelection(editor.state?.selection)

      // If any editor-specific floating UI or cell selection is active:
      if (hasOpenRadixPopper || hasOpenGlassMenu || hasOpenSlashMenu || hasTableSelection) {
        // Prevent event from bubbling or reaching any parent modal/dialog listeners
        e.stopPropagation()
        e.stopImmediatePropagation()
        e.preventDefault()

        // Close all editor menus and popovers
        window.dispatchEvent(
          new CustomEvent('tiptap:close-menus', { detail: 'escape' })
        )

        // Clear cell selection if active, returning to a simple cursor
        if (hasTableSelection) {
          try {
            editor.chain().focus().setTextSelection(editor.state.selection.from).run()
          } catch {
            // Ignore if selection resolve fails
          }
        }

        // Return focus to the editor surface
        if (document.activeElement && document.activeElement !== editor.view.dom) {
          ;(document.activeElement as HTMLElement).blur?.()
          editor.view.focus()
        }
      }
    }

    // Attach to capture phase so this runs BEFORE any bubble listeners on window or document
    window.addEventListener('keydown', handleKeyDownCapture, { capture: true })

    return () => {
      window.removeEventListener('keydown', handleKeyDownCapture, { capture: true })
    }
  }, [editor])
}

export default useEditorEscGuard
