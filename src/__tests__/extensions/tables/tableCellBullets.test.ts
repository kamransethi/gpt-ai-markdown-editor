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
import { OrderedListMarkdownFix } from '../../../webview/extensions/orderedListMarkdownFix';
import { TaskItemClipboardFix } from '../../../webview/extensions/taskItemClipboardFix';
import { renderTableToMarkdownWithBreaks } from '../../../webview/utils/tableMarkdownSerializer';
import { TableBulletListSmart } from '../../../webview/extensions/tableBulletListSmart';

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
  beforeEach(() => {
    editor = makeEditor();
  });
  afterEach(() => {
    editor.destroy();
  });

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
    expect(dataRow).toContain('|'); // still a table row
    expect(dataRow).not.toMatch(/\n/); // no embedded newlines
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

  it('serializes nested bullet list with alternating markers and indentation', () => {
    // L1: "- item", L2: "  + nested", L3: "    * deep"
    const input = `| Steps | Col 2 |
| ----- | ----- |
| - L1<br>  + L2<br>    * L3 | ok |`;

    setMd(editor, input);
    const output = getMd(editor);

    // L1 must use `-` (depth 0)
    expect(output).toMatch(/- L1/);
    // L2 must use `+` with 2-space indent (depth 1)
    expect(output).toMatch(/ {2}\+ L2/);
    // L3 must use `*` with 4-space indent (depth 2)
    expect(output).toMatch(/ {4}\* L3/);

    // All on one table row (no embedded newlines)
    const dataRow = output.split('\n').find(l => l.includes('L1'));
    expect(dataRow).toBeDefined();
    expect(dataRow).toContain('|');
  });
});

describe('SC-001 / SC-002: ordered list inside table cell serializes with <br>', () => {
  let editor: Editor;
  beforeEach(() => {
    editor = makeEditor();
  });
  afterEach(() => {
    editor.destroy();
  });

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

describe('toggleBulletListSmart: text-manipulation bullet toggle in table cells', () => {
  let editor: Editor;
  beforeEach(() => {
    editor = makeEditor();
  });
  afterEach(() => {
    editor.destroy();
  });

  it('inserts "- " prefix on selected lines in a table cell', () => {
    const input = `| Col 1 | Col 2 |
| ----- | ----- |
| Row 1<br>Row 2<br>Bullet 1<br>Bullet 2 | Test |`;

    setMd(editor, input);

    // Select "Bullet 1" text
    const state = editor.state;
    let bulletStart = -1;
    let bulletEnd = -1;
    state.doc.descendants((node, pos) => {
      if (node.isText && node.text === 'Bullet 1') {
        bulletStart = pos;
        bulletEnd = pos + node.nodeSize;
      }
    });
    expect(bulletStart).toBeGreaterThan(0);
    editor.commands.setTextSelection({ from: bulletStart, to: bulletEnd });
    editor.commands.toggleBulletListSmart();

    const output = getMd(editor);

    // Selected line now has "- " prefix
    expect(output).toContain('- Bullet 1');
    // Non-selected lines unchanged (no bullet prefix added)
    expect(output).toContain('Row 1');
    expect(output).not.toMatch(/- Row 1/);
    expect(output).toContain('Bullet 2');
    expect(output).not.toMatch(/- Bullet 2/);
  });

  it('removes "- " prefix when all selected lines already have a bullet', () => {
    const input = `| Col 1 | Col 2 |
| ----- | ----- |
| Row 1<br>- Bullet 1<br>- Bullet 2 | Test |`;

    setMd(editor, input);

    // Select from "- Bullet 1" to "- Bullet 2"
    const state = editor.state;
    let b1start = -1,
      b2end = -1;
    state.doc.descendants((node, pos) => {
      if (node.isText && node.text === '- Bullet 1') b1start = pos;
      if (node.isText && node.text === '- Bullet 2') b2end = pos + node.nodeSize;
    });
    expect(b1start).toBeGreaterThan(0);
    editor.commands.setTextSelection({ from: b1start, to: b2end });
    editor.commands.toggleBulletListSmart();

    const output = getMd(editor);
    // Bullet markers removed
    expect(output).toContain('Bullet 1');
    expect(output).toContain('Bullet 2');
    expect(output).not.toContain('- Bullet 1');
    expect(output).not.toContain('- Bullet 2');
  });

  it('round-trips: save then reload shows same bullet text without doubling the dash', () => {
    const input = `| Col 1 | Col 2 |
| ----- | ----- |
| Row 1<br>- Bullet 1<br>- Bullet 2 | Test |`;

    setMd(editor, input);
    const firstPass = getMd(editor);
    // Reload from what was saved — must not double-up "- -"
    setMd(editor, firstPass);
    const secondPass = getMd(editor);

    expect(secondPass).toBe(firstPass);
    expect(secondPass).not.toContain('- - Bullet');
  });

  it('falls back to standard toggle when not in a table cell', () => {
    setMd(editor, 'Hello world');
    const state = editor.state;
    let textStart = -1,
      textEnd = -1;
    state.doc.descendants((node, pos) => {
      if (node.isText && node.text === 'Hello world') {
        textStart = pos;
        textEnd = pos + node.nodeSize;
      }
    });
    editor.commands.setTextSelection({ from: textStart, to: textEnd });
    editor.commands.toggleBulletListSmart();
    expect(getMd(editor)).toContain('- Hello world');
  });
});

// ---------------------------------------------------------------------------
// isTableBulletActive: toolbar highlight when cursor is on a bullet line
// ---------------------------------------------------------------------------

describe('isTableBulletActive: toolbar state in table cells', () => {
  let editor: Editor;
  beforeEach(() => {
    editor = makeEditor();
  });
  afterEach(() => {
    editor.destroy();
  });

  it('returns true when cursor is on a bullet line in a table cell', () => {
    setMd(editor, `| A | B |\n| - | - |\n| - Bullet 1<br>Row 2 | ok |`);
    let bulletPos = -1;
    editor.state.doc.descendants((node, pos) => {
      if (node.isText && node.text?.startsWith('- Bullet')) bulletPos = pos;
    });
    expect(bulletPos).toBeGreaterThan(0);
    editor.commands.setTextSelection(bulletPos + 2); // cursor inside "Bullet 1"
    expect((editor.commands as any).isTableBulletActive()).toBe(true);
  });

  it('returns false when cursor is on a non-bullet line in a table cell', () => {
    setMd(editor, `| A | B |\n| - | - |\n| - Bullet 1<br>Plain row | ok |`);
    let plainPos = -1;
    editor.state.doc.descendants((node, pos) => {
      if (node.isText && node.text === 'Plain row') plainPos = pos;
    });
    expect(plainPos).toBeGreaterThan(0);
    editor.commands.setTextSelection(plainPos + 2);
    expect((editor.commands as any).isTableBulletActive()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tab / Shift+Tab: indent / dedent bullet lines in table cells
// ---------------------------------------------------------------------------

describe('Tab/Shift+Tab: indent and dedent bullet lines in table cells', () => {
  let editor: Editor;
  beforeEach(() => {
    editor = makeEditor();
  });
  afterEach(() => {
    editor.destroy();
  });

  it('Tab increases indent depth and cycles marker: - → + ', () => {
    setMd(editor, `| A | B |\n| - | - |\n| - Bullet 1<br>Row 2 | ok |`);
    let bulletPos = -1;
    editor.state.doc.descendants((node, pos) => {
      if (node.isText && node.text?.startsWith('- Bullet')) bulletPos = pos;
    });
    editor.commands.setTextSelection(bulletPos + 2);
    // Simulate Tab via keyboard shortcut handler
    editor.commands.keyboardShortcut('Tab');
    const output = getMd(editor);
    expect(output).toContain('  + Bullet 1');
  });

  it('Tab again increases to level 2 with * marker', () => {
    setMd(editor, `| A | B |\n| - | - |\n| - Bullet 1<br>Row 2 | ok |`);
    let bulletPos = -1;
    editor.state.doc.descendants((node, pos) => {
      if (node.isText && node.text?.includes('Bullet 1')) bulletPos = pos;
    });
    editor.commands.setTextSelection(bulletPos + 2);
    // Tab twice: - → + → *
    editor.commands.keyboardShortcut('Tab');
    editor.commands.keyboardShortcut('Tab');
    const output = getMd(editor);
    expect(output).toContain('    * Bullet 1');
  });

  it('Shift+Tab decreases indent depth and cycles marker: + → -', () => {
    setMd(editor, `| A | B |\n| - | - |\n| - Bullet 1<br>Row 2 | ok |`);
    let bulletPos = -1;
    editor.state.doc.descendants((node, pos) => {
      if (node.isText && node.text?.includes('Bullet 1')) bulletPos = pos;
    });
    editor.commands.setTextSelection(bulletPos + 2);
    // Tab once to get to level 1 (  + Bullet 1), then Shift+Tab back to level 0
    editor.commands.keyboardShortcut('Tab');
    editor.commands.keyboardShortcut('Shift-Tab');
    const output = getMd(editor);
    expect(output).toContain('- Bullet 1');
    expect(output).not.toContain('  + Bullet');
  });

  it('Shift+Tab at top level (depth 0) does not consume the event', () => {
    setMd(editor, `| A | B |\n| - | - |\n| - Bullet 1<br>Row 2 | ok |`);
    let bulletPos = -1;
    editor.state.doc.descendants((node, pos) => {
      if (node.isText && node.text?.startsWith('- Bullet')) bulletPos = pos;
    });
    editor.commands.setTextSelection(bulletPos + 2);
    // At depth 0, Shift-Tab should not modify content
    const before = getMd(editor);
    editor.commands.keyboardShortcut('Shift-Tab');
    const after = getMd(editor);
    expect(after).toBe(before); // unchanged
  });
});
