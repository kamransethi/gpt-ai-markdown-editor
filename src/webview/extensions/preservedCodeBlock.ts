/**
 * Copyright (c) 2025-2026 Concret.io
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

import type {
  JSONContent,
  MarkdownParseHelpers,
  MarkdownRendererHelpers,
  MarkdownToken,
} from '@tiptap/core';

/**
 * Custom markdown parse/render handlers for `codeBlock` that fix two issues in the
 * default @tiptap/extension-code-block implementation:
 *
 * 1. Fenced code blocks with 1-3 leading spaces of indentation were silently dropped
 *    because the default check `token.raw.startsWith('```')` ignores the CommonMark
 *    allowance for up to 3 spaces of indentation before the fence.
 *
 * 2. Indented code blocks (4+ spaces) were parsed correctly but re-serialized as
 *    triple-backtick fences wrapped around the literal text. When that text itself
 *    contained ```` ``` ```` markers, the output produced ambiguous, nested fences
 *    that corrupted the file on save.
 *
 * Fix strategy: capture the original indent prefix (and whether the block was
 * fenced vs. indented) as a node attribute, and serialize back in the matching
 * style so edits stay minimal.
 */

const FENCE_RE = /^([ ]{0,3})(```|~~~)/;

function isIndentedStyle(prefix: string): boolean {
  if (!prefix) return false;
  if (prefix.includes('\t')) return true;
  return prefix.length >= 4;
}

function extractFencePrefix(raw: string): string {
  const match = raw.match(FENCE_RE);
  return match ? match[1] : '';
}

function extractIndentPrefix(raw: string): string {
  const firstContentLine = raw.split('\n').find(l => l.trim().length > 0) ?? '';
  const match = firstContentLine.match(/^([ \t]+)/);
  return match ? match[1] : '    ';
}

export function parsePreservedCodeBlock(
  token: MarkdownToken,
  helpers: MarkdownParseHelpers
): JSONContent | JSONContent[] {
  if (token.type !== 'code') {
    return [];
  }

  const raw = typeof token.raw === 'string' ? token.raw : '';
  const isIndented = token.codeBlockStyle === 'indented';
  const hasLeadingSpaceFence = !isIndented && FENCE_RE.test(raw);
  const hasBareFence = !isIndented && (raw.startsWith('```') || raw.startsWith('~~~'));

  if (!isIndented && !hasLeadingSpaceFence && !hasBareFence) {
    return [];
  }

  const indentPrefix = isIndented ? extractIndentPrefix(raw) : extractFencePrefix(raw);

  const language =
    typeof (token as MarkdownToken & { lang?: unknown }).lang === 'string'
      ? ((token as MarkdownToken & { lang?: string }).lang ?? '')
      : '';
  const text = typeof token.text === 'string' ? token.text : '';

  const attrs: Record<string, unknown> = {
    language: language || null,
  };
  if (indentPrefix) {
    attrs['indent-prefix'] = indentPrefix;
  }

  return helpers.createNode('codeBlock', attrs, text ? [helpers.createTextNode(text)] : []);
}

export function renderPreservedCodeBlock(node: JSONContent, h: MarkdownRendererHelpers): string {
  const language = typeof node.attrs?.language === 'string' ? (node.attrs.language as string) : '';
  const indentPrefix =
    typeof node.attrs?.['indent-prefix'] === 'string'
      ? (node.attrs['indent-prefix'] as string)
      : '';

  const body = node.content ? h.renderChildren(node.content) : '';

  // Indented code block style: prefix every non-empty line with the indent.
  if (isIndentedStyle(indentPrefix)) {
    if (!body) {
      return indentPrefix;
    }
    return body
      .split('\n')
      .map(line => (line.length > 0 ? `${indentPrefix}${line}` : line))
      .join('\n');
  }

  // Fenced code block style: optional 0-3 space prefix on fences and body.
  const openFence = `${indentPrefix}\`\`\`${language}`;
  const closeFence = `${indentPrefix}\`\`\``;

  if (!body) {
    return `${openFence}\n\n${closeFence}`;
  }

  const bodyLines = body
    .split('\n')
    .map(line => (indentPrefix && line.length > 0 ? `${indentPrefix}${line}` : line));

  return [openFence, ...bodyLines, closeFence].join('\n');
}
