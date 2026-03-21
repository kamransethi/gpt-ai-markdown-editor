/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Shared table operation SVGs and DOM builder used by BOTH the toolbar
 * table dropdown and the right-click table context menu.
 * Single source of truth so both menus look identical.
 *
 * @module sharedTableOps
 */

import type { Editor } from '@tiptap/core';
import {
  moveSelectedTableRow,
  moveSelectedTableColumn,
  sortTableByColumn,
} from './tableOperationActions';

// ── SVG Icons ───────────────────────────────────────────────────────

export const TABLE_SVG = {
  rowAbove:
    '<svg width="18" height="18" viewBox="0 0 18 18"><rect x="2" y="8" width="14" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/><line x1="9" y1="8" x2="9" y2="16" stroke="currentColor" stroke-width="1.2"/><line x1="2" y1="12" x2="16" y2="12" stroke="currentColor" stroke-width="1.2"/><path d="M9 2 L6 5 L12 5 Z" fill="currentColor"/></svg>',
  rowBelow:
    '<svg width="18" height="18" viewBox="0 0 18 18"><rect x="2" y="2" width="14" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/><line x1="9" y1="2" x2="9" y2="10" stroke="currentColor" stroke-width="1.2"/><line x1="2" y1="6" x2="16" y2="6" stroke="currentColor" stroke-width="1.2"/><path d="M9 16 L6 13 L12 13 Z" fill="currentColor"/></svg>',
  colLeft:
    '<svg width="18" height="18" viewBox="0 0 18 18"><rect x="8" y="2" width="8" height="14" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/><line x1="8" y1="9" x2="16" y2="9" stroke="currentColor" stroke-width="1.2"/><line x1="12" y1="2" x2="12" y2="16" stroke="currentColor" stroke-width="1.2"/><path d="M2 9 L5 6 L5 12 Z" fill="currentColor"/></svg>',
  colRight:
    '<svg width="18" height="18" viewBox="0 0 18 18"><rect x="2" y="2" width="8" height="14" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/><line x1="2" y1="9" x2="10" y2="9" stroke="currentColor" stroke-width="1.2"/><line x1="6" y1="2" x2="6" y2="16" stroke="currentColor" stroke-width="1.2"/><path d="M16 9 L13 6 L13 12 Z" fill="currentColor"/></svg>',
  moveUp:
    '<svg width="18" height="18" viewBox="0 0 18 18"><path d="M9 3 L5 7 L13 7 Z" fill="currentColor"/><line x1="9" y1="7" x2="9" y2="15" stroke="currentColor" stroke-width="1.6"/></svg>',
  moveDown:
    '<svg width="18" height="18" viewBox="0 0 18 18"><path d="M9 15 L5 11 L13 11 Z" fill="currentColor"/><line x1="9" y1="3" x2="9" y2="11" stroke="currentColor" stroke-width="1.6"/></svg>',
  moveLeft:
    '<svg width="18" height="18" viewBox="0 0 18 18"><path d="M3 9 L7 5 L7 13 Z" fill="currentColor"/><line x1="7" y1="9" x2="15" y2="9" stroke="currentColor" stroke-width="1.6"/></svg>',
  moveRight:
    '<svg width="18" height="18" viewBox="0 0 18 18"><path d="M15 9 L11 5 L11 13 Z" fill="currentColor"/><line x1="3" y1="9" x2="11" y2="9" stroke="currentColor" stroke-width="1.6"/></svg>',
  deleteRow:
    '<svg width="18" height="18" viewBox="0 0 18 18"><rect x="2" y="4" width="14" height="12" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><line x1="2" y1="10" x2="16" y2="10" stroke="currentColor" stroke-width="1.2"/><line x1="9" y1="4" x2="9" y2="16" stroke="currentColor" stroke-width="1.2"/><line x1="4" y1="6.5" x2="14" y2="6.5" stroke="var(--md-error-fg)" stroke-width="2"/><line x1="6" y1="2" x2="12" y2="2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  deleteCol:
    '<svg width="18" height="18" viewBox="0 0 18 18"><rect x="2" y="2" width="14" height="14" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><line x1="2" y1="9" x2="16" y2="9" stroke="currentColor" stroke-width="1.2"/><line x1="9" y1="2" x2="9" y2="16" stroke="currentColor" stroke-width="1.2"/><line x1="5.5" y1="4" x2="5.5" y2="14" stroke="var(--md-error-fg)" stroke-width="2"/></svg>',
  deleteTable:
    '<svg width="18" height="18" viewBox="0 0 18 18"><rect x="2" y="2" width="14" height="14" rx="1" fill="none" stroke="currentColor" stroke-width="1.3" stroke-dasharray="3 2"/><line x1="5" y1="5" x2="13" y2="13" stroke="var(--md-error-fg)" stroke-width="2" stroke-linecap="round"/><line x1="13" y1="5" x2="5" y2="13" stroke="var(--md-error-fg)" stroke-width="2" stroke-linecap="round"/></svg>',
  sortAsc:
    '<svg width="18" height="18" viewBox="0 0 18 18"><path d="M9 3 L5 7 L13 7 Z" fill="currentColor"/><line x1="9" y1="7" x2="9" y2="15" stroke="currentColor" stroke-width="1.6"/></svg>',
  sortDesc:
    '<svg width="18" height="18" viewBox="0 0 18 18"><path d="M9 15 L5 11 L13 11 Z" fill="currentColor"/><line x1="9" y1="3" x2="9" y2="11" stroke="currentColor" stroke-width="1.6"/></svg>',
  exportCsv:
    '<svg width="18" height="18" viewBox="0 0 18 18"><path d="M3 12 L3 15 Q3 16 4 16 L14 16 Q15 16 15 15 L15 12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><line x1="9" y1="2" x2="9" y2="12" stroke="currentColor" stroke-width="1.4"/><path d="M5 8 L9 12 L13 8" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
} as const;

// ── Types ───────────────────────────────────────────────────────────

interface IconButton {
  icon: string;
  title: string;
  action: () => void;
}

export interface SharedTableOpsOptions {
  /** Called after an item action fires (e.g. close menu, refresh toolbar) */
  onItemClick: () => void;
  /** Optional pre-action hook (e.g. restore context selection) */
  beforeAction?: () => void;
}

// ── DOM Helpers ─────────────────────────────────────────────────────

function addSectionLabel(container: HTMLElement, text: string): void {
  const label = document.createElement('div');
  label.className = 'context-menu-section-label';
  label.textContent = text;
  container.appendChild(label);
}

function addSeparator(container: HTMLElement): void {
  const sep = document.createElement('div');
  sep.className = 'context-menu-separator';
  sep.setAttribute('role', 'separator');
  container.appendChild(sep);
}

function addButtonRow(
  container: HTMLElement,
  buttons: IconButton[],
  options: SharedTableOpsOptions,
): void {
  const row = document.createElement('div');
  row.className = 'context-menu-button-row';
  buttons.forEach(b => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'context-menu-icon-btn';
    btn.title = b.title;
    btn.setAttribute('aria-label', b.title);
    btn.innerHTML = b.icon;
    btn.onmousedown = e => e.preventDefault();
    btn.onclick = e => {
      e.preventDefault();
      e.stopPropagation();
      options.beforeAction?.();
      b.action();
      options.onItemClick();
    };
    row.appendChild(btn);
  });
  container.appendChild(row);
}

function addTextItem(
  container: HTMLElement,
  label: string,
  action: () => void,
  options: SharedTableOpsOptions,
  extra?: { icon?: string; className?: string },
): void {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'context-menu-item' + (extra?.className ? ` ${extra.className}` : '');
  btn.setAttribute('role', 'menuitem');
  btn.onmousedown = e => e.preventDefault();

  if (extra?.icon) {
    const iconSpan = document.createElement('span');
    iconSpan.className = 'context-menu-item-icon';
    iconSpan.innerHTML = extra.icon;
    btn.appendChild(iconSpan);
  }

  const lbl = document.createElement('span');
  lbl.className = 'context-menu-label';
  lbl.textContent = label;
  btn.appendChild(lbl);

  btn.onclick = e => {
    e.preventDefault();
    e.stopPropagation();
    options.beforeAction?.();
    action();
    options.onItemClick();
  };

  container.appendChild(btn);
}

// ── Public Builder ──────────────────────────────────────────────────

/**
 * Build the shared table operations DOM into a container.
 * Produces identical output for both the toolbar dropdown and context menu:
 * icon button rows for INSERT/MOVE/DELETE, text items for SORT and EXPORT.
 */
export function buildSharedTableOps(
  container: HTMLElement,
  editor: Editor,
  options: SharedTableOpsOptions,
): void {
  // ── INSERT ──
  addSectionLabel(container, 'Insert');
  addButtonRow(container, [
    { icon: TABLE_SVG.rowAbove, title: 'Insert row above', action: () => editor.chain().focus().addRowBefore().run() },
    { icon: TABLE_SVG.rowBelow, title: 'Insert row below', action: () => editor.chain().focus().addRowAfter().run() },
    { icon: TABLE_SVG.colLeft, title: 'Insert column left', action: () => editor.chain().focus().addColumnBefore().run() },
    { icon: TABLE_SVG.colRight, title: 'Insert column right', action: () => editor.chain().focus().addColumnAfter().run() },
  ], options);

  addSeparator(container);

  // ── MOVE ──
  addSectionLabel(container, 'Move');
  addButtonRow(container, [
    { icon: TABLE_SVG.moveUp, title: 'Move row up', action: () => moveSelectedTableRow(editor, 'up') },
    { icon: TABLE_SVG.moveDown, title: 'Move row down', action: () => moveSelectedTableRow(editor, 'down') },
    { icon: TABLE_SVG.moveLeft, title: 'Move column left', action: () => moveSelectedTableColumn(editor, 'left') },
    { icon: TABLE_SVG.moveRight, title: 'Move column right', action: () => moveSelectedTableColumn(editor, 'right') },
  ], options);

  addSeparator(container);

  // ── DELETE ──
  addSectionLabel(container, 'Delete');
  addButtonRow(container, [
    { icon: TABLE_SVG.deleteRow, title: 'Delete row', action: () => editor.chain().focus().deleteRow().run() },
    { icon: TABLE_SVG.deleteCol, title: 'Delete column', action: () => editor.chain().focus().deleteColumn().run() },
    { icon: TABLE_SVG.deleteTable, title: 'Delete table', action: () => editor.chain().focus().deleteTable().run() },
  ], options);

  addSeparator(container);

  // ── SORT ──
  addTextItem(container, 'Sort ascending (A → Z)', () => sortTableByColumn(editor, true), options, { icon: TABLE_SVG.sortAsc });
  addTextItem(container, 'Sort descending (Z → A)', () => sortTableByColumn(editor, false), options, { icon: TABLE_SVG.sortDesc });

  addSeparator(container);

  // ── EXPORT ──
  addTextItem(container, 'Export table as CSV', () => window.dispatchEvent(new CustomEvent('exportTableCsv')), options, { icon: TABLE_SVG.exportCsv });
}
