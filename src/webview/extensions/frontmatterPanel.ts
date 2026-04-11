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

      // ── Content area wrapper ──
      const content = document.createElement('div');
      content.className = 'frontmatter-content-wrap';

      // ── Editable textarea ──
      const textarea = document.createElement('textarea');
      textarea.className = 'frontmatter-textarea';
      const yamlText = (node.attrs.yaml as string) || '';
      textarea.value = yamlText;
      textarea.spellcheck = false;

      // ── Syntax-highlighted display (below textarea) ──
      const pre = document.createElement('pre');
      pre.className = 'code-block-highlighted frontmatter-display';

      const code = document.createElement('code');
      const highlighted = hljs.highlight(yamlText, { language: 'yaml' });
      code.innerHTML = highlighted.value;
      code.className = 'language-yaml hljs';

      pre.appendChild(code);

      content.appendChild(textarea);
      content.appendChild(pre);
      dom.appendChild(header);
      dom.appendChild(content);

      // ── Track if frontmatter is empty (newly created) ──
      const wasEmpty = !yamlText.trim();

      // ── Helper to update syntax highlighting ──
      const updateHighlight = (text: string) => {
        const highlighted = hljs.highlight(text, { language: 'yaml' });
        code.innerHTML = highlighted.value;
      };

      // ── Textarea change handler: update node attrs on input ──
      const handleTextareaChange = () => {
        const pos = getPos();
        if (typeof pos !== 'number') return;

        const newText = textarea.value;
        updateHighlight(newText);

        // Update node attributes
        const transaction = editor.state.tr.setNodeMarkup(pos, undefined, {
          yaml: newText,
        });
        editor.view.dispatch(transaction);
      };

      textarea.addEventListener('input', handleTextareaChange);

      // ── Stop ProseMirror seeing mousedown on textarea/header ──
      textarea.addEventListener('mousedown', e => e.stopPropagation());
      header.addEventListener('mousedown', e => e.stopPropagation());

      // ── Toggle helpers ──
      const applyState = () => {
        content.style.display = isOpen ? '' : 'none';
        triangle.style.transform = isOpen ? 'rotate(90deg)' : '';

        // Auto-focus textarea if frontmatter is empty and just opened
        if (isOpen && wasEmpty) {
          setTimeout(() => {
            textarea.focus();
            textarea.select();
          }, 0);
        }
      };
      applyState(); // Starts closed

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
          textarea.value = yamlText;
          updateHighlight(yamlText);
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
