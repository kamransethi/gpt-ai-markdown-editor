import type { EditorState, Selection, Transaction } from '@tiptap/pm/state';
import type { Node as ProseMirrorNode, Schema } from '@tiptap/pm/model';
import { CellSelection, TableMap, findTable, selectedRect } from 'prosemirror-tables';

export type TableMatrix = string[][];

function normalizeCellText(cell: ProseMirrorNode | null): string {
  if (!cell) {
    return '';
  }

  return cell.textBetween(0, cell.content.size, '\n', '\n').trim();
}

function getMatrixFromTable(
  table: ProseMirrorNode,
  rect?: { left: number; right: number; top: number; bottom: number }
): TableMatrix {
  const map = TableMap.get(table);
  const bounds = rect ?? { left: 0, right: map.width, top: 0, bottom: map.height };
  const rows: TableMatrix = [];

  for (let rowIndex = bounds.top; rowIndex < bounds.bottom; rowIndex += 1) {
    const row: string[] = [];

    for (let colIndex = bounds.left; colIndex < bounds.right; colIndex += 1) {
      const cellPos = map.map[rowIndex * map.width + colIndex];
      const cellNode = table.nodeAt(cellPos);
      row.push(normalizeCellText(cellNode));
    }

    rows.push(row);
  }

  return rows;
}

export function getSelectedTableMatrix(state: EditorState): TableMatrix | null {
  if (!(state.selection instanceof CellSelection)) {
    return null;
  }

  const rect = selectedRect(state);
  return getMatrixFromTable(rect.table, rect);
}

export function getCurrentTableMatrix(state: EditorState): TableMatrix | null {
  const selectedMatrix = getSelectedTableMatrix(state);
  if (selectedMatrix) {
    return selectedMatrix;
  }

  const tableResult = findTable(state.selection.$from);
  if (!tableResult) {
    return null;
  }

  return getMatrixFromTable(tableResult.node);
}

function quoteCsvCell(value: string): string {
  if (!/[",\n\r]/.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '""')}"`;
}

export function serializeTableMatrix(matrix: TableMatrix, delimiter: '\t' | ','): string {
  return matrix
    .map(row =>
      row
        .map(cell => (delimiter === ',' ? quoteCsvCell(cell) : cell.replace(/\t/g, '    ')))
        .join(delimiter)
    )
    .join('\n');
}

export function serializeTableMatrixAsMarkdown(matrix: TableMatrix): string {
  if (matrix.length === 0 || matrix[0].length === 0) {
    return '';
  }

  const columnCount = Math.max(...matrix.map(row => row.length));
  const normalized = matrix.map(row =>
    Array.from({ length: columnCount }, (_, index) => row[index] ?? '')
  );
  const header = normalized[0];
  const divider = Array.from({ length: columnCount }, () => '---');
  const bodyRows = normalized.slice(1);
  const lines = [header, divider, ...bodyRows].map(
    row => `| ${row.map(cell => cell.replace(/\n/g, '<br />')).join(' | ')} |`
  );
  return `${lines.join('\n')}\n`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderTableMatrixAsHtml(matrix: TableMatrix): string {
  if (matrix.length === 0 || matrix[0].length === 0) {
    return '';
  }

  const columnCount = Math.max(...matrix.map(row => row.length));
  const normalized = matrix.map(row =>
    Array.from({ length: columnCount }, (_, index) => row[index] ?? '')
  );
  const [headerRow, ...bodyRows] = normalized;
  const renderRow = (row: string[], cellTag: 'th' | 'td') =>
    `<tr>${row
      .map(cell => `<${cellTag}>${escapeHtml(cell).replace(/\n/g, '<br />')}</${cellTag}>`)
      .join('')}</tr>`;

  return `<table><tbody>${renderRow(headerRow, 'th')}${bodyRows
    .map(row => renderRow(row, 'td'))
    .join('')}</tbody></table>`;
}

type DelimiterDetection = '\t' | ',' | null;

function detectClipboardDelimiter(text: string): DelimiterDetection {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trimEnd())
    .filter(Boolean);

  if (lines.length === 0) {
    return null;
  }

  if (lines.some(line => line.includes('\t'))) {
    return '\t';
  }

  const commaStructuredLines = lines.filter(line => line.includes(','));
  if (commaStructuredLines.length >= 1) {
    return ',';
  }

  return null;
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

export function parseClipboardTable(text: string): TableMatrix | null {
  const delimiter = detectClipboardDelimiter(text);
  if (!delimiter) {
    return null;
  }

  const rows = text
    .split(/\r?\n/)
    .filter(line => line.length > 0)
    .map(line => (delimiter === '\t' ? line.split('\t') : parseCsvLine(line)));

  const maxColumns = Math.max(...rows.map(row => row.length), 0);
  if (rows.length === 0 || maxColumns < 2) {
    return null;
  }

  return rows.map(row => Array.from({ length: maxColumns }, (_, index) => row[index] ?? ''));
}

export function isTableSelection(selection: Selection): selection is CellSelection {
  return selection instanceof CellSelection;
}

/**
 * Find the current cell's row and column index within its table.
 * Returns null if the selection is not inside a table cell.
 */
function findCellPosition(
  state: EditorState
): { tableStart: number; table: ProseMirrorNode; row: number; col: number } | null {
  const tableResult = findTable(state.selection.$from);
  if (!tableResult) return null;

  const { node: table, pos: tablePos } = tableResult;
  const map = TableMap.get(table);
  const cellPos = state.selection.$from.pos - (tablePos + 1);

  // Find which cell contains the cursor
  for (let row = 0; row < map.height; row++) {
    for (let col = 0; col < map.width; col++) {
      const cellStart = map.map[row * map.width + col];
      const cell = table.nodeAt(cellStart);
      if (!cell) continue;
      const cellEnd = cellStart + cell.nodeSize;
      if (cellPos >= cellStart && cellPos < cellEnd) {
        return { tableStart: tablePos + 1, table, row, col };
      }
    }
  }
  return null;
}

/**
 * Paste a matrix of text values into existing table cells, starting from
 * the current cursor position. Overwrites cell content but does not
 * add/remove rows or columns.
 * Returns the transaction if successful, null otherwise.
 */
export function pasteIntoCells(
  state: EditorState,
  matrix: TableMatrix
): Transaction | null {
  const pos = findCellPosition(state);
  if (!pos) return null;

  const { tableStart, table, row: startRow, col: startCol } = pos;
  const map = TableMap.get(table);
  const schema: Schema = state.schema;
  let tr = state.tr;

  for (let r = 0; r < matrix.length; r++) {
    const targetRow = startRow + r;
    if (targetRow >= map.height) break;

    for (let c = 0; c < matrix[r].length; c++) {
      const targetCol = startCol + c;
      if (targetCol >= map.width) break;

      const cellOffset = map.map[targetRow * map.width + targetCol];
      const cell = table.nodeAt(cellOffset);
      if (!cell) continue;

      const cellStart = tableStart + cellOffset + 1; // inside the cell node
      const cellEnd = cellStart + cell.content.size;

      const text = matrix[r][c];
      const paragraph = schema.nodes.paragraph.create(
        null,
        text ? schema.text(text) : null
      );

      tr = tr.replaceWith(
        tr.mapping.map(cellStart),
        tr.mapping.map(cellEnd),
        paragraph.content
      );
    }
  }

  return tr;
}
