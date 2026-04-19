/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 *
 * Clipboard handling: copy and paste event listeners for the markdown editor.
 * Handles table copy/paste, code block paste, markdown-to-HTML conversion, etc.
 */

import type { Editor } from '@tiptap/core';
import { processPasteContent, parseFencedCode } from '../utils/pasteHandler';
import { copySelectionAsMarkdown } from '../utils/copyMarkdown';
import {
  getCurrentTableMatrix,
  isTableSelection,
  parseClipboardTable,
  parseHtmlTable,
  pasteIntoCells,
  renderTableMatrixAsHtml,
  serializeTableMatrix,
  serializeTableMatrixAsMarkdown,
} from '../utils/tableClipboard';
import { findTable } from 'prosemirror-tables';

/**
 * Check whether the event target is inside an embedded editor (e.g. mermaid source overlay)
 * that should handle its own clipboard events.
 */
function isEmbeddedEditorTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  return !!target.closest('.mermaid-source-overlay, .code-block-editor');
}

/**
 * Check if HTML contains mixed content: either multiple tables or
 * significant non-table content alongside a table.
 */
function isMixedTableContent(html: string): boolean {
  const tableCount = (html.match(/<table[\s>]/gi) || []).length;
  if (tableCount > 1) return true;

  // Strip all table content to check if there's meaningful text outside
  const withoutTables = html.replace(/<table[\s\S]*?<\/table>/gi, '');
  const textContent = withoutTables.replace(/<[^>]*>/g, '').trim();
  return textContent.length > 0;
}

/**
 * Insert a parsed table matrix into the editor — either into an existing table
 * (if cursor is inside one) or as a new standalone table.
 */
function insertTableMatrix(editor: Editor, matrix: string[][]): void {
  const activeTable = findTable(editor.state.selection.$from);
  if (activeTable) {
    const tr = pasteIntoCells(editor.state, matrix);
    if (tr) {
      editor.view.dispatch(tr);
    }
  } else {
    const html = renderTableMatrixAsHtml(matrix);
    editor.commands.insertContent(html);
  }
}

/**
 * Set up clipboard event handlers (copy/paste) on the document.
 *
 * @param getEditor - Getter for the current TipTap editor instance.
 * @returns Cleanup function that removes all registered listeners.
 */
export function setupClipboardHandlers(getEditor: () => Editor | null): () => void {
  const handleCopyAsMarkdown = () => {
    const editor = getEditor();
    if (!editor) return;
    copySelectionAsMarkdown(editor);
  };
  window.addEventListener('copyAsMarkdown', handleCopyAsMarkdown);

  const copyHandler = (event: ClipboardEvent) => {
    const editor = getEditor();
    if (!editor || !event.clipboardData || isEmbeddedEditorTarget(event.target)) {
      return;
    }

    if (!isTableSelection(editor.state.selection)) {
      return;
    }

    const matrix = getCurrentTableMatrix(editor.state);
    if (!matrix) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.clipboardData.setData('text/plain', serializeTableMatrix(matrix, '\t'));
    event.clipboardData.setData('text/csv', serializeTableMatrix(matrix, ','));
    event.clipboardData.setData('text/markdown', serializeTableMatrixAsMarkdown(matrix));
  };

  const pasteHandler = (event: ClipboardEvent) => {
    const editor = getEditor();
    if (!editor || isEmbeddedEditorTarget(event.target)) return;

    const clipboardData = event.clipboardData;
    if (!clipboardData) return;

    // If cursor is inside a code block, handle specially
    if (editor.isActive('codeBlock')) {
      event.preventDefault();
      event.stopPropagation();

      const plainText = clipboardData.getData('text/plain') || '';

      // Check if pasted content is a fenced code block
      const fenced = parseFencedCode(plainText);
      const codeToInsert = fenced ? fenced.content : plainText;

      // Insert as plain text (TipTap will handle it correctly in code block)
      editor.commands.insertContent(codeToInsert);
      return;
    }

    // ── PRIORITY 0: ProseMirror's own clipboard (within-editor copy-paste) ──
    // ProseMirror marks its clipboard HTML with data-pm-slice for lossless
    // round-tripping. Let ProseMirror handle it natively — it preserves
    // node types, attributes (checked state, etc.), and structure far better
    // than any HTML→Markdown→HTML conversion we could do.
    const clipboardHtml = clipboardData.getData('text/html') || '';
    if (clipboardHtml && /data-pm-slice/i.test(clipboardHtml)) {
      // Exception: if explicit table formats are also present (e.g. our copy
      // handler sets TSV/CSV alongside data-pm-slice for table selections),
      // still handle those — but only for table-specific paste-into-cells.
      const explicitTsv = clipboardData.getData('text/tab-separated-values');
      if (explicitTsv && findTable(editor.state.selection.$from)) {
        const parsedTable = parseClipboardTable(explicitTsv);
        if (parsedTable) {
          event.preventDefault();
          event.stopPropagation();
          insertTableMatrix(editor, parsedTable);
          return;
        }
      }
      // Let ProseMirror's native paste handler take over
      return;
    }

    // ── PRIORITY 1: Explicit TSV format (from spreadsheets, our copy handler) ──
    // Tab-separated values are intentionally set by the source app and are
    // unambiguous. CSV is NOT parsed from clipboard to avoid false positives
    // with prose that contains commas.
    const explicitTsv = clipboardData.getData('text/tab-separated-values');
    if (explicitTsv) {
      const parsedTable = parseClipboardTable(explicitTsv);
      if (parsedTable) {
        event.preventDefault();
        event.stopPropagation();
        insertTableMatrix(editor, parsedTable);
        return;
      }
    }

    // ── PRIORITY 2: HTML clipboard with table(s) ──
    // Check HTML BEFORE text/plain to avoid greedily parsing mixed
    // content (text + multiple tables) as a single tab-separated table.
    if (clipboardHtml && /<table[\s>]/i.test(clipboardHtml)) {
      // Single isolated table → normalize through matrix roundtrip.
      // This strips <tbody>/<thead> wrappers and <colgroup> artifacts.
      if (!isMixedTableContent(clipboardHtml)) {
        const htmlTable = parseHtmlTable(clipboardHtml);
        if (htmlTable) {
          event.preventDefault();
          event.stopPropagation();
          insertTableMatrix(editor, htmlTable);
          return;
        }
      }

      // Mixed content (text + tables, multiple tables, full-document paste)
      // or parseHtmlTable failed (e.g. single-column table):
      // Let ProseMirror's native paste handler deal with it.
      // - ProseMirror strips <meta>, <colgroup>, <style>, etc.
      // - Our Table extension's contentElement hook handles <tbody>/<thead>/<tfoot>
      return;
    }

    // ── PRIORITY 3: Plain text that looks like a table (TSV from text editors) ──
    // Only reached when no HTML table is available — avoids the greedy-parse
    // problem where browser text/plain mixes table tabs with non-table text.
    const plainText = clipboardData.getData('text/plain') || '';
    const parsedTable = parseClipboardTable(plainText);
    if (parsedTable) {
      event.preventDefault();
      event.stopPropagation();
      insertTableMatrix(editor, parsedTable);
      return;
    }

    // ── PRIORITY 4: Rich HTML / Markdown / plain text ──
    const result = processPasteContent(clipboardData);

    // Images handled by imageDragDrop - don't interfere
    if (result.isImage) {
      return;
    }

    // If content is raw markdown, use TipTap's Markdown parser for accurate conversion
    if (result.wasConverted && result.content && result.isMarkdown) {
      event.preventDefault();
      event.stopPropagation();
      editor.commands.insertContent(result.content, { contentType: 'markdown' });
      return;
    }

    // If we need to convert content (rich HTML), intercept early
    if (result.wasConverted && result.content && result.isHtml) {
      event.preventDefault();
      event.stopPropagation();
      // Insert HTML - TipTap parses it into proper nodes (tables, lists, etc.)
      editor.commands.insertContent(result.content);
    }
    // Otherwise: default paste behavior for plain text
  };

  // Must use capture phase to intercept BEFORE TipTap's default handling
  document.addEventListener('copy', copyHandler, true);
  document.addEventListener('paste', pasteHandler, true);

  return () => {
    window.removeEventListener('copyAsMarkdown', handleCopyAsMarkdown);
    document.removeEventListener('copy', copyHandler, true);
    document.removeEventListener('paste', pasteHandler, true);
  };
}
