import type { Editor } from '@tiptap/core';
import { findTable, moveTableColumn, moveTableRow, TableMap } from '@tiptap/pm/tables';

function getSelectedTableCellLocation(editor: Editor): {
  tablePos: number;
  rowIndex: number;
  columnIndex: number;
  rowCount: number;
  columnCount: number;
} | null {
  const { $from } = editor.state.selection;
  const table = findTable($from);
  if (!table) {
    return null;
  }

  let cellStart = -1;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
      cellStart = $from.before(depth);
      break;
    }
  }

  if (cellStart < 0) {
    return null;
  }

  const map = TableMap.get(table.node);
  const relativeCellPos = cellStart - table.pos - 1;
  const cellIndex = map.map.indexOf(relativeCellPos);
  if (cellIndex < 0) {
    return null;
  }

  return {
    tablePos: table.pos,
    rowIndex: Math.floor(cellIndex / map.width),
    columnIndex: cellIndex % map.width,
    rowCount: map.height,
    columnCount: map.width,
  };
}

export function moveSelectedTableRow(editor: Editor, direction: 'up' | 'down'): boolean {
  const location = getSelectedTableCellLocation(editor);
  if (!location) {
    return false;
  }

  const offset = direction === 'up' ? -1 : 1;
  const targetIndex = location.rowIndex + offset;
  if (targetIndex < 0 || targetIndex >= location.rowCount) {
    return false;
  }

  return moveTableRow({
    from: location.rowIndex,
    to: targetIndex,
    pos: location.tablePos,
  })(editor.state, editor.view.dispatch, editor.view);
}

export function moveSelectedTableColumn(editor: Editor, direction: 'left' | 'right'): boolean {
  const location = getSelectedTableCellLocation(editor);
  if (!location) {
    return false;
  }

  const offset = direction === 'left' ? -1 : 1;
  const targetIndex = location.columnIndex + offset;
  if (targetIndex < 0 || targetIndex >= location.columnCount) {
    return false;
  }

  return moveTableColumn({
    from: location.columnIndex,
    to: targetIndex,
    pos: location.tablePos,
  })(editor.state, editor.view.dispatch, editor.view);
}
