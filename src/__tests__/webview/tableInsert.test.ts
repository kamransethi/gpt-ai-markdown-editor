/**
 * @jest-environment jsdom
 */

import type { Editor } from '@tiptap/core';
import { hideTableInsertDialog, showTableInsertDialog } from '../../webview/features/tableInsert';

const createMockEditor = () => {
  const insertTable = jest.fn(() => ({ run: jest.fn() }));
  const chain = jest.fn(() => ({
    focus: jest.fn(() => ({
      insertTable,
      run: jest.fn(),
    })),
  }));

  // Cast as unknown then Editor since we're using a partial mock
  return { editor: { chain } as unknown as Editor, insertTable };
};

afterEach(() => {
  hideTableInsertDialog();
  document.body.innerHTML = '';
});

describe('tableInsert dialog', () => {
  it('clamps oversized values and inserts table with header row', () => {
    const { editor, insertTable } = createMockEditor();

    showTableInsertDialog(editor);

    const colsInput = document.querySelector('#table-cols-input') as HTMLInputElement;
    const rowsInput = document.querySelector('#table-rows-input') as HTMLInputElement;
    const okButton = document.querySelector('#table-ok-btn') as HTMLButtonElement;

    colsInput.value = '15'; // above max 10
    rowsInput.value = '25'; // above max 20

    okButton.click();

    expect(insertTable).toHaveBeenCalledWith({ rows: 20, cols: 10, withHeaderRow: true });
    expect(document.querySelector('.export-settings-overlay')?.classList.contains('visible')).toBe(
      false
    );
  });

  it('keeps dialog open and focuses invalid input when value is non-numeric', () => {
    const { editor, insertTable } = createMockEditor();

    showTableInsertDialog(editor);

    const colsInput = document.querySelector('#table-cols-input') as HTMLInputElement;
    const okButton = document.querySelector('#table-ok-btn') as HTMLButtonElement;

    colsInput.value = 'abc'; // invalid
    okButton.click();

    expect(insertTable).not.toHaveBeenCalled();
    expect(document.querySelector('.export-settings-overlay')?.classList.contains('visible')).toBe(
      true
    );
    expect(document.activeElement).toBe(colsInput);
  });
});
