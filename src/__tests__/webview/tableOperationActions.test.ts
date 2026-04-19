/** @jest-environment jsdom */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TableKit } from '@tiptap/extension-table';
import {
  moveSelectedTableRow,
  moveSelectedTableColumn,
} from '../../webview/utils/tableOperationActions';

describe('tableOperationActions', () => {
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
            <tr><td>Row0-Col0</td><td>Row0-Col1</td><td>Row0-Col2</td></tr>
            <tr><td>Row1-Col0</td><td>Row1-Col1</td><td>Row1-Col2</td></tr>
            <tr><td>Row2-Col0</td><td>Row2-Col1</td><td>Row2-Col2</td></tr>
          </tbody>
        </table>
      `,
    });
    return editor;
  }

  /** Returns cell text contents row by row */
  function getTableRows(instance: Editor): string[][] {
    const rows: string[][] = [];
    instance.state.doc.descendants((node): boolean | void => {
      if (node.type.name === 'tableRow') {
        const cells: string[] = [];
        node.forEach(cell => {
          cells.push(cell.textContent);
        });
        rows.push(cells);
        return false; // don't descend into cells
      }
    });
    return rows;
  }

  /** Move cursor into the cell at the given row/column (0-indexed) */
  function focusCell(instance: Editor, row: number, col: number): void {
    const positions: number[] = [];
    instance.state.doc.descendants((node, pos) => {
      if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
        positions.push(pos + 1); // +1 to go inside the cell
      }
    });
    const index = row * 3 + col; // 3 columns in test table
    instance.commands.setTextSelection(positions[index]);
  }

  // ─── Move Row ──────────────────────────────────────────────────────────────

  it('moves row 1 up to row 0', () => {
    const instance = createTableEditor();
    focusCell(instance, 1, 0);

    const result = moveSelectedTableRow(instance, 'up');

    expect(result).toBe(true);
    const rows = getTableRows(instance);
    expect(rows[0]).toEqual(['Row1-Col0', 'Row1-Col1', 'Row1-Col2']);
    expect(rows[1]).toEqual(['Row0-Col0', 'Row0-Col1', 'Row0-Col2']);
    expect(rows[2]).toEqual(['Row2-Col0', 'Row2-Col1', 'Row2-Col2']);
  });

  it('moves row 1 down to row 2', () => {
    const instance = createTableEditor();
    focusCell(instance, 1, 0);

    const result = moveSelectedTableRow(instance, 'down');

    expect(result).toBe(true);
    const rows = getTableRows(instance);
    expect(rows[0]).toEqual(['Row0-Col0', 'Row0-Col1', 'Row0-Col2']);
    expect(rows[1]).toEqual(['Row2-Col0', 'Row2-Col1', 'Row2-Col2']);
    expect(rows[2]).toEqual(['Row1-Col0', 'Row1-Col1', 'Row1-Col2']);
  });

  it('returns false when moving the first row up', () => {
    const instance = createTableEditor();
    focusCell(instance, 0, 0);

    const result = moveSelectedTableRow(instance, 'up');

    expect(result).toBe(false);
    // Table should be unchanged
    const rows = getTableRows(instance);
    expect(rows[0]).toEqual(['Row0-Col0', 'Row0-Col1', 'Row0-Col2']);
  });

  it('returns false when moving the last row down', () => {
    const instance = createTableEditor();
    focusCell(instance, 2, 0);

    const result = moveSelectedTableRow(instance, 'down');

    expect(result).toBe(false);
    const rows = getTableRows(instance);
    expect(rows[2]).toEqual(['Row2-Col0', 'Row2-Col1', 'Row2-Col2']);
  });

  // ─── Move Column ──────────────────────────────────────────────────────────

  it('moves column 1 left to column 0', () => {
    const instance = createTableEditor();
    focusCell(instance, 0, 1);

    const result = moveSelectedTableColumn(instance, 'left');

    expect(result).toBe(true);
    const rows = getTableRows(instance);
    expect(rows[0]).toEqual(['Row0-Col1', 'Row0-Col0', 'Row0-Col2']);
    expect(rows[1]).toEqual(['Row1-Col1', 'Row1-Col0', 'Row1-Col2']);
  });

  it('moves column 1 right to column 2', () => {
    const instance = createTableEditor();
    focusCell(instance, 0, 1);

    const result = moveSelectedTableColumn(instance, 'right');

    expect(result).toBe(true);
    const rows = getTableRows(instance);
    expect(rows[0]).toEqual(['Row0-Col0', 'Row0-Col2', 'Row0-Col1']);
    expect(rows[1]).toEqual(['Row1-Col0', 'Row1-Col2', 'Row1-Col1']);
  });

  it('returns false when moving the first column left', () => {
    const instance = createTableEditor();
    focusCell(instance, 0, 0);

    const result = moveSelectedTableColumn(instance, 'left');

    expect(result).toBe(false);
    const rows = getTableRows(instance);
    expect(rows[0][0]).toBe('Row0-Col0');
  });

  it('returns false when moving the last column right', () => {
    const instance = createTableEditor();
    focusCell(instance, 0, 2);

    const result = moveSelectedTableColumn(instance, 'right');

    expect(result).toBe(false);
    const rows = getTableRows(instance);
    expect(rows[0][2]).toBe('Row0-Col2');
  });
});
