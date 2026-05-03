/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 *
 * Clipboard handling: copy and paste event listeners for the markdown editor.
 * Handles table copy/paste, code block paste, markdown-to-HTML conversion, etc.
 */

import type { Editor } from '@tiptap/core';
import { processPasteContent, parseFencedCode, hasOnlyImageContent } from '../utils/pasteHandler';
import { copySelectionAsMarkdown } from '../utils/copyMarkdown';
import { queueImageFromUrl } from './imageDragDrop';

/**
 * Check whether the event target is inside an embedded editor (e.g. mermaid source overlay)
 * that should handle its own clipboard events.
 */
function isEmbeddedEditorTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  return !!target.closest('.mermaid-source-overlay, .code-block-editor');
}


/**
 * Extract all absolute http/https img src URLs from an HTML string.
 * Used before stripping img tags so we can queue each for upload.
 */
function extractImgUrls(html: string): string[] {
  const urls: string[] = [];
  const pattern = /<img\b[^>]*\bsrc="(https?:\/\/[^"]+)"[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    urls.push(match[1]);
  }
  return urls;
}

/**
 * Remove all <img> elements from an HTML string.
 * Called before inserting web-pasted HTML to prevent double-insert when
 * the same images are queued for local upload via queueImageFromUrl.
 */
function stripImgTags(html: string): string {
  return html.replace(/<img\b[^>]*>/gi, '');
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

      const plainText = clipboardData.getData('text/plain') || '';

      // Check if pasted content is a fenced code block
      const fenced = parseFencedCode(plainText);
      const codeToInsert = fenced ? fenced.content : plainText;

      // Insert as plain text (TipTap will handle it correctly in code block)
      editor.commands.insertContent(codeToInsert);
      return;
    }

    const html = clipboardData.getData('text/html');
    if (html) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      const tables = tempDiv.querySelectorAll('table');
      let hasNested = false;
      for (let i = 0; i < tables.length; i++) {
        if (tables[i].querySelector('table')) {
          hasNested = true;
          break;
        }
      }
      if (hasNested) {
        const vscode = (window as any).vscode;
        if (vscode) {
          vscode.postMessage({
            type: 'SHOW_NOTIFICATION',
            style: 'warning',
            message: 'Nested tables detected. They will be flattened as Markdown does not support nested tables.',
          });
        }
      }
    }

    // ── PRIORITY 1: Rich HTML / Markdown / plain text ──
    // Let TipTap's native handlers deal with most content.
    // Our processPasteContent helper only handles image/markdown/html conversions
    // for external content that TipTap doesn't recognize natively.
    const result = processPasteContent(clipboardData);

    // Pure image clipboard (no text/html): let imageDragDrop handle it via its
    // paste listener. Do not interfere.
    if (result.isImage && hasOnlyImageContent(clipboardData)) {
      return;
    }

    // If content is raw markdown, use TipTap's Markdown parser for accurate conversion
    if (result.wasConverted && result.content && result.isMarkdown) {
      event.preventDefault();
      editor.commands.insertContent(result.content, { contentType: 'markdown' });
      return;
    }

    // If we need to convert content (rich HTML), intercept early
    if (result.wasConverted && result.content && result.isHtml) {
      event.preventDefault();

      // Extract <img src> URLs from the HTML so we can queue them for upload,
      // then strip <img> tags before insertion to prevent double-insert.
      const imgUrls = extractImgUrls(result.content);
      const htmlWithoutImgs = imgUrls.length > 0 ? stripImgTags(result.content) : result.content;

      // Insert the HTML content (images removed) — TipTap parses into proper nodes
      editor.commands.insertContent(htmlWithoutImgs);

      // Queue each extracted image URL for download + local upload (fire-and-forget)
      for (const url of imgUrls) {
        void queueImageFromUrl(editor, url);
      }
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
