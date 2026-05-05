/**
 * Copyright (c) 2025-2026 Concret.io
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

import type { Editor, JSONContent } from '@tiptap/core';

type MarkdownManager = {
  serialize?: (json: JSONContent) => string;
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

  const content = node.content;
  if (!Array.isArray(content) || content.length === 0) return true;

  return !content.some(isMeaningfulInlineNode);
}

/**
 * Strips all empty paragraphs from the doc's top-level content.
 * Exported for backward-compat with existing tests.
 */
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

function serializeSingleNode(node: JSONContent, serialize: (json: JSONContent) => string): string {
  try {
    return serialize({ type: 'doc', content: [node] }).trim();
  } catch {
    return '';
  }
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
    const getMarkdown = editorUnknown.getMarkdown;
    if (typeof getMarkdown === 'function') {
      return getMarkdown.call(editor);
    }
    return '';
  };

  if (!markdownManager?.serialize || typeof editor.getJSON !== 'function') {
    return getFallbackMarkdown();
  }

  const serialize = markdownManager.serialize.bind(markdownManager);

  try {
    const json = editor.getJSON();
    const children = json.content;

    if (!Array.isArray(children) || children.length === 0) {
      return '';
    }

    // Strip trailing empty paragraphs (Tiptap always appends one for cursor positioning)
    let endIdx = children.length;
    while (endIdx > 0 && isEmptyParagraph(children[endIdx - 1])) {
      endIdx--;
    }

    // Strip leading empty paragraphs
    let startIdx = 0;
    while (startIdx < endIdx && isEmptyParagraph(children[startIdx])) {
      startIdx++;
    }

    if (startIdx >= endIdx) {
      return '';
    }

    const trimmed = children.slice(startIdx, endIdx);

    // Serialize each content node individually and rejoin, inserting one extra
    // "\n" per intentional blank line (empty paragraph) between content blocks.
    // The standard paragraph separator is "\n\n" (one blank line); each empty
    // paragraph beyond that adds one more "\n" to the output.
    let result = '';
    let pendingBlanks = 0;

    for (const node of trimmed) {
      if (isEmptyParagraph(node)) {
        pendingBlanks++;
      } else {
        const nodeMarkdown = serializeSingleNode(node, serialize);
        if (nodeMarkdown === '') {
          // Node serialized to nothing (unrecognised type, etc.) – treat it
          // as if it were an empty paragraph so blank-line intent is kept.
          pendingBlanks++;
          continue;
        }
        if (result !== '') {
          result += '\n\n' + '\n'.repeat(pendingBlanks);
        }
        result += nodeMarkdown;
        pendingBlanks = 0;
      }
    }

    return result;
  } catch {
    return getFallbackMarkdown();
  }
}
