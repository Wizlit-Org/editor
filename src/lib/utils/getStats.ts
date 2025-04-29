import { EditorStats } from "@/components/BlockEditor/BlockEditor";
import { Editor } from "@tiptap/core";
import { getEmbedNodeProps } from "./isCustomNodeSelected";

export const getAnnotatedText = (html: string): string => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
  
    const walk = (node: ChildNode): string => {
      // Text node → literal text
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent || '';
      }
      // Element node → recurse or emit token
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
  
        // Collect all data-* attributes
        const dataAttrs = Array.from(el.attributes)
          .filter(attr => attr.name.startsWith('data-'))
          .map(attr => `${attr.name}=${attr.value}`)
          .join(' ');
  
        // If this is an embed, emit a single token
        if (el.tagName === 'IMG') {
          const src = (el as HTMLImageElement).src;
          const withAttrs = dataAttrs ? ` [[${src} ${dataAttrs}]]` : ` [[${src}]]`;
          return withAttrs;
        }
        if (el.tagName === 'IFRAME') {
          const src = (el as HTMLIFrameElement).src;
          return ` [[${src}]]`;
        }
        if (el.tagName === 'CODE') {
          const lang = (el as HTMLPreElement).classList.contains('language-') ? (el as HTMLPreElement).classList.item(1) : '';
          return ` [[${lang}]]` + node.textContent;
        }
  
        // Otherwise, descend into children in order
        let acc = '';
        el.childNodes.forEach(child => {
          acc += walk(child);
        });
        return acc;
      }
      return '';
    };
  
    const annotated = walk(doc.body).trim();
    return annotated;
};

export const getStats = (editor: Editor, maxCharacters?: number, altCharacterCounter: boolean = false): EditorStats => {
    // 1) Build annotated plain text (includes data-* tokens inline)
    const text = editor.state.doc.textContent
    const annotated = getAnnotatedText(editor.getHTML() || '');
  
    // 2) Character & word count over the annotated string
    const characters = altCharacterCounter ? text.length : editor.storage.characterCount.characters();
    const words = altCharacterCounter ? text.trim().split(/\s+/).filter(Boolean).length : editor.storage.characterCount.words();
    const percentage = maxCharacters
      ? Math.round((100 * characters) / maxCharacters)
      : 0;
    
    let embedCount = 0
    let embedList: string[] = []
    editor.state.doc.descendants(node => {
      const { isEmbed, url } = getEmbedNodeProps(node);
      if (isEmbed) {
        embedCount++;
        embedList.push(url);
      }
    });

    return { characters, words, percentage, embedCount, embedList, plainText: annotated }
}

export const trimHTML = (html: string): string => {
    // Remove multiple consecutive empty paragraph tags from start
    let trimmed = html.trim().replace(/^(<p>\s*<\/p>)+/i, '');
    // Remove multiple consecutive empty paragraph tags from end
    trimmed = trimmed.replace(/(<p>\s*<\/p>)+$/i, '');
    return trimmed;
}

export const getDoc = (html: string): { text: string, html: string } => {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const htmlContent = doc.body.innerHTML || '';
    
    return {
      text: getAnnotatedText(html),
      html: trimHTML(htmlContent),
    }
}

export const compareDocs = (
  originalHTML: string,
  compareHTML: string,
): {
  isChanged: boolean,
  isStrictChanged: boolean,
  originalText: string,
  originalHTML: string,
  compareText: string,
  compareHTML: string
} => {
    const { text: finalOriginalText, html: finalOriginalHTML } = getDoc(originalHTML);
    const { text: finalCompareText, html: finalCompareHTML } = getDoc(compareHTML);
  
    const isChanged = finalCompareHTML.localeCompare(finalOriginalHTML.trim()) !== 0;
    const isStrictChanged = finalCompareText.localeCompare(finalOriginalText.trim()) !== 0;

    return {
      isChanged,
      isStrictChanged,
      originalText: finalOriginalText,
      originalHTML: finalOriginalHTML,
      compareText: finalCompareText,
      compareHTML: finalCompareHTML
    };
}