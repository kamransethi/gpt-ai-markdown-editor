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

      // ── Content area: plain textarea (reliable cut/copy/paste) ──
      const content = document.createElement('div');
      content.className = 'frontmatter-content-wrap';

      const textarea = document.createElement('textarea');
      textarea.className = 'frontmatter-textarea';
      textarea.spellcheck = false;
      textarea.setAttribute('aria-label', 'Front matter YAML content');

      const yamlText = (node.attrs.yaml as string) || '';
      textarea.value = yamlText;

      content.appendChild(textarea);
      dom.appendChild(header);
      dom.appendChild(content);

      const wasEmpty = !yamlText.trim();

      // Auto-resize to fit content
      const autoResize = () => {
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
      };

      // ── Input handler ──
      const handleInput = () => {
        const pos = getPos();
        if (typeof pos !== 'number') return;
        autoResize();
        const transaction = editor.state.tr.setNodeMarkup(pos, undefined, { yaml: textarea.value });
        editor.view.dispatch(transaction);
      };

      textarea.addEventListener('input', handleInput);
      textarea.addEventListener('mousedown', e => e.stopPropagation());
      textarea.addEventListener('keydown', e => e.stopPropagation());
      header.addEventListener('mousedown', e => e.stopPropagation());

      // ── Toggle ──
      const applyState = () => {
        content.style.display = isOpen ? '' : 'none';
        triangle.style.transform = isOpen ? 'rotate(90deg)' : '';

        if (isOpen) {
          autoResize();
        }
        if (isOpen && wasEmpty) {
          setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(0, 0);
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
          // Don't clobber active user edits
          if (document.activeElement !== textarea) {
            textarea.value = (updatedNode.attrs.yaml as string) || '';
            autoResize();
          }
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
