/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

import { Editor } from '@tiptap/core';

export function scrollToHeading(editor: Editor, pos: number) {
  // Focus and set selection
  editor.commands.setTextSelection(pos);
  editor.commands.focus();

  // Scroll after DOM updates
  requestAnimationFrame(() => {
    try {
      const view = editor.view;
      const domPos = view.domAtPos(pos);

      let headingElement: Node;
      if (
        domPos.node.nodeType === Node.ELEMENT_NODE &&
        domPos.offset < domPos.node.childNodes.length
      ) {
        headingElement = domPos.node.childNodes[domPos.offset];
      } else {
        headingElement = domPos.node;
      }

      if (headingElement.nodeType === Node.TEXT_NODE) {
        headingElement = headingElement.parentElement as HTMLElement;
      }

      let target = headingElement as HTMLElement;
      let depth = 0;
      while (target && !target.matches?.('h1, h2, h3, h4, h5, h6')) {
        target = target.parentElement as HTMLElement;
        depth++;
        if (depth > 10) break;
      }

      if (target) {
        const toolbar = document.querySelector('.formatting-toolbar');
        const toolbarHeight = toolbar ? toolbar.getBoundingClientRect().height : 0;
        const offset = toolbarHeight + 16;

        const scrollContainer = document.documentElement;
        const targetRect = target.getBoundingClientRect();
        const scrollTop = scrollContainer.scrollTop + targetRect.top - offset;

        scrollContainer.scrollTop = scrollTop;
      }
    } catch (error) {
      console.warn('[Outline] Could not scroll to heading:', error);
    }
  });
}
