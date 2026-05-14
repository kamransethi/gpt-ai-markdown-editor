/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

/**
 * Smart bullet-list toggle for table cells.
 *
 * Table cells store all content in a single paragraph with `hardBreak` nodes (because
 * GFM cells cannot span multiple lines). Native TipTap `toggleBulletList` would wrap the
 * entire paragraph as one list item, and the serializer would then prepend another `- `
 * to the already-present `- ` text prefix — producing `- - Bullet`.
 *
 * Instead, for table cells we use plain-text manipulation: `- ` prefixes are inserted or
 * removed directly on the selected hard-break-separated "lines". This matches what the
 * document stores on disk (`- text<br>  + nested`) and survives round-trips perfectly.
 *
 * Features:
 * - `toggleBulletListSmart` — toggle `- ` prefix on selected lines in a table cell
 * - `isTableBulletActive` — returns true when cursor line in a table cell has a bullet
 * - TAB on a bullet line → increase indent + cycle marker (- → + → *)
 * - SHIFT+TAB on a bullet line → decrease indent + cycle marker back (* → + → -)
 *
 * For all other contexts (not a table cell) toggleBulletListSmart falls back to
 * the standard `toggleBulletList` command, and Tab/Shift+Tab are not consumed.
 */

import { Extension } from '@tiptap/core';
import { getSelectedTableLines } from '../utils/tableSelectionUtils';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    tableBulletListSmart: {
      toggleBulletListSmart: () => ReturnType;
      /** Returns true when the cursor line in a table cell has a bullet marker */
      isTableBulletActive: () => ReturnType;
    };
  }
}

/** Matches leading whitespace + bullet marker + optional space */
const TABLE_BULLET_RE = /^([\t ]*)([-+*]) ?/;

/** Bullet marker cycle order: depth 0=-, 1=+, 2=* */
const MARKERS = ['-', '+', '*'] as const;

/**
 * Given current indentation level (in 2-space units), return the expected marker.
 */
function markerForDepth(depth: number): string {
  return MARKERS[depth % MARKERS.length];
}

/**
 * Parse a line's indentation depth (2 spaces per level), marker, and actual prefix length.
 * Returns null if the line has no bullet.
 *
 * `prefixLen` is the real character count of the matched prefix (m[0].length) — used for
 * deletion in Tab/Shift-Tab.  Do NOT substitute `indent * 2 + marker.length + 1` here:
 * the trailing space in the regex is optional, so the formula can be off by one.
 */
function parseBulletLine(
  text: string
): { indent: number; marker: string; prefixLen: number } | null {
  const m = TABLE_BULLET_RE.exec(text);
  if (!m) return null;
  const indent = Math.floor(m[1].length / 2);
  return { indent, marker: m[2], prefixLen: m[0].length };
}

// ---------------------------------------------------------------------------
// TipTap Extension
// ---------------------------------------------------------------------------

export const TableBulletListSmart = Extension.create({
  name: 'tableBulletListSmart',

  addCommands() {
    return {
      toggleBulletListSmart:
        () =>
        ({ state, dispatch, view, chain }) => {
          const result = getSelectedTableLines(state, state.selection);

          // Not in a table cell — use standard TipTap bullet list
          if (!result) {
            return chain().toggleBulletList().run();
          }

          const { selectedLines, tr } = result;

          // Determine if ALL selected lines already have a bullet marker
          const allHaveBullet = selectedLines.every(({ start, end }) => {
            const text = state.doc.textBetween(start, end, '\n');
            return TABLE_BULLET_RE.test(text);
          });

          let changed = false;

          if (allHaveBullet) {
            // Remove bullet markers (process in reverse to keep offsets valid)
            for (let i = selectedLines.length - 1; i >= 0; i--) {
              const { start, end } = selectedLines[i];
              const text = state.doc.textBetween(start, end, '\n');
              const m = TABLE_BULLET_RE.exec(text);
              if (m) {
                tr.delete(start, start + m[0].length);
                changed = true;
              }
            }
          } else {
            // Add `- ` prefix to lines that don't already have one
            for (let i = selectedLines.length - 1; i >= 0; i--) {
              const { start, end } = selectedLines[i];
              const text = state.doc.textBetween(start, end, '\n');
              if (!TABLE_BULLET_RE.test(text)) {
                tr.insertText('- ', start);
                changed = true;
              }
            }
          }

          if (!changed) return false;

          if (dispatch) dispatch(tr);
          view.focus();
          return true;
        },

      isTableBulletActive:
        () =>
        ({ state }) => {
          const result = getSelectedTableLines(state, state.selection);
          if (!result || result.selectedLines.length === 0) return false;
          // Active if the cursor's line has a bullet marker
          const { start, end } = result.selectedLines[0];
          const text = state.doc.textBetween(start, end, '\n');
          return TABLE_BULLET_RE.test(text);
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        const { state, view } = this.editor;
        const result = getSelectedTableLines(state, state.selection);
        if (!result) return false; // not in a table cell — let default Tab run

        const { selectedLines, tr } = result;
        let changed = false;

        // Process in reverse to keep offsets valid
        for (let i = selectedLines.length - 1; i >= 0; i--) {
          const { start, end } = selectedLines[i];
          const text = state.doc.textBetween(start, end, '\n');
          const parsed = parseBulletLine(text);
          if (!parsed) continue; // non-bullet line: skip (don't consume Tab for it)

          const newDepth = parsed.indent + 1;
          const newMarker = markerForDepth(newDepth);
          const newIndent = '  '.repeat(newDepth);
          const newPrefix = `${newIndent}${newMarker} `;
          tr.delete(start, start + parsed.prefixLen);
          tr.insertText(newPrefix, start);
          changed = true;
        }

        if (!changed) return false;
        view.dispatch(tr);
        return true;
      },

      'Shift-Tab': () => {
        const { state, view } = this.editor;
        const result = getSelectedTableLines(state, state.selection);
        if (!result) return false;

        const { selectedLines, tr } = result;
        let changed = false;

        for (let i = selectedLines.length - 1; i >= 0; i--) {
          const { start, end } = selectedLines[i];
          const text = state.doc.textBetween(start, end, '\n');
          const parsed = parseBulletLine(text);
          if (!parsed || parsed.indent === 0) continue; // already at top level or not a bullet

          const newDepth = parsed.indent - 1;
          const newMarker = markerForDepth(newDepth);
          const newIndent = '  '.repeat(newDepth);
          const newPrefix = `${newIndent}${newMarker} `;
          tr.delete(start, start + parsed.prefixLen);
          tr.insertText(newPrefix, start);
          changed = true;
        }

        if (!changed) return false;
        view.dispatch(tr);
        return true;
      },
    };
  },
});
