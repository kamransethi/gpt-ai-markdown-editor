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
 * For all other contexts (not a table cell) it falls back to the standard
 * `toggleBulletList` command.
 */

import { Extension } from '@tiptap/core';
import { getSelectedTableLines } from '../utils/tableSelectionUtils';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    tableBulletListSmart: {
      toggleBulletListSmart: () => ReturnType;
    };
  }
}

const TABLE_BULLET_RE = /^[\t ]*([-+*])\s?/;

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
              const match = TABLE_BULLET_RE.exec(text);
              if (match) {
                tr.delete(start, start + match[0].length);
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
    };
  },
});
