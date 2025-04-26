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

const resizeFile = async (file: File, maxSize?: number, forceReduceSize?: boolean): Promise<File> => {
  if (maxSize && file.size > maxSize && !forceReduceSize) {
    throw new Error(
      `File is ${Math.round(file.size / 1024)} KB, exceeds limit of ${Math.round(
        maxSize / 1024
      )} KB; set forceReduceSize=true to auto-compress.`
    );
  }

  if (!maxSize || file.size <= maxSize) {
    return file;
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
    throw new Error('Error compressing image');
  }
};

interface UploadQueueItem {
    id?: string;
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
    private failedUploads: Map<string, UploadQueueItem> = new Map();
  
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

    private updateImageAttributes(localUrl: string, attrs: Record<string, any>): boolean {
      if (!this.editor) return false;
    
      // 1) Find the node position in the current doc
      let pos = -1;
      this.editor.state.doc.descendants((node, nodePos) => {
        if (node.type.name === 'imageBlock' && node.attrs.src === localUrl) {
          pos = nodePos;
          return false;
        }
        return true;
      });
      if (pos < 0) return false;
    
      // 2) Chain a mapped transaction to update attributes atomically
      this.editor
        .chain()
        .focus()
        .setNodeSelection(pos)
        .updateAttributes('imageBlock', {
          ...this.editor.state.doc.nodeAt(pos)!.attrs,
          ...attrs,
        })
        .setMeta('addToHistory', false)
        .run();
    
      return true;
    }
    

    private async processItem(item: UploadQueueItem, signal: AbortSignal) {
        if (!this.editor) return;
        
        const { id, file, pos, upload, maxSize, forceReduceSize } = item;
        let localUrl: string | null | undefined = id;
        const isRetry = !!id ? true : false;

        if (signal.aborted) return;
        let processedFile = isRetry ? file : await resizeFile(file, maxSize, forceReduceSize);
        if (processedFile instanceof Error) {
            throw processedFile;
        };
        
        try {
            if (signal.aborted) return;

            if (!isRetry) {
                localUrl = URL.createObjectURL(file);
                // Insert new image
                this.editor
                    .chain()
                    .focus()
                    .insertContentAt(pos, this.editor.schema.nodes.imageBlock.create({ src: localUrl, loading: true }))
                    .setMeta('addToHistory', false)
                    .run();
            }

            if (!localUrl) return;
            this.localImageUrls.set(localUrl, file.name);

            if (signal.aborted) return;
            const url = await upload(processedFile);
            
            if (!url) {
                this.updateImageAttributes(localUrl, { 
                    loading: false, 
                    error: 'Failed to get URL' 
                });
                this.failedUploads.set(localUrl, { id: localUrl, file: processedFile, pos, upload, maxSize, forceReduceSize });
                return;
            }

            if (signal.aborted) return;
            this.updateImageAttributes(localUrl, { 
                src: url,
                loading: false, 
                error: null 
            });

        } catch (error: any) {
            if (signal.aborted) return;
            
            const errorMessage = error?.response?.data?.error || 'Failed to upload image';
            this.updateImageAttributes(localUrl!, { 
                loading: false, 
                error: errorMessage 
            });
            if (localUrl) {
                this.failedUploads.set(localUrl, { id: localUrl, file: processedFile, pos, upload, maxSize, forceReduceSize });
            }
        } finally {
            if (localUrl && !this.localImageUrls.has(localUrl)) {
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
      this.failedUploads.clear();
    }

    retryUpload(localUrl: string) {
      const failedUpload = this.failedUploads.get(localUrl);
      if (!failedUpload) return;
    
      // Show loading UI immediately
      this.updateImageAttributes(localUrl, { loading: true, error: null });
    
      // Delay 1s then re-add to queue
      setTimeout(() => {
        this.add(failedUpload);
      }, 1000);
    }    
}