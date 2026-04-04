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
 * Collapse runs of 4+ consecutive newlines down to exactly 3 (= one blank line)
 * in the regions outside fenced code blocks. This prevents blank-line placeholder
 * nodes from emitting double blank lines (the serializer wraps each block with \n\n,
 * so an empty paragraph produces \n\n\n\n which we normalize to \n\n\n).
 */
function normalizeBlankLines(markdown: string): string {
  const segments = markdown.split(/(```[\s\S]*?```|~~~[\s\S]*?~~~)/g);
  return segments
    .map((seg, i) => {
      // Odd-indexed segments are fenced code blocks — leave untouched
      if (i % 2 === 1) return seg;
      return seg.replace(/\n{4,}/g, '\n\n\n');
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

export function getEditorMarkdownForSync(editor: Editor): string {
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
    // @tiptap/markdown sometimes serializes hard breaks in tables as \x1F (Unit Separator).
    // Let's replace those with standard markdown <br /> tags so they don't corrupt the file.
    // eslint-disable-next-line no-control-regex
    const sanitized = content.replace(/\x1F/g, '<br />');
    // Collapse over-produced blank lines from blank-line placeholder nodes (≥4 \n → 3 \n)
    return normalizeBlankLines(sanitized);
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
    return sanitizeSerialized(normalizedSerialized);
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
    return sanitizeSerialized(rawSerialized);
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
    return sanitizeSerialized(fallback);
  }

  console.error(
    '[DK-AI] All serialization strategies failed for non-empty document; returning empty output'
  );
  return '';
}
