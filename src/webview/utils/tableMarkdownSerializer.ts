/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

/**
 * Custom table markdown serializer that preserves hardBreak nodes inside table cells.
 *
 * The default @tiptap/extension-table renderTableToMarkdown calls `collapseWhitespace()`
 * on each cell's rendered text, which obliterates line breaks (hardBreaks render as "  \n"
 * which collapseWhitespace turns into a space). This custom serializer walks the cell's
 * JSON content directly, rendering text with marks and converting hardBreak nodes to `<br>`
 * before any whitespace normalization occurs.
 */

import type { JSONContent, MarkdownRendererHelpers } from '@tiptap/core';

/**
 * Recursively render a block node to HTML, allowing list items, headings, etc. inside tables.
 * Inline content converts hardBreak nodes to `<br>`.
 */
const BULLET_MARKERS = ['-', '+', '*'] as const;

function renderBlockNode(node: JSONContent, h: MarkdownRendererHelpers, depth = 0): string {
  if (!node) return '';

  // Helper to render inline content and preserve `<br>`
  const renderInline = (nodes: JSONContent[] | undefined): string => {
    if (!nodes) return '';
    let text = '';
    for (const inline of nodes) {
      if (inline.type === 'hardBreak' || inline.type === 'hard_break') {
        text += '<br>';
      } else {
        text += h.renderChildren([inline] as unknown as JSONContent[]);
      }
    }
    return text;
  };

  switch (node.type) {
    case 'paragraph': {
      return renderInline(node.content);
    }
    case 'heading': {
      const level = node.attrs?.level || 1;
      const content = renderInline(node.content);
      return `<h${level}>${content}</h${level}>`;
    }
    case 'bulletList': {
      // Nested lists use alternating markers: -, +, * (per GFM convention).
      // All items are joined with <br> — raw newlines break the GFM table structure.
      const marker = BULLET_MARKERS[depth % BULLET_MARKERS.length];
      const indent = '  '.repeat(depth);
      const lines: string[] = [];
      for (const item of node.content || []) {
        // item is a listItem — separate its paragraph text from nested lists
        let mainText = '';
        const nested: string[] = [];
        for (const child of item.content || []) {
          if (child.type === 'bulletList' || child.type === 'orderedList') {
            nested.push(renderBlockNode(child, h, depth + 1));
          } else {
            mainText = renderBlockNode(child, h, depth);
          }
        }
        lines.push(`${indent}${marker} ${mainText}`);
        for (const n of nested) lines.push(n);
      }
      return lines.join('<br>');
    }
    case 'orderedList': {
      // Ordered list inside table cell — indented per depth, numbered.
      // Items MUST be joined with <br> (not \n) — raw newlines break GFM table structure.
      const indent = '  '.repeat(depth);
      let index = node.attrs?.start || 1;
      const lines: string[] = [];
      for (const item of node.content || []) {
        let mainText = '';
        const nested: string[] = [];
        for (const child of item.content || []) {
          if (child.type === 'bulletList' || child.type === 'orderedList') {
            nested.push(renderBlockNode(child, h, depth + 1));
          } else {
            mainText = renderBlockNode(child, h, depth);
          }
        }
        lines.push(`${indent}${index++}. ${mainText}`);
        for (const n of nested) lines.push(n);
      }
      return lines.join('<br>');
    }
    case 'listItem': {
      // listItem is only reached via the default fallback path (non-list parent).
      // In normal flow, bulletList/orderedList handle listItem content directly above.
      const content = (node.content || []).map(n => renderBlockNode(n, h, depth)).join('');
      return content;
    }
    case 'blockquote': {
      const content = (node.content || []).map(n => renderBlockNode(n, h, depth)).join('<br>');
      return `<blockquote>${content}</blockquote>`;
    }
    case 'githubAlert': {
      const alertType = node.attrs?.alertType || 'NOTE';
      const content = (node.content || []).map(n => renderBlockNode(n, h, depth)).join('<br>');
      return `<blockquote>[!${alertType}]<br>${content}</blockquote>`;
    }
    default: {
      if (node.type === 'text') {
        return h.renderChildren([node] as unknown as JSONContent[]);
      }
      if (node.content) {
        // Fallback for unhandled blocks with content (like codeBlock inside a table, if allowed)
        return node.content.map(n => renderBlockNode(n, h, depth)).join('<br>');
      }
      // Truly unhandled node, let the default renderer try
      return h.renderChildren([node] as unknown as JSONContent[]);
    }
  }
}

/**
 * Render a single cell's JSON content to a string, preserving hardBreak as `<br>`.
 * Also converts internal block nodes (Headings, Lists, Blockquotes) into HTML elements
 * because GFM tables don't support markdown block syntax.
 */
function renderCellContent(cellNode: JSONContent, h: MarkdownRendererHelpers): string {
  if (!cellNode.content || cellNode.content.length === 0) {
    return '';
  }

  const parts: string[] = [];

  for (const block of cellNode.content) {
    parts.push(renderBlockNode(block, h));
  }

  // Join multiple blocks with §§ (Temporary marker)
  // This prevents TipTap 3.22.4 from collapsing breaks in tables
  const withBreaks = parts.join('§§');

  // Only collapse spaces, NOT newlines — preserve <br> markers
  return (withBreaks || '').trimEnd();
}

export function renderTableToMarkdownWithBreaks(
  node: JSONContent,
  h: MarkdownRendererHelpers
): string {
  if (!node || !node.content || node.content.length === 0) {
    return '';
  }

  const rows: { text: string; isHeader: boolean; align: string | null }[][] = [];

  node.content.forEach(rowNode => {
    const cells: { text: string; isHeader: boolean; align: string | null }[] = [];
    if (rowNode.content) {
      rowNode.content.forEach(cellNode => {
        const text = renderCellContent(cellNode, h);
        const isHeader = cellNode.type === 'tableHeader';
        const align = (cellNode.attrs?.align as string | null | undefined) ?? null;
        cells.push({ text, isHeader, align });
      });
    }
    rows.push(cells);
  });

  const columnCount = rows.reduce((max, r) => Math.max(max, r.length), 0);
  if (columnCount === 0) return '';

  // For column width computation, we need the display length (without <br> tags)
  const displayLen = (text: string) => {
    // Split on markers to get the longest segment for column width
    const segments = text.split(new RegExp('§§|<br>|' + String.fromCharCode(31)));
    return Math.max(...segments.map(s => s.length), 0);
  };

  const colWidths = new Array(columnCount).fill(0);
  rows.forEach(r => {
    for (let i = 0; i < columnCount; i += 1) {
      const len = displayLen(r[i]?.text || '');
      if (len > colWidths[i]) colWidths[i] = len;
      if (colWidths[i] < 3) colWidths[i] = 3;
    }
  });

  const pad = (s: string, width: number) => s + ' '.repeat(Math.max(0, width - displayLen(s)));

  const headerRow = rows[0];
  const hasHeader = headerRow.some(c => c.isHeader);

  // Collect per-column alignment from the first row that has it (prefer header)
  const colAlignments: Array<string | null> = new Array(columnCount).fill(null);
  rows.forEach(r => {
    r.forEach((c, i) => {
      if (!colAlignments[i] && c.align) colAlignments[i] = c.align;
    });
  });

  let out = '';

  const headerTexts = new Array(columnCount)
    .fill(0)
    .map((_, i) => (hasHeader ? (headerRow[i] && headerRow[i].text) || '' : ''));

  out += `| ${headerTexts.map((t, i) => pad(t, colWidths[i])).join(' | ')} |\n`;
  out += `| ${colWidths
    .map((w, i) => {
      const align = colAlignments[i];
      const dashes = '-'.repeat(Math.max(3, w));
      if (align === 'center') return `:${dashes}:`;
      if (align === 'right') return `${dashes}:`;
      if (align === 'left') return `:${dashes}`;
      return dashes;
    })
    .join(' | ')} |\n`;

  const body = hasHeader ? rows.slice(1) : rows;
  body.forEach(r => {
    out += `| ${new Array(columnCount)
      .fill(0)
      .map((_, i) => pad((r[i] && r[i].text) || '', colWidths[i]))
      .join(' | ')} |\n`;
  });

  return out.trimEnd();
}
