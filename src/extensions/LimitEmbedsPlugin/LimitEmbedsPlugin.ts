import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Extension } from '@tiptap/core';
import { getEmbedNodeProps } from '@/lib/utils/isCustomNodeSelected';

export const LimitEmbedsPlugin = (maxEmbeddings?: number) =>
  Extension.create({
    name: 'limitEmbeds',
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: new PluginKey('limitEmbeds'),
          filterTransaction: (tr, state) => {
            if (maxEmbeddings == null || maxEmbeddings <= 0) return true;
            
            const newDoc = tr.doc; 
            let embedCount = 0;
            newDoc.descendants(node => {
              const { isEmbed } = getEmbedNodeProps(node);
              if (isEmbed) embedCount++;
            });
            // 넘으면 차단
            return embedCount <= maxEmbeddings;
          },
          appendTransaction: (txs, oldState, newState) => {
            const blocked = oldState.doc.eq(newState.doc) === false
              && newState.doc.content.size === oldState.doc.content.size;
            if (blocked) {
              // TODO: 경고 트랜잭션(토스트 등) 발행 가능
            }
            return null;
          },
        })
      ];
    },
  });
