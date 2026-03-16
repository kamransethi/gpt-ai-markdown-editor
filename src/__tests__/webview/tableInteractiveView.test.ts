/** @jest-environment jsdom */

const moveTableColumnMock = jest.fn();
const moveTableRowMock = jest.fn();
const addColumnAfterMock = jest.fn();
const addRowAfterMock = jest.fn();
const colSelectionMock = jest.fn((anchor, head) => ({ type: 'col', anchor, head }));
const rowSelectionMock = jest.fn((anchor, head) => ({ type: 'row', anchor, head }));

jest.mock('@tiptap/extension-table', () => {
  class MockTableView {
    node: any;
    cellMinWidth: number;
    dom: HTMLDivElement;
    table: HTMLTableElement;
    colgroup: HTMLTableColElement;
    contentDOM: HTMLTableSectionElement;

    constructor(node: any, cellMinWidth: number) {
      this.node = node;
      this.cellMinWidth = cellMinWidth;
      this.dom = document.createElement('div');
      this.dom.className = 'tableWrapper';
      this.table = document.createElement('table');
      this.colgroup = document.createElement('colgroup');
      this.contentDOM = document.createElement('tbody');
      this.table.appendChild(this.colgroup);
      this.table.appendChild(this.contentDOM);
      this.dom.appendChild(this.table);

      const matrix = node.__matrix as string[][];
      matrix.forEach(rowValues => {
        const row = document.createElement('tr');
        rowValues.forEach(value => {
          const cell = document.createElement('td');
          cell.textContent = value;
          row.appendChild(cell);
        });
        this.contentDOM.appendChild(row);
      });
    }

    update(node: any) {
      this.node = node;
      return true;
    }
  }

  return { TableView: MockTableView };
});

jest.mock('@tiptap/pm/tables', () => ({
  addColumnAfter: (state: unknown, dispatch: unknown) => addColumnAfterMock(state, dispatch),
  addRowAfter: (state: unknown, dispatch: unknown) => addRowAfterMock(state, dispatch),
  CellSelection: {
    colSelection: (anchor: unknown, head: unknown) => colSelectionMock(anchor, head),
    rowSelection: (anchor: unknown, head: unknown) => rowSelectionMock(anchor, head),
  },
  TableMap: {
    get: (node: any) => node.__tableMap,
  },
  moveTableColumn: (options: unknown) => moveTableColumnMock(options),
  moveTableRow: (options: unknown) => moveTableRowMock(options),
}));

import { TableInteractiveView } from '../../webview/extensions/tableInteractiveView';

describe('TableInteractiveView', () => {
  let originalElementFromPoint: typeof document.elementFromPoint | undefined;

  const createView = () => {
    const dispatch = jest.fn();
    const command = jest.fn(() => true);
    moveTableColumnMock.mockReturnValue(command);
    moveTableRowMock.mockReturnValue(command);

    const node = {
      __matrix: [
        ['A', 'B'],
        ['C', 'D'],
      ],
      __tableMap: {
        width: 2,
        height: 2,
        map: [0, 10, 20, 30],
      },
    };

    const view = {
      dom: document.body,
      posAtDOM: jest.fn(() => 12),
      state: {
        doc: {
          resolve: (pos: number) => ({ pos }),
        },
        tr: {
          setSelection: jest.fn(selection => ({ selection })),
        },
      },
      dispatch,
    };

    const tableView = new TableInteractiveView(node as any, 25, view as any);
    document.body.appendChild(tableView.dom);
    return { tableView, view, dispatch, command };
  };

  beforeEach(() => {
    document.body.innerHTML = '';
    originalElementFromPoint = document.elementFromPoint;
    moveTableColumnMock.mockReset();
    moveTableRowMock.mockReset();
    addColumnAfterMock.mockReset();
    addRowAfterMock.mockReset();
    colSelectionMock.mockClear();
    rowSelectionMock.mockClear();
  });

  afterEach(() => {
    if (originalElementFromPoint) {
      Object.defineProperty(document, 'elementFromPoint', {
        configurable: true,
        value: originalElementFromPoint,
      });
      return;
    }

    Reflect.deleteProperty(document, 'elementFromPoint');
  });

  it('renders row and column handle controls', () => {
    const { tableView } = createView();

    expect(tableView.dom.querySelectorAll('.table-column-selector')).toHaveLength(2);
    expect(tableView.dom.querySelectorAll('.table-row-selector')).toHaveLength(2);
    expect(tableView.dom.querySelector('.table-add-column-button')).not.toBeNull();
    expect(tableView.dom.querySelector('.table-add-row-button')).not.toBeNull();
  });

  it('selects a full column from the column selector', () => {
    const { tableView, dispatch } = createView();
    const selector = tableView.dom.querySelector('.table-column-selector') as HTMLButtonElement;

    selector.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    expect(colSelectionMock).toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalled();
  });

  it('selects a full row from the row selector', () => {
    const { tableView, dispatch } = createView();
    const selector = tableView.dom.querySelector('.table-row-selector') as HTMLButtonElement;

    selector.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    expect(rowSelectionMock).toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalled();
  });

  it('moves a column when dropping a dragged column grip', () => {
    const { tableView, view, command } = createView();
    const grips = tableView.dom.querySelectorAll('.table-column-grip');

    const targetHandle = grips[1].parentElement as HTMLElement;
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: jest.fn(() => targetHandle),
    });

    grips[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 10, clientY: 10 }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 30, clientY: 10 }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 30, clientY: 10 }));

    expect(moveTableColumnMock).toHaveBeenCalledWith({ from: 0, to: 1, pos: 12 });
    expect(command).toHaveBeenCalledWith(view.state, view.dispatch, view);
  });

  it('moves a row when dropping a dragged row grip', () => {
    const { tableView, view, command } = createView();
    const grips = tableView.dom.querySelectorAll('.table-row-grip');

    const targetHandle = grips[1].parentElement as HTMLElement;
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: jest.fn(() => targetHandle),
    });

    grips[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 10, clientY: 10 }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 10, clientY: 30 }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 10, clientY: 30 }));

    expect(moveTableRowMock).toHaveBeenCalledWith({ from: 0, to: 1, pos: 12 });
    expect(command).toHaveBeenCalledWith(view.state, view.dispatch, view);
  });

  it('adds a column after the last column from the extend button', () => {
    const { tableView, dispatch, view } = createView();
    const button = tableView.dom.querySelector('.table-add-column-button') as HTMLButtonElement;

    button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    expect(colSelectionMock).toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalled();
    expect(addColumnAfterMock).toHaveBeenCalledWith(view.state, view.dispatch);
  });

  it('adds a row after the last row from the extend button', () => {
    const { tableView, dispatch, view } = createView();
    const button = tableView.dom.querySelector('.table-add-row-button') as HTMLButtonElement;

    button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    expect(rowSelectionMock).toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalled();
    expect(addRowAfterMock).toHaveBeenCalledWith(view.state, view.dispatch);
  });
});