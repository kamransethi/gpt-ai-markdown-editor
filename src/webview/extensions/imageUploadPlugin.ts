/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

/**
 * Image Upload Plugin
 *
 * ProseMirror plugin that tracks in-progress image upload positions via plugin
 * state rather than DOM queries. Each upload is keyed by its placeholder ID;
 * positions are mapped through every transaction so they remain correct even
 * when the user types before an upload completes.
 */

import { Extension } from '@tiptap/core';
import type { Editor } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { Transaction } from '@tiptap/pm/state';

/** Plugin state: placeholder ID → current doc position of the image node */
type UploadState = Map<string, number>;

type UploadMeta = { type: 'add'; id: string; pos: number } | { type: 'remove'; id: string };

export const imageUploadPluginKey = new PluginKey<UploadState>('imageUpload');

/**
 * TipTap Extension that registers the imageUpload ProseMirror plugin.
 * Add this to the editor's extensions array.
 */
export const ImageUploadPlugin = Extension.create({
  name: 'imageUpload',

  addProseMirrorPlugins() {
    return [
      new Plugin<UploadState>({
        key: imageUploadPluginKey,

        state: {
          init(): UploadState {
            return new Map();
          },

          apply(tr: Transaction, prevState: UploadState): UploadState {
            const newState = new Map<string, number>();

            // Map each tracked position through this transaction's mapping so positions
            // stay correct even when the user inserts/deletes content before the image.
            for (const [id, pos] of prevState) {
              const result = tr.mapping.mapResult(pos);
              if (!result.deleted) {
                newState.set(id, result.pos);
              }
              // If deleted: the placeholder node was removed — position is gone.
              // callers should detect the absence and abort the upload.
            }

            // Apply any add/remove commands piggy-backed on the transaction meta.
            const meta = tr.getMeta(imageUploadPluginKey) as UploadMeta | undefined;
            if (meta) {
              if (meta.type === 'add') {
                newState.set(meta.id, meta.pos);
              } else if (meta.type === 'remove') {
                newState.delete(meta.id);
              }
            }

            return newState;
          },
        },
      }),
    ];
  },
});

// ---------------------------------------------------------------------------
// Public API — called by imageDragDrop.ts
// ---------------------------------------------------------------------------

/**
 * Start tracking an upload: store the image node's current position in plugin state.
 * Call immediately after `insertContentAt` for the placeholder image.
 *
 * @param editor - TipTap editor instance
 * @param placeholderId - Unique id used as `data-placeholder-id` on the image node
 */
export function addUploadTracking(editor: Editor, placeholderId: string): void {
  // Search the freshly updated doc for the node with our placeholder id
  let foundPos: number | undefined;
  editor.state.doc.descendants((node, pos): boolean | void => {
    if (foundPos !== undefined) return false;
    if (node.type.name === 'image' && node.attrs['data-placeholder-id'] === placeholderId) {
      foundPos = pos;
      return false;
    }
  });

  if (foundPos === undefined) {
    console.warn(`[DK-AI] addUploadTracking: placeholder ${placeholderId} not found in doc`);
    return;
  }

  editor.view.dispatch(
    editor.state.tr.setMeta(imageUploadPluginKey, {
      type: 'add',
      id: placeholderId,
      pos: foundPos,
    } satisfies UploadMeta)
  );
}

/**
 * Get the current (mapped) position of an in-progress upload placeholder.
 * Returns `undefined` if the placeholder was removed (e.g. user deleted the node).
 *
 * @param editor - TipTap editor instance
 * @param placeholderId - Upload placeholder id
 */
export function getUploadPos(editor: Editor, placeholderId: string): number | undefined {
  return imageUploadPluginKey.getState(editor.state)?.get(placeholderId);
}

/**
 * Stop tracking an upload (call after the upload resolves or is cancelled).
 *
 * @param editor - TipTap editor instance
 * @param placeholderId - Upload placeholder id
 */
export function removeUploadTracking(editor: Editor, placeholderId: string): void {
  editor.view.dispatch(
    editor.state.tr.setMeta(imageUploadPluginKey, {
      type: 'remove',
      id: placeholderId,
    } satisfies UploadMeta)
  );
}
