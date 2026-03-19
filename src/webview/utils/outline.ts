/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

import { Editor } from '@tiptap/core';

export interface OutlineEntry {
  level: number;
  text: string;
  pos: number;
  sectionStart: number;
  sectionEnd: number;
}

export interface SimpleHeading {
  level: number;
  text: string;
  pos: number;
  nodeSize?: number;
}

export function computeOutline(headings: SimpleHeading[], docSize: number): OutlineEntry[] {
  const outline = headings.map(h => ({
    level: h.level,
    text: h.text,
    pos: h.pos,
    sectionStart: h.pos,
    sectionEnd: (h.pos || 0) + (h.nodeSize || 0),
  }));

  for (let i = 0; i < outline.length; i++) {
    const current = outline[i];
    let sectionEnd = docSize;

    for (let j = i + 1; j < outline.length; j++) {
      const next = outline[j];
      if (next.level <= current.level) {
        sectionEnd = next.sectionStart;
        break;
      }
    }

    current.sectionEnd = sectionEnd;
  }

  return outline;
}

export function buildOutlineFromEditor(editor: Editor): OutlineEntry[] {
  const doc = editor.state.doc;
  const headings: SimpleHeading[] = [];

  doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      const level = node.attrs.level as number;
      const text = node.textContent;
      headings.push({
        level,
        text,
        pos,
        nodeSize: node.nodeSize,
      });
    }
    return true;
  });

  return computeOutline(headings, doc.content.size);
}
