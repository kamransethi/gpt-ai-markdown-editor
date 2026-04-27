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

    // ── PRIORITY 1: Rich HTML / Markdown / plain text ──
    // Let TipTap's native handlers deal with most content.
    // Our processPasteContent helper only handles image/markdown/html conversions
    // for external content that TipTap doesn't recognize natively.
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

  // Use capture phase to intercept BEFORE TipTap's default handling
  document.addEventListener('paste', pasteHandler, true);

  return () => {
    window.removeEventListener('copyAsMarkdown', handleCopyAsMarkdown);
    document.removeEventListener('paste', pasteHandler, true);
  };
}
