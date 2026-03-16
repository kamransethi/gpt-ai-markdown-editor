import type { Node as ProseMirrorNode, ResolvedPos } from '@tiptap/pm/model';
import type { EditorView, NodeView } from '@tiptap/pm/view';
import {
  addColumnAfter,
  addRowAfter,
  CellSelection,
  TableMap,
  moveTableColumn,
  moveTableRow,
} from '@tiptap/pm/tables';
import { TableView } from '@tiptap/extension-table';

type Axis = 'row' | 'column';

function resolveCell(view: EditorView, pos: number): ResolvedPos {
  return view.state.doc.resolve(pos);
}

export class TableInteractiveView extends TableView implements NodeView {
  private readonly view: EditorView;
  private readonly handlesLayer: HTMLDivElement;
  private readonly cornerHandle: HTMLDivElement;
  private columnHandles: HTMLDivElement;
  private rowHandles: HTMLDivElement;
  private columnExtendHandle: HTMLDivElement;
  private rowExtendHandle: HTMLDivElement;
  private dragState:
    | {
        axis: Axis;
        index: number;
        startX: number;
        startY: number;
        active: boolean;
        targetIndex: number | null;
      }
    | null = null;
  private selectionAnchor: { axis: Axis; index: number } | null = null;
  private pointerSelecting: { axis: Axis; active: boolean } | null = null;

  constructor(node: ProseMirrorNode, cellMinWidth: number, view: EditorView) {
    super(node, cellMinWidth);
    this.view = view;
    this.dom.classList.add('table-wrapper-interactive');

    this.handlesLayer = document.createElement('div');
    this.handlesLayer.className = 'table-interaction-layer';
    this.cornerHandle = document.createElement('div');
    this.cornerHandle.className = 'table-handle-corner';
    this.columnHandles = document.createElement('div');
    this.columnHandles.className = 'table-column-handles';
    this.rowHandles = document.createElement('div');
    this.rowHandles.className = 'table-row-handles';
    this.columnExtendHandle = document.createElement('div');
    this.columnExtendHandle.className = 'table-column-extend';
    this.rowExtendHandle = document.createElement('div');
    this.rowExtendHandle.className = 'table-row-extend';

    this.handlesLayer.appendChild(this.cornerHandle);
    this.handlesLayer.appendChild(this.columnHandles);
    this.handlesLayer.appendChild(this.rowHandles);
    this.dom.appendChild(this.handlesLayer);

    this.renderHandles();
    this.view.dom.ownerDocument.addEventListener('mouseup', this.handlePointerEnd);
  }

  override update(node: ProseMirrorNode) {
    if (!super.update(node)) {
      return false;
    }

    this.renderHandles();
    return true;
  }

  destroy() {
    this.view.dom.ownerDocument.removeEventListener('mouseup', this.handlePointerEnd);
  }

  private readonly handlePointerEnd = (event?: MouseEvent) => {
    this.finishGripPointerDrag(event ?? null);
    this.pointerSelecting = null;
  };

  private readonly handleGripPointerMove = (event: MouseEvent) => {
    if (!this.dragState) {
      return;
    }

    const travelX = Math.abs(event.clientX - this.dragState.startX);
    const travelY = Math.abs(event.clientY - this.dragState.startY);
    if (!this.dragState.active && travelX < 4 && travelY < 4) {
      return;
    }

    this.dragState.active = true;
    this.dom.classList.add('is-reordering');

    const hoveredIndex = this.getHoveredHandleIndex(this.dragState.axis, event.clientX, event.clientY);
    this.updateDragTarget(hoveredIndex);
  };

  private getTableMap() {
    return TableMap.get(this.node);
  }

  private getCellPos(row: number, column: number): number {
    const map = this.getTableMap();
    return map.map[row * map.width + column] + 1;
  }

  private selectColumn(columnIndex: number, headIndex = columnIndex) {
    const anchor = resolveCell(this.view, this.getCellPos(0, columnIndex));
    const head = resolveCell(this.view, this.getCellPos(this.getTableMap().height - 1, headIndex));
    const tr = this.view.state.tr.setSelection(CellSelection.colSelection(anchor, head));
    this.view.dispatch(tr);
  }

  private selectRow(rowIndex: number, headIndex = rowIndex) {
    const anchor = resolveCell(this.view, this.getCellPos(rowIndex, 0));
    const head = resolveCell(this.view, this.getCellPos(headIndex, this.getTableMap().width - 1));
    const tr = this.view.state.tr.setSelection(CellSelection.rowSelection(anchor, head));
    this.view.dispatch(tr);
  }

  private onSelectorPointerDown(axis: Axis, index: number, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.selectionAnchor = { axis, index };
    this.pointerSelecting = { axis, active: true };

    if (axis === 'column') {
      this.selectColumn(index);
    } else {
      this.selectRow(index);
    }
  }

  private onSelectorPointerEnter(axis: Axis, index: number) {
    if (!this.pointerSelecting?.active || this.pointerSelecting.axis !== axis || !this.selectionAnchor) {
      return;
    }

    const start = this.selectionAnchor.index;
    if (axis === 'column') {
      this.selectColumn(start, index);
    } else {
      this.selectRow(start, index);
    }
  }

  private onSelectorClick(axis: Axis, index: number, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    if (event.shiftKey && this.selectionAnchor?.axis === axis) {
      if (axis === 'column') {
        this.selectColumn(this.selectionAnchor.index, index);
      } else {
        this.selectRow(this.selectionAnchor.index, index);
      }
      return;
    }

    this.selectionAnchor = { axis, index };
    if (axis === 'column') {
      this.selectColumn(index);
    } else {
      this.selectRow(index);
    }
  }

  private startGripPointerDrag(axis: Axis, index: number, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    this.finishGripPointerDrag(null);
    this.dragState = {
      axis,
      index,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
      targetIndex: null,
    };

    this.view.dom.ownerDocument.addEventListener('mousemove', this.handleGripPointerMove);
  }

  private getHoveredHandleIndex(axis: Axis, clientX: number, clientY: number): number | null {
    const hoveredElement = this.view.dom.ownerDocument.elementFromPoint(clientX, clientY) as HTMLElement | null;
    const handleClass = axis === 'column' ? '.table-column-handle' : '.table-row-handle';
    const handle = hoveredElement?.closest(handleClass) as HTMLElement | null;
    if (!handle) {
      return null;
    }

    const rawIndex = handle.dataset.index;
    if (typeof rawIndex !== 'string') {
      return null;
    }

    const parsedIndex = Number.parseInt(rawIndex, 10);
    return Number.isFinite(parsedIndex) ? parsedIndex : null;
  }

  private updateDragTarget(targetIndex: number | null) {
    const axis = this.dragState?.axis;
    const handles = axis === 'column' ? this.columnHandles.children : this.rowHandles.children;

    Array.from(handles).forEach(handle => handle.classList.remove('is-drop-target'));

    if (this.dragState) {
      this.dragState.targetIndex = targetIndex;
    }

    if (targetIndex === null || !axis || targetIndex === this.dragState?.index) {
      return;
    }

    const selector = axis === 'column' ? `.table-column-handle[data-index="${targetIndex}"]` : `.table-row-handle[data-index="${targetIndex}"]`;
    const handle = this.dom.querySelector(selector);
    handle?.classList.add('is-drop-target');
  }

  private finishGripPointerDrag(event: MouseEvent | null) {
    if (!this.dragState) {
      return;
    }

    const currentDrag = this.dragState;
    this.view.dom.ownerDocument.removeEventListener('mousemove', this.handleGripPointerMove);
    this.dom.classList.remove('is-reordering');
    this.updateDragTarget(null);
    this.dragState = null;

    if (!currentDrag.active) {
      return;
    }

    const dropIndex = currentDrag.targetIndex ?? (event ? this.getHoveredHandleIndex(currentDrag.axis, event.clientX, event.clientY) : null);
    if (dropIndex === null || dropIndex === currentDrag.index) {
      return;
    }

    const tablePos = this.view.posAtDOM(this.table, 0);
    const command =
      currentDrag.axis === 'column'
        ? moveTableColumn({ from: currentDrag.index, to: dropIndex, pos: tablePos })
        : moveTableRow({ from: currentDrag.index, to: dropIndex, pos: tablePos });

    command(this.view.state, this.view.dispatch, this.view);
  }

  private addColumnAtEnd(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    const map = this.getTableMap();
    const lastColumnIndex = Math.max(map.width - 1, 0);
    const anchor = resolveCell(this.view, this.getCellPos(0, lastColumnIndex));
    const head = resolveCell(this.view, this.getCellPos(map.height - 1, lastColumnIndex));
    const tr = this.view.state.tr.setSelection(CellSelection.colSelection(anchor, head));
    this.view.dispatch(tr);
    addColumnAfter(this.view.state, this.view.dispatch);
  }

  private addRowAtEnd(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    const map = this.getTableMap();
    const lastRowIndex = Math.max(map.height - 1, 0);
    const anchor = resolveCell(this.view, this.getCellPos(lastRowIndex, 0));
    const head = resolveCell(this.view, this.getCellPos(lastRowIndex, map.width - 1));
    const tr = this.view.state.tr.setSelection(CellSelection.rowSelection(anchor, head));
    this.view.dispatch(tr);
    addRowAfter(this.view.state, this.view.dispatch);
  }

  private getColumnWidth(columnIndex: number): number {
    const firstRow = this.table.rows.item(0);
    const cell = firstRow?.cells.item(columnIndex) as HTMLElement | null;
    return cell?.getBoundingClientRect().width || 120;
  }

  private getRowHeight(rowIndex: number): number {
    const row = this.table.rows.item(rowIndex) as HTMLTableRowElement | null;
    return row?.getBoundingClientRect().height || 32;
  }

  private renderHandles() {
    this.columnHandles.innerHTML = '';
    this.rowHandles.innerHTML = '';

    const map = this.getTableMap();

    for (let columnIndex = 0; columnIndex < map.width; columnIndex += 1) {
      const item = document.createElement('div');
      item.className = 'table-column-handle';
      item.dataset.index = String(columnIndex);
      item.style.width = `${this.getColumnWidth(columnIndex)}px`;

      const selector = document.createElement('button');
      selector.type = 'button';
      selector.className = 'table-axis-selector table-column-selector';
      selector.title = `Select column ${columnIndex + 1}`;
      selector.setAttribute('aria-label', `Select column ${columnIndex + 1}`);

      const grip = document.createElement('button');
      grip.type = 'button';
      grip.className = 'table-axis-grip table-column-grip';
      grip.title = `Move column ${columnIndex + 1}`;
      grip.setAttribute('aria-label', `Move column ${columnIndex + 1}`);
      grip.textContent = '⋯';

      selector.addEventListener('mousedown', event => this.onSelectorPointerDown('column', columnIndex, event));
      selector.addEventListener('mouseenter', () => this.onSelectorPointerEnter('column', columnIndex));
      selector.addEventListener('click', event => this.onSelectorClick('column', columnIndex, event));
      grip.addEventListener('mousedown', event => this.startGripPointerDrag('column', columnIndex, event));

      item.appendChild(selector);
      item.appendChild(grip);
      this.columnHandles.appendChild(item);
    }

    const columnExtendButton = document.createElement('button');
    columnExtendButton.type = 'button';
    columnExtendButton.className = 'table-axis-extend table-add-column-button';
    columnExtendButton.title = 'Add column after last column';
    columnExtendButton.setAttribute('aria-label', 'Add column after last column');
    columnExtendButton.textContent = '+';
    columnExtendButton.addEventListener('mousedown', event => this.addColumnAtEnd(event));
    this.columnExtendHandle.replaceChildren(columnExtendButton);
    this.columnHandles.appendChild(this.columnExtendHandle);

    for (let rowIndex = 0; rowIndex < map.height; rowIndex += 1) {
      const item = document.createElement('div');
      item.className = 'table-row-handle';
      item.dataset.index = String(rowIndex);
      item.style.height = `${this.getRowHeight(rowIndex)}px`;

      const selector = document.createElement('button');
      selector.type = 'button';
      selector.className = 'table-axis-selector table-row-selector';
      selector.title = `Select row ${rowIndex + 1}`;
      selector.setAttribute('aria-label', `Select row ${rowIndex + 1}`);

      const grip = document.createElement('button');
      grip.type = 'button';
      grip.className = 'table-axis-grip table-row-grip';
      grip.title = `Move row ${rowIndex + 1}`;
      grip.setAttribute('aria-label', `Move row ${rowIndex + 1}`);
      grip.textContent = '⋮';

      selector.addEventListener('mousedown', event => this.onSelectorPointerDown('row', rowIndex, event));
      selector.addEventListener('mouseenter', () => this.onSelectorPointerEnter('row', rowIndex));
      selector.addEventListener('click', event => this.onSelectorClick('row', rowIndex, event));
      grip.addEventListener('mousedown', event => this.startGripPointerDrag('row', rowIndex, event));

      item.appendChild(selector);
      item.appendChild(grip);
      this.rowHandles.appendChild(item);
    }

    const rowExtendButton = document.createElement('button');
    rowExtendButton.type = 'button';
    rowExtendButton.className = 'table-axis-extend table-add-row-button';
    rowExtendButton.title = 'Add row after last row';
    rowExtendButton.setAttribute('aria-label', 'Add row after last row');
    rowExtendButton.textContent = '+';
    rowExtendButton.addEventListener('mousedown', event => this.addRowAtEnd(event));
    this.rowExtendHandle.replaceChildren(rowExtendButton);
    this.rowHandles.appendChild(this.rowExtendHandle);
  }
}