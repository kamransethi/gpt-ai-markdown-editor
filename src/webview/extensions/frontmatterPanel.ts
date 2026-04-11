import { mergeAttributes } from '@tiptap/core';
import type { JSONContent } from '@tiptap/core';
import type { Node as PmNode } from '@tiptap/pm/model';
import { CodeBlock } from '@tiptap/extension-code-block';

/**
 * Front Matter Panel Extension
 *
 * Implements a simple, robust structure mirroring standard CodeBlocks.
 * Starts collapsed by default, fully editable text area when expanded.
 */
export const FrontmatterBlock = CodeBlock.extend({
  name: 'frontmatterBlock',

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
    return () => {
      let isOpen = false;

      const dom = document.createElement('div');
      dom.className = 'frontmatter-block code-block-ui';
      dom.style.marginTop = '0';
      dom.style.marginBottom = '1.5em';

      // ── Header ──
      const header = document.createElement('div');
      header.className = 'code-block-ui-header';
      header.style.cursor = 'pointer';
      header.contentEditable = 'false'; // IMPORTANT: prevent ProseMirror from eating clicks here

      const title = document.createElement('span');
      title.className = 'mermaid-code-title frontmatter-label';
      title.textContent = 'FRONT MATTER (YAML)';
      title.style.marginRight = 'auto';
      title.style.fontWeight = 'bold';
      title.style.fontSize = '11px';
      title.style.color = 'var(--md-muted)';

      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = 'code-block-ui-copy frontmatter-triangle';
      toggleBtn.textContent = 'Show';

      header.appendChild(title);
      header.appendChild(toggleBtn);

      // ── Content area ──
      const content = document.createElement('div');
      content.className = 'frontmatter-content-wrap';
      content.style.display = 'none';

      const pre = document.createElement('pre');
      pre.className = 'code-block-highlighted code-block-ui-pre frontmatter-pre';
      pre.style.marginTop = '0';
      pre.style.borderTopLeftRadius = '0';
      pre.style.borderTopRightRadius = '0';
      pre.style.borderTop = 'none';

      const code = document.createElement('code');
      code.className = 'language-yaml hljs';
      code.setAttribute('spellcheck', 'false');

      pre.appendChild(code);
      content.appendChild(pre);
      dom.appendChild(header);
      dom.appendChild(content);

      const applyState = () => {
        content.style.display = isOpen ? 'block' : 'none';
        toggleBtn.textContent = isOpen ? 'Hide' : 'Show';
      };

      const toggle = (e?: Event) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        isOpen = !isOpen;
        applyState();
        if (isOpen) {
          setTimeout(() => {
            code.focus();
          }, 50);
        }
      };

      header.addEventListener('mousedown', e => {
        e.preventDefault();
        e.stopPropagation();
      });
      header.addEventListener('click', toggle);

      toggleBtn.addEventListener('mousedown', e => {
        e.preventDefault();
        e.stopPropagation();
      });
      toggleBtn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      });

      (dom as any)._fmToggle = toggle;
      (dom as any)._fmOpen = (val: boolean) => {
        isOpen = val;
        applyState();
      };
      (dom as any)._fmIsOpen = () => isOpen;

      return {
        dom,
        contentDOM: code, // Native ProseMirror editing!
        stopEvent: (event: Event) => {
          const target = event.target as HTMLElement | null;
          return Boolean(target?.closest('.code-block-ui-header'));
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
  // ProseMirror code blocks natively store their contents as text elements
  return frontmatterNode.textContent || '';
}
