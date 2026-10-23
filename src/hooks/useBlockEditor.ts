import { useEditor } from '@tiptap/react'
import type { Editor, EditorOptions } from '@tiptap/core'

import { ExtensionKit } from '@/extensions/extension-kit'
import { UploadQueue } from '@/extensions/ImageUpload/ImageUploadQueue'
import { useEffect, useMemo, useRef, useState } from 'react'
import { UploadListDialogProps, UploadListItem } from '@/extensions/ImageUpload/components/UploadListDialog.tsx'
import { ConvertSrc, OnImageClick } from '@/extensions/ImageBlock/components/ImageBlockView'
import { detectPasteType } from '@/components/menus/SmartPasteMenu'

declare global {
  interface Window {
    editor: Editor | null
  }
}

export const uploadImageQueue = new UploadQueue()

export const useBlockEditor = ({
  key,
  editable,
  content,
  onUploadImage,
  convertSrc,
  onImageClick,
  maxSize,
  maxEmbeddings,
  maxCharacters,
  className = '',
  ...editorOptions
}: {
  onUploadImage?: (file: File) => Promise<string>
  convertSrc?: ConvertSrc
  onImageClick?: OnImageClick
  maxSize?: number
  maxEmbeddings?: number
  maxCharacters?: number
  className?: string
  key?: string
} & Partial<Omit<EditorOptions, 'extensions'>>) => {
  const editorRef = useRef<Editor | null>(null)

  const editor = useEditor(
    {
      ...editorOptions,
      editable,
      immediatelyRender: false,
      shouldRerenderOnTransaction: false,
      autofocus: true,
      extensions: ExtensionKit({
        limit: maxCharacters,
        onUploadImage,
        convertSrc,
        onImageClick,
        maxSize,
        maxEmbeddings,
      }),
      editorProps: {
        attributes: {
          autocomplete: 'off',
          autocorrect: 'off',
          autocapitalize: 'off',
          class: `min-h-full ${className}`,
        },
        handlePaste: (_view, event) => {
          const activeEditor = editorRef.current
          const clipboard = (event as ClipboardEvent).clipboardData
          if (!clipboard) return false

          const pos = _view ? _view.state.selection.from : 0

          // 1) Clipboard Image Files or Screenshot Items (e.g. Win+Shift+S, Copy Image, file paste)
          const directFiles = Array.from(clipboard.files || []).filter(f => f.type.startsWith('image/'))
          const itemFiles =
            directFiles.length > 0
              ? directFiles
              : Array.from(clipboard.items || [])
                  .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
                  .map(item => item.getAsFile())
                  .filter((file): file is File => file !== null)

          if (itemFiles.length > 0) {
            event.preventDefault()
            if (activeEditor) {
              activeEditor.commands.uploadImages({ files: itemFiles, pos })
            }
            return true
          }

          const rawText = clipboard.getData('text/plain')
          const text = rawText ? rawText.trim() : ''
          const html = clipboard.getData('text/html') || ''

          // 2) Base64 Data URL in text/plain (data:image/...;base64,...)
          if (text.startsWith('data:image/') && text.includes(';base64,')) {
            event.preventDefault()
            if (_view) {
              const coords = _view.coordsAtPos(pos)
              window.dispatchEvent(
                new CustomEvent('tiptap:smart-paste', {
                  detail: {
                    text,
                    type: 'image_data',
                    coords: { top: coords.top, left: coords.left, bottom: coords.bottom },
                    selection: { from: _view.state.selection.from, to: _view.state.selection.to },
                  },
                }),
              )
              return true
            }
            if (activeEditor) {
              activeEditor.commands.uploadImageByBase64({ base64: text, pos })
            }
            return true
          }

          // 3) HTML <img src="..."> without plain text (e.g. right-click copy image from web)
          if (!text && html.includes('<img')) {
            const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i)
            if (imgMatch && imgMatch[1]) {
              const imgSrc = imgMatch[1].trim()
              event.preventDefault()
              if (imgSrc.startsWith('data:image/') && imgSrc.includes(';base64,')) {
                if (_view) {
                  const coords = _view.coordsAtPos(pos)
                  window.dispatchEvent(
                    new CustomEvent('tiptap:smart-paste', {
                      detail: {
                        text: imgSrc,
                        type: 'image_data',
                        coords: { top: coords.top, left: coords.left, bottom: coords.bottom },
                        selection: { from: _view.state.selection.from, to: _view.state.selection.to },
                      },
                    }),
                  )
                  return true
                }
                activeEditor?.commands.uploadImageByBase64({ base64: imgSrc, pos })
                return true
              }
              if (imgSrc.startsWith('http://') || imgSrc.startsWith('https://')) {
                if (_view) {
                  const coords = _view.coordsAtPos(pos)
                  window.dispatchEvent(
                    new CustomEvent('tiptap:smart-paste', {
                      detail: {
                        text: imgSrc,
                        type: 'image_url',
                        meta: { url: imgSrc },
                        coords: { top: coords.top, left: coords.left, bottom: coords.bottom },
                        selection: { from: _view.state.selection.from, to: _view.state.selection.to },
                      },
                    }),
                  )
                  return true
                }
                activeEditor?.commands.uploadImageByUrl({ url: imgSrc, pos })
                return true
              }
            }
          }

          if (!text) return false

          // 4) Smart Paste Detection (Image URL, YouTube, Web URL, Code snippet, Markdown list)
          const detected = detectPasteType(text)
          if (detected && _view) {
            event.preventDefault()
            const coords = _view.coordsAtPos(pos)
            window.dispatchEvent(
              new CustomEvent('tiptap:smart-paste', {
                detail: {
                  text,
                  type: detected.type,
                  meta: detected.meta,
                  coords: {
                    top: coords.top,
                    left: coords.left,
                    bottom: coords.bottom,
                  },
                  selection: {
                    from: _view.state.selection.from,
                    to: _view.state.selection.to,
                  },
                },
              }),
            )
            return true
          }

          // Default: let standard TipTap paste handlers run
          return false
        },
      },
      content,
    },
    [maxSize, maxEmbeddings],
  )

  editorRef.current = editor

  const [uploadItems, setUploadItems] = useState<UploadListItem[]>([])

  const uploadDialog = useMemo<UploadListDialogProps>(
    () => ({
      items: uploadItems,
      onRetry: (id: string) => uploadImageQueue.retry(id),
      onRemove: (id: string) => uploadImageQueue.remove(id),
    }),
    [uploadItems],
  )

  useEffect(() => {
    uploadImageQueue.onStatusChange(items => {
      setUploadItems(items)
    })
  }, [])

  useEffect(() => {
    uploadImageQueue.clear()
  }, [key, editable])

  if (editor) {
    window.editor = editor
  }

  return { editor, uploadDialog }
}
