/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

import type { Editor } from '@tiptap/core';
import { getSelectedTableLines } from './tableSelectionUtils';

const tableBulletRegex = /^[\t ]*([-+*])\s?/;

function getSelectedLines(editor: Editor) {
  const result = getSelectedTableLines(editor.state, editor.state.selection);
  return result || null;
}

export function isTableBulletSelection(editor: Editor): boolean {
  const result = getSelectedLines(editor);
  if (!result) {
    return false;
  }

  return result.selectedLines.some(({ start, end }) => {
    const text = editor.state.doc.textBetween(start, end, '\n');
    return tableBulletRegex.test(text);
  });
}

export function applyTableBulletHack(editor: Editor): boolean {
  const result = getSelectedLines(editor);
  if (!result) {
    return false;
  }

  const { selectedLines, tr } = result;
  let changed = false;

  for (let i = selectedLines.length - 1; i >= 0; i -= 1) {
    const { start, end } = selectedLines[i];
    const text = editor.state.doc.textBetween(start, end, '\n');
    const match = tableBulletRegex.exec(text);

    if (match) {
      const markerLength = match[0].length;
      const replacement = '- ';
      if (match[1] !== '-' || match[0] !== '- ') {
        tr.delete(start, start + markerLength);
        tr.insertText(replacement, start);
        changed = true;
      }
    } else {
      tr.insertText('- ', start);
      changed = true;
    }
  }

  if (!changed) {
    return false;
  }

  editor.view.dispatch(tr);
  editor.view.focus();
  return true;
}

export function removeTableBulletHack(editor: Editor): boolean {
  const result = getSelectedLines(editor);
  if (!result) {
    return false;
  }

  const { selectedLines, tr } = result;
  let changed = false;

  for (let i = selectedLines.length - 1; i >= 0; i -= 1) {
    const { start, end } = selectedLines[i];
    const text = editor.state.doc.textBetween(start, end, '\n');
    const match = tableBulletRegex.exec(text);

    if (match) {
      const markerLength = match[0].length;
      tr.delete(start, start + markerLength);
      changed = true;
    }
  }

  if (!changed) {
    return false;
  }

  editor.view.dispatch(tr);
  editor.view.focus();
  return true;
}

export function toggleTableBulletHack(editor: Editor): boolean {
  const result = getSelectedLines(editor);
  if (!result) {
    return false;
  }

  const allLinesHaveBullet = result.selectedLines.every(({ start, end }) => {
    const text = editor.state.doc.textBetween(start, end, '\n');
    return tableBulletRegex.test(text);
  });

  if (allLinesHaveBullet) {
    return removeTableBulletHack(editor);
  }

  return applyTableBulletHack(editor);
}
