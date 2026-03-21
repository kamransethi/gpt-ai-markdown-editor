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
import { showLinkDialog } from './linkDialog';
import { MenuBuilder } from '../utils/menuBuilder';
import { modSymbol as mod } from '../utils/platform';
import { devLog } from '../utils/devLog';
import { buildSharedTableOps } from '../utils/sharedTableOps';

// ── Types ───────────────────────────────────────────────────────────

interface TableContextMenuController {
  element: HTMLElement;
  show: (x: number, y: number, contextPos?: number) => void;
  hide: () => void;
  destroy: () => void;
}

// ── Builder ─────────────────────────────────────────────────────────

export function createTableContextMenu(editor: Editor): TableContextMenuController {
  const mb = new MenuBuilder('context-menu table-context-menu', 'Table context menu');

  // Track the right-clicked position for restoring context
  let contextPos: number | null = null;

  const restoreContextSelection = () => {
    if (contextPos == null) return;

    const hasFocus = editor.view.hasFocus();
    const currentFrom = editor.state.selection.from;

    // Check whether the current selection is already inside a table
    if (hasFocus) {
      const { $from } = editor.state.selection;
      let inTable = false;
      for (let d = $from.depth; d > 0; d--) {
        if ($from.node(d).type.name === 'table') {
          inTable = true;
          break;
        }
      }
      if (inTable) {
        devLog(
          `[DK-AI] restoreContextSelection: editor focused & in table (from=${currentFrom}), skipping`
        );
        return;
      }
    }

    // Editor lost focus or selection drifted out of the table — restore it
    try {
      const maxPos = editor.state.doc.content.size;
      const safePos = Math.min(contextPos, maxPos);
      devLog(
        `[DK-AI] restoreContextSelection: restoring (hasFocus=${hasFocus}, from=${currentFrom}, contextPos=${safePos})`
      );
      editor.chain().focus().setTextSelection(safePos).run();
    } catch (err) {
      console.error('[DK-AI] restoreContextSelection failed:', err);
      try {
        editor.view.focus();
      } catch {
        // ignore
      }
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
  mb.addItem('Delete', () => editor.chain().focus().deleteSelection().run(), {
    className: 'context-menu-danger',
  });

  mb.addSeparator();

  // ── SHARED TABLE OPS (Insert/Move/Delete/Sort/Export) ──
  // Uses the same builder as the toolbar dropdown for identical rendering
  buildSharedTableOps(mb.element, editor, {
    onItemClick: () => mb.hide(),
    beforeAction: restoreContextSelection,
  });

  mb.addSeparator();

  // ── LINK ──
  mb.addItem('Insert Link', () => showLinkDialog(editor), { shortcut: `${mod}K` });

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
