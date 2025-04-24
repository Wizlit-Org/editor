import { Editor } from "@tiptap/core";

const toBase64 = (file: File) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
});


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
    private maxConcurrent: number = 3;
    private activeUploads: number = 0;
    private editor: Editor | null = null;
    private localImageUrls: Map<string, string> = new Map();
  
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
      while (this.queue.length > 0 && this.activeUploads < this.maxConcurrent) {
        const item = this.queue.shift();
        if (item) {
          this.activeUploads++;
          this.processItem(item).finally(() => {
            this.activeUploads--;
            this.processing = false;
            this.process();
          });
        }
      }
      this.processing = false;
    }
  
    private async processItem(item: UploadQueueItem) {
      if (!this.editor) return;
      
      const { file, pos, upload, maxSize, forceReduceSize } = item;
      let localUrl: string | null = null;
      
      const processFile = async (file: File) => {
        if (maxSize && forceReduceSize && file.size > maxSize) {
          // TODO: Implement image compression
          return file;
        }
        return file;
      };
  
      try {
        // Create a local URL for the file
        localUrl = URL.createObjectURL(file);
        this.localImageUrls.set(localUrl, file.name);
  
        // Insert preview image with a non-undoable transaction
        this.editor.view.dispatch(
          this.editor.state.tr
            .setMeta('addToHistory', false)
            .insert(pos, this.editor.schema.nodes.imageBlock.create(
              { src: localUrl, loading: true }
            ))
        );
  
        const processedFile = await processFile(file);
        if (processedFile instanceof Error) {
          throw processedFile;
        }
  
        const url = await upload(processedFile);
        
        // Find the correct node position by looking for the loading image
        const findNodePos = () => {
          let currentPos = pos;
          while (currentPos < this.editor!.state.doc.content.size) {
            const node = this.editor!.state.doc.nodeAt(currentPos);
            if (node && node.type.name === 'imageBlock' && node.attrs.loading && node.attrs.src === localUrl) {
              return currentPos;
            }
            currentPos++;
          }
          return pos;
        };
  
        const nodePos = findNodePos();
        
        // Update to final URL with a non-undoable transaction
        this.editor.view.dispatch(
          this.editor.state.tr
            .setMeta('addToHistory', false)
            .setNodeMarkup(nodePos, undefined, { 
              src: url, 
              loading: false, 
              error: null 
            })
        );
  
        // Clean up the local URL
        if (localUrl) {
          URL.revokeObjectURL(localUrl);
          this.localImageUrls.delete(localUrl);
        }
      } catch (error: any) {
        const errorMessage = error?.response?.data?.error || 'Failed to upload image';
        
        // Find the correct node position by looking for the loading image
        const findNodePos = () => {
          let currentPos = pos;
          while (currentPos < this.editor!.state.doc.content.size) {
            const node = this.editor!.state.doc.nodeAt(currentPos);
            if (node && node.type.name === 'imageBlock' && node.attrs.loading && node.attrs.src === localUrl) {
              return currentPos;
            }
            currentPos++;
          }
          return pos;
        };
  
        const nodePos = findNodePos();
        
        // Update error state with a non-undoable transaction
        this.editor.view.dispatch(
          this.editor.state.tr
            .setMeta('addToHistory', false)
            .setNodeMarkup(nodePos, undefined, { 
              loading: false, 
              error: errorMessage 
            })
        );
  
        // Clean up the local URL in case of error
        if (localUrl) {
          URL.revokeObjectURL(localUrl);
          this.localImageUrls.delete(localUrl);
        }
      }
    }
}