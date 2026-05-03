/** @jest-environment jsdom */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TableKit } from '@tiptap/extension-table';
import {
  getCurrentTableMatrix,
  getSelectedTableMatrix,
  parseClipboardTable,
  parseHtmlTable,
  pasteIntoCells,
  renderTableMatrixAsHtml,
  serializeTableMatrix,
  serializeTableMatrixAsMarkdown,
} from '../../../webview/utils/tableClipboard';

describe('tableClipboard utilities', () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
  });

  function createTableEditor() {
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

    return editor;
  }

  function getTableCellPositions(instance: Editor): number[] {
    const positions: number[] = [];
    instance.state.doc.descendants((node, pos) => {
      if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
        positions.push(pos);
      }
    });
    return positions;
  }

  it('extracts a rectangular cell selection as a matrix', () => {
    const instance = createTableEditor();
    const cellPositions = getTableCellPositions(instance);
    instance.commands.setCellSelection({
      anchorCell: cellPositions[3],
      headCell: cellPositions[7],
    });

    expect(getSelectedTableMatrix(instance.state)).toEqual([
      ['A1', 'B1'],
      ['A2', 'B2'],
    ]);
  });

  it('extracts the whole current table when the selection is collapsed', () => {
    const instance = createTableEditor();
    instance.commands.focus('start');
    instance.commands.goToNextCell();

    expect(getCurrentTableMatrix(instance.state)).toEqual([
      ['Col A', 'Col B', 'Col C'],
      ['A1', 'B1', 'C1'],
      ['A2', 'B2', 'C2'],
    ]);
  });

  it('serializes selected cells as TSV', () => {
    expect(
      serializeTableMatrix(
        [
          ['A1', 'B1'],
          ['A2', 'B2'],
        ],
        '\t'
      )
    ).toBe('A1\tB1\nA2\tB2');
  });

  it('serializes selected cells as CSV', () => {
    expect(
      serializeTableMatrix(
        [
          ['A1', 'B,1'],
          ['A2', 'B2'],
        ],
        ','
      )
    ).toBe('A1,"B,1"\nA2,B2');
  });

  it('serializes selected cells as markdown table', () => {
    expect(
      serializeTableMatrixAsMarkdown([
        ['Name', 'Type'],
        ['Alpha', 'CSV'],
      ])
    ).toBe('| Name | Type |\n| --- | --- |\n| Alpha | CSV |\n');
  });

  it('parses TSV clipboard data into a new table matrix', () => {
    expect(parseClipboardTable('A1\tB1\nA2\tB2')).toEqual([
      ['A1', 'B1'],
      ['A2', 'B2'],
    ]);
  });

  it('does NOT parse CSV clipboard data (CSV support removed for robustness)', () => {
    // CSV was removed because commas in prose caused false-positive table detection
    expect(parseClipboardTable('Name,Type\n"My File",CSV')).toBeNull();
  });

  it('does NOT parse prose text with incidental commas as a table', () => {
    const proseWithCommas = [
      'Write failing tests FIRST',
      'Verify tests fail (confirms tests work)',
      'Implement feature to make tests pass',
      'Cover positive, negative, edge cases',
      'If bugs found: audit/debug, not quick fixes',
    ].join('\n');
    expect(parseClipboardTable(proseWithCommas)).toBeNull();
  });

  it('does NOT parse single line with a comma as a table', () => {
    expect(parseClipboardTable('Hello, world')).toBeNull();
  });

  it('does NOT parse any comma-delimited text as a table', () => {
    const csv = 'A,B,C\n1,2,3\n4,5,6';
    expect(parseClipboardTable(csv)).toBeNull();
  });

  it('does NOT parse plain text without tabs as a table', () => {
    expect(parseClipboardTable('Just some regular text')).toBeNull();
    expect(parseClipboardTable('Line 1\nLine 2\nLine 3')).toBeNull();
  });

  describe('pasteIntoCells', () => {
    it('overwrites cells starting from the cursor position', () => {
      const instance = createTableEditor();
      const cellPositions = getTableCellPositions(instance);
      // Place cursor in the first body cell (A1) — cellPositions[3]
      instance.commands.setTextSelection(cellPositions[3] + 1);

      const tr = pasteIntoCells(instance.state, [['X1', 'Y1']]);
      expect(tr).not.toBeNull();

      instance.view.dispatch(tr!);

      // Verify cells were updated
      const matrix = getCurrentTableMatrix(instance.state);
      expect(matrix).toEqual([
        ['Col A', 'Col B', 'Col C'],
        ['X1', 'Y1', 'C1'],
        ['A2', 'B2', 'C2'],
      ]);
    });

    it('overwrites multiple rows of cells', () => {
      const instance = createTableEditor();
      const cellPositions = getTableCellPositions(instance);
      // Place cursor in A1
      instance.commands.setTextSelection(cellPositions[3] + 1);

      const tr = pasteIntoCells(instance.state, [
        ['X1', 'Y1'],
        ['X2', 'Y2'],
      ]);
      expect(tr).not.toBeNull();
      instance.view.dispatch(tr!);

      const matrix = getCurrentTableMatrix(instance.state);
      expect(matrix).toEqual([
        ['Col A', 'Col B', 'Col C'],
        ['X1', 'Y1', 'C1'],
        ['X2', 'Y2', 'C2'],
      ]);
    });

    it('clips paste data when it exceeds table bounds', () => {
      const instance = createTableEditor();
      const cellPositions = getTableCellPositions(instance);
      // Place cursor in the last column of body row 1 (C1) — cellPositions[5]
      instance.commands.setTextSelection(cellPositions[5] + 1);

      const tr = pasteIntoCells(instance.state, [['X', 'Y', 'Z']]);
      expect(tr).not.toBeNull();
      instance.view.dispatch(tr!);

      const matrix = getCurrentTableMatrix(instance.state);
      // Only X should be pasted; Y and Z exceed columns
      expect(matrix).toEqual([
        ['Col A', 'Col B', 'Col C'],
        ['A1', 'B1', 'X'],
        ['A2', 'B2', 'C2'],
      ]);
    });

    it('returns null when cursor is outside a table', () => {
      editor = new Editor({
        extensions: [StarterKit, TableKit],
        content: '<p>Hello world</p>',
      });
      editor.commands.setTextSelection(1);

      const tr = pasteIntoCells(editor.state, [['X']]);
      expect(tr).toBeNull();
    });

    it('handles pasting a single cell', () => {
      const instance = createTableEditor();
      const cellPositions = getTableCellPositions(instance);
      // Place cursor in B2
      instance.commands.setTextSelection(cellPositions[7] + 1);

      const tr = pasteIntoCells(instance.state, [['REPLACED']]);
      expect(tr).not.toBeNull();
      instance.view.dispatch(tr!);

      const matrix = getCurrentTableMatrix(instance.state);
      expect(matrix).toEqual([
        ['Col A', 'Col B', 'Col C'],
        ['A1', 'B1', 'C1'],
        ['A2', 'REPLACED', 'C2'],
      ]);
    });

    it('handles pasting into header row', () => {
      const instance = createTableEditor();
      const cellPositions = getTableCellPositions(instance);
      // Place cursor in header cell (Col B) — cellPositions[1]
      instance.commands.setTextSelection(cellPositions[1] + 1);

      const tr = pasteIntoCells(instance.state, [['New Header']]);
      expect(tr).not.toBeNull();
      instance.view.dispatch(tr!);

      const matrix = getCurrentTableMatrix(instance.state);
      expect(matrix).toEqual([
        ['Col A', 'New Header', 'Col C'],
        ['A1', 'B1', 'C1'],
        ['A2', 'B2', 'C2'],
      ]);
    });
  });

  describe('renderTableMatrixAsHtml', () => {
    it('does NOT include <tbody> in the output', () => {
      const html = renderTableMatrixAsHtml([
        ['Name', 'Age'],
        ['Alice', '30'],
      ]);
      expect(html).not.toContain('<tbody>');
      expect(html).not.toContain('</tbody>');
    });

    it('wraps header cells in <th> and body cells in <td>', () => {
      const html = renderTableMatrixAsHtml([
        ['H1', 'H2'],
        ['D1', 'D2'],
      ]);
      expect(html).toContain('<th>H1</th>');
      expect(html).toContain('<th>H2</th>');
      expect(html).toContain('<td>D1</td>');
      expect(html).toContain('<td>D2</td>');
    });

    it('wraps output in <table> without <tbody> or <thead>', () => {
      const html = renderTableMatrixAsHtml([
        ['A', 'B'],
        ['C', 'D'],
      ]);
      expect(html).toMatch(/^<table><tr>.*<\/tr><\/table>$/);
    });

    it('handles single-row matrix (header only)', () => {
      const html = renderTableMatrixAsHtml([['X', 'Y']]);
      expect(html).toBe('<table><tr><th>X</th><th>Y</th></tr></table>');
    });

    it('escapes HTML entities in cell content', () => {
      const html = renderTableMatrixAsHtml([
        ['<script>', '&test'],
        ['"quotes"', "it's"],
      ]);
      expect(html).toContain('&lt;script&gt;');
      expect(html).toContain('&amp;test');
      expect(html).toContain('&quot;quotes&quot;');
      expect(html).toContain('&#39;');
    });

    it('returns empty string for empty matrix', () => {
      expect(renderTableMatrixAsHtml([])).toBe('');
      expect(renderTableMatrixAsHtml([[]])).toBe('');
    });

    it('normalizes uneven row lengths', () => {
      const html = renderTableMatrixAsHtml([['A', 'B', 'C'], ['D']]);
      // Should pad second row to 3 columns — empty cells get <p></p> for ProseMirror schema
      expect(html).toContain('<td>D</td><td><p></p></td><td><p></p></td>');
    });
  });

  describe('parseHtmlTable', () => {
    it('parses a simple HTML table into a matrix', () => {
      const html =
        '<table><tr><th>Name</th><th>Age</th></tr><tr><td>Alice</td><td>30</td></tr></table>';
      expect(parseHtmlTable(html)).toEqual([
        ['Name', 'Age'],
        ['Alice', '30'],
      ]);
    });

    it('parses HTML table with <tbody> wrapper', () => {
      const html =
        '<table><tbody><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></tbody></table>';
      expect(parseHtmlTable(html)).toEqual([
        ['A', 'B'],
        ['1', '2'],
      ]);
    });

    it('parses HTML table with <thead> and <tbody>', () => {
      const html =
        '<table><thead><tr><th>X</th><th>Y</th></tr></thead><tbody><tr><td>a</td><td>b</td></tr></tbody></table>';
      expect(parseHtmlTable(html)).toEqual([
        ['X', 'Y'],
        ['a', 'b'],
      ]);
    });

    it('returns null for HTML without a table', () => {
      expect(parseHtmlTable('<p>Hello world</p>')).toBeNull();
    });

    it('returns null for a single-column table', () => {
      const html = '<table><tr><td>Only one</td></tr></table>';
      expect(parseHtmlTable(html)).toBeNull();
    });

    it('trims whitespace from cell text', () => {
      const html = '<table><tr><td>  hello  </td><td>  world  </td></tr></table>';
      expect(parseHtmlTable(html)).toEqual([['hello', 'world']]);
    });

    it('normalizes uneven rows', () => {
      const html = '<table><tr><td>A</td><td>B</td><td>C</td></tr><tr><td>D</td></tr></table>';
      const result = parseHtmlTable(html);
      expect(result).toEqual([
        ['A', 'B', 'C'],
        ['D', '', ''],
      ]);
    });

    it('handles rich HTML wrapping around the table', () => {
      const html =
        '<html><body><meta charset="utf-8"><table><tr><th>Col1</th><th>Col2</th></tr><tr><td>val1</td><td>val2</td></tr></table></body></html>';
      expect(parseHtmlTable(html)).toEqual([
        ['Col1', 'Col2'],
        ['val1', 'val2'],
      ]);
    });

    it('extracts text from nested formatting inside cells', () => {
      const html = '<table><tr><td><strong>Bold</strong></td><td><em>Italic</em></td></tr></table>';
      expect(parseHtmlTable(html)).toEqual([['Bold', 'Italic']]);
    });
  });

  describe('table copy-paste round-trip scenarios', () => {
    it('serialized TSV round-trips through parseClipboardTable', () => {
      const original = [
        ['Name', 'Type', 'Value'],
        ['Alpha', 'CSV', '100'],
        ['Beta', 'TSV', '200'],
      ];
      const tsv = serializeTableMatrix(original, '\t');
      const parsed = parseClipboardTable(tsv);
      expect(parsed).toEqual(original);
    });

    it('serialized CSV does NOT round-trip through parseClipboardTable (CSV paste removed)', () => {
      const original = [
        ['Name', 'Description'],
        ['Item 1', 'A simple item'],
        ['Item 2', 'Another item'],
      ];
      const csv = serializeTableMatrix(original, ',');
      // CSV serialization still works for copy-to-clipboard
      expect(csv).toBe('Name,Description\nItem 1,A simple item\nItem 2,Another item');
      // But parsing CSV on paste is intentionally disabled
      expect(parseClipboardTable(csv)).toBeNull();
    });

    it('renderTableMatrixAsHtml output can be re-parsed by parseHtmlTable', () => {
      const original = [
        ['Header A', 'Header B'],
        ['Data 1', 'Data 2'],
        ['Data 3', 'Data 4'],
      ];
      const html = renderTableMatrixAsHtml(original);
      const parsed = parseHtmlTable(html);
      expect(parsed).toEqual(original);
    });

    it('HTML with <tbody> round-trips through parseHtmlTable', () => {
      // Simulating what an external source might put in clipboard
      const externalHtml =
        '<table><tbody><tr><th>Key</th><th>Value</th></tr><tr><td>name</td><td>test</td></tr></tbody></table>';
      const parsed = parseHtmlTable(externalHtml);
      expect(parsed).toEqual([
        ['Key', 'Value'],
        ['name', 'test'],
      ]);
      // Re-render without <tbody>
      const cleanHtml = renderTableMatrixAsHtml(parsed!);
      expect(cleanHtml).not.toContain('<tbody>');
      // And it still parses back correctly
      expect(parseHtmlTable(cleanHtml)).toEqual(parsed);
    });

    it('paste row into same table preserves other rows', () => {
      const instance = createTableEditor();
      const cellPositions = getTableCellPositions(instance);

      // Copy row 1 (A1, B1, C1) as TSV
      const tsv = 'A1\tB1\tC1';
      const parsed = parseClipboardTable(tsv);
      expect(parsed).toEqual([['A1', 'B1', 'C1']]);

      // Paste into row 2 (at A2)
      instance.commands.setTextSelection(cellPositions[6] + 1);
      const tr = pasteIntoCells(instance.state, parsed!);
      expect(tr).not.toBeNull();
      instance.view.dispatch(tr!);

      const matrix = getCurrentTableMatrix(instance.state);
      expect(matrix).toEqual([
        ['Col A', 'Col B', 'Col C'],
        ['A1', 'B1', 'C1'],
        ['A1', 'B1', 'C1'],
      ]);
    });

    it('paste different data into existing rows works correctly', () => {
      const instance = createTableEditor();
      const cellPositions = getTableCellPositions(instance);

      // Paste completely different data starting at B1
      instance.commands.setTextSelection(cellPositions[4] + 1);
      const tr = pasteIntoCells(instance.state, [
        ['NEW-B1', 'NEW-C1'],
        ['NEW-B2', 'NEW-C2'],
      ]);
      expect(tr).not.toBeNull();
      instance.view.dispatch(tr!);

      const matrix = getCurrentTableMatrix(instance.state);
      expect(matrix).toEqual([
        ['Col A', 'Col B', 'Col C'],
        ['A1', 'NEW-B1', 'NEW-C1'],
        ['A2', 'NEW-B2', 'NEW-C2'],
      ]);
    });

    it('paste into another table does not affect the source table', () => {
      // Create editor with 2 tables
      editor = new Editor({
        extensions: [StarterKit, TableKit],
        content: `
          <table>
            <tbody>
              <tr><th>T1-A</th><th>T1-B</th></tr>
              <tr><td>t1-1</td><td>t1-2</td></tr>
            </tbody>
          </table>
          <p>Gap between tables</p>
          <table>
            <tbody>
              <tr><th>T2-A</th><th>T2-B</th></tr>
              <tr><td>t2-1</td><td>t2-2</td></tr>
            </tbody>
          </table>
        `,
      });

      // Find all cell positions
      const cellPositions: number[] = [];
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
          cellPositions.push(pos);
        }
      });

      // Table 1 has 4 cells (0-3), Table 2 has 4 cells (4-7)
      // Paste into second table body cell
      editor.commands.setTextSelection(cellPositions[6] + 1);
      const tr = pasteIntoCells(editor.state, [['REPLACED', 'ALSO']]);
      expect(tr).not.toBeNull();
      editor.view.dispatch(tr!);

      // Verify first table is untouched by reading it
      editor.commands.setTextSelection(cellPositions[0] + 1);
      const table1 = getCurrentTableMatrix(editor.state);
      expect(table1).toEqual([
        ['T1-A', 'T1-B'],
        ['t1-1', 't1-2'],
      ]);

      // Verify second table was updated
      editor.commands.setTextSelection(cellPositions[6] + 1);
      const table2 = getCurrentTableMatrix(editor.state);
      expect(table2).toEqual([
        ['T2-A', 'T2-B'],
        ['REPLACED', 'ALSO'],
      ]);
    });
  });
});
