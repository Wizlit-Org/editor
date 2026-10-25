import { Editor } from '@tiptap/react'
import { useCallback } from 'react'

export const useTextmenuCommands = (editor: Editor) => {
  const onBold = useCallback(() => editor.chain().focus().toggleBold().run(), [editor])
  const onItalic = useCallback(() => editor.chain().focus().toggleItalic().run(), [editor])
  const onStrike = useCallback(() => editor.chain().focus().toggleStrike().run(), [editor])
  const onUnderline = useCallback(() => editor.chain().focus().toggleUnderline().run(), [editor])
  const onCode = useCallback(() => editor.chain().focus().toggleCode().run(), [editor])
  const onCodeBlock = useCallback(() => editor.chain().focus().toggleCodeBlock().run(), [editor])

  const onSubscript = useCallback(() => editor.chain().focus().toggleSubscript().run(), [editor])
  const onSuperscript = useCallback(() => editor.chain().focus().toggleSuperscript().run(), [editor])

  const onLink = useCallback(
    (url: string, text?: string, inNewTab?: boolean) => {
      if (text) {
        const { from, to } = editor.state.selection
        editor
          .chain()
          .focus()
          .insertContentAt(
            { from, to },
            {
              type: 'text',
              text,
              marks: [
                {
                  type: 'link',
                  attrs: {
                    href: url,
                    target: inNewTab ? '_blank' : '',
                  },
                },
              ],
            },
          )
          .run()
      } else {
        editor
          .chain()
          .focus()
          .setLink({ href: url, target: inNewTab ? '_blank' : '' })
          .run()
      }
    },
    [editor],
  )

  return {
    onBold,
    onItalic,
    onStrike,
    onUnderline,
    onCode,
    onCodeBlock,
    onSubscript,
    onSuperscript,
    onLink,
  }
}
