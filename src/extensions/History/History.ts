import { History as TiptapHistory } from '@tiptap/extension-history'

export const History = TiptapHistory.configure({
  depth: 20,
  newGroupDelay: 500,
})

export default History
