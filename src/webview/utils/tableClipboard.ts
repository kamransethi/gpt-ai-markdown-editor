import type { EditorState, Selection, Transaction } from '@tiptap/pm/state';
import type { Node as ProseMirrorNode, Schema } from '@tiptap/pm/model';
import { CellSelection, TableMap, findTable, selectedRect } from 'prosemirror-tables';

export type TableMatrix = string[][];

/**
 * Parse an HTML string containing a `<table>` into a TableMatrix.
 * Uses the browser's DOMParser to extract cell text from `<th>` and `<td>` elements.
 * Returns null if the HTML doesn't contain a valid table with at least 2 columns.
 */
export function parseHtmlTable(html: string): TableMatrix | null {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const table = doc.querySelector('table');
  if (!table) return null;

  const rows = Array.from(table.querySelectorAll('tr'));
  if (rows.length === 0) return null;

  const matrix: TableMatrix = rows.map(row => {
    const cells = Array.from(row.querySelectorAll('th, td'));
    return cells.map(cell => (cell.textContent || '').trim());
  });

  const maxCols = Math.max(...matrix.map(r => r.length), 0);
  if (maxCols < 2) return null;

  // Normalize column count
  return matrix.map(row => Array.from({ length: maxCols }, (_, i) => row[i] ?? ''));
}

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
      .map(cell => {
        const content = escapeHtml(cell).replace(/\n/g, '<br />');
        // ProseMirror requires at least one block node inside table cells.
        // Empty <td></td> violates the schema — wrap with <p></p>.
        return `<${cellTag}>${content || '<p></p>'}</${cellTag}>`;
      })
      .join('')}</tr>`;

  return `<table>${renderRow(headerRow, 'th')}${bodyRows
    .map(row => renderRow(row, 'td'))
    .join('')}</table>`;
}

/**
 * Parse tab-separated plain text into a table matrix.
 * Only supports TSV (tab-delimited) — CSV is intentionally NOT supported
 * because commas in prose ("positive, negative, edge cases") produce
 * false-positive table detection. For CSV data, use HTML table paste instead.
 */
export function parseClipboardTable(text: string): TableMatrix | null {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trimEnd())
    .filter(Boolean);

  if (lines.length === 0) {
    return null;
  }

  // Only detect tabs — they are unambiguous (prose never contains literal tabs)
  const hasTabLines = lines.some(line => line.includes('\t'));
  if (!hasTabLines) {
    return null;
  }

  const rows = lines.map(line => line.split('\t'));
  const maxColumns = Math.max(...rows.map(row => row.length), 0);
  if (maxColumns < 2) {
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
export function pasteIntoCells(state: EditorState, matrix: TableMatrix): Transaction | null {
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
      const paragraph = schema.nodes.paragraph.create(null, text ? schema.text(text) : null);

      tr = tr.replaceWith(tr.mapping.map(cellStart), tr.mapping.map(cellEnd), paragraph.content);
    }
  }

  return tr;
}
