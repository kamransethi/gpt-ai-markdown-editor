import type { Editor } from '@tiptap/core';
import { findTable, moveTableColumn, moveTableRow, TableMap } from 'prosemirror-tables';

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

// ── Sort helpers ────────────────────────────────────────────────────

function getCellText(row: any, colIndex: number): string {
  if (colIndex >= row.childCount) return '';
  const cell = row.child(colIndex);
  return cell.textContent || '';
}

/**
 * Sort table rows by the column the cursor is in.
 *
 * @param editor - TipTap editor instance
 * @param ascending - true for A→Z / low→high, false for Z→A / high→low
 */
export function sortTableByColumn(editor: Editor, ascending: boolean): void {
  const { $from } = editor.state.selection;
  let cellDepth = -1;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
      cellDepth = d;
      break;
    }
  }
  if (cellDepth < 0) return;

  let tableDepth = -1;
  for (let d = cellDepth - 1; d > 0; d--) {
    if ($from.node(d).type.name === 'tableRow') continue;
    if ($from.node(d).type.name === 'table') {
      tableDepth = d;
      break;
    }
  }
  if (tableDepth < 0) return;

  const tableNode = $from.node(tableDepth);
  const tableStart = $from.before(tableDepth);

  // Use position-based column finding
  const cellPos = $from.before(cellDepth);
  const rowPos = $from.before(cellDepth - 1);
  let colIndex = 0;
  let accum = rowPos + 1;
  const row = $from.node(cellDepth - 1);
  for (let i = 0; i < row.childCount; i++) {
    if (accum === cellPos) {
      colIndex = i;
      break;
    }
    accum += row.child(i).nodeSize;
  }

  // Separate header row(s) from body rows
  const headerRows: any[] = [];
  const bodyRows: any[] = [];

  tableNode.forEach((r: any, _offset: number, index: number) => {
    if (index === 0 && r.firstChild?.type.name === 'tableHeader') {
      headerRows.push(r);
    } else {
      bodyRows.push(r);
    }
  });

  bodyRows.sort((a: any, b: any) => {
    const textA = getCellText(a, colIndex);
    const textB = getCellText(b, colIndex);
    const numA = parseFloat(textA);
    const numB = parseFloat(textB);
    if (!isNaN(numA) && !isNaN(numB)) {
      return ascending ? numA - numB : numB - numA;
    }
    const cmp = textA.localeCompare(textB, undefined, { sensitivity: 'base' });
    return ascending ? cmp : -cmp;
  });

  const allRows = [...headerRows, ...bodyRows];
  const { tr } = editor.state;
  const tableEnd = tableStart + tableNode.nodeSize;

  const schema = editor.state.schema;
  const newTable = schema.nodes.table.create(tableNode.attrs, allRows);

  tr.replaceWith(tableStart, tableEnd, newTable);
  editor.view.dispatch(tr);
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
  })(editor.state, editor.view.dispatch, editor.view);
}
