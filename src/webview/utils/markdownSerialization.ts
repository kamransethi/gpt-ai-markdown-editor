/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

import type { Editor, JSONContent } from '@tiptap/core';
import { devLog } from '../utils/devLog';

type MarkdownManager = {
  serialize?: (json: JSONContent) => string;
  getMarkdown?: () => string;
};

export type CompressionOptions = {
  compressTables?: boolean;
  trimBlankLines?: boolean;
};

function isMeaningfulInlineNode(node: JSONContent): boolean {
  if (!node || typeof node.type !== 'string') return false;

  if (node.type === 'hardBreak' || node.type === 'hard_break') return false;

  if (node.type === 'text') {
    const text = typeof node.text === 'string' ? node.text : '';
    return text.trim().length > 0;
  }

  return true;
}

function isEmptyParagraph(node: JSONContent): boolean {
  if (node.type !== 'paragraph') return false;

  // Blank-line placeholder nodes must be preserved in the output — they represent
  // intentional blank lines in the document that the user wants kept on save.
  if (node.attrs?.blankLine === true) return false;

  const content = node.content;
  if (!Array.isArray(content) || content.length === 0) return true;

  return !content.some(isMeaningfulInlineNode);
}

/**
 * Collapse redundant newlines in the regions outside fenced code blocks.
 */
function normalizeBlankLines(markdown: string, aggressive: boolean = false): string {
  // Include leading whitespace ([ \t]*) in the captured group so that fence indentation
  // (e.g. the 2 spaces in "  ```bash" inside a list item) remains part of the preserved
  // odd segment and is never modified by the even-segment processing below.
  const segments = markdown.split(/([ \t]*```[\s\S]*?```|[ \t]*~~~[\s\S]*?~~~)/g);
  const normalized = segments
    .map((seg, i) => {
      // Odd-indexed segments are fenced code blocks — leave untouched
      if (i % 2 === 1) return seg;
      // Normal: Collapse 4+ newlines to 3 (avoids double-blank-line glitches)
      // Aggressive: Collapse 3+ newlines to 2 (one blank line maximum)
      const threshold = aggressive ? 3 : 4;
      const target = aggressive ? '\n\n' : '\n\n\n';
      const regex = new RegExp(`\\n{${threshold},}`, 'g');
      return seg.replace(regex, target);
    })
    .join('');

  return aggressive ? normalized.trim() : normalized;
}

function compressTableLine(line: string): string {
  const trimmed = line.trim();
  if (!trimmed.includes('|')) {
    return line;
  }

  const cells = trimmed.split('|');
  const compressed = cells.map(cell => cell.trim()).join('|');
  return compressed;
}

function compressMarkdown(markdown: string, options: CompressionOptions): string {
  // Include leading whitespace ([ \t]*) in the captured group so that fence indentation
  // (e.g. the 2 spaces before "  ```bash" inside a list item) is captured as part of
  // the code-block (odd) segment and is never stripped as a whitespace-only line.
  const segments = markdown.split(/([ \t]*```[\s\S]*?```|[ \t]*~~~[\s\S]*?~~~)/g);
  let inIndentedCode = false;

  return segments
    .map((seg, i) => {
      if (i % 2 === 1) {
        return seg;
      }

      const lines = seg.split('\n');
      const compressedLines = lines.map(line => {
        if (inIndentedCode) {
          if (line.trim() === '' || /^( {4}|\t)/.test(line)) {
            return line;
          }
          inIndentedCode = false;
        }

        if (line.trim() === '') {
          return '';
        }

        if (/^( {4}|\t)/.test(line)) {
          inIndentedCode = true;
          return line;
        }

        if (options.compressTables && line.includes('|') && line.split('|').length >= 3) {
          return compressTableLine(line);
        }

        return line.replace(/[ \t]+$/g, '');
      });

      return compressedLines.join('\n');
    })
    .join('');
}

export function stripEmptyDocParagraphsFromJson(doc: JSONContent): JSONContent {
  if (doc.type !== 'doc' || !Array.isArray(doc.content)) {
    return doc;
  }

  const nextContent = doc.content.filter(child => !isEmptyParagraph(child));

  return {
    ...doc,
    content: nextContent,
  };
}

export function getEditorMarkdownForSync(
  editor: Editor,
  compression: CompressionOptions = {}
): string {
  const editorUnknown = editor as unknown as {
    markdown?: MarkdownManager;
    storage?: {
      markdown?: MarkdownManager;
    };
    getMarkdown?: () => string;
  };

  const markdownManager = editorUnknown.markdown || editorUnknown.storage?.markdown;

  const getFallbackMarkdown = (): string => {
    const directGetMarkdown = editorUnknown.getMarkdown;
    if (typeof directGetMarkdown === 'function') {
      const value = directGetMarkdown.call(editor);
      if (typeof value === 'string' && value.length > 0) {
        return value;
      }
    }

    const managerGetMarkdown = markdownManager?.getMarkdown;
    if (typeof managerGetMarkdown === 'function') {
      const value = managerGetMarkdown.call(markdownManager);
      if (typeof value === 'string' && value.length > 0) {
        return value;
      }
    }

    return '';
  };

  const sanitizeSerialized = (content: string): string => {
    // Our custom table serializer uses §§ to preserve breaks during the TipTap pass.
    // Let's replace those with standard markdown <br> tags so they don't corrupt the file.
    const sanitized = content.split('§§').join('<br>');
    // Also handle \x1F (Unit Separator) which @tiptap/markdown sometimes uses
    // eslint-disable-next-line no-control-regex
    const fullySanitized = sanitized.replace(/\x1F/g, '<br>');
    // Collapse over-produced blank lines from blank-line placeholder nodes
    return normalizeBlankLines(fullySanitized, !!compression.trimBlankLines);
  };

  const trySerialize = (label: string, fn: () => string): string | null => {
    try {
      const value = fn();
      if (typeof value !== 'string') {
        console.error(`[DK-AI] ${label} returned non-string output`);
        return null;
      }
      return value;
    } catch (error) {
      console.error(`[DK-AI] ${label} failed:`, error);
      return null;
    }
  };

  const hasMeaningfulDocContent = (doc: JSONContent): boolean => {
    return Array.isArray(doc.content) && doc.content.length > 0;
  };

  if (!markdownManager?.serialize || typeof editor.getJSON !== 'function') {
    const fallback = trySerialize(
      'fallback getMarkdown (no serialization manager)',
      getFallbackMarkdown
    );
    if (fallback !== null) {
      console.warn(
        '[DK-AI] Serialization manager not found, using fallback. Output len:',
        fallback.length
      );
      return sanitizeSerialized(fallback);
    }
    console.error(
      '[DK-AI] Serialization manager missing and fallback failed; returning empty output'
    );
    return '';
  }

  const json = trySerialize('editor.getJSON', () => JSON.stringify(editor.getJSON()));
  if (json === null) {
    const fallback = trySerialize(
      'fallback getMarkdown (after getJSON failure)',
      getFallbackMarkdown
    );
    return fallback ? sanitizeSerialized(fallback) : '';
  }

  const parsedJson = JSON.parse(json) as JSONContent;
  const normalizedJson = stripEmptyDocParagraphsFromJson(parsedJson);
  const nonEmptyDoc = hasMeaningfulDocContent(parsedJson);

  const normalizedSerialized = trySerialize('serialize(normalizedJson)', () =>
    markdownManager.serialize!(normalizedJson)
  );
  if (normalizedSerialized !== null && (normalizedSerialized.length > 0 || !nonEmptyDoc)) {
    devLog(
      '[DK-AI] Serialization successful (normalized). JSON nodes:',
      parsedJson.content?.length,
      'Serialized len:',
      normalizedSerialized.length
    );
    const sanitized = sanitizeSerialized(normalizedSerialized);
    return compressMarkdown(sanitized, compression);
  }

  if (normalizedSerialized !== null && normalizedSerialized.length === 0 && nonEmptyDoc) {
    console.error('[DK-AI] serialize(normalizedJson) returned empty string for non-empty document');
  }

  const rawSerialized = trySerialize('serialize(rawJson)', () =>
    markdownManager.serialize!(parsedJson)
  );
  if (rawSerialized !== null && (rawSerialized.length > 0 || !nonEmptyDoc)) {
    console.warn(
      '[DK-AI] Used raw JSON serializer fallback. JSON nodes:',
      parsedJson.content?.length,
      'Serialized len:',
      rawSerialized.length
    );
    const sanitized = sanitizeSerialized(rawSerialized);
    return compressMarkdown(sanitized, compression);
  }

  if (rawSerialized !== null && rawSerialized.length === 0 && nonEmptyDoc) {
    console.error('[DK-AI] serialize(rawJson) returned empty string for non-empty document');
  }

  const fallback = trySerialize('fallback getMarkdown', getFallbackMarkdown);
  if (fallback !== null && (fallback.length > 0 || !nonEmptyDoc)) {
    console.warn(
      '[DK-AI] Using getMarkdown fallback after serializer failures. Output len:',
      fallback.length
    );
    const sanitized = sanitizeSerialized(fallback);
    return compressMarkdown(sanitized, compression);
  }

  console.error(
    '[DK-AI] All serialization strategies failed for non-empty document; returning empty output'
  );
  return '';
}
