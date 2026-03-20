/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Google Docs-style table context menu for the WYSIWYG markdown editor.
 * Shows on right-click inside a table cell. Includes clipboard ops,
 * insert/delete row/column with icon buttons, move row/column,
 * link insertion, sort, and export.
 *
 * @module tableContextMenu
 */

import type { Editor } from '@tiptap/core';
import { moveSelectedTableRow, moveSelectedTableColumn } from '../utils/tableOperationActions';
import { showLinkDialog } from './linkDialog';
import { MenuBuilder } from '../utils/menuBuilder';
import { modSymbol as mod } from '../utils/platform';

// ── Types ───────────────────────────────────────────────────────────

interface TableContextMenuController {
  element: HTMLElement;
  show: (x: number, y: number, contextPos?: number) => void;
  hide: () => void;
  destroy: () => void;
}

// ── Sort helpers ────────────────────────────────────────────────────

function sortTableByColumn(editor: Editor, ascending: boolean): void {
  // Find the current column from selection
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

  // Find the table node
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

  // Determine current column index
  const rowNode = $from.node(cellDepth - 1); // parent row
  let colIndex = 0;
  for (let i = 0; i < rowNode.childCount; i++) {
    if (rowNode.child(i) === $from.node(cellDepth)) break;
    // We can't directly compare nodes by reference in all cases
    // Use position instead
    colIndex = i;
  }

  // Use position-based column finding
  const cellPos = $from.before(cellDepth);
  const rowPos = $from.before(cellDepth - 1);
  let computedColIndex = 0;
  let accum = rowPos + 1; // skip the row open tag
  const row = $from.node(cellDepth - 1);
  for (let i = 0; i < row.childCount; i++) {
    if (accum === cellPos) {
      computedColIndex = i;
      break;
    }
    accum += row.child(i).nodeSize;
  }
  colIndex = computedColIndex;

  // Separate header row(s) from body rows
  const headerRows: any[] = [];
  const bodyRows: any[] = [];

  tableNode.forEach((row: any, _offset: number, index: number) => {
    // First row with tableHeader cells is the header
    if (index === 0 && row.firstChild?.type.name === 'tableHeader') {
      headerRows.push(row);
    } else {
      bodyRows.push(row);
    }
  });

  // Sort body rows by text content of the target column
  bodyRows.sort((a: any, b: any) => {
    const textA = getCellText(a, colIndex);
    const textB = getCellText(b, colIndex);
    // Try numeric comparison first
    const numA = parseFloat(textA);
    const numB = parseFloat(textB);
    if (!isNaN(numA) && !isNaN(numB)) {
      return ascending ? numA - numB : numB - numA;
    }
    const cmp = textA.localeCompare(textB, undefined, { sensitivity: 'base' });
    return ascending ? cmp : -cmp;
  });

  // Rebuild table with same structure
  const allRows = [...headerRows, ...bodyRows];
  const { tr } = editor.state;
  const tableEnd = tableStart + tableNode.nodeSize;

  // Replace table content
  const schema = editor.state.schema;
  const newTable = schema.nodes.table.create(tableNode.attrs, allRows);

  tr.replaceWith(tableStart, tableEnd, newTable);
  editor.view.dispatch(tr);
}

function getCellText(row: any, colIndex: number): string {
  if (colIndex >= row.childCount) return '';
  const cell = row.child(colIndex);
  return cell.textContent || '';
}

// ── Builder ─────────────────────────────────────────────────────────

export function createTableContextMenu(editor: Editor): TableContextMenuController {
  const mb = new MenuBuilder('context-menu table-context-menu', 'Table context menu');

  // Track the right-clicked position for restoring context
  let contextPos: number | null = null;

  const restoreContextSelection = () => {
    if (contextPos == null) return;
    const chain = editor.chain().focus();
    if (typeof (chain as any).setTextSelection === 'function') {
      (chain as any).setTextSelection(contextPos).run();
    } else {
      chain.run();
    }
  };

  // Hook: restore context position before every action
  mb.onBeforeAction = restoreContextSelection;

  // ═════════════════════════════════════════════════════════════════
  //  MENU ITEMS
  // ═════════════════════════════════════════════════════════════════

  // ── CLIPBOARD ──
  mb.addItem('Cut', () => document.execCommand('cut'), { shortcut: `${mod}X` });
  mb.addItem('Copy', () => document.execCommand('copy'), { shortcut: `${mod}C` });
  mb.addItem('Paste', () => document.execCommand('paste'), { shortcut: `${mod}V` });
  mb.addItem('Delete', () => editor.chain().focus().deleteSelection().run());

  mb.addSeparator();

  // ── INSERT (icon buttons) ──
  mb.addSectionLabel('Insert');

  // SVG icons for the 4 insert directions
  const svgRowAbove =
    '<svg width="18" height="18" viewBox="0 0 18 18"><rect x="2" y="8" width="14" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/><line x1="9" y1="8" x2="9" y2="16" stroke="currentColor" stroke-width="1.2"/><line x1="2" y1="12" x2="16" y2="12" stroke="currentColor" stroke-width="1.2"/><path d="M9 2 L6 5 L12 5 Z" fill="currentColor"/></svg>';
  const svgRowBelow =
    '<svg width="18" height="18" viewBox="0 0 18 18"><rect x="2" y="2" width="14" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/><line x1="9" y1="2" x2="9" y2="10" stroke="currentColor" stroke-width="1.2"/><line x1="2" y1="6" x2="16" y2="6" stroke="currentColor" stroke-width="1.2"/><path d="M9 16 L6 13 L12 13 Z" fill="currentColor"/></svg>';
  const svgColLeft =
    '<svg width="18" height="18" viewBox="0 0 18 18"><rect x="8" y="2" width="8" height="14" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/><line x1="8" y1="9" x2="16" y2="9" stroke="currentColor" stroke-width="1.2"/><line x1="12" y1="2" x2="12" y2="16" stroke="currentColor" stroke-width="1.2"/><path d="M2 9 L5 6 L5 12 Z" fill="currentColor"/></svg>';
  const svgColRight =
    '<svg width="18" height="18" viewBox="0 0 18 18"><rect x="2" y="2" width="8" height="14" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/><line x1="2" y1="9" x2="10" y2="9" stroke="currentColor" stroke-width="1.2"/><line x1="6" y1="2" x2="6" y2="16" stroke="currentColor" stroke-width="1.2"/><path d="M16 9 L13 6 L13 12 Z" fill="currentColor"/></svg>';

  mb.addButtonRow([
    {
      icon: svgRowAbove,
      title: 'Insert row above',
      action: () => editor.chain().focus().addRowBefore().run(),
    },
    {
      icon: svgRowBelow,
      title: 'Insert row below',
      action: () => editor.chain().focus().addRowAfter().run(),
    },
    {
      icon: svgColLeft,
      title: 'Insert column left',
      action: () => editor.chain().focus().addColumnBefore().run(),
    },
    {
      icon: svgColRight,
      title: 'Insert column right',
      action: () => editor.chain().focus().addColumnAfter().run(),
    },
  ]);

  mb.addSeparator();

  // ── MOVE ROW / COLUMN ──
  mb.addSectionLabel('Move');

  const svgMoveUp =
    '<svg width="18" height="18" viewBox="0 0 18 18"><path d="M9 3 L5 7 L13 7 Z" fill="currentColor"/><line x1="9" y1="7" x2="9" y2="15" stroke="currentColor" stroke-width="1.6"/></svg>';
  const svgMoveDown =
    '<svg width="18" height="18" viewBox="0 0 18 18"><path d="M9 15 L5 11 L13 11 Z" fill="currentColor"/><line x1="9" y1="3" x2="9" y2="11" stroke="currentColor" stroke-width="1.6"/></svg>';
  const svgMoveLeft =
    '<svg width="18" height="18" viewBox="0 0 18 18"><path d="M3 9 L7 5 L7 13 Z" fill="currentColor"/><line x1="7" y1="9" x2="15" y2="9" stroke="currentColor" stroke-width="1.6"/></svg>';
  const svgMoveRight =
    '<svg width="18" height="18" viewBox="0 0 18 18"><path d="M15 9 L11 5 L11 13 Z" fill="currentColor"/><line x1="3" y1="9" x2="11" y2="9" stroke="currentColor" stroke-width="1.6"/></svg>';

  mb.addButtonRow([
    {
      icon: svgMoveUp,
      title: 'Move row up',
      action: () => {
        editor.chain().focus().run();
        moveSelectedTableRow(editor, 'up');
      },
    },
    {
      icon: svgMoveDown,
      title: 'Move row down',
      action: () => {
        editor.chain().focus().run();
        moveSelectedTableRow(editor, 'down');
      },
    },
    {
      icon: svgMoveLeft,
      title: 'Move column left',
      action: () => {
        editor.chain().focus().run();
        moveSelectedTableColumn(editor, 'left');
      },
    },
    {
      icon: svgMoveRight,
      title: 'Move column right',
      action: () => {
        editor.chain().focus().run();
        moveSelectedTableColumn(editor, 'right');
      },
    },
  ]);

  mb.addSeparator();

  // ── LINK ──
  mb.addItem('Insert Link', () => showLinkDialog(editor), { shortcut: `${mod}K` });

  mb.addSeparator();

  // ── DELETE (icon buttons — all on one row) ──
  mb.addSectionLabel('Delete');

  mb.addButtonRow([
    {
      icon: '<svg width="18" height="18" viewBox="0 0 18 18"><rect x="2" y="4" width="14" height="12" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><line x1="2" y1="10" x2="16" y2="10" stroke="currentColor" stroke-width="1.2"/><line x1="9" y1="4" x2="9" y2="16" stroke="currentColor" stroke-width="1.2"/><line x1="4" y1="6.5" x2="14" y2="6.5" stroke="var(--md-error-fg)" stroke-width="2"/><line x1="6" y1="2" x2="12" y2="2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
      title: 'Delete row',
      action: () => editor.chain().focus().deleteRow().run(),
    },
    {
      icon: '<svg width="18" height="18" viewBox="0 0 18 18"><rect x="2" y="2" width="14" height="14" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><line x1="2" y1="9" x2="16" y2="9" stroke="currentColor" stroke-width="1.2"/><line x1="9" y1="2" x2="9" y2="16" stroke="currentColor" stroke-width="1.2"/><line x1="5.5" y1="4" x2="5.5" y2="14" stroke="var(--md-error-fg)" stroke-width="2"/></svg>',
      title: 'Delete column',
      action: () => editor.chain().focus().deleteColumn().run(),
    },
    {
      icon: '<svg width="18" height="18" viewBox="0 0 18 18"><rect x="2" y="2" width="14" height="14" rx="1" fill="none" stroke="currentColor" stroke-width="1.3" stroke-dasharray="3 2"/><line x1="5" y1="5" x2="13" y2="13" stroke="var(--md-error-fg)" stroke-width="2" stroke-linecap="round"/><line x1="13" y1="5" x2="5" y2="13" stroke="var(--md-error-fg)" stroke-width="2" stroke-linecap="round"/></svg>',
      title: 'Delete table',
      action: () => editor.chain().focus().deleteTable().run(),
    },
  ]);

  mb.addSeparator();

  // ── SORT ──
  mb.addSubmenuTrigger('Sort table', sub => {
    const makeSubItem = (label: string, action: () => void) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'context-menu-item';
      btn.setAttribute('role', 'menuitem');
      const lbl = document.createElement('span');
      lbl.className = 'context-menu-label';
      lbl.textContent = label;
      btn.appendChild(lbl);
      btn.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        restoreContextSelection();
        action();
        mb.hide();
      };
      sub.appendChild(btn);
    };

    makeSubItem('Sort ascending (A → Z)', () => sortTableByColumn(editor, true));
    makeSubItem('Sort descending (Z → A)', () => sortTableByColumn(editor, false));
  });

  // ── EXPORT ──
  mb.addItem('Export Table as CSV', () => {
    window.dispatchEvent(new CustomEvent('exportTableCsv'));
  });

  // ═════════════════════════════════════════════════════════════════
  //  LIFECYCLE
  // ═════════════════════════════════════════════════════════════════

  mb.mount();

  const show = (x: number, y: number, pos?: number) => {
    contextPos = pos ?? null;
    mb.show(x, y);
  };

  const hide = () => {
    mb.hide();
    contextPos = null;
  };

  return {
    element: mb.element,
    show,
    hide,
    destroy: () => mb.destroy(),
  };
}
