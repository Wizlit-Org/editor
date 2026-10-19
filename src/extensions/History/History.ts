import { UndoRedo as TiptapHistory } from '@tiptap/extensions'

export const History = TiptapHistory.configure({
  depth: 20,
  newGroupDelay: 500,
})

export default History
