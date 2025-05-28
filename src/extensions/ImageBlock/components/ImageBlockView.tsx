import React, { useState, useCallback, useEffect } from 'react';
import { Editor, NodeViewWrapper } from '@tiptap/react';
import { Node } from '@tiptap/pm/model';
import { cn } from '@/lib/utils';
import type { NodeViewProps } from '@tiptap/react'

interface ImageBlockViewProps extends NodeViewProps {
  editor: Editor;
  getPos: () => number;
  node: Node & { attrs: { src: string; align?: string; width?: string } };
  updateAttributes: (attrs: Record<string, any>) => void;
}

export type ConvertSrc = (src: string) => (Promise<string> | string) | 'EXTERNAL_IMAGE'
export type OnImageClick = (url: string, event: React.MouseEvent<HTMLDivElement>) => void

export const ImageBlockView: React.FC<ImageBlockViewProps> = ({ editor, getPos, node, extension }) => {
  const { src: rawSrc, align, width } = node.attrs;
  const { onImageClick, convertSrc } = extension.options;
  const editorEditable = editor.isEditable;

  const originalSrc = rawSrc.match(/^https?:\/\//) ? rawSrc : undefined;
  const [src, setSrc] = useState<string | 'EXTERNAL_IMAGE' | undefined>(originalSrc);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (convertSrc) {
      Promise.resolve(convertSrc(rawSrc)).then(setSrc);
    }
  }, [convertSrc, rawSrc]);
  
  const isExternalImage = src === "EXTERNAL_IMAGE";

  const finalLoaded = isExternalImage ? true : loaded;

  const wrapperClassName = cn(
    align === 'left' ? 'ml-0' : 'ml-auto',
    align === 'right' ? 'mr-0' : 'mr-auto',
    align === 'center' && 'mx-auto',
    'bg-gray-100 wrapper',
    finalLoaded ? '' : 'animate-pulse',
    !(editorEditable || isExternalImage) ? 'active:scale-95' : ''
  );

  const onClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    editor.commands.setNodeSelection(getPos());
    if (onImageClick && !editorEditable) {
      onImageClick(src, event);
    }
  }, [editor, getPos, onImageClick, src]);

  const handleReupload = useCallback(() => {
    editor.commands.uploadImageByUrl({ url: rawSrc, pos: getPos() });
    editor.chain().focus().deleteRange({ from: getPos(), to: getPos() + 1 }).run();
  }, [editor, rawSrc, getPos]);

  if (!src) return null;
  return (
    <NodeViewWrapper>
      <div
        className={wrapperClassName}
        style={{
          width: width || '100%',
          aspectRatio: finalLoaded ? undefined : '16/9',
          position: 'relative',
        }}
        data-drag-handle
      >
        <img
          src={isExternalImage ? originalSrc : src as string}
          alt=""
          loading="lazy"
          onClick={onClick}
          onLoad={() => setLoaded(true)}
          className={cn(
            'block w-full h-auto transition duration-300',
            finalLoaded ? 'opacity-100' : 'opacity-0',
            !editorEditable ? 'cursor-pointer' : '',
            isExternalImage ? 'opacity-20' : ''
          )}
        />
        {isExternalImage && (
          <div className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center p-4 text-center p-8">
            <svg className="w-12 h-12 text-gray-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="mb-2 text-sm text-gray-400">External image not available</div>
            {editorEditable && (
              <button
                onClick={handleReupload}
                className="mt-3 px-2 py-1.5 bg-red-500 text-white rounded hover:bg-red-600 transition-colors text-xs"
              >
                Upload again
              </button>
            )}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
};

export default ImageBlockView;