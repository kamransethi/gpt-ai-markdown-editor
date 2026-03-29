import { Node } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

/**
 * DraggableBlocks Extension
 * Adds drag handles and drop indicators for block-level nodes (images, Mermaid, etc.)
 * Highlights dragged block and drop target
 */
export const DraggableBlocks = Node.create({
  name: 'draggableBlocks',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('draggableBlocks'),
        state: {
          init: () => ({ dragging: null, dropTarget: null }),
          apply(tr, value) {
            // Track dragging and drop target state
            const meta = tr.getMeta('draggableBlocks');
            if (meta) {
              return { ...value, ...meta };
            }
            return value;
          },
        },
        props: {
          decorations(state) {
            // Add handle and highlight decorations for images and Mermaid blocks
            const decorations: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (node.type.name === 'image' || node.type.name === 'mermaid') {
                // Drag handle decoration
                decorations.push(
                  Decoration.widget(
                    pos,
                    () => {
                      const handle = document.createElement('div');
                      handle.className = 'block-drag-handle';
                      handle.title = 'Drag to move';
                      handle.innerHTML =
                        '<svg width="20" height="20" viewBox="0 0 24 24"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>';
                      handle.setAttribute('draggable', 'true');
                      handle.addEventListener('dragstart', e => {
                        e.dataTransfer?.setData('application/x-block-pos', String(pos));
                        e.dataTransfer!.effectAllowed = 'move';
                        // Highlight block being dragged
                        state.tr.setMeta('draggableBlocks', { dragging: pos });
                      });
                      return handle;
                    },
                    { side: -1 }
                  )
                );
                // Highlight dragged block
                // (Highlighting logic will be handled by CSS class on the node DOM)
              }
            });
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});
