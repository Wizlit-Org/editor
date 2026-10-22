import { Editor } from "@tiptap/core";
import imageCompression from 'browser-image-compression';

const resizeFile = async (
  file: File,
  maxSize?: number,
  forceReduceSize = false,
  signal?: AbortSignal
): Promise<File> => {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  if (maxSize && file.size > maxSize && !forceReduceSize) {
    throw new Error(
      `File size ${Math.round(file.size / 1024)}KB exceeds limit ${Math.round(
        (maxSize || 0) / 1024
      )}KB. Set forceReduceSize:true to auto-compress.`
    );
  }
  if (!maxSize || file.size <= maxSize) return file;

  // 300KB 상한선 직전(250~290KB)에서 최상의 화질(FHD 해상도 보존)을 유지하도록 설정
  const maxSizeMB = maxSize ? Math.min(0.285, maxSize / (1024 * 1024)) : 0.285;

  const options = {
    maxSizeMB,
    maxWidthOrHeight: 1920,
    initialQuality: 0.85,
    useWebWorker: false,
    fileType: file.type || 'image/jpeg',
    signal,
  };

  return imageCompression(file, options);
};

interface UploadQueueItem {
  id?: string;
  file: File;
  pos: number;
  upload: (file: File, signal?: AbortSignal) => Promise<string>;
  maxSize?: number;
  forceReduceSize?: boolean;
  controller: AbortController;
  tempBlobUrl?: string;
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

    const controller = new AbortController();                   // ← new controller
    const id = item.id || `${item.file.name}-${Date.now()}`;
    let tempBlobUrl: string | undefined = undefined;
    if (typeof window !== 'undefined' && typeof URL !== 'undefined') {
      try {
        tempBlobUrl = URL.createObjectURL(item.file);
        if (this.editor) {
          this.editor
            .chain()
            .focus()
            .insertContentAt(
              item.pos,
              this.editor.schema.nodes.imageBlock.create({ src: tempBlobUrl })
            )
            .run();
        }
      } catch {}
    }

    const queueItem = { ...item, id, controller, tempBlobUrl };
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
        return;
      }

      this.statusMap.set(id!, {
        ...origStatus,
        status: 'validating',
        compressedSize: processed.size,
      });
      this.emit();

      if (!url) { // || !(await isValidUrl(url))) {
        this.statusMap.set(id!, {
          ...origStatus,
          status: 'failed',
        });
        this.emit();
        return;
      }

      if (item.tempBlobUrl && this.editor) {
        let foundPos: number | null = null;
        this.editor.state.doc.descendants((node, pos) => {
          if (node.type.name === 'imageBlock' && node.attrs.src === item.tempBlobUrl) {
            foundPos = pos;
            return false;
          }
        });
        if (foundPos !== null) {
          this.editor
            .chain()
            .setNodeSelection(foundPos)
            .updateAttributes('imageBlock', { src: url })
            .run();
        } else {
          this.editor
            .chain()
            .focus()
            .insertContentAt(
              item.pos,
              this.editor.schema.nodes.imageBlock.create({ src: url })
            )
            .run();
        }
        try {
          URL.revokeObjectURL(item.tempBlobUrl);
        } catch {}
      } else {
        this.editor
          .chain()
          .focus()
          .insertContentAt(
            item.pos,
            this.editor.schema.nodes.imageBlock.create({ src: url })
          )
          .run();
      }

      this.statusMap.set(id!, {
        ...origStatus,
        status: 'success',
        compressedSize: processed.size,
      });
      this.emit();
    } catch (error: any) {
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
    // Abort all active uploads
    this.originalItems.forEach(item => {
      item.controller.abort();
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
