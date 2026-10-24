import { Editor } from '@tiptap/core'
import imageCompression from 'browser-image-compression'
import { uploadPluginKey, findPlaceholder } from './ImageUpload'

const ensureFileWithExtension = (blobOrFile: Blob | File, fallbackName = 'image'): File => {
  const rawType = (blobOrFile.type || '').toLowerCase()
  const mime = rawType.startsWith('image/') ? rawType : 'image/jpeg'
  let ext = mime.split('/')[1]?.split('+')[0]?.split(';')[0] || 'jpg'
  if (ext === 'jpeg') ext = 'jpg'

  let fileName = (blobOrFile as File).name || `${fallbackName}-${Date.now()}.${ext}`
  if (!fileName.includes('.')) {
    fileName = `${fileName}.${ext}`
  }
  if (blobOrFile instanceof File && blobOrFile.name === fileName && blobOrFile.type === mime) {
    return blobOrFile
  }
  return new File([blobOrFile], fileName, { type: mime })
}

const fetchRemoteUrlAsFile = async (rawUrl: string, signal?: AbortSignal): Promise<File> => {
  const cleanUrl = rawUrl.trim()

  // 1) Try BFF Proxy (/api/image-proxy) for 100% CORS-free fetch
  try {
    const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(cleanUrl)}`
    const proxyRes = await fetch(proxyUrl, { signal })
    if (proxyRes.ok) {
      const blob = await proxyRes.blob()
      if (blob.size > 0) {
        return ensureFileWithExtension(blob, 'pasted-remote')
      }
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') throw err
  }

  // 2) Try direct CORS fetch
  try {
    const directRes = await fetch(cleanUrl, { mode: 'cors', signal })
    if (directRes.ok) {
      const blob = await directRes.blob()
      if (blob.size > 0) {
        return ensureFileWithExtension(blob, 'pasted-remote')
      }
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') throw err
  }

  // 3) Fallback to Canvas drawImage
  return new Promise<File>((resolve, reject) => {
    const img = document.createElement('img')
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth || 800
        canvas.height = img.naturalHeight || 600
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('No 2D context'))
          return
        }
        ctx.drawImage(img, 0, 0)
        canvas.toBlob(blob => {
          if (!blob) {
            reject(new Error('Canvas toBlob failed'))
            return
          }
          resolve(ensureFileWithExtension(blob, 'pasted-canvas'))
        }, 'image/png')
      } catch (e) {
        reject(e)
      }
    }
    img.onerror = () => reject(new Error('Failed to load remote image'))
    img.src = cleanUrl
  })
}

const resizeFile = async (
  file: File,
  maxSize?: number,
  forceReduceSize = false,
  signal?: AbortSignal,
): Promise<File> => {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  const safeInput = ensureFileWithExtension(file, file.name || 'pasted')

  if (safeInput.type === 'image/svg+xml' || !maxSize || safeInput.size <= maxSize) {
    return safeInput
  }

  if (maxSize && safeInput.size > maxSize && !forceReduceSize) {
    throw new Error(
      `File size ${Math.round(safeInput.size / 1024)}KB exceeds limit ${Math.round(
        (maxSize || 0) / 1024,
      )}KB. Set forceReduceSize:true to auto-compress.`,
    )
  }

  const maxSizeMB = maxSize ? Math.min(0.285, maxSize / (1024 * 1024)) : 0.285

  try {
    const options = {
      maxSizeMB,
      maxWidthOrHeight: 1920,
      initialQuality: 0.85,
      useWebWorker: false,
      fileType: safeInput.type || 'image/jpeg',
      signal,
    }
    const compressed = await imageCompression(safeInput, options)
    return ensureFileWithExtension(compressed, safeInput.name)
  } catch {
    return safeInput
  }
}

const decodeBase64AsFile = async (base64Uri: string, signal?: AbortSignal): Promise<File> => {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  const cleanUri = base64Uri.trim()

  try {
    const res = await fetch(cleanUri, { signal })
    const blob = await res.blob()
    if (blob.size > 0) {
      return ensureFileWithExtension(blob, 'pasted-base64')
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') throw err
  }

  const dataUriRegex = /^data:image\/([a-z0-9.+-]+)(?:;[^,]*)?;base64,([\s\S]+)$/i
  const match = cleanUri.match(dataUriRegex)
  if (!match) {
    throw new Error('Invalid base64 image URI')
  }
  const rawSubType = match[1].toLowerCase()
  const b64Data = match[2].replace(/\s+/g, '')
  const byteString = atob(b64Data)
  const array = new Uint8Array(byteString.length)
  for (let i = 0; i < byteString.length; i++) {
    array[i] = byteString.charCodeAt(i)
  }
  const mimeType = `image/${rawSubType}`
  const blob = new Blob([array], { type: mimeType })
  return ensureFileWithExtension(blob, 'pasted-base64')
}

interface UploadQueueItem {
  id?: string
  file?: File
  sourceUrl?: string
  base64Source?: string
  pos: number
  upload: (file: File, signal?: AbortSignal) => Promise<string>
  maxSize?: number
  forceReduceSize?: boolean
  controller: AbortController
}

export type UploadStatus = 'compressing' | 'uploading' | 'validating' | 'success' | 'failed'

export interface UploadStatusDetail {
  id: string
  fileName: string
  status: UploadStatus
  originalSize: number
  compressedSize?: number
}

export class UploadQueue {
  private queue: UploadQueueItem[] = []
  private originalItems = new Map<string, UploadQueueItem>()
  private activeCount = 0
  private readonly maxConcurrent: number
  private editor: Editor | null = null
  private listeners: ((status: UploadStatusDetail[]) => void)[] = []
  private statusMap = new Map<string, UploadStatusDetail>()

  constructor(maxConcurrent = 3) {
    this.maxConcurrent = maxConcurrent
  }

  setEditor(editor: Editor) {
    this.editor = editor
  }

  onStatusChange(fn: (status: UploadStatusDetail[]) => void) {
    this.listeners.push(fn)
  }

  private emit() {
    const statuses = Array.from(this.statusMap.values())
    this.listeners.forEach(fn => fn(statuses))
  }

  /**
   * Enqueue a new image upload (either File or remote sourceUrl).
   * Mounts the skeleton placeholder decoration synchronously at 0ms,
   * then yields to the browser paint cycle before heavy compression/fetch.
   */
  add(item: Omit<UploadQueueItem, 'controller'>) {
    if (
      this.statusMap.size > 0 &&
      Array.from(this.statusMap.values()).every(s => s.status === 'success')
    ) {
      this.clear()
    }

    const controller = new AbortController()
    const baseLabel = item.file?.name || 'remote-image.jpg'
    const id = item.id || `${baseLabel}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

    // 1) Synchronously dispatch placeholder widget at 0ms so user sees immediate feedback
    let replaceRange: { from: number; to: number } | undefined = undefined
    if (this.editor && this.editor.view) {
      const doc = this.editor.state.doc
      const safePos = Math.max(0, Math.min(item.pos, doc.content.size))
      const $pos = doc.resolve(safePos)
      if ($pos.parent && $pos.parent.isTextblock && $pos.parent.content.size === 0) {
        replaceRange = {
          from: $pos.before(),
          to: $pos.after(),
        }
      }

      const tr = this.editor.state.tr.setMeta(uploadPluginKey, {
        add: { id, pos: safePos, replaceRange },
      })
      this.editor.view.dispatch(tr)
    }

    const queueItem: UploadQueueItem = { ...item, id, controller }
    this.originalItems.set(id, queueItem)
    this.statusMap.set(id, {
      id,
      fileName: baseLabel,
      status: 'compressing',
      originalSize: item.file?.size || 0,
    })
    this.queue.push(queueItem)
    this.emit()

    // 2) Defer heavy fetch/compression by 1 frame (16ms) so the skeleton renders immediately at 0ms
    setTimeout(() => {
      this.process()
    }, 16)
  }

  remove(id: string) {
    const original = this.originalItems.get(id)
    if (original) {
      original.controller.abort()
    }

    if (this.editor && this.editor.view) {
      const tr = this.editor.state.tr.setMeta(uploadPluginKey, {
        remove: { id },
      })
      this.editor.view.dispatch(tr)
    }

    this.queue = this.queue.filter(item => item.id !== id)
    this.originalItems.delete(id)
    this.statusMap.delete(id)
    this.emit()
  }

  private async process(): Promise<void> {
    if (
      !this.editor ||
      this.activeCount >= this.maxConcurrent ||
      this.queue.length === 0
    ) {
      return
    }
    const item = this.queue.shift()!
    const { id, controller } = item

    if (!this.statusMap.has(id!)) {
      return this.process()
    }

    this.activeCount++
    const origStatus = this.statusMap.get(id!)!
    try {
      this.statusMap.set(id!, { ...origStatus, status: 'compressing' })
      this.emit()

      // Resolve File from direct File, base64Source, or remote sourceUrl
      let sourceFile = item.file
      if (!sourceFile && item.base64Source) {
        sourceFile = await decodeBase64AsFile(item.base64Source, controller.signal)
      }
      if (!sourceFile && item.sourceUrl) {
        sourceFile = await fetchRemoteUrlAsFile(item.sourceUrl, controller.signal)
      }
      if (!sourceFile) {
        throw new Error('No image file resolved')
      }

      const processed = await resizeFile(
        sourceFile,
        item.maxSize,
        item.forceReduceSize || false,
        controller.signal,
      )

      if (!this.statusMap.has(id!)) {
        return
      }

      this.statusMap.set(id!, {
        ...origStatus,
        fileName: processed.name,
        originalSize: sourceFile.size,
        status: 'uploading',
        compressedSize: processed.size,
      })
      this.emit()

      const url = await item.upload(processed, controller.signal)

      if (controller.signal.aborted) {
        if (this.editor && this.editor.view) {
          const tr = this.editor.state.tr.setMeta(uploadPluginKey, {
            remove: { id: id! },
          })
          this.editor.view.dispatch(tr)
        }
        return
      }

      this.statusMap.set(id!, {
        ...origStatus,
        status: 'validating',
        compressedSize: processed.size,
      })
      this.emit()

      if (!url) {
        throw new Error('Empty uploaded URL')
      }

      if (this.editor && this.editor.view) {
        const placeholderInfo = findPlaceholder(this.editor.state, id!)
        const imageNode = this.editor.schema.nodes.imageBlock.create({ src: url })

        if (placeholderInfo?.replaceRange) {
          const { from, to } = placeholderInfo.replaceRange
          const tr = this.editor.state.tr
            .setMeta(uploadPluginKey, { remove: { id: id! } })
            .replaceWith(from, to, imageNode)
          this.editor.view.dispatch(tr)
        } else {
          const insertPos = placeholderInfo
            ? placeholderInfo.pos
            : Math.min(item.pos, this.editor.state.doc.content.size)
          this.editor
            .chain()
            .focus()
            .command(({ tr }) => {
              tr.setMeta(uploadPluginKey, { remove: { id: id! } })
              return true
            })
            .insertContentAt(insertPos, imageNode)
            .run()
        }
      }

      this.statusMap.set(id!, {
        ...origStatus,
        status: 'success',
        compressedSize: processed.size,
      })
      this.emit()
    } catch (error: any) {
      if (this.editor && this.editor.view) {
        const placeholderInfo = findPlaceholder(this.editor.state, id!)
        const tr = this.editor.state.tr.setMeta(uploadPluginKey, {
          remove: { id: id! },
        })
        this.editor.view.dispatch(tr)

        // If remote URL upload failed due to network/auth, fallback to inserting proxy/external imageBlock so user isn't left with nothing
        if (item.sourceUrl && error?.name !== 'AbortError') {
          const fallbackSrc = `/api/image-proxy?url=${encodeURIComponent(item.sourceUrl.trim())}`
          const imageNode = this.editor.schema.nodes.imageBlock.create({ src: fallbackSrc })
          const insertPos = placeholderInfo
            ? placeholderInfo.pos
            : Math.min(item.pos, this.editor.state.doc.content.size)
          this.editor.chain().focus().insertContentAt(insertPos, imageNode).run()
        }
      }
      if (error?.name === 'AbortError') {
        return
      }
      console.error('Image upload failed', error)
      this.statusMap.set(id!, {
        ...origStatus,
        status: 'failed',
        compressedSize: origStatus.compressedSize,
      })
      this.emit()
    } finally {
      this.activeCount--
      this.process()
    }
  }

  retry(id: string) {
    const original = this.originalItems.get(id)
    if (!original) return
    const prev = this.statusMap.get(id)!
    this.statusMap.set(id, { ...prev, status: 'compressing' })
    this.queue.push(original)
    this.emit()
    this.process()
  }

  clear() {
    this.originalItems.forEach(item => {
      item.controller.abort()
      if (item.id && this.editor && this.editor.view) {
        const tr = this.editor.state.tr.setMeta(uploadPluginKey, {
          remove: { id: item.id },
        })
        this.editor.view.dispatch(tr)
      }
    })
    this.queue = []
    this.originalItems.clear()
    this.statusMap.clear()
    this.emit()
  }
}
