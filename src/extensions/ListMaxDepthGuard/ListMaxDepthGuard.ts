import { Extension } from '@tiptap/core'

export const ListMaxDepthGuard = Extension.create({
  name: 'listMaxDepthGuard',

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        const { state } = this.editor
        const { $from } = state.selection

        // Count list nesting depth (bulletList, orderedList, taskList)
        let listDepth = 0
        for (let d = $from.depth; d > 0; d--) {
          const name = $from.node(d).type.name
          if (name === 'bulletList' || name === 'orderedList' || name === 'taskList') {
            listDepth++
          }
        }

        // Block indentation if already at level 3 (allow 1 -> 2 -> 3 only)
        if (listDepth >= 3) {
          return true
        }

        return false
      },
    }
  },
})

export default ListMaxDepthGuard
