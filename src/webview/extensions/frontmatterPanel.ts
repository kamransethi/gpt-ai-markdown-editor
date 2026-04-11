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
    return ({ node }: { node: any }) => {
      let isOpen = false;

      const dom = document.createElement('div');
      dom.className = 'frontmatter-block';

      // ── Header (outside contentEditable — click never swallowed by ProseMirror) ──
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

      // ── Content area ──
      const content = document.createElement('div');
      content.className = 'frontmatter-content-wrap';

      const pre = document.createElement('pre');
      pre.className = 'code-block-highlighted';

      const code = document.createElement('code');
      const yamlText = (node.attrs.yaml as string) || '';
      const highlighted = hljs.highlight(yamlText, { language: 'yaml' });
      code.innerHTML = highlighted.value;
      code.className = 'language-yaml hljs';

      pre.appendChild(code);
      content.appendChild(pre);

      dom.appendChild(header);
      dom.appendChild(content);

      // ── Toggle helpers ──
      const applyState = () => {
        content.style.display = isOpen ? '' : 'none';
        triangle.style.transform = isOpen ? 'rotate(90deg)' : '';
      };
      applyState(); // Starts closed

      // Stop ProseMirror seeing mousedown (important — prevents selection steal)
      header.addEventListener('mousedown', e => e.stopPropagation());
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

      // Expose for external callers (toolbar button)
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
        // NO contentDOM — atom node, ProseMirror never touches the internals
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
