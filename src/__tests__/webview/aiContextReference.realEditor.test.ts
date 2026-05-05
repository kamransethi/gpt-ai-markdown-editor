/** @jest-environment jsdom */

/**
 * Integration test: exercise computeSelectionBlockRange against a real TipTap
 * editor wired up the way the production webview wires it. The standalone unit
 * tests use stubs to verify the line math; this test exists to catch issues
 * that only show up with the actual `@tiptap/markdown` MarkdownManager.
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { ListKit } from '@tiptap/extension-list';
import { MarkdownParagraph } from '../../webview/extensions/markdownParagraph';
import { OrderedListMarkdownFix } from '../../webview/extensions/orderedListMarkdownFix';
import { computeSelectionBlockRange } from '../../webview/utils/aiContextReference';

function createRealEditor(initialMarkdown: string): Editor {
  const element = document.createElement('div');
  document.body.appendChild(element);
  return new Editor({
    element,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        paragraph: false,
        codeBlock: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        listKeymap: false,
        undoRedo: { depth: 100 },
      }),
      MarkdownParagraph,
      Markdown.configure({
        markedOptions: { gfm: true, breaks: true },
      }),
      ListKit.configure({
        orderedList: false,
        taskItem: { nested: true },
      }),
      OrderedListMarkdownFix,
    ],
    content: initialMarkdown,
    contentType: 'markdown',
  });
}

describe('computeSelectionBlockRange with a real TipTap editor', () => {
  it('returns the first paragraph line when the cursor is in paragraph 1 of three', () => {
    const editor = createRealEditor('First paragraph\n\nSecond paragraph\n\nThird');
    // Place cursor inside the first paragraph.
    editor.commands.setTextSelection(3);

    const result = computeSelectionBlockRange(editor);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.range.startLine).toBe(1);
      expect(result.range.endLine).toBe(1);
    }
    editor.destroy();
  });

  it('returns the third paragraph line when the cursor is in paragraph 3 of three', () => {
    const editor = createRealEditor('First paragraph\n\nSecond paragraph\n\nThird');
    // Move to end of doc — selection lands inside the last paragraph.
    const docEnd = editor.state.doc.content.size;
    editor.commands.setTextSelection(docEnd);

    const result = computeSelectionBlockRange(editor);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.range.startLine).toBe(5);
      expect(result.range.endLine).toBe(5);
    }
    editor.destroy();
  });

  it('reports a useful failure reason for an empty document', () => {
    const editor = createRealEditor('');
    const result = computeSelectionBlockRange(editor);
    // Either empty-doc-json or no-blocks is acceptable — the actionable bit is
    // that the result is not `ok`.
    expect(result.ok).toBe(false);
    editor.destroy();
  });
});
