/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

import Paragraph from '@tiptap/extension-paragraph';
import type { JSONContent, MarkdownRendererHelpers, RenderContext } from '@tiptap/core';

function isMeaningfulTextNode(node: JSONContent): boolean {
  if (node.type !== 'text') return false;
  const text = typeof node.text === 'string' ? node.text : '';
  return text.trim().length > 0;
}

function isMeaningfulInlineNode(node: JSONContent): boolean {
  if (!node || typeof node.type !== 'string') return false;
  if (node.type === 'hardBreak' || node.type === 'hard_break') return false;
  if (node.type === 'text') return isMeaningfulTextNode(node);
  return true;
}

export const MarkdownParagraph = Paragraph.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      blankLine: {
        default: false,
        parseHTML: (el: Element) => el.hasAttribute('data-blank-line'),
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs['blankLine'] ? { 'data-blank-line': '' } : {},
      },
    };
  },

  parseHTML() {
    return [
      // High-priority rule: blank-line placeholder paragraphs
      { tag: 'p[data-blank-line]', priority: 60, getAttrs: () => ({ blankLine: true }) },
      // Default paragraph rule
      { tag: 'p' },
    ];
  },

  renderMarkdown: ((
    node: JSONContent,
    helpers: MarkdownRendererHelpers,
    _context: RenderContext
  ) => {
    // Blank-line placeholder: serialize as an empty string so @tiptap/markdown
    // emits the surrounding \n\n block separators. The serialization post-processor
    // in markdownSerialization.ts then collapses any ≥4 consecutive newlines down
    // to exactly 3 (= one blank line in the saved file).
    // Guard: only skip serialization when the node is actually empty — if the user
    // typed text into the blank-line row the node still carries blankLine:true but
    // now has real content that must not be discarded.
    if (node.attrs?.blankLine === true) {
      const hasMeaningfulContent =
        Array.isArray(node.content) &&
        node.content.some((child: JSONContent) => isMeaningfulInlineNode(child));
      if (!hasMeaningfulContent) {
        return '';
      }
      // Has content — fall through to normal paragraph rendering below
    }

    const content = helpers.renderChildren(node.content || []);

    const hasMeaningfulContent =
      Array.isArray(node.content) &&
      node.content.some((child: JSONContent) => isMeaningfulInlineNode(child));

    if (!hasMeaningfulContent && content.trim() === '') {
      return null;
    }

    return content;
  }) as unknown as (
    node: JSONContent,
    helpers: MarkdownRendererHelpers,
    ctx: RenderContext
  ) => string,
});
