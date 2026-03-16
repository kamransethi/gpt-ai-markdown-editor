/** @jest-environment jsdom */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TableKit } from '@tiptap/extension-table';
import {
  getCurrentTableMatrix,
  getSelectedTableMatrix,
  parseClipboardTable,
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
});
