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
  content: 'block+',
  atom: false,
  draggable: false,
  selectable: false,
  isolating: true,

  addAttributes() {
    return {
      open: {
        default: false,
        parseHTML: (element: HTMLElement) => element.hasAttribute('open'),
        renderHTML: (attrs: Record<string, unknown>) => {
          return attrs.open ? { open: '' } : {};
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'details[data-type="frontmatter"]',
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const openAttr = node.attrs.open ? { open: '' } : {};
    return [
      'details',
      mergeAttributes(
        { class: 'frontmatter-details', 'data-type': 'frontmatter' },
        openAttr,
        HTMLAttributes
      ),
      ['summary', { class: 'frontmatter-summary' },
        ['span', { class: 'frontmatter-label' }, 'FRONT MATTER'],
      ],
      ['div', { class: 'frontmatter-content' }, 0],
    ];
  },

  // Return empty string — front matter is managed by `currentFrontmatter` in
  // editor.ts and restored via `restoreFrontmatter()` on every save.
  renderMarkdown(_node: JSONContent) {
    return '';
  },
});

/**
 * Return true if the given ProseMirror node is the front matter block.
 */
export function isFrontmatterBlock(node: PmNode | null | undefined): boolean {
  return !!node && node.type.name === 'frontmatterBlock';
}

/**
 * Extract raw YAML text from a frontmatterBlock node.
 * Walks the block's children and joins their text content.
 */
export function extractFrontmatterText(frontmatterNode: PmNode): string {
  const lines: string[] = [];
  frontmatterNode.forEach((child: PmNode) => {
    lines.push(child.textContent);
  });
  return lines.join('\n');
}
