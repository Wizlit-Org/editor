import { Icon } from '@/components/ui/Icon'
import { Toolbar } from '@/components/ui/Toolbar'
import { useTextmenuCommands } from './hooks/useTextmenuCommands'
import { useTextmenuStates } from './hooks/useTextmenuStates'
import { BubbleMenu } from '@tiptap/react/menus'
import { Editor } from '@tiptap/react'
import { memo, useEffect, useState } from 'react'
import { useTextmenuContentTypes } from './hooks/useTextmenuContentTypes'
import { ContentTypePicker } from './components/ContentTypePicker'
import { EditLinkPopover } from './components/EditLinkPopover'

const MemoButton = memo(Toolbar.Button)
const MemoContentTypePicker = memo(ContentTypePicker)

const MENU_OPTIONS = {
  placement: 'top-start' as const,
  offset: 8,
}

export type TextMenuProps = {
  editor: Editor
}

export const TextMenu = ({ editor }: TextMenuProps) => {
  const [selecting, setSelecting] = useState(false)
  const commands = useTextmenuCommands(editor)
  const states = useTextmenuStates(editor)
  const blockOptions = useTextmenuContentTypes(editor)

  useEffect(() => {
    let selectionTimeout: number

    const onSelectionChange = () => {
      setSelecting(true)

      if (selectionTimeout) {
        window.clearTimeout(selectionTimeout)
      }

      selectionTimeout = window.setTimeout(() => {
        setSelecting(false)
        try {
          if (editor.view && !editor.isDestroyed) {
            editor.view.dispatch(editor.state.tr.setMeta('textMenu', 'updatePosition'))
          }
        } catch {}
      }, 150)
    }

    editor.on('selectionUpdate', onSelectionChange)

    return () => {
      editor.off('selectionUpdate', onSelectionChange)
    }
  }, [editor])

  const BTN_CLASS =
    'h-7 w-7 p-0 flex items-center justify-center text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white hover:bg-black/5 active:bg-black/10 dark:hover:bg-white/5 dark:active:bg-white/10 rounded-md border border-transparent transition-colors duration-150'
  const ACTIVE_CLASS = 'bg-black/10 text-zinc-900 dark:bg-white/15 dark:text-white font-semibold'

  return (
    <BubbleMenu
      className={selecting ? 'opacity-0 pointer-events-none z-[1330]' : 'opacity-100 transition-opacity duration-150 z-[1330]'}
      options={MENU_OPTIONS}
      editor={editor}
      pluginKey="textMenu"
      shouldShow={states.shouldShow}
      updateDelay={0}
    >
      <div className="inline-flex h-full leading-none gap-0.5 p-1 rounded-xl items-center z-[1330] bg-white/90 dark:bg-[#202020]/95 backdrop-blur-xl border border-black/[0.08] dark:border-white/[0.1] shadow-2xl ring-1 ring-white/40 dark:ring-white/5 text-zinc-800 dark:text-zinc-200">
        <MemoContentTypePicker options={blockOptions} />
        <div className="h-4 w-[1px] bg-black/10 dark:bg-white/10 mx-1 shrink-0" />
        <MemoButton
          tooltip="Bold"
          tooltipShortcut={['Mod', 'B']}
          onClick={commands.onBold}
          active={states.isBold}
          className={BTN_CLASS}
          activeClassname={ACTIVE_CLASS}
        >
          <Icon name="Bold" className="w-3.5 h-3.5" />
        </MemoButton>
        <MemoButton
          tooltip="Italic"
          tooltipShortcut={['Mod', 'I']}
          onClick={commands.onItalic}
          active={states.isItalic}
          className={BTN_CLASS}
          activeClassname={ACTIVE_CLASS}
        >
          <Icon name="Italic" className="w-3.5 h-3.5" />
        </MemoButton>
        <MemoButton
          tooltip="Underline"
          tooltipShortcut={['Mod', 'U']}
          onClick={commands.onUnderline}
          active={states.isUnderline}
          className={BTN_CLASS}
          activeClassname={ACTIVE_CLASS}
        >
          <Icon name="Underline" className="w-3.5 h-3.5" />
        </MemoButton>
        <MemoButton
          tooltip="Strikethrough"
          tooltipShortcut={['Mod', 'Shift', 'S']}
          onClick={commands.onStrike}
          active={states.isStrike}
          className={BTN_CLASS}
          activeClassname={ACTIVE_CLASS}
        >
          <Icon name="Strikethrough" className="w-3.5 h-3.5" />
        </MemoButton>
        <div className="h-4 w-[1px] bg-black/10 dark:bg-white/10 mx-1 shrink-0" />
        <MemoButton
          tooltip="Code"
          tooltipShortcut={['Mod', 'E']}
          onClick={commands.onCode}
          active={states.isCode}
          className={BTN_CLASS}
          activeClassname={ACTIVE_CLASS}
        >
          <Icon name="Code" className="w-3.5 h-3.5" />
        </MemoButton>
        <EditLinkPopover onSetLink={commands.onLink} />
      </div>
    </BubbleMenu>
  )
}

export default TextMenu
