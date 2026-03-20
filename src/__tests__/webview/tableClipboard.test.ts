/** @jest-environment jsdom */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TableKit } from '@tiptap/extension-table';
import {
  getCurrentTableMatrix,
  getSelectedTableMatrix,
  parseClipboardTable,
  pasteIntoCells,
  serializeTableMatrix,
  serializeTableMatrixAsMarkdown,
} from '../../webview/utils/tableClipboard';

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

  it('parses CSV clipboard data into a new table matrix', () => {
    expect(parseClipboardTable('Name,Type\n"My File",CSV')).toEqual([
      ['Name', 'Type'],
      ['My File', 'CSV'],
    ]);
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
});
