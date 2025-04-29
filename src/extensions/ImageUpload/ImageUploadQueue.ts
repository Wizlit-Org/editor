import { Editor } from "@tiptap/core";
import imageCompression from 'browser-image-compression';

interface Dimensions {
  width: number;
  height: number;
  scale: number;
}

const fitUnderMaxSize = (
  width: number,
  height: number,
  maxPixels: number
): Dimensions => {
  const total = width * height;
  if (total <= maxPixels) {
    return { width, height, scale: 1 };
  }
  const scale = Math.sqrt(maxPixels / total);
  return {
    width: Math.floor(width * scale),
    height: Math.floor(height * scale),
    scale,
  };
};

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

  const img = new Image();
  img.src = URL.createObjectURL(file);
  await new Promise<HTMLImageElement>((resolve, reject) => {
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image load failed'));
  });
  URL.revokeObjectURL(img.src);

  const { width, height, scale } = fitUnderMaxSize(img.width, img.height, maxSize);
  if (scale && scale >= 1) return file;

  const options = {
    maxSizeMB: maxSize! / (1024 * 1024),
    maxWidthOrHeight: Math.max(width, height),
    useWebWorker: false,
    fileType: file.type,
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
    this.originalItems.set(id, { ...item, id, controller });
    this.statusMap.set(id, {
      id,
      fileName: item.file.name,
      status: 'compressing',
      originalSize: item.file.size,
    });
    this.queue.push({ ...item, id, controller });
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

      if (!url || !(await isValidUrl(url))) {
        this.statusMap.set(id!, {
          ...origStatus,
          status: 'failed',
        });
        this.emit();
        return;
      }

      this.editor
        .chain()
        .focus()
        .insertContentAt(
          item.pos,
          this.editor.schema.nodes.imageBlock.create({ src: url })
        )
        .run();

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
    this.queue = [];
    this.originalItems.clear();
    this.statusMap.clear();
    this.emit();
  }
}

const isValidUrl = async (urlString: string): Promise<boolean> => {
  try {
    new URL(urlString);
    
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = urlString;
      // Set a timeout to prevent hanging
      setTimeout(() => resolve(false), 5000);
    });
  } catch {
    return false;
  }
};
