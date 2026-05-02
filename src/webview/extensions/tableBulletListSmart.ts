/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

/**
 * Smart bullet-list toggle for table cells.
 *
 * Problem: Table cells often hold all content in a single paragraph with `hardBreak` nodes
 * (because GFM cells can't span lines). When `toggleBulletList` is called with a partial
 * selection inside such a paragraph it wraps the ENTIRE paragraph as one list item — the
 * user gets one fat bullet with everything inside instead of individual bullets for only
 * the selected lines.
 *
 * Fix: `toggleBulletListSmart` detects this case, splits the paragraph into logical
 * "lines" at `hardBreak` boundaries, identifies which lines overlap the selection, and
 * rebuilds the cell block with:
 *   - pre-selection lines as individual paragraphs
 *   - selected lines as a `bulletList` (one `listItem` per line)
 *   - post-selection lines as individual paragraphs
 *
 * For all other contexts (not a table cell, already in a list, no hardBreaks) it falls
 * back to the standard `toggleBulletList` command.
 */

import { Extension } from '@tiptap/core';
import { Fragment } from '@tiptap/pm/model';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { EditorState, Transaction } from '@tiptap/pm/state';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    tableBulletListSmart: {
      toggleBulletListSmart: () => ReturnType;
    };
  }
}

// ---------------------------------------------------------------------------
// Core transaction builder
// ---------------------------------------------------------------------------

interface LineGroup {
  nodes: PMNode[];
  /** inclusive start position in the document (first char of line content) */
  start: number;
  /** exclusive end position in the document (position after last char, before hardBreak) */
  end: number;
}

/**
 * Build a ProseMirror transaction that replaces a hard-break-joined paragraph
 * with separate paragraphs / bullet-list nodes respecting the current selection.
 *
 * Returns `null` when the standard `toggleBulletList` should be used instead.
 */
function buildSmartBulletTransaction(state: EditorState): Transaction | null {
  const { $from, from, to } = state.selection;
  const schema = state.schema;

  // ── 1. Find table-cell ancestor and paragraph depth ───────────────────────
  let inTableCell = false;
  let paragraphDepth = -1;

  for (let d = $from.depth; d >= 0; d--) {
    const nodeName = $from.node(d).type.name;
    if (nodeName === 'tableCell' || nodeName === 'tableHeader') {
      inTableCell = true;
    }
    if (nodeName === 'paragraph' && paragraphDepth === -1) {
      paragraphDepth = d;
    }
    // If we're already inside a listItem, let the standard command handle it
    if (nodeName === 'listItem') {
      return null;
    }
  }

  if (!inTableCell || paragraphDepth === -1) return null;

  const paragraphNode = $from.node(paragraphDepth);
  const paragraphPos = $from.before(paragraphDepth);

  // ── 2. Bail if no hardBreaks — standard toggle handles homogeneous content ─
  let hasHardBreaks = false;
  paragraphNode.forEach(child => {
    if (child.type.name === 'hardBreak') hasHardBreaks = true;
  });
  if (!hasHardBreaks) return null;

  // ── 3. Group inline nodes into logical lines separated by hardBreaks ───────
  const lines: LineGroup[] = [];
  let currentNodes: PMNode[] = [];
  let offset = paragraphPos + 1; // +1 skips the paragraph-open token
  let lineStart = offset;

  paragraphNode.forEach(child => {
    if (child.type.name === 'hardBreak') {
      lines.push({ nodes: currentNodes, start: lineStart, end: offset });
      currentNodes = [];
      lineStart = offset + child.nodeSize;
    } else {
      currentNodes.push(child);
    }
    offset += child.nodeSize;
  });
  lines.push({ nodes: currentNodes, start: lineStart, end: offset });

  // ── 4. Classify each line relative to the selection ───────────────────────
  const beforeLines: PMNode[][] = [];
  const selectedLines: PMNode[][] = [];
  const afterLines: PMNode[][] = [];

  const isEmptySelection = from === to;

  for (const line of lines) {
    if (isEmptySelection) {
      // Cursor (empty selection): select the line whose range contains the cursor.
      // A line spans [start, end]. Use inclusive check on end so a cursor sitting
      // exactly at the end of a line (e.g. end of "Bullet 1") selects that line.
      if (line.start <= from && from <= line.end) {
        selectedLines.push(line.nodes);
      } else if (line.end < from) {
        beforeLines.push(line.nodes);
      } else {
        afterLines.push(line.nodes);
      }
    } else {
      // Range selection: a line is selected if it overlaps [from, to).
      if (line.end <= from) {
        beforeLines.push(line.nodes);
      } else if (line.start >= to) {
        afterLines.push(line.nodes);
      } else {
        selectedLines.push(line.nodes);
      }
    }
  }

  if (selectedLines.length === 0) return null;

  // ── 5. Build replacement nodes ─────────────────────────────────────────────
  const paraType = schema.nodes.paragraph;
  const bulletType = schema.nodes.bulletList;
  const itemType = schema.nodes.listItem;

  if (!bulletType || !itemType) return null;

  const makePara = (nodes: PMNode[]) =>
    paraType.create(null, nodes.length > 0 ? Fragment.from(nodes) : Fragment.empty);

  const newNodes: PMNode[] = [];

  for (const lineNodes of beforeLines) {
    newNodes.push(makePara(lineNodes));
  }

  const listItems = selectedLines.map(lineNodes =>
    itemType.create(null, Fragment.from(makePara(lineNodes)))
  );
  newNodes.push(bulletType.create(null, Fragment.from(listItems)));

  for (const lineNodes of afterLines) {
    newNodes.push(makePara(lineNodes));
  }

  // ── 6. Replace the original paragraph ─────────────────────────────────────
  const tr = state.tr;
  tr.replaceWith(paragraphPos, paragraphPos + paragraphNode.nodeSize, newNodes);
  return tr;
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
        ({ state, dispatch, chain }) => {
          const tr = buildSmartBulletTransaction(state);
          if (tr) {
            if (dispatch) dispatch(tr);
            return true;
          }
          // Fall back to standard toggleBulletList for all other contexts
          return chain().toggleBulletList().run();
        },
    };
  },
});
