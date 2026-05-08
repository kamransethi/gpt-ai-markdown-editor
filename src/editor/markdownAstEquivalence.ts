/**
 * Copyright (c) 2025-2026 Concret.io
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

/**
 * Detects when two markdown strings are structurally equivalent — i.e. they
 * render to the same document, even if the source bytes differ.
 *
 * The webview's WYSIWYG round-trip (parse → ProseMirror → re-serialize) often
 * rewrites lint-clean source into the serializer's canonical style: bullet
 * markers `*`/`+` collapse to `-`, ordered lists renumber, soft-wrapped lines
 * fold, blank-line counts normalize, etc. None of these change the rendered
 * document; they just create noisy diffs that break `markdownlint`-enforced
 * conventions.
 *
 * This guard is consulted before the extension writes the webview's serialized
 * markdown back to the TextDocument: if the incoming text is structurally
 * equivalent to what's already on disk, the write is suppressed and the
 * original bytes are preserved.
 *
 * Equivalence is "renders to the same HTML" — the strictest check that still
 * tolerates the cosmetic-only round-trip differences listed above. Whitespace
 * inside `<pre>` and inline `<code>` is preserved during normalization so that
 * legitimate edits to verbatim content are still detected as changes.
 */

import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({
  html: true,
  // breaks:false makes single newlines render as soft breaks (a space-equivalent
  // in the rendered output), so hard-wrapping vs unwrapping a paragraph is
  // treated as cosmetic — which matches how readers see the document.
  breaks: false,
  linkify: false,
});

/**
 * Collapse runs of whitespace to a single space, but leave content inside
 * `<pre>...</pre>` and inline `<code>...</code>` untouched. Code regions are
 * the only place whitespace is structurally meaningful in rendered markdown.
 */
function normalizeRenderedHtml(html: string): string {
  const verbatimRegex = /<(pre|code)\b[\s\S]*?<\/\1>/gi;
  const parts: string[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = verbatimRegex.exec(html)) !== null) {
    parts.push(html.slice(cursor, match.index).replace(/\s+/g, ' '));
    parts.push(match[0]);
    cursor = match.index + match[0].length;
  }
  parts.push(html.slice(cursor).replace(/\s+/g, ' '));
  return parts.join('').trim();
}

/**
 * Returns true when `a` and `b` are different source strings that represent
 * the same document. Returns false when they differ in any way a reader would
 * notice (added/removed text, changed link target, edited code, etc.).
 */
export function isMarkdownStructurallyEquivalent(a: string, b: string): boolean {
  if (a === b) return true;
  try {
    return normalizeRenderedHtml(md.render(a)) === normalizeRenderedHtml(md.render(b));
  } catch {
    // If either side fails to render, fall back to "not equivalent" so the
    // caller takes the safe path of writing the change through.
    return false;
  }
}
