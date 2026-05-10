/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

/**
 * @file codeBlockShikiWithUi.ts
 * @description Extends CodeBlockLowlight with a NodeView that renders a language-select
 *   dropdown and copy button above the code block.
 *
 * CodeBlockLowlight inherits from @tiptap/extension-code-block, which provides:
 *   - markdownTokenName: 'code'  → @tiptap/markdown matches `code` tokens to this node
 *   - parseMarkdown              → converts marked tokens into codeBlock nodes
 *   - renderMarkdown             → serializes codeBlock nodes to fenced markdown
 *
 * tiptap-extension-code-block-shiki (CodeBlockShiki) is a standalone Node.create()
 * that lacks all three, causing code blocks to silently vanish on parse and save.
 */

import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import type { MarkdownParseHelpers, MarkdownToken } from '@tiptap/core';

const CODE_BLOCK_LANGUAGES = [
  { value: 'plaintext', label: 'Plain Text' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'bash', label: 'Bash' },
  { value: 'json', label: 'JSON' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'css', label: 'CSS' },
  { value: 'html', label: 'HTML' },
  { value: 'sql', label: 'SQL' },
  { value: 'java', label: 'Java' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'mermaid', label: 'Mermaid' },
];

async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // Fallback for environments without Clipboard API
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

export const CodeBlockWithUi = CodeBlockLowlight.extend({
  /**
   * Override parseMarkdown to accept fenced code blocks whose `raw` has leading whitespace.
   *
   * marked.js v13+ (CommonMark-compliant) requires continuation content in ordered lists
   * to be indented by the full marker width (e.g. 3 spaces for "2. "). A fenced code block
   * indented with only 2 spaces is parsed as a top-level block, but marked preserves the
   * indentation in `token.raw` (e.g. "  ```bash\n..."). The inherited @tiptap/extension-code-block
   * parseMarkdown checks `raw.startsWith("```")`, which fails for indented raw, silently
   * dropping the code block. Trimming before the check fixes this.
   */
  parseMarkdown: (token: MarkdownToken, helpers: MarkdownParseHelpers) => {
    if (token.type !== 'code') return [];
    const raw = (token.raw as string) ?? '';
    const trimmed = raw.trimStart();
    if (!trimmed.startsWith('```') && !trimmed.startsWith('~~~') && token.codeBlockStyle !== 'indented') {
      return [];
    }
    const text = (token.text as string) ?? '';
    return helpers.createNode(
      'codeBlock',
      { language: (token.lang as string) || null },
      text ? [helpers.createTextNode(text)] : []
    );
  },

  addNodeView() {
    return ({ node, getPos, editor }: any) => {
      let currentNode = node;

      const dom = document.createElement('div');
      dom.className = 'code-block-ui';

      const header = document.createElement('div');
      header.className = 'code-block-ui-header';

      // Language selector dropdown
      const languageSelect = document.createElement('select');
      languageSelect.className = 'code-block-ui-language';
      languageSelect.setAttribute('aria-label', 'Code block language');
      CODE_BLOCK_LANGUAGES.forEach(lang => {
        const option = document.createElement('option');
        option.value = lang.value;
        option.textContent = lang.label;
        languageSelect.appendChild(option);
      });
      languageSelect.value = (currentNode.attrs.language as string) || 'plaintext';

      // Copy button
      const copyButton = document.createElement('button');
      copyButton.type = 'button';
      copyButton.className = 'code-block-ui-copy';
      copyButton.textContent = 'Copy';

      // Content area — lowlight decorations highlight inside this <code> element
      const pre = document.createElement('pre');
      pre.className = 'code-block-highlighted code-block-ui-pre';

      const code = document.createElement('code');
      code.className = `language-${(currentNode.attrs.language as string) || 'plaintext'}`;
      pre.appendChild(code);

      header.appendChild(languageSelect);
      header.appendChild(copyButton);
      dom.appendChild(header);
      dom.appendChild(pre);

      // Language change dispatches a node attribute update
      languageSelect.addEventListener('change', () => {
        const pos = getPos();
        if (typeof pos !== 'number') return;
        const language = languageSelect.value || 'plaintext';
        const attrs = { ...currentNode.attrs, language };
        const transaction = editor.state.tr.setNodeMarkup(pos, undefined, attrs);
        editor.view.dispatch(transaction);
      });

      // Copy button writes current code text to clipboard
      copyButton.addEventListener('click', async () => {
        await copyTextToClipboard(currentNode.textContent);
        copyButton.textContent = 'Copied';
        window.setTimeout(() => {
          copyButton.textContent = 'Copy';
        }, 1000);
      });

      // Prevent header interactions from being swallowed by ProseMirror
      const stopPropagation = (event: Event) => {
        event.stopPropagation();
      };
      header.addEventListener('click', stopPropagation);
      header.addEventListener('mousedown', stopPropagation);
      languageSelect.addEventListener('keydown', stopPropagation);

      return {
        dom,
        contentDOM: code,
        update: (updatedNode: any) => {
          if (updatedNode.type.name !== this.name) return false;
          currentNode = updatedNode;
          const nextLanguage = (updatedNode.attrs.language as string) || 'plaintext';
          languageSelect.value = nextLanguage;
          code.className = `language-${nextLanguage}`;
          return true;
        },
        stopEvent: (event: Event) => {
          const target = event.target as HTMLElement | null;
          return Boolean(target?.closest('.code-block-ui-header'));
        },
      };
    };
  },
});
