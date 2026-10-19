import { Icon } from '@/components/ui/Icon'
import { Toolbar } from '@/components/ui/Toolbar'
import { useTextmenuCommands } from './hooks/useTextmenuCommands'
import { useTextmenuStates } from './hooks/useTextmenuStates'
import { BubbleMenu } from '@tiptap/react/menus'
import { Editor } from '@tiptap/react'
import { memo, useEffect, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { ColorPicker } from '@/components/panels'
// import { FontFamilyPicker } from './components/FontFamilyPicker'
// import { FontSizePicker } from './components/FontSizePicker'
import { useTextmenuContentTypes } from './hooks/useTextmenuContentTypes'
import { ContentTypePicker } from './components/ContentTypePicker'
// import { AIDropdown } from './components/AIDropdown'
import { EditLinkPopover } from './components/EditLinkPopover'

// We memorize the button so each button is not rerendered
// on every editor state change
const MemoButton = memo(Toolbar.Button)
const MemoColorPicker = memo(ColorPicker)
// const MemoFontFamilyPicker = memo(FontFamilyPicker)
// const MemoFontSizePicker = memo(FontSizePicker)
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
      }, 200)
    }

    editor.on('selectionUpdate', onSelectionChange)

    return () => {
      editor.off('selectionUpdate', onSelectionChange)
    }
  }, [editor])

  const BTN_CLASS =
    'text-[#9b9b9b] hover:text-[#e3e3e3] hover:bg-white/[0.06] active:bg-white/[0.1] border border-transparent transition-colors'
  const ACTIVE_CLASS = 'bg-white/[0.1] text-white'

  return (
    <BubbleMenu
      className={selecting ? 'hidden' : ''}
      options={MENU_OPTIONS}
      editor={editor}
      pluginKey="textMenu"
      shouldShow={states.shouldShow}
      updateDelay={0}
    >
      <div className="glass-toolbar inline-flex h-full leading-none gap-0.5 p-1 items-center text-[#e3e3e3] shadow-xl z-50">
        <MemoContentTypePicker options={blockOptions} />
        <div className="h-4 w-[1px] bg-white/10 mx-1 shrink-0" />
        <MemoButton
          tooltip="Bold"
          tooltipShortcut={['Mod', 'B']}
          onClick={commands.onBold}
          active={states.isBold}
          className={BTN_CLASS}
          activeClassname={ACTIVE_CLASS}
        >
          <Icon name="Bold" />
        </MemoButton>
        <MemoButton
          tooltip="Italic"
          tooltipShortcut={['Mod', 'I']}
          onClick={commands.onItalic}
          active={states.isItalic}
          className={BTN_CLASS}
          activeClassname={ACTIVE_CLASS}
        >
          <Icon name="Italic" />
        </MemoButton>
        <MemoButton
          tooltip="Underline"
          tooltipShortcut={['Mod', 'U']}
          onClick={commands.onUnderline}
          active={states.isUnderline}
          className={BTN_CLASS}
          activeClassname={ACTIVE_CLASS}
        >
          <Icon name="Underline" />
        </MemoButton>
        <MemoButton
          tooltip="Strikethrough"
          tooltipShortcut={['Mod', 'Shift', 'S']}
          onClick={commands.onStrike}
          active={states.isStrike}
          className={BTN_CLASS}
          activeClassname={ACTIVE_CLASS}
        >
          <Icon name="Strikethrough" />
        </MemoButton>
        <div className="h-4 w-[1px] bg-white/10 mx-1 shrink-0" />
        <MemoButton
          tooltip="Subscript"
          tooltipShortcut={['Mod', '.']}
          onClick={commands.onSubscript}
          active={states.isSubscript}
          className={BTN_CLASS}
          activeClassname={ACTIVE_CLASS}
        >
          <Icon name="Subscript" />
        </MemoButton>
        <MemoButton
          tooltip="Superscript"
          tooltipShortcut={['Mod', ',']}
          onClick={commands.onSuperscript}
          active={states.isSuperscript}
          className={BTN_CLASS}
          activeClassname={ACTIVE_CLASS}
        >
          <Icon name="Superscript" />
        </MemoButton>
        <div className="h-4 w-[1px] bg-white/10 mx-1 shrink-0" />
        <MemoButton
          tooltip="Code"
          tooltipShortcut={['Mod', 'E']}
          onClick={commands.onCode}
          active={states.isCode}
          className={BTN_CLASS}
          activeClassname={ACTIVE_CLASS}
        >
          <Icon name="Code" />
        </MemoButton>
        <MemoButton
          tooltip="Code block"
          onClick={commands.onCodeBlock}
          className={BTN_CLASS}
          activeClassname={ACTIVE_CLASS}
        >
          <Icon name="FileCode" />
        </MemoButton>
        <EditLinkPopover onSetLink={commands.onLink} />
        <Popover.Root>
          <Popover.Trigger asChild>
            <MemoButton
              active={!!states.currentHighlight}
              className={BTN_CLASS}
              activeClassname={ACTIVE_CLASS}
              tooltip="Highlight"
            >
              <Icon name="Highlighter" />
            </MemoButton>
          </Popover.Trigger>
          <Popover.Content side="top" sideOffset={8} asChild className="z-50 outline-none">
            <div className="glass-menu p-1.5 shadow-2xl">
              <MemoColorPicker
                color={states.currentHighlight}
                onChange={commands.onChangeHighlight}
                onClear={commands.onClearHighlight}
              />
            </div>
          </Popover.Content>
        </Popover.Root>
      </div>
    </BubbleMenu>
  )
}

export default TextMenu
