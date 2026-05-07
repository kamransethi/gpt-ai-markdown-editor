/**
 * Copyright (c) 2025-2026 Concret.io
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 *
 * @fileoverview Build a Claude-Code-style `@file#startLine-endLine` reference for the
 * current TipTap selection so the user can paste precise context into AI coding tools.
 *
 * The math is block-rounded: a partial selection inside a paragraph reports the
 * paragraph's full line range. This is intentional — AI tools want enough context
 * to understand the surrounding text, not arbitrary half-blocks.
 *
 * Path resolution and the auto-save-before-copy step are handled by the extension
 * host; this module only computes line numbers and formats the final string.
 */

import type { Editor, JSONContent } from '@tiptap/core';
import { stripEmptyDocParagraphsFromJson } from './markdownSerialization';
import { copyToClipboard } from './copyMarkdown';

export interface AiContextRefResult {
  success: boolean;
  ref?: string;
  error?: string;
}

export interface SelectionBlockRange {
  startLine: number;
  endLine: number;
}

interface BlockPos {
  from: number;
  to: number;
}

type MarkdownManager = {
  serialize?: (json: JSONContent) => string;
};

/**
 * Count the number of lines a string represents.
 *
 * Matches the natural reading: "abc" is 1 line, "a\nb" is 2, "a\nb\n" is also 2
 * (a trailing newline does not add a line). Empty string is 0 lines.
 */
export function countLines(s: string): number {
  if (s.length === 0) return 0;
  let count = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\n') count++;
  }
  if (s[s.length - 1] !== '\n') count++;
  return count;
}

/**
 * Format the final clipboard string.
 * Single-line selections collapse to `#42`; multi-line use `#42-58`.
 */
export function formatAiContextRef(relPath: string, startLine: number, endLine: number): string {
  const suffix = startLine === endLine ? `#${startLine}` : `#${startLine}-${endLine}`;
  return `@${relPath}${suffix}`;
}

/**
 * Find the index of the block that contains a given ProseMirror document position.
 *
 * A position exactly at a block boundary (`pos === block.to`) is treated as
 * belonging to the next block, matching how a cursor at end-of-paragraph behaves.
 * Positions past the last block clamp to the last block (gap-cursor case).
 */
export function findContainingBlockIndex(blocks: BlockPos[], pos: number): number {
  if (blocks.length === 0) return -1;
  for (let i = 0; i < blocks.length; i++) {
    if (pos < blocks[i].to) return i;
  }
  return blocks.length - 1;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isEmptyParagraphNode(node: any): boolean {
  if (!node || !node.type || node.type.name !== 'paragraph') return false;
  const content = node.content;
  if (!content || content.size === 0) return true;
  let hasMeaningful = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content.forEach((child: any) => {
    if (!child || !child.type) return;
    const name = child.type.name;
    if (name === 'hardBreak' || name === 'hard_break') return;
    if (name === 'text') {
      const text = typeof child.text === 'string' ? child.text : '';
      if (text.trim().length > 0) hasMeaningful = true;
      return;
    }
    hasMeaningful = true;
  });
  return !hasMeaningful;
}

/**
 * Compute the line range (in the saved markdown file) that the current selection
 * covers, rounded out to whole top-level blocks.
 *
 * Returns null when:
 *   - the doc has no content,
 *   - the markdown serializer is unavailable,
 *   - the selection cannot be mapped to any non-empty block.
 *
 * The caller is expected to have just auto-saved the document, so the file on
 * disk is exactly `serialize(stripEmptyDocParagraphsFromJson(getJSON()))`. The
 * returned line numbers reference that file.
 */
export type SelectionBlockRangeFailure =
  | 'no-serializer'
  | 'no-getJSON'
  | 'empty-doc-json'
  | 'no-blocks'
  | 'selection-out-of-range'
  | 'index-mismatch'
  | 'serializer-threw';

export type SelectionBlockRangeResult =
  | { ok: true; range: SelectionBlockRange }
  | { ok: false; reason: SelectionBlockRangeFailure; detail?: string };

/**
 * Internal variant that returns a structured failure reason. Useful for surfacing
 * actionable error messages and console diagnostics; the public wrapper below
 * reduces this to `SelectionBlockRange | null` for backwards-compat with tests.
 */
export function computeSelectionBlockRange(editor: Editor): SelectionBlockRangeResult {
  const { from, to, empty } = editor.state.selection;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorAny = editor as any;
  const direct: MarkdownManager | undefined = editorAny.markdown;
  // editor.storage.markdown is `{ manager: MarkdownManager }` in @tiptap/markdown >=3,
  // not a manager itself, so unwrap `.manager` when falling back.
  const fromStorage: MarkdownManager | undefined = editorAny.storage?.markdown?.manager;
  const markdownManager: MarkdownManager | undefined = direct ?? fromStorage;
  const serialize = markdownManager?.serialize?.bind(markdownManager);
  if (typeof serialize !== 'function') {
    return { ok: false, reason: 'no-serializer' };
  }
  if (typeof editor.getJSON !== 'function') {
    return { ok: false, reason: 'no-getJSON' };
  }

  const docJson = stripEmptyDocParagraphsFromJson(editor.getJSON());
  if (!Array.isArray(docJson.content) || docJson.content.length === 0) {
    return { ok: false, reason: 'empty-doc-json' };
  }

  // Walk the live editor doc to learn each top-level block's PM position range.
  // Skip blocks that the save pipeline strips (empty paragraphs) so the indices
  // we compute line up with `docJson.content`.
  const blocks: BlockPos[] = [];
  let blockCount = 0;
  // ProseMirror's doc-level fragment offsets are 0-based within the fragment.
  // Top-level child positions in the doc are `offset + 1` because the doc node
  // itself contributes a leading position.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editor.state.doc.content.forEach((node: any, offset: number) => {
    blockCount++;
    if (isEmptyParagraphNode(node)) return;
    blocks.push({
      from: offset + 1,
      to: offset + 1 + node.nodeSize,
    });
  });
  if (blockCount === 0 || blocks.length === 0) {
    return {
      ok: false,
      reason: 'no-blocks',
      detail: `blockCount=${blockCount} blocks.length=${blocks.length}`,
    };
  }

  const startIdx = findContainingBlockIndex(blocks, from);
  const endIdx = empty ? startIdx : findContainingBlockIndex(blocks, to);
  if (startIdx < 0 || endIdx < 0) {
    return {
      ok: false,
      reason: 'selection-out-of-range',
      detail: `from=${from} to=${to} blocks=${blocks.length}`,
    };
  }
  if (startIdx >= docJson.content.length || endIdx >= docJson.content.length) {
    return {
      ok: false,
      reason: 'index-mismatch',
      detail: `startIdx=${startIdx} endIdx=${endIdx} jsonLen=${docJson.content.length} blocks=${blocks.length}`,
    };
  }

  const prefix: JSONContent = {
    type: 'doc',
    content: docJson.content.slice(0, startIdx),
  };
  const through: JSONContent = {
    type: 'doc',
    content: docJson.content.slice(0, endIdx + 1),
  };

  let prefixSerialized = '';
  let throughSerialized = '';
  try {
    prefixSerialized = serialize(prefix);
    throughSerialized = serialize(through);
  } catch (err) {
    return {
      ok: false,
      reason: 'serializer-threw',
      detail: err instanceof Error ? err.message : String(err),
    };
  }

  // Standard markdown serialization separates top-level blocks with a single
  // blank line and ends with a trailing newline. So the block following a
  // non-empty prefix begins exactly two lines after the prefix's last line:
  // one blank-line separator, plus the block's first textual line.
  // When startIdx === 0, there is no prefix and the first block starts at line 1.
  const startLine = startIdx === 0 ? 1 : countLines(prefixSerialized) + 2;
  const endLine = Math.max(startLine, countLines(throughSerialized));

  return { ok: true, range: { startLine, endLine } };
}

export function getSelectionBlockRange(editor: Editor): SelectionBlockRange | null {
  const result = computeSelectionBlockRange(editor);
  return result.ok ? result.range : null;
}

/**
 * High-level orchestration used by both the toolbar button and the keybinding:
 *   1. Compute the selection's block-rounded line range.
 *   2. Ask the extension host to save the document and return a workspace-relative
 *      path (so the file on disk matches the line numbers we just computed).
 *   3. Format `@path#startLine-endLine` and write it to the clipboard.
 *
 * The host round-trip is abstracted behind `requestPathFromHost` so the function
 * can be exercised without a real `vscode` webview API in tests if needed later.
 */
export async function copyAiContextReference(
  editor: Editor,
  requestPathFromHost: (
    range: SelectionBlockRange
  ) => Promise<{ ref?: string; relPath?: string; error?: string }>
): Promise<AiContextRefResult> {
  const result = computeSelectionBlockRange(editor);
  if (!result.ok) {
    const message = result.detail
      ? `AI ref unavailable (${result.reason}: ${result.detail})`
      : `AI ref unavailable (${result.reason})`;
    // Surface to the dev console so the user can grab the exact reason if the
    // toast text is truncated. Keeps host/webview separation — no PII leaves the box.
    console.warn('[MD4H][aiContextRef]', result);
    return { success: false, error: message };
  }
  const range = result.range;

  let response: { ref?: string; relPath?: string; error?: string };
  try {
    response = await requestPathFromHost(range);
  } catch (err) {
    return { success: false, error: String(err) };
  }
  if (response.error) {
    return { success: false, error: response.error };
  }

  const ref =
    response.ref ??
    (response.relPath
      ? formatAiContextRef(response.relPath, range.startLine, range.endLine)
      : undefined);
  if (!ref) {
    return { success: false, error: 'Host did not return a path' };
  }

  const copyResult = await copyToClipboard(ref);
  if (!copyResult.success) {
    return { success: false, error: copyResult.error };
  }
  return { success: true, ref };
}
