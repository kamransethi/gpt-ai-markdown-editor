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

    const tableText =
      clipboardData.getData('text/tab-separated-values') ||
      clipboardData.getData('text/csv') ||
      clipboardData.getData('text/plain') ||
      '';
    const parsedTable = parseClipboardTable(tableText);
    if (parsedTable) {
      event.preventDefault();
      event.stopPropagation();

      const activeTable = findTable(editor.state.selection.$from);
      if (activeTable) {
        // Paste into existing table cells at cursor position
        const tr = pasteIntoCells(editor.state, parsedTable);
        if (tr) {
          editor.view.dispatch(tr);
        }
      } else {
        const html = renderTableMatrixAsHtml(parsedTable);
        editor.commands.insertContent(html);
      }
      return;
    }

    // Check if HTML clipboard contains a table — parse it into a clean matrix
    // to avoid <tbody> leaking through when TipTap processes the raw HTML
    const clipboardHtml = clipboardData.getData('text/html') || '';
    if (clipboardHtml && /<table[\s>]/i.test(clipboardHtml)) {
      const htmlTable = parseHtmlTable(clipboardHtml);
      if (htmlTable) {
        event.preventDefault();
        event.stopPropagation();

        const activeTable = findTable(editor.state.selection.$from);
        if (activeTable) {
          const tr = pasteIntoCells(editor.state, htmlTable);
          if (tr) {
            editor.view.dispatch(tr);
          }
        } else {
          const html = renderTableMatrixAsHtml(htmlTable);
          editor.commands.insertContent(html);
        }
        return;
      }

      // parseHtmlTable failed (e.g. single-column table) but HTML does contain
      // a <table>.  Let TipTap handle it — our Table extension's parseHTML
      // contentElement hook unwraps <thead>/<tbody>/<tfoot> at the DOM level.
      // MUST preventDefault here — otherwise ProseMirror's native handler
      // processes the raw HTML separately.
      event.preventDefault();
      event.stopPropagation();
      editor.commands.insertContent(clipboardHtml);
      return;
    }

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
