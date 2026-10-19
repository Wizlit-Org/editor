import React, { useState, useCallback, useEffect, useRef } from 'react';
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

export const ImageBlockView: React.FC<ImageBlockViewProps> = ({ editor, getPos, node, extension, updateAttributes, selected }) => {
  const { src: rawSrc, align, width } = node.attrs;
  const { onImageClick, convertSrc } = extension.options;
  const editorEditable = editor.isEditable;

  const originalSrc = rawSrc?.match(/^https?:\/\//) ? rawSrc : undefined;
  const [src, setSrc] = useState<string | 'EXTERNAL_IMAGE' | undefined>(originalSrc);
  const [loaded, setLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [resizing, setResizing] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleResizeStart = useCallback(
    (direction: 'left' | 'right') => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!editorEditable) return;

      setResizing(true);
      const startX = e.clientX;
      const startRect = containerRef.current?.getBoundingClientRect();
      const parentWidth = containerRef.current?.parentElement?.clientWidth || 800;
      const startWidthPx = startRect?.width || parentWidth;

      const onMouseMove = (moveEvent: MouseEvent) => {
        moveEvent.preventDefault();
        const deltaX = moveEvent.clientX - startX;
        const multiplier = align === 'center' ? 2 : 1;
        const delta = direction === 'right' ? deltaX * multiplier : -deltaX * multiplier;
        const newWidthPx = Math.max(160, Math.min(parentWidth, startWidthPx + delta));
        const newWidthPercent = Math.min(100, Math.max(20, Math.round((newWidthPx / parentWidth) * 100)));
        updateAttributes({ width: `${newWidthPercent}%` });
      };

      const onMouseUp = () => {
        setResizing(false);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [align, editorEditable, updateAttributes]
  );

  useEffect(() => {
    setLoaded(false);
    setHasError(false);
    if (convertSrc && rawSrc) {
      Promise.resolve(convertSrc(rawSrc))
        .then(resolved => setSrc(resolved))
        .catch(() => {
          setHasError(true);
          setLoaded(true);
        });
    } else if (rawSrc) {
      setSrc(rawSrc);
    }
  }, [convertSrc, rawSrc]);

  // Handle cached images
  useEffect(() => {
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [src]);

  const isExternalImage = src === 'EXTERNAL_IMAGE';
  const finalLoaded = isExternalImage ? true : (loaded || hasError);

  const wrapperClassName = cn(
    align === 'left' ? 'ml-0' : 'ml-auto',
    align === 'right' ? 'mr-0' : 'mr-auto',
    align === 'center' && 'mx-auto',
    'group relative rounded-lg overflow-hidden wrapper transition-all duration-300',
    selected && 'ring-2 ring-indigo-500/70 dark:ring-violet-500/70 shadow-lg',
    !finalLoaded && 'bg-[#080F3B]',
    !(editorEditable || isExternalImage) ? 'active:scale-95' : ''
  );

  const onClick = useCallback((event: React.MouseEvent<HTMLImageElement>) => {
    editor.commands.setNodeSelection(getPos());
    if (onImageClick && !editorEditable && src) {
      onImageClick(src, event as any);
    }
  }, [editor, getPos, onImageClick, editorEditable, src]);

  const handleReupload = useCallback(() => {
    editor.commands.uploadImageByUrl({ url: rawSrc, pos: getPos() });
    editor.chain().focus().deleteRange({ from: getPos(), to: getPos() + 1 }).run();
  }, [editor, rawSrc, getPos]);

  if (!rawSrc) return null;

  return (
    <NodeViewWrapper>
      <style>{`
        @keyframes pulseNavySkeleton {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .image-skeleton-navy {
          animation: pulseNavySkeleton 1.8s ease-in-out infinite;
        }
      `}</style>
      <div
        ref={containerRef}
        className={wrapperClassName}
        style={{
          width: width || '100%',
          aspectRatio: finalLoaded ? undefined : '16/9',
          minHeight: finalLoaded ? undefined : '160px',
          position: 'relative',
        }}
        data-drag-handle
      >
        {/* Dark Navy Shimmer Skeleton UI */}
        <div
          className={cn(
            'image-skeleton-navy absolute inset-0 w-full h-full rounded-lg pointer-events-none transition-opacity duration-300',
            finalLoaded ? 'opacity-0' : 'opacity-100 z-[1]'
          )}
          style={{
            background: 'linear-gradient(90deg, #080F3B 0%, rgba(20, 35, 110, 0.9) 50%, #080F3B 100%)',
            backgroundSize: '200% 100%',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        />

        {src && !isExternalImage && (
          <img
            ref={imgRef}
            src={isExternalImage ? originalSrc : (src as string)}
            alt=""
            loading="lazy"
            onClick={onClick}
            onLoad={() => setLoaded(true)}
            onError={() => {
              setHasError(true);
              setLoaded(true);
            }}
            className={cn(
              'block w-full h-auto rounded-lg transition-opacity duration-300',
              finalLoaded && !hasError ? 'opacity-100' : 'opacity-0',
              !editorEditable ? 'cursor-pointer' : '',
              !finalLoaded ? 'min-h-[160px]' : ''
            )}
            draggable={editorEditable}
          />
        )}

        {hasError && !isExternalImage && (
          <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-[#080F3B] text-slate-400 rounded-lg p-6 border border-white/10 z-[2]">
            <svg
              className="w-10 h-10 mb-2 opacity-40 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <span className="text-xs opacity-60 font-medium">이미지를 불러올 수 없습니다</span>
            {editorEditable && (
              <button
                onClick={handleReupload}
                className="mt-2.5 px-3 py-1 bg-red-500/80 hover:bg-red-600 text-white rounded text-xs transition-colors"
              >
                다시 업로드
              </button>
            )}
          </div>
        )}

        {isExternalImage && (
          <div className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center p-4 text-center p-8 bg-[#080F3B]/90 rounded-lg z-[2]">
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
        {/* Notion-style Left & Right Accent Resize Handles */}
        {editorEditable && finalLoaded && (
          <>
            <div
              onMouseDown={handleResizeStart('left')}
              className={cn(
                'absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-12 rounded-full cursor-ew-resize z-20 transition-all duration-150',
                'bg-indigo-500 hover:bg-indigo-600 dark:bg-violet-500 dark:hover:bg-violet-400 shadow-[0_0_8px_rgba(99,102,241,0.6)]',
                selected || resizing ? 'opacity-100 scale-100' : 'opacity-0 group-hover:opacity-100 scale-90 hover:scale-100'
              )}
              title="Drag to resize image"
            />
            <div
              onMouseDown={handleResizeStart('right')}
              className={cn(
                'absolute right-1.5 top-1/2 -translate-y-1/2 w-1.5 h-12 rounded-full cursor-ew-resize z-20 transition-all duration-150',
                'bg-indigo-500 hover:bg-indigo-600 dark:bg-violet-500 dark:hover:bg-violet-400 shadow-[0_0_8px_rgba(99,102,241,0.6)]',
                selected || resizing ? 'opacity-100 scale-100' : 'opacity-0 group-hover:opacity-100 scale-90 hover:scale-100'
              )}
              title="Drag to resize image"
            />
          </>
        )}
      </div>
    </NodeViewWrapper>
  );
};

export default ImageBlockView;