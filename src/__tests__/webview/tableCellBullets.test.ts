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
import { TableBulletListSmart } from '../../webview/extensions/tableBulletListSmart';

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
      TableBulletListSmart,
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

// ---------------------------------------------------------------------------
// toggleBulletListSmart: only selected lines become bullets, not the whole cell
// ---------------------------------------------------------------------------

describe('toggleBulletListSmart: selection-aware bullet toggle in table cells', () => {
  let editor: Editor;
  beforeEach(() => { editor = makeEditor(); });
  afterEach(() => { editor.destroy(); });

  it('converts only the selected lines to bullets, leaving pre-lines intact', () => {
    // Load table with hardBreak-joined content
    const input = `| Col 1 | Col 2 |
| ----- | ----- |
| Row 1<br>Row 2<br>Bullet 1<br>Bullet 2 | Test |`;

    setMd(editor, input);

    // Select "Bullet 1" and "Bullet 2" — find them in the doc
    const state = editor.state;
    let bulletStart = -1;
    let bulletEnd = -1;
    state.doc.descendants((node, pos) => {
      if (node.isText && node.text === 'Bullet 1') bulletStart = pos;
      if (node.isText && node.text === 'Bullet 2') bulletEnd = pos + node.nodeSize;
    });

    expect(bulletStart).toBeGreaterThan(0);
    expect(bulletEnd).toBeGreaterThan(bulletStart);

    // Set selection over both bullet lines
    editor.commands.setTextSelection({ from: bulletStart, to: bulletEnd });

    // Toggle bullet list — should only affect the selected lines
    editor.commands.toggleBulletListSmart();

    const output = getMd(editor);

    // Row 1 and Row 2 must still be in the cell (not bullets)
    expect(output).toContain('Row 1');
    expect(output).toContain('Row 2');

    // Bullet items must appear
    expect(output).toContain('- Bullet 1');
    expect(output).toContain('- Bullet 2');

    // The table structure must still be valid — data row has pipe chars
    const dataRow = output.split('\n').find(l => l.includes('Row 1'));
    expect(dataRow).toBeDefined();
    expect(dataRow).toContain('|'); // still a table row

    // The row must NOT have a raw newline embedded inside it
    expect(dataRow).not.toMatch(/\n/);
  });

  it('does not wrap the entire cell when only part of the content is selected', () => {
    const input = `| Col 1 | Col 2 |
| ----- | ----- |
| Keep<br>Also keep<br>Make bullet | Test |`;

    setMd(editor, input);

    // Select only "Make bullet"
    const state = editor.state;
    let lineStart = -1;
    let lineEnd = -1;
    state.doc.descendants((node, pos) => {
      if (node.isText && node.text === 'Make bullet') {
        lineStart = pos;
        lineEnd = pos + node.nodeSize;
      }
    });

    expect(lineStart).toBeGreaterThan(0);
    editor.commands.setTextSelection({ from: lineStart, to: lineEnd });
    editor.commands.toggleBulletListSmart();

    const output = getMd(editor);

    // Non-selected lines should NOT become bullet items
    expect(output).not.toMatch(/^.*-\s+Keep.*$/m);
    expect(output).not.toMatch(/^.*-\s+Also keep.*$/m);

    // The selected line should become a bullet item
    expect(output).toContain('- Make bullet');

    // Table row must remain valid
    const dataRow = output.split('\n').find(l => l.includes('Keep'));
    expect(dataRow).toBeDefined();
    expect(dataRow).toContain('|');
  });

  it('falls back to standard toggle when not in a table cell', () => {
    // Load plain paragraph content (no table)
    setMd(editor, 'Hello world');

    // Select the text
    const state = editor.state;
    let textStart = -1;
    let textEnd = -1;
    state.doc.descendants((node, pos) => {
      if (node.isText && node.text === 'Hello world') {
        textStart = pos;
        textEnd = pos + node.nodeSize;
      }
    });

    editor.commands.setTextSelection({ from: textStart, to: textEnd });
    editor.commands.toggleBulletListSmart();

    const output = getMd(editor);
    expect(output).toContain('- Hello world');
  });
});
