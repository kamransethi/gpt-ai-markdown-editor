/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

import { Extension } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';

export const ImageBoundaryNav = Extension.create({
  name: 'imageBoundaryNav',

  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const { state, view } = this.editor;
        const { selection, schema } = state;

        if (!selection.empty) {
          return false;
        }

        const { $from } = selection;
        const parent = $from.parent;

        if (parent.type.name !== 'paragraph') {
          return false;
        }

        const imageBefore = $from.nodeBefore?.type.name === 'image';
        const imageAfter = $from.nodeAfter?.type.name === 'image';

        if (!imageBefore && !imageAfter) {
          return false;
        }

        // Enter before an image at the start of a block
        if ($from.parentOffset === 0 && imageAfter) {
          const pos = $from.before();
          const tr = state.tr.insert(pos, schema.nodes.paragraph.create());
          tr.setSelection(TextSelection.create(tr.doc, pos + 1));
          view.dispatch(tr.scrollIntoView());
          return true;
        }

        // Enter after an image at the end of a block
        if ($from.parentOffset === parent.content.size && imageBefore) {
          const pos = $from.after();
          const tr = state.tr.insert(pos, schema.nodes.paragraph.create());
          tr.setSelection(TextSelection.create(tr.doc, pos + 1));
          view.dispatch(tr.scrollIntoView());
          return true;
        }

        return false;
      },
    };
  },
});
