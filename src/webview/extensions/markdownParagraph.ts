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
  renderMarkdown: ((
    node: JSONContent,
    helpers: MarkdownRendererHelpers,
    _context: RenderContext
  ) => {
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
