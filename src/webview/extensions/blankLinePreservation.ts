/**
 * Copyright (c) 2025-2026 Concret.io
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

import { Extension } from '@tiptap/core';
import type { JSONContent, MarkdownParseHelpers, MarkdownToken } from '@tiptap/core';

/**
 * Converts marked "space" tokens (extra blank lines between blocks) into empty
 * paragraph nodes so they survive the parse → serialize round-trip.
 *
 * marked emits a "space" token for ALL blank-line gaps between blocks.  Its
 * raw field is the literal whitespace consumed, e.g. "\n\n" for a standard
 * paragraph separation or "\n\n\n" for one extra blank line.  We create one
 * empty paragraph per blank line beyond the standard two-newline separator:
 *
 *   "\n\n"   (2 newlines) → 0 empty paragraphs  (standard gap, no extras)
 *   "\n\n\n" (3 newlines) → 1 empty paragraph   (one extra blank line)
 *   "\n\n\n\n" (4 newlines) → 2 empty paragraphs (two extra blank lines)
 *
 * NOTE: this only handles tokens for which marked actually emits a "space"
 * token. Several block tokenizers in marked greedily consume trailing
 * blank-line whitespace into the block's own raw field (heading, lheading,
 * table, code, hr) — those need to be normalized first by
 * `normalizeBlankLineGreedyTokens` in markedLexerNormalizer.ts.
 */
export const BlankLinePreservation = Extension.create({
  name: 'blankLinePreservation',

  markdownTokenName: 'space',

  parseMarkdown: (token: MarkdownToken, _helpers: MarkdownParseHelpers): JSONContent[] => {
    const raw = (token as { raw?: string }).raw ?? '';
    const newlineCount = (raw.match(/\n/g) ?? []).length;
    // Standard separation is 2 newlines; anything beyond that is extra blank lines.
    const extraBlanks = Math.max(0, newlineCount - 2);
    if (extraBlanks === 0) return [];
    return Array.from({ length: extraBlanks }, () => ({
      type: 'paragraph',
      content: [] as JSONContent[],
    }));
  },
});
