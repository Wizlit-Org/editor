import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Editor, NodeViewWrapper } from '@tiptap/react';
import { Node } from '@tiptap/pm/model';
import { cn } from '@/lib/utils';
import type { NodeViewProps } from '@tiptap/react';
import { Icon } from '@/components/ui/Icon';

interface ImageBlockViewProps extends NodeViewProps {
  editor: Editor;
  getPos: () => number;
  node: Node & { attrs: { src: string; align?: string; width?: string } };
  updateAttributes: (attrs: Record<string, any>) => void;
}

export type ConvertSrc = (src: string) => (Promise<string> | string) | 'EXTERNAL_IMAGE';
export type OnImageClick = (url: string, event: React.MouseEvent<HTMLDivElement>) => void;

export const ImageBlockView: React.FC<ImageBlockViewProps> = ({
  editor,
  getPos,
  node,
  extension,
}) => {
  const { src: rawSrc, align, width } = node.attrs;
  const { onImageClick, convertSrc } = extension.options;
  const editorEditable = editor.isEditable;

  const originalSrc = rawSrc?.match(/^https?:\/\//) ? rawSrc : undefined;
  const [src, setSrc] = useState<string | 'EXTERNAL_IMAGE' | undefined>(originalSrc);
  const [loaded, setLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

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

  const wrapperClassName = cn(
    align === 'left' ? 'mr-auto ml-0' : '',
    align === 'right' ? 'ml-auto mr-0' : '',
    align === 'center' ? 'mx-auto' : '',
    'relative transition-all duration-300 max-w-full',
    !(editorEditable || isExternalImage) ? 'active:scale-[0.98]' : ''
  );

  return (
    <NodeViewWrapper className="my-4 block">
      <div
        className={wrapperClassName}
        style={{
          width: width && width !== 'auto' ? width : 'fit-content',
          maxWidth: '100%',
        }}
        data-drag-handle
      >
        {/* Glassmorphism Pulse Skeleton UI (로딩 중에만 표시) */}
        {!finalLoaded && (
          <div className="w-full min-h-[160px] aspect-video rounded-xl bg-black/5 dark:bg-white/5 backdrop-blur-md animate-pulse border border-black/5 dark:border-white/10 flex items-center justify-center">
            <Icon name="Image" className="w-8 h-8 text-zinc-400/40 dark:text-zinc-500/40" />
          </div>
        )}

        {/* 원본 사이즈 자연스러운 이미지 렌더링 (로드 완료 시 박스 없이 깔끔하게 표시) */}
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
              'max-w-full h-auto rounded-lg transition-opacity duration-300',
              finalLoaded && !hasError ? 'opacity-100 block' : 'opacity-0 hidden',
              !editorEditable ? 'cursor-pointer' : ''
            )}
            style={{
              maxHeight: '75vh',
              objectFit: 'contain',
            }}
            draggable={editorEditable}
          />
        )}

        {/* '이미지 없음' 글라스 카드 폴백 UI (에러/부재 시) */}
        {hasError && !isExternalImage && (
          <div className="w-full min-h-[160px] flex flex-col items-center justify-center bg-black/[0.03] dark:bg-white/[0.04] backdrop-blur-md text-zinc-500 dark:text-zinc-400 rounded-xl p-8 border border-black/10 dark:border-white/15">
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

        {/* '외부 이미지' 소형 글라스 칩 (우측 상단 모서리) */}
        {isExternalImage && (
          <div className="relative min-h-[140px] flex flex-col items-center justify-center bg-black/[0.03] dark:bg-white/[0.04] backdrop-blur-md rounded-xl p-6 border border-black/10 dark:border-white/15">
            <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-black/60 dark:bg-black/70 backdrop-blur-md text-white border border-white/20 shadow-md flex items-center gap-1 select-none pointer-events-none">
              <Icon name="Link2" className="w-3 h-3 text-white/80" />
              <span>외부 이미지</span>
            </div>
            <Icon name="Image" className="w-8 h-8 text-zinc-400/50 mb-2" />
            <span className="text-xs text-zinc-500">외부 이미지 로드됨</span>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
};

export default ImageBlockView;