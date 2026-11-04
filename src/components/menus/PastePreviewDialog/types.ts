import { Editor } from '@tiptap/react'

export interface PastePreviewDialogProps {
  editor: Editor
  theme?: 'light' | 'dark'
}

export interface PasteOptionItem {
  id: string
  label: string
  description: string
  icon: string
  isPrimary?: boolean
  insert: () => void
}
