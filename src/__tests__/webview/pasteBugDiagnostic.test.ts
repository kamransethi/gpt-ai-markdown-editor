/** @jest-environment jsdom */

/**
 * Regression tests for paste bugs:
 * 1. Table with empty last cell fails to paste (renderTableMatrixAsHtml empty <td>)
 * 2. Multi-table + text content pastes only first table (greedy parseClipboardTable)
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TableKit } from '@tiptap/extension-table';
import { Markdown } from '@tiptap/markdown';
import {
  parseClipboardTable,
  parseHtmlTable,
  pasteIntoCells,
  getCurrentTableMatrix,
  renderTableMatrixAsHtml,
  serializeTableMatrix,
  serializeTableMatrixAsMarkdown,
} from '../../webview/utils/tableClipboard';
import {
  looksLikeMarkdown,
  markdownToHtml,
  processPasteContent,
} from '../../webview/utils/pasteHandler';

describe('Bug 1 fix: Table with empty last cell', () => {
  const problemTable = [
    '| Feature Type | Description / Details | Status |',
    '| ------------ | --------------------- | ------ |',
    '| Formatting   | - Test Highlight      | qwewq  |',
    '| Logic        | - Logical operators   |        |',
  ].join('\n');

  test('looksLikeMarkdown detects table with empty cell', () => {
    expect(looksLikeMarkdown(problemTable)).toBe(true);
  });

  test('markdownToHtml renders table with empty cell correctly', () => {
    const html = markdownToHtml(problemTable);
    expect(html).toContain('<table>');
    expect(html).toContain('<th>Status</th>');
    expect(html).toContain('<td></td>');
  });

  test('parseClipboardTable handles TSV with trailing empty cell', () => {
    const tsv = 'Col A\tCol B\tCol C\nA1\tB1\tC1\nA2\tB2\t';
    const parsed = parseClipboardTable(tsv);
    expect(parsed).not.toBeNull();
    expect(parsed![2]).toEqual(['A2', 'B2', '']);
  });

  test('parseClipboardTable handles TSV without trailing tab (empty last cell)', () => {
    const tsv = 'Col A\tCol B\tCol C\nA1\tB1\tC1\nA2\tB2';
    const parsed = parseClipboardTable(tsv);
    expect(parsed).not.toBeNull();
    expect(parsed![2]).toEqual(['A2', 'B2', '']);
  });

  test('CSV roundtrip: serialization works but paste parsing is disabled', () => {
    const matrix = [
      ['Feature Type', 'Description / Details', 'Status'],
      ['Formatting', '- Test Highlight', 'qwewq'],
      ['Logic', '- Logical operators', ''],
    ];
    const csv = serializeTableMatrix(matrix, ',');
    // CSV serialization still produces valid output for copy-to-clipboard
    expect(csv).toContain('Feature Type');
    // But CSV paste parsing is intentionally disabled to avoid false positives
    expect(parseClipboardTable(csv)).toBeNull();
  });

  test('Markdown roundtrip preserves empty cell', () => {
    const matrix = [
      ['Feature Type', 'Description / Details', 'Status'],
      ['Logic', '- Logical operators', ''],
    ];
    const md = serializeTableMatrixAsMarkdown(matrix);
    expect(looksLikeMarkdown(md)).toBe(true);
    const html = markdownToHtml(md);
    expect(html).toContain('<table>');
    expect(html).toContain('<td></td>');
  });

  test('renderTableMatrixAsHtml produces <p></p> in empty cells', () => {
    const matrix = [
      ['Header A', 'Header B'],
      ['Data', ''],
    ];
    const html = renderTableMatrixAsHtml(matrix);
    // Empty cells must have <p></p> to satisfy ProseMirror schema
    expect(html).toContain('<td><p></p></td>');
    // Non-empty cells should NOT have <p></p> wrapper
    expect(html).toContain('<td>Data</td>');
  });

  test('renderTableMatrixAsHtml empty cell round-trips through parseHtmlTable', () => {
    const matrix = [
      ['Feature Type', 'Description / Details', 'Status'],
      ['Logic', '- Logical operators', ''],
    ];
    const html = renderTableMatrixAsHtml(matrix);
    const parsed = parseHtmlTable(html);
    expect(parsed).toEqual(matrix);
  });

  test('processPasteContent identifies markdown table with empty cell', () => {
    const dt = {
      getData: (type: string) => (type === 'text/plain' ? problemTable : ''),
      items: [] as DataTransferItem[],
    } as unknown as DataTransfer;
    const result = processPasteContent(dt);
    expect(result.wasConverted).toBe(true);
    expect(result.isMarkdown).toBe(true);
    expect(result.content).toBe(problemTable);
  });
});

describe('Bug 1 integration: TipTap table insertion with empty cells', () => {
  let editor: Editor;
  afterEach(() => editor?.destroy());

  test('@tiptap/markdown setContent with empty cell table', () => {
    editor = new Editor({
      extensions: [
        StarterKit,
        TableKit,
        Markdown.configure({ markedOptions: { gfm: true, breaks: true } }),
      ],
    });

    const md = ['| A | B | C |', '| --- | --- | --- |', '| x | y |  |'].join('\n');

    editor.commands.setContent(md, { contentType: 'markdown' });

    const cells: string[] = [];
    editor.state.doc.descendants(node => {
      if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
        cells.push(node.textContent);
      }
    });
    expect(cells).toContain('');
    expect(cells.length).toBe(6); // 3 headers + 3 body cells
  });

  test('insertContent with renderTableMatrixAsHtml (empty cells)', () => {
    editor = new Editor({
      extensions: [StarterKit, TableKit],
      content: '<p></p>',
    });

    const matrix = [
      ['Header A', 'Header B', 'Header C'],
      ['Data', 'More', ''],
    ];
    const html = renderTableMatrixAsHtml(matrix);

    // This used to throw: RangeError: Invalid content for node tableCell: <>
    editor.commands.insertContent(html);

    const cells: string[] = [];
    editor.state.doc.descendants(node => {
      if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
        cells.push(node.textContent);
      }
    });
    expect(cells).toEqual(['Header A', 'Header B', 'Header C', 'Data', 'More', '']);
  });

  test('insertContent with HTML from markdownToHtml (empty cells)', () => {
    editor = new Editor({
      extensions: [
        StarterKit,
        TableKit,
        Markdown.configure({ markedOptions: { gfm: true, breaks: true } }),
      ],
      content: '<p></p>',
    });

    const md = [
      '| Feature Type | Description | Status |',
      '| --- | --- | --- |',
      '| Logic | Operators | |',
    ].join('\n');

    // markdownToHtml produces HTML with <thead>/<tbody> and <td></td>
    const rawHtml = markdownToHtml(md);
    expect(rawHtml).toContain('<tbody>');

    // parseHtmlTable + renderTableMatrixAsHtml cleans it up
    const htmlTable = parseHtmlTable(rawHtml);
    expect(htmlTable).not.toBeNull();
    const cleanHtml = renderTableMatrixAsHtml(htmlTable!);

    editor.commands.insertContent(cleanHtml);

    const cells: string[] = [];
    editor.state.doc.descendants(node => {
      if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
        cells.push(node.textContent);
      }
    });
    expect(cells).toContain('');
    expect(cells.length).toBe(6);
  });

  test('pasteIntoCells handles rows with empty cells', () => {
    editor = new Editor({
      extensions: [StarterKit, TableKit],
      content: `
        <table>
          <tbody>
            <tr><th>Col A</th><th>Col B</th><th>Col C</th></tr>
            <tr><td>A1</td><td>B1</td><td>C1</td></tr>
            <tr><td>A2</td><td>B2</td><td>C2</td></tr>
          </tbody>
        </table>
      `,
    });

    const cellPositions: number[] = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
        cellPositions.push(pos);
      }
    });

    editor.commands.setTextSelection(cellPositions[3] + 1);
    const tr = pasteIntoCells(editor.state, [['New A1', 'New B1', '']]);
    expect(tr).not.toBeNull();
    editor.view.dispatch(tr!);

    expect(getCurrentTableMatrix(editor.state)).toEqual([
      ['Col A', 'Col B', 'Col C'],
      ['New A1', 'New B1', ''],
      ['A2', 'B2', 'C2'],
    ]);
  });
});

describe('Bug 2 fix: Multi-table + text paste', () => {
  test('parseClipboardTable still works for pure TSV data', () => {
    const tsv = 'Name\tAge\nAlice\t30\nBob\t25';
    expect(parseClipboardTable(tsv)).toEqual([
      ['Name', 'Age'],
      ['Alice', '30'],
      ['Bob', '25'],
    ]);
  });

  test('parseHtmlTable only returns first table from multi-table HTML', () => {
    const html = `
      <p>TEXT</p>
      <table><tr><th>T1</th><th>Desc</th></tr><tr><td>A</td><td>B</td></tr></table>
      <table><tr><th>T2</th><th>Desc</th></tr><tr><td>C</td><td>D</td></tr></table>
    `;
    // Only first table extracted — second table lost
    expect(parseHtmlTable(html)).toEqual([
      ['T1', 'Desc'],
      ['A', 'B'],
    ]);
  });
});
