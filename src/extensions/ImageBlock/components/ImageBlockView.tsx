import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Editor, NodeViewWrapper } from '@tiptap/react';
import { Node } from '@tiptap/pm/model';
import { cn } from '@/lib/utils';
import type { NodeViewProps } from '@tiptap/react'
import { Icon } from '@/components/ui/Icon';

interface ImageBlockViewProps extends NodeViewProps {
  editor: Editor;
  getPos: () => number;
  node: Node & { attrs: { src: string; align?: string; width?: string; caption?: string } };
  updateAttributes: (attrs: Record<string, any>) => void;
}

export type ConvertSrc = (src: string) => (Promise<string> | string) | 'EXTERNAL_IMAGE'
export type OnImageClick = (url: string, event: React.MouseEvent<HTMLDivElement>) => void

export const ImageBlockView: React.FC<ImageBlockViewProps> = ({
  editor,
  getPos,
  node,
  extension,
  updateAttributes,
  selected,
}) => {
  const { src: rawSrc, align, width, caption } = node.attrs;
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
    'group relative rounded-xl overflow-hidden wrapper transition-all duration-300',
    selected && 'ring-2 ring-black/15 dark:ring-white/20 shadow-md',
    !finalLoaded && 'bg-black/5 dark:bg-white/5 backdrop-blur-md',
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
    <NodeViewWrapper className="my-4">
      <div
        ref={containerRef}
        className={wrapperClassName}
        style={{
          width: width === 'auto' ? 'auto' : (width || '100%'),
          maxWidth: '100%',
          aspectRatio: finalLoaded ? undefined : '16/9',
          minHeight: finalLoaded ? undefined : '160px',
          position: 'relative',
        }}
        data-drag-handle
      >
        {/* Glassmorphism Pulse Skeleton UI */}
        <div
          className={cn(
            'absolute inset-0 w-full h-full rounded-xl pointer-events-none transition-opacity duration-300 flex items-center justify-center',
            finalLoaded ? 'opacity-0' : 'opacity-100 z-[1] bg-black/5 dark:bg-white/5 backdrop-blur-md animate-pulse border border-black/5 dark:border-white/10'
          )}
        >
          <Icon name="Image" className="w-8 h-8 text-zinc-400/40 dark:text-zinc-500/40" />
        </div>

        {src && !isExternalImage && (
          <img
            ref={imgRef}
            src={isExternalImage ? originalSrc : (src as string)}
            alt={caption || ''}
            loading="lazy"
            onClick={onClick}
            onLoad={() => setLoaded(true)}
            onError={() => {
              setHasError(true);
              setLoaded(true);
            }}
            className={cn(
              'block w-full h-auto rounded-xl transition-opacity duration-300',
              finalLoaded && !hasError ? 'opacity-100' : 'opacity-0',
              !editorEditable ? 'cursor-pointer' : '',
              !finalLoaded ? 'min-h-[160px]' : ''
            )}
            draggable={editorEditable}
          />
        )}

        {/* '이미지 없음' 글라스 카드 폴백 UI (메인화면 톤앤매너) */}
        {hasError && !isExternalImage && (
          <div className="w-full min-h-[160px] flex flex-col items-center justify-center bg-black/[0.03] dark:bg-white/[0.04] backdrop-blur-md text-zinc-500 dark:text-zinc-400 rounded-xl p-8 border border-black/10 dark:border-white/15 z-[2]">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 mb-2.5">
              <Icon name="Image" className="w-5 h-5 text-zinc-400 dark:text-zinc-500" />
            </div>
            <span className="text-xs font-semibold tracking-wide text-zinc-700 dark:text-zinc-300 mb-1">
              이미지 없음
            </span>
            <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
              이미지를 불러올 수 없거나 삭제되었습니다
            </span>
            {editorEditable && (
              <button
                type="button"
                onClick={handleReupload}
                className="mt-3 px-3 py-1.5 rounded-lg text-xs font-medium bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20 text-zinc-700 dark:text-[#e3e3e3] border border-black/5 dark:border-white/10 transition-colors"
              >
                다시 업로드
              </button>
            )}
          </div>
        )}

        {/* '외부 이미지' 소형 글라스 칩 (우측 상단 모서리 재배치) */}
        {isExternalImage && (
          <div className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-black/60 dark:bg-black/70 backdrop-blur-md text-white border border-white/20 shadow-md z-10 flex items-center gap-1.5 pointer-events-none select-none">
            <Icon name="Link2" className="w-3 h-3 text-white/80" />
            <span>외부 이미지</span>
          </div>
        )}

        {/* Glassmorphism Left & Right Resize Handles */}
        {editorEditable && finalLoaded && (
          <>
            <div
              onMouseDown={handleResizeStart('left')}
              className={cn(
                'absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-12 rounded-full cursor-ew-resize z-20 transition-all duration-150',
                'bg-white/80 hover:bg-white dark:bg-white/30 dark:hover:bg-white/60 border border-black/15 dark:border-white/30 shadow-[0_2px_8px_rgba(0,0,0,0.15)] backdrop-blur-md',
                selected || resizing ? 'opacity-100 scale-100' : 'opacity-0 group-hover:opacity-100 scale-90 hover:scale-100'
              )}
              title="Drag to resize image"
            />
            <div
              onMouseDown={handleResizeStart('right')}
              className={cn(
                'absolute right-2 top-1/2 -translate-y-1/2 w-1.5 h-12 rounded-full cursor-ew-resize z-20 transition-all duration-150',
                'bg-white/80 hover:bg-white dark:bg-white/30 dark:hover:bg-white/60 border border-black/15 dark:border-white/30 shadow-[0_2px_8px_rgba(0,0,0,0.15)] backdrop-blur-md',
                selected || resizing ? 'opacity-100 scale-100' : 'opacity-0 group-hover:opacity-100 scale-90 hover:scale-100'
              )}
              title="Drag to resize image"
            />
          </>
        )}
      </div>

      {/* Notion-style Image Caption Input */}
      {(editorEditable || caption) && (
        <div className="mt-2 text-center w-full max-w-full">
          {editorEditable ? (
            <input
              type="text"
              value={caption || ''}
              onChange={(e) => updateAttributes({ caption: e.target.value })}
              placeholder="캡션 추가..."
              className="w-full text-center text-xs text-zinc-600 dark:text-zinc-400 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 bg-transparent border-none outline-none focus:outline-none transition-colors"
            />
          ) : (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 italic">
              {caption}
            </p>
          )}
        </div>
      )}
    </NodeViewWrapper>
  );
};

export default ImageBlockView;