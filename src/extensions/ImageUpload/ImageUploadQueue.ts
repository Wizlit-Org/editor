import { Editor } from "@tiptap/core";
import imageCompression from 'browser-image-compression';

interface Dimensions {
  width: number;
  height: number;
  scale?: number;
}

const fitUnderMaxSize = (width: number, height: number, maxSize: number): Dimensions => {
  const originalSize = width * height;
  if (originalSize <= maxSize) {
    return { width, height, scale: 1 };
  }

  const scale = Math.sqrt(maxSize / originalSize);
  return {
    width: Math.floor(width * scale),
    height: Math.floor(height * scale),
    scale
  };
}

const resizeFile = async (file: File, maxSize?: number, forceReduceSize?: boolean): Promise<File | Error> => {
  if (maxSize && file.size > maxSize && !forceReduceSize) {
    return new Error(
      `File is ${Math.round(file.size / 1024)} KB, exceeds limit of ${Math.round(
        maxSize / 1024
      )} KB; set forceReduceSize=true to auto-compress.`
    );
  }

  if (!maxSize || file.size <= maxSize) {
    return file;
  }

  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    return new Error('crypto.subtle not available, skipping image compression');
  }

  try {
    const img = new Image();
    const imgLoadPromise = new Promise<HTMLImageElement>((resolve, reject) => {
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
    });
    
    img.src = URL.createObjectURL(file);
    await imgLoadPromise;
    URL.revokeObjectURL(img.src);

    const { width, height, scale } = fitUnderMaxSize(img.width, img.height, maxSize);
    if (scale && scale >= 1) return file;

    const options = {
      maxSizeMB: maxSize / (1024 * 1024), // Convert bytes to MB
      maxWidthOrHeight: Math.max(width, height),
      useWebWorker: false,
      fileType: 'image/png',
    };

    return await imageCompression(file, options);
  } catch (error) {
    console.error('Error compressing image:', error);
    return new Error('Error compressing image');
  }
};

interface UploadQueueItem {
    file: File;
    pos: number;
    upload: (file: File) => Promise<string>;
    maxSize?: number;
    forceReduceSize?: boolean;
}
  
export class UploadQueue {
    private queue: UploadQueueItem[] = [];
    private processing: boolean = false;
    private maxConcurrent: number;
    private activeUploads: number = 0;
    private editor: Editor | null = null;
    private localImageUrls: Map<string, string> = new Map();
    private abortControllers: Map<string, AbortController> = new Map();
  
    constructor(maxConcurrent: number = 3) {
      this.maxConcurrent = maxConcurrent;
    }
  
    setEditor(editor: Editor) {
      this.editor = editor;
    }
  
    add(item: UploadQueueItem) {
      this.queue.push(item);
      this.process();
    }
  
    private async process() {
      if (this.processing || this.queue.length === 0 || this.activeUploads >= this.maxConcurrent || !this.editor) {
        return;
      }
  
      this.processing = true;
      try {
        while (this.queue.length > 0 && this.activeUploads < this.maxConcurrent) {
          const item = this.queue.shift();
          if (item) {
            this.activeUploads++;
            const controller = new AbortController();
            this.abortControllers.set(item.file.name, controller);
            
            this.processItem(item, controller.signal)
              .finally(() => {
                this.activeUploads--;
                this.abortControllers.delete(item.file.name);
                this.processing = false;
                this.process();
              });
          }
        }
      } finally {
        this.processing = false;
      }
    }

    private findAndUpdateImageNode(localUrl: string, attrs: Record<string, any>): boolean {
        if (!this.editor) return false;

        const state = this.editor.state;
        const tr = state.tr;
        let found = false;

        state.doc.descendants((node, nodePos) => {
            if (found) return false;
            if (node.type.name === 'imageBlock' && node.attrs.loading && node.attrs.src === localUrl) {
                found = true;
                tr.setNodeMarkup(nodePos, undefined, attrs);
                return false;
            }
            return true;
        });

        if (found) {
            tr.setMeta('addToHistory', false);
            this.editor.view.dispatch(tr);
        } else {
            console.warn('Could not find image node to update');
        }

        return found;
    }

    private async processItem(item: UploadQueueItem, signal: AbortSignal) {
        if (!this.editor) return;
        
        const { file, pos, upload, maxSize, forceReduceSize } = item;
        let localUrl: string | null = null;
        
        try {
            if (signal.aborted) return;
            
            localUrl = URL.createObjectURL(file);
            this.localImageUrls.set(localUrl, file.name);

            const tr = this.editor.state.tr
                .setMeta('addToHistory', false)
                .insert(pos, this.editor.schema.nodes.imageBlock.create(
                    { src: localUrl, loading: true }
                ));
            
            this.editor.view.dispatch(tr);

            if (signal.aborted) return;
            const processedFile = await resizeFile(file, maxSize, forceReduceSize);
            if (processedFile instanceof Error) {
                throw processedFile;
            }

            if (signal.aborted) return;
            const url = await upload(processedFile);
            
            if (signal.aborted) return;
            this.findAndUpdateImageNode(localUrl, { 
                src: url, 
                loading: false, 
                error: null 
            });
        } catch (error: any) {
            if (signal.aborted) return;
            
            const errorMessage = error?.response?.data?.error || 'Failed to upload image';
            this.findAndUpdateImageNode(localUrl!, { 
                loading: false, 
                error: errorMessage 
            });
        } finally {
            if (localUrl) {
                URL.revokeObjectURL(localUrl);
                this.localImageUrls.delete(localUrl);
            }
        }
    }

    cancelUpload(fileName: string) {
      const controller = this.abortControllers.get(fileName);
      if (controller) {
        controller.abort();
        this.abortControllers.delete(fileName);
      }
    }

    clear() {
      this.queue = [];
      this.abortControllers.forEach(controller => controller.abort());
      this.abortControllers.clear();
      this.localImageUrls.forEach(url => URL.revokeObjectURL(url));
      this.localImageUrls.clear();
    }
}