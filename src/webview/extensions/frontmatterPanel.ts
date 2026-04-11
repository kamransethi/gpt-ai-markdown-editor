/**
 * Front Matter Panel Extension
 *
 * A custom TipTap node (`frontmatterBlock`) that renders YAML front matter as a
 * collapsible `<details>` panel at the top of the document.
 *
 * Design:
 *  - The node wraps a codeBlock containing the raw YAML text.
 *  - `renderMarkdown` returns '' so the node is invisible to the markdown
 *    serializer; front matter is restored by `restoreFrontmatter()` instead.
 *  - No `parseMarkdown` is defined — the node is never created from markdown
 *    tokens (front matter is stripped before TipTap sees the content).
 */

import { Node, mergeAttributes } from '@tiptap/core';
import type { JSONContent } from '@tiptap/core';
import type { Node as PmNode } from '@tiptap/pm/model';
import hljs from 'highlight.js/lib/core';
import yaml from 'highlight.js/lib/languages/yaml';

// Register YAML language for syntax highlighting
hljs.registerLanguage('yaml', yaml);

export const FrontmatterBlock = Node.create({
  name: 'frontmatterBlock',
  group: 'block',
  atom: true, // No children — YAML lives in the `yaml` attribute
  selectable: false,
  draggable: false,

  addAttributes() {
    return {
      yaml: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="frontmatter"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes({ 'data-type': 'frontmatter', class: 'frontmatter-block' }, HTMLAttributes),
    ];
  },

  addNodeView() {
    return ({ node, editor, getPos }: { node: any; editor: any; getPos: any }) => {
      let isOpen = false;

      const dom = document.createElement('div');
      dom.className = 'frontmatter-block';

      // ── Header ──
      const header = document.createElement('div');
      header.className = 'frontmatter-block-header';
      header.setAttribute('role', 'button');
      header.setAttribute('tabindex', '0');

      const triangle = document.createElement('span');
      triangle.className = 'frontmatter-triangle';
      triangle.textContent = '▶';

      const label = document.createElement('span');
      label.className = 'frontmatter-label';
      label.textContent = 'FRONT MATTER';

      header.appendChild(triangle);
      header.appendChild(label);

      // ── Content area: single <pre><code> that's contentEditable ──
      const content = document.createElement('div');
      content.className = 'frontmatter-content-wrap';

      const pre = document.createElement('pre');
      pre.className = 'code-block-highlighted';

      const code = document.createElement('code');
      code.className = 'language-yaml hljs';
      code.contentEditable = 'true';
      code.spellcheck = false;
      code.setAttribute('role', 'textbox');
      code.setAttribute('aria-label', 'Front matter YAML content');

      const yamlText = (node.attrs.yaml as string) || '';
      const highlighted = hljs.highlight(yamlText, { language: 'yaml' });
      code.innerHTML = highlighted.value;

      pre.appendChild(code);
      content.appendChild(pre);
      dom.appendChild(header);
      dom.appendChild(content);

      const wasEmpty = !yamlText.trim();

      // ── Update highlighting while preserving cursor position ──
      const updateHighlight = (text: string) => {
        const selection = window.getSelection();
        let offset = 0;
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const preRange = document.createRange();
          preRange.selectNodeContents(code);
          preRange.setEnd(range.endContainer, range.endOffset);
          offset = preRange.toString().length;
        }

        const highlighted = hljs.highlight(text, { language: 'yaml' });
        code.innerHTML = highlighted.value;

        // Restore cursor
        try {
          const textNodes: globalThis.Node[] = [];
          const walk = document.createTreeWalker(code, NodeFilter.SHOW_TEXT, null);
          let textNode: globalThis.Node | null;
          while ((textNode = walk.nextNode())) {
            textNodes.push(textNode);
          }

          let currentOffset = 0;
          for (const textNode of textNodes) {
            const textLen = (textNode as Text).textContent?.length ?? 0;
            if (currentOffset + textLen >= offset) {
              const posInNode = offset - currentOffset;
              const range = document.createRange();
              range.setStart(textNode as Text, Math.min(posInNode, textLen));
              range.collapse(true);
              selection?.removeAllRanges();
              selection?.addRange(range);
              break;
            }
            currentOffset += textLen;
          }
        } catch {
          // Cursor restoration optional
        }
      };

      // ── Input handler ──
      const handleInput = () => {
        const pos = getPos();
        if (typeof pos !== 'number') return;

        const plainText = code.innerText || '';
        updateHighlight(plainText);

        const transaction = editor.state.tr.setNodeMarkup(pos, undefined, { yaml: plainText });
        editor.view.dispatch(transaction);
      };

      code.addEventListener('input', handleInput);
      code.addEventListener('mousedown', e => e.stopPropagation());
      code.addEventListener('keydown', e => e.stopPropagation());
      header.addEventListener('mousedown', e => e.stopPropagation());

      // ── Toggle ──
      const applyState = () => {
        content.style.display = isOpen ? '' : 'none';
        triangle.style.transform = isOpen ? 'rotate(90deg)' : '';

        if (isOpen && wasEmpty) {
          setTimeout(() => {
            code.focus();
            const range = document.createRange();
            range.selectNodeContents(code);
            range.collapse(true);
            const selection = window.getSelection();
            selection?.removeAllRanges();
            selection?.addRange(range);
          }, 0);
        }
      };
      applyState();

      header.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        isOpen = !isOpen;
        applyState();
      });

      header.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          isOpen = !isOpen;
          applyState();
        }
      });

      (dom as any)._fmToggle = () => {
        isOpen = !isOpen;
        applyState();
      };
      (dom as any)._fmOpen = (val: boolean) => {
        isOpen = val;
        applyState();
      };
      (dom as any)._fmIsOpen = () => isOpen;

      return {
        dom,
        update: (updatedNode: any) => {
          if (updatedNode.type.name !== 'frontmatterBlock') return false;
          const yamlText = (updatedNode.attrs.yaml as string) || '';
          const highlighted = hljs.highlight(yamlText, { language: 'yaml' });
          code.innerHTML = highlighted.value;
          return true;
        },
      };
    };
  },

  // Invisible to the markdown serializer — `currentFrontmatter` is used instead
  renderMarkdown(_node: JSONContent) {
    return '';
  },
});

export function isFrontmatterBlock(node: PmNode | null | undefined): boolean {
  return !!node && node.type.name === 'frontmatterBlock';
}

export function extractFrontmatterText(frontmatterNode: PmNode): string {
  return (frontmatterNode.attrs.yaml as string) || '';
}
