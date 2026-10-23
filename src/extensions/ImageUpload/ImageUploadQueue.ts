import { Editor } from "@tiptap/core";
import imageCompression from 'browser-image-compression';
import { uploadPluginKey, findPlaceholder } from './ImageUpload';

const ensureFileWithExtension = (blobOrFile: Blob | File, originalFile: File): File => {
  const mime = blobOrFile.type || originalFile.type || 'image/jpeg';
  let ext = mime.split('/')[1]?.split('+')[0] || 'jpg';
  if (ext === 'jpeg') ext = 'jpg';

  let fileName = (blobOrFile as File).name || originalFile.name || `image-${Date.now()}.${ext}`;
  if (!fileName.includes('.')) {
    fileName = `${fileName}.${ext}`;
  }
  if (blobOrFile instanceof File && blobOrFile.name === fileName) {
    return blobOrFile;
  }
  return new File([blobOrFile], fileName, { type: mime });
};

const resizeFile = async (
  file: File,
  maxSize?: number,
  forceReduceSize = false,
  signal?: AbortSignal
): Promise<File> => {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const safeInput = ensureFileWithExtension(file, file);

  // SVG/GIF should not be re-encoded through canvas compression unless strictly over limit
  if (safeInput.type === 'image/svg+xml' || (!maxSize || safeInput.size <= maxSize)) {
    return safeInput;
  }

  if (maxSize && safeInput.size > maxSize && !forceReduceSize) {
    throw new Error(
      `File size ${Math.round(safeInput.size / 1024)}KB exceeds limit ${Math.round(
        (maxSize || 0) / 1024
      )}KB. Set forceReduceSize:true to auto-compress.`
    );
  }

  // 300KB 상한선 직전(250~290KB)에서 최상의 화질(FHD 해상도 보존)을 유지하도록 설정
  const maxSizeMB = maxSize ? Math.min(0.285, maxSize / (1024 * 1024)) : 0.285;

  try {
    const options = {
      maxSizeMB,
      maxWidthOrHeight: 1920,
      initialQuality: 0.85,
      useWebWorker: false,
      fileType: safeInput.type || 'image/jpeg',
      signal,
    };

    const compressed = await imageCompression(safeInput, options);
    return ensureFileWithExtension(compressed, safeInput);
  } catch (err) {
    // If browser-image-compression fails on certain image formats, fallback to safeInput
    return safeInput;
  }
};

interface UploadQueueItem {
  id?: string;
  file: File;
  pos: number;
  upload: (file: File, signal?: AbortSignal) => Promise<string>;
  maxSize?: number;
  forceReduceSize?: boolean;
  controller: AbortController;
}

export type UploadStatus = 'compressing' | 'uploading' | 'validating' | 'success' | 'failed';

export interface UploadStatusDetail {
  id: string;
  fileName: string;
  status: UploadStatus;
  originalSize: number;
  compressedSize?: number;
}

export class UploadQueue {
  private queue: UploadQueueItem[] = [];
  private originalItems = new Map<string, UploadQueueItem>();
  private activeCount = 0;
  private readonly maxConcurrent: number;
  private editor: Editor | null = null;
  private listeners: ((status: UploadStatusDetail[]) => void)[] = [];
  private statusMap = new Map<string, UploadStatusDetail>();

  constructor(maxConcurrent = 3) {
    this.maxConcurrent = maxConcurrent;
  }

  /**
   * Attach Tiptap editor instance.
   */
  setEditor(editor: Editor) {
    this.editor = editor;
  }

  /**
   * Subscribe to status changes.
   */
  onStatusChange(fn: (status: UploadStatusDetail[]) => void) {
    this.listeners.push(fn);
  }

  private emit() {
    const statuses = Array.from(this.statusMap.values());
    this.listeners.forEach(fn => fn(statuses));
  }

  /**
   * Enqueue a new image upload.
   */
  add(item: Omit<UploadQueueItem, 'controller'>) {
    // Before adding new items, clear out previous only-if-all-success
    if (
      this.statusMap.size > 0 &&
      Array.from(this.statusMap.values()).every(s => s.status === 'success')
    ) {
      this.clear();
    }

    const controller = new AbortController();
    const id = item.id || `${item.file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // 빈 텍스트블록 감지 시 데코레이션 은닉 및 원자적 치환 범위 지정 (docChanged: false)
    let replaceRange: { from: number; to: number } | undefined = undefined;
    if (this.editor && this.editor.view) {
      const doc = this.editor.state.doc;
      const safePos = Math.max(0, Math.min(item.pos, doc.content.size));
      const $pos = doc.resolve(safePos);
      if ($pos.parent && $pos.parent.isTextblock && $pos.parent.content.size === 0) {
        replaceRange = {
          from: $pos.before(),
          to: $pos.after(),
        };
      }

      const tr = this.editor.state.tr.setMeta(uploadPluginKey, {
        add: { id, pos: item.pos, replaceRange },
      });
      this.editor.view.dispatch(tr);
    }

    const queueItem = { ...item, id, controller };
    this.originalItems.set(id, queueItem);
    this.statusMap.set(id, {
      id,
      fileName: item.file.name,
      status: 'compressing',
      originalSize: item.file.size,
    });
    this.queue.push(queueItem);
    this.emit();
    this.process();
  }

  /**
   * Remove (or cancel) a queued or in-flight upload.
   */
  remove(id: string) {
    // 1) Abort any in-flight work
    const original = this.originalItems.get(id);
    if (original) {
      original.controller.abort();
    }

    // Remove placeholder decoration if present
    if (this.editor && this.editor.view) {
      const tr = this.editor.state.tr.setMeta(uploadPluginKey, {
        remove: { id },
      });
      this.editor.view.dispatch(tr);
    }

    // 2) Remove from the pending queue
    this.queue = this.queue.filter(item => item.id !== id);

    // 3) Remove stored references
    this.originalItems.delete(id);
    this.statusMap.delete(id);

    // 4) Notify listeners
    this.emit();
  }

  /**
   * Process queue with respect to concurrency limit.
   */
  private async process(): Promise<void> {
    if (
      !this.editor ||
      this.activeCount >= this.maxConcurrent ||
      this.queue.length === 0
    ) {
      return;
    }
    const item = this.queue.shift()!;
    const { id, controller } = item;

    // If removed since pulling off, skip it
    if (!this.statusMap.has(id!)) {
      return this.process();
    }

    this.activeCount++;
    const origStatus = this.statusMap.get(id!)!;
    try {
      this.statusMap.set(id!, { ...origStatus, status: 'compressing' });
      this.emit();

      const processed = await resizeFile(
        item.file,
        item.maxSize,
        item.forceReduceSize || false,
        controller.signal                       // ← pass signal
      );

      // Skip if removed in-flight
      if (!this.statusMap.has(id!)) {
        return;
      }

      this.statusMap.set(id!, {
        ...origStatus,
        status: 'uploading',
        compressedSize: processed.size,
      });
      this.emit();

      const url = await item.upload(processed, controller.signal);  // ← pass signal

      // If aborted mid-flight, bail out
      if (controller.signal.aborted) {
        if (this.editor && this.editor.view) {
          const tr = this.editor.state.tr.setMeta(uploadPluginKey, {
            remove: { id: id! },
          });
          this.editor.view.dispatch(tr);
        }
        return;
      }

      this.statusMap.set(id!, {
        ...origStatus,
        status: 'validating',
        compressedSize: processed.size,
      });
      this.emit();

      if (!url) {
        this.statusMap.set(id!, {
          ...origStatus,
          status: 'failed',
        });
        this.emit();
        if (this.editor && this.editor.view) {
          const tr = this.editor.state.tr.setMeta(uploadPluginKey, {
            remove: { id: id! },
          });
          this.editor.view.dispatch(tr);
        }
        return;
      }

      // 업로드 성공 시: 데코레이션 제거 및 imageBlock 1회 단일 트랜잭션 삽입 (빈 단락은 replaceWith 원자적 치환)
      if (this.editor && this.editor.view) {
        const placeholderInfo = findPlaceholder(this.editor.state, id!);
        const imageNode = this.editor.schema.nodes.imageBlock.create({ src: url });

        if (placeholderInfo?.replaceRange) {
          const { from, to } = placeholderInfo.replaceRange;
          const tr = this.editor.state.tr
            .setMeta(uploadPluginKey, { remove: { id: id! } })
            .replaceWith(from, to, imageNode);
          this.editor.view.dispatch(tr);
        } else {
          const insertPos = placeholderInfo ? placeholderInfo.pos : Math.min(item.pos, this.editor.state.doc.content.size);
          this.editor
            .chain()
            .focus()
            .command(({ tr }) => {
              tr.setMeta(uploadPluginKey, { remove: { id: id! } });
              return true;
            })
            .insertContentAt(insertPos, imageNode)
            .run();
        }
      }

      this.statusMap.set(id!, {
        ...origStatus,
        status: 'success',
        compressedSize: processed.size,
      });
      this.emit();
    } catch (error: any) {
      if (this.editor && this.editor.view) {
        const tr = this.editor.state.tr.setMeta(uploadPluginKey, {
          remove: { id: id! },
        });
        this.editor.view.dispatch(tr);
      }
      // Swallow abort errors silently
      if (error.name === 'AbortError') {
        return;
      }
      console.error('Image upload failed', error);
      this.statusMap.set(id!, {
        ...origStatus,
        status: 'failed',
        compressedSize: origStatus.compressedSize,
      });
      this.emit();
    } finally {
      this.activeCount--;
      this.process();
    }
  }

  /**
   * Retry a previously failed upload.
   */
  retry(id: string) {
    const original = this.originalItems.get(id);
    if (!original) return;
    // Reset status to compressing
    const prev = this.statusMap.get(id)!;
    this.statusMap.set(id, { ...prev, status: 'compressing' });
    this.queue.push(original);
    this.emit();
    this.process();
  }

  /**
   * Clear queue, original items, and statuses.
   */
  clear() {
    // Abort all active uploads and remove decorations
    this.originalItems.forEach(item => {
      item.controller.abort();
      if (item.id && this.editor && this.editor.view) {
        const tr = this.editor.state.tr.setMeta(uploadPluginKey, {
          remove: { id: item.id },
        });
        this.editor.view.dispatch(tr);
      }
    });
    this.queue = [];
    this.originalItems.clear();
    this.statusMap.clear();
    this.emit();
  }
}

// const isValidUrl = async (urlString: string): Promise<boolean> => {
//   try {
//     new URL(urlString);
    
//     return new Promise((resolve) => {
//       const img = new Image();
//       img.onload = () => resolve(true);
//       img.onerror = () => resolve(false);
//       img.src = urlString;
//       // Set a timeout to prevent hanging
//       setTimeout(() => resolve(false), 5000);
//     });
//   } catch {
//     return false;
//   }
// };
