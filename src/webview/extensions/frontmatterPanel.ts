/**
 * Front Matter Panel Extension
 *
 * A custom TipTap node (`frontmatterBlock`) that renders YAML front matter as a
 * collapsible panel at the top of the document.
 *
 * Design:
 *  - YAML is stored as actual text content inside the node (like a code block),
 *    NOT in an attribute. ProseMirror manages the text via `contentDOM` so
 *    cut/copy/paste/undo all work natively — identical to how code blocks work.
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
  content: 'text*', // YAML stored as real text — enables native cut/copy/paste
  marks: '',
  code: true, // Disables smart quotes, auto-pairs, etc.
  selectable: false,
  draggable: false,

  parseHTML() {
    return [{ tag: 'div[data-type="frontmatter"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes({ 'data-type': 'frontmatter', class: 'frontmatter-block' }, HTMLAttributes),
      ['pre', ['code', { class: 'language-yaml' }, 0]],
    ];
  },

  addNodeView() {
    return ({ node }: { node: any }) => {
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

      // ── Content area: ProseMirror-managed <pre><code> via contentDOM ──
      const content = document.createElement('div');
      content.className = 'frontmatter-content-wrap';

      const pre = document.createElement('pre');
      pre.className = 'code-block-highlighted frontmatter-pre';

      const code = document.createElement('code');
      code.className = 'language-yaml';
      code.setAttribute('spellcheck', 'false');
      code.setAttribute('aria-label', 'Front matter YAML content');

      pre.appendChild(code);
      content.appendChild(pre);
      dom.appendChild(header);
      dom.appendChild(content);

      const wasEmpty = !node.textContent?.trim();

      // ── Toggle ──
      const applyState = () => {
        content.style.display = isOpen ? '' : 'none';
        triangle.style.transform = isOpen ? 'rotate(90deg)' : '';

        if (isOpen && wasEmpty) {
          setTimeout(() => code.focus(), 0);
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

      header.addEventListener('mousedown', e => e.stopPropagation());

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
        contentDOM: code, // ProseMirror owns this element — cut/copy/paste work natively
        stopEvent: (event: Event) => {
          const target = event.target as HTMLElement | null;
          return Boolean(target?.closest('.frontmatter-block-header'));
        },
        update: (updatedNode: any) => {
          if (updatedNode.type.name !== 'frontmatterBlock') return false;
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
  return frontmatterNode.textContent || '';
}
