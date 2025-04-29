import React, { useState, useCallback } from 'react';
import { Editor, NodeViewWrapper } from '@tiptap/react';
import { Node } from '@tiptap/pm/model';
import { cn } from '@/lib/utils';

interface ImageBlockViewProps {
  editor: Editor;
  getPos: () => number;
  node: Node & { attrs: { src: string; align?: string; width?: string } };
  updateAttributes: (attrs: Record<string, any>) => void;
}

export const ImageBlockView: React.FC<ImageBlockViewProps> = ({ editor, getPos, node }) => {
  const [loaded, setLoaded] = useState(false);
  const { src, align, width } = node.attrs;

  const wrapperClassName = cn(
    align === 'left' ? 'ml-0' : 'ml-auto',
    align === 'right' ? 'mr-0' : 'mr-auto',
    align === 'center' && 'mx-auto',
    'bg-gray-100 wrapper',
    loaded ? '' : 'animate-pulse'
  );

  const onClick = useCallback(() => {
    editor.commands.setNodeSelection(getPos());
  }, [editor, getPos]);

  return (
    <NodeViewWrapper>
      <div
        className={wrapperClassName}
        style={{
          width: width || '100%',
          aspectRatio: loaded ? undefined : '16/9',
        }}
        data-drag-handle
      >
        <img
          src={src}
          alt=""
          onClick={onClick}
          onLoad={() => setLoaded(true)}
          className={cn(
            'block w-full h-auto transition-opacity duration-300',
            loaded ? 'opacity-100' : 'opacity-0'
          )}
        />
      </div>
    </NodeViewWrapper>
  );
};

export default ImageBlockView;