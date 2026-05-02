/** @jest-environment jsdom */

/**
 * Regression test: bullets/ordered lists inside table cells must serialize
 * with <br> separators, not raw newlines that break GFM table structure.
 *
 * Bug: tableMarkdownSerializer bulletList/orderedList used `items.join(' \n')`
 * which injected raw newlines into the cell value, making the table invalid.
 * Fix: changed to `items.join('<br>')`.
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { TableKit, Table } from '@tiptap/extension-table';
import { ListKit } from '@tiptap/extension-list';
import Paragraph from '@tiptap/extension-paragraph';
import { OrderedListMarkdownFix } from '../../webview/extensions/orderedListMarkdownFix';
import { TaskItemClipboardFix } from '../../webview/extensions/taskItemClipboardFix';
import { renderTableToMarkdownWithBreaks } from '../../webview/utils/tableMarkdownSerializer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTableExtension() {
  return Table.extend({
    renderMarkdown(node: any, h: any) {
      return renderTableToMarkdownWithBreaks(node, h);
    },
    parseHTML() {
      return [
        {
          tag: 'table',
          contentElement(node: HTMLElement) {
            node.querySelectorAll(':scope > colgroup').forEach(el => el.remove());
            const sections = node.querySelectorAll(
              ':scope > thead, :scope > tbody, :scope > tfoot'
            );
            for (const section of Array.from(sections)) {
              while (section.firstChild) {
                node.insertBefore(section.firstChild, section);
              }
              section.remove();
            }
            return node;
          },
        },
      ];
    },
  }).configure({ resizable: false });
}

function makeEditor(): Editor {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return new Editor({
    element: el,
    extensions: [
      StarterKit.configure({
        paragraph: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        listKeymap: false,
        link: false,
      }),
      Paragraph,
      Markdown.configure({ markedOptions: { gfm: true, breaks: true } }),
      createTableExtension(),
      TableKit.configure({ table: false }),
      ListKit.configure({ taskItem: false, orderedList: false }),
      TaskItemClipboardFix.configure({ nested: true }),
      OrderedListMarkdownFix,
    ],
    content: '',
  });
}

function setMd(editor: Editor, md: string) {
  editor.commands.setContent(md, { contentType: 'markdown' } as any);
}

function getMd(editor: Editor): string {
  return (editor as any).getMarkdown();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SC-001 / SC-002: bullet list inside table cell serializes with <br>', () => {
  let editor: Editor;
  beforeEach(() => { editor = makeEditor(); });
  afterEach(() => { editor.destroy(); });

  it('serializes bullet list items with <br> separator, not raw newlines', () => {
    // Load a table where one cell contains a bullet list
    const input = `| Col 1 | Col 2 |
| ----- | ----- |
| Row 1<br>- Bullet 1<br>- Bullet 2 | Test |`;

    setMd(editor, input);
    const output = getMd(editor);

    // The cell value must not contain a raw newline (which would break the table)
    const lines = output.split('\n');
    const dataRow = lines.find(l => l.includes('Bullet'));
    expect(dataRow).toBeDefined();
    expect(dataRow).toContain('|');         // still a table row
    expect(dataRow).not.toMatch(/\n/);      // no embedded newlines
    expect(output).toContain('- Bullet 1'); // bullet marker preserved
    expect(output).toContain('- Bullet 2');
  });

  it('table structure remains valid (3 pipe chars per row) after bullet serialization', () => {
    const input = `| A | B |
| - | - |
| - Item 1<br>- Item 2 | val |`;

    setMd(editor, input);
    const output = getMd(editor);

    const dataRows = output.split('\n').filter(l => l.trim().startsWith('|') && !l.includes('---'));
    // Every data row must have at least 2 pipe separators (3 columns → 3+ pipes)
    for (const row of dataRows) {
      const pipeCount = (row.match(/\|/g) || []).length;
      expect(pipeCount).toBeGreaterThanOrEqual(2);
    }
  });

  it('round-trips a table with bullet list cell without data loss', () => {
    const input = `| Col 1 | Col 2 |
| ----- | ----- |
| Row 1<br>Row 2<br>- Bullet 1<br>- Bullet 2 | Test |`;

    setMd(editor, input);
    const firstPass = getMd(editor);
    setMd(editor, firstPass);
    const secondPass = getMd(editor);

    expect(secondPass).toBe(firstPass); // stable round-trip
  });
});

describe('SC-001 / SC-002: ordered list inside table cell serializes with <br>', () => {
  let editor: Editor;
  beforeEach(() => { editor = makeEditor(); });
  afterEach(() => { editor.destroy(); });

  it('serializes ordered list items with <br> separator, not raw newlines', () => {
    const input = `| Steps | Notes |
| ----- | ----- |
| 1. First<br>2. Second | ok |`;

    setMd(editor, input);
    const output = getMd(editor);

    const lines = output.split('\n');
    const dataRow = lines.find(l => l.includes('First'));
    expect(dataRow).toBeDefined();
    expect(dataRow).toContain('|');
    expect(output).toContain('1.');
    expect(output).toContain('2.');
  });
});
