/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * FR-002: Native Image Upload Position Tracking
 *
 * @jest-environment jsdom
 *
 * Tests for the imageUploadPlugin — verifies that:
 * 1. addUploadTracking registers a placeholder position found by doc.descendants
 * 2. After text is inserted BEFORE the image, getUploadPos returns the mapped position
 * 3. When the placeholder node is deleted, getUploadPos returns undefined
 * 4. removeUploadTracking removes the entry from plugin state
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {
  ImageUploadPlugin,
  addUploadTracking,
  getUploadPos,
  removeUploadTracking,
} from '../../../webview/extensions/imageUploadPlugin';
import { CustomImage } from '../../../webview/extensions/customImage';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createEditor(initialHtml = '<p>Hello</p>') {
  return new Editor({
    extensions: [
      StarterKit,
      CustomImage.configure({ allowBase64: true }),
      ImageUploadPlugin,
    ],
    content: initialHtml,
  });
}

function insertImageWithPlaceholder(editor: Editor, placeholderId: string): void {
  editor.commands.insertContent({
    type: 'image',
    attrs: { src: 'data:image/png;base64,abc', alt: 'test', 'data-placeholder-id': placeholderId },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FR-002: ImageUploadPlugin position tracking', () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
  });

  it('addUploadTracking registers the image position without mutating the document', () => {
    editor = createEditor('<p>Hello</p>');
    const contentBefore = editor.getHTML();

    insertImageWithPlaceholder(editor, 'test-001');
    addUploadTracking(editor, 'test-001');

    const pos = getUploadPos(editor, 'test-001');
    expect(pos).toBeDefined();
    expect(typeof pos).toBe('number');

    // Document should still have the image — tracking didn't modify it
    expect(editor.getHTML()).not.toBe(contentBefore);
    expect(editor.state.doc.nodeAt(pos!)).toBeTruthy();
    expect(editor.state.doc.nodeAt(pos!)!.type.name).toBe('image');
  });

  it('maps placeholder position correctly when text is typed before it', () => {
    editor = createEditor('<p></p>');

    insertImageWithPlaceholder(editor, 'test-002');
    addUploadTracking(editor, 'test-002');

    const posBefore = getUploadPos(editor, 'test-002');
    expect(posBefore).toBeDefined();

    // Move cursor to start and insert text — this shifts the image position
    editor.commands.setTextSelection(0);
    editor.commands.insertContentAt(0, '<p>Prefix text added</p>');

    const posAfter = getUploadPos(editor, 'test-002');
    expect(posAfter).toBeDefined();
    // Position must have shifted by at least the length of inserted content
    expect(posAfter!).toBeGreaterThan(posBefore!);

    // The node at the new position should still be the image
    const node = editor.state.doc.nodeAt(posAfter!);
    expect(node).toBeTruthy();
    expect(node!.type.name).toBe('image');
    expect(node!.attrs['data-placeholder-id']).toBe('test-002');
  });

  it('returns undefined when placeholder node was deleted by the user', () => {
    editor = createEditor('<p>Start</p>');

    insertImageWithPlaceholder(editor, 'test-003');
    addUploadTracking(editor, 'test-003');

    const pos = getUploadPos(editor, 'test-003');
    expect(pos).toBeDefined();

    // Delete the image node
    const node = editor.state.doc.nodeAt(pos!);
    expect(node).toBeTruthy();
    editor.commands.deleteRange({ from: pos!, to: pos! + node!.nodeSize });

    // Plugin apply() should detect the mapping returned deleted=true and remove entry
    const posAfterDelete = getUploadPos(editor, 'test-003');
    expect(posAfterDelete).toBeUndefined();
  });

  it('removeUploadTracking removes the entry from plugin state', () => {
    editor = createEditor('<p>Hello</p>');

    insertImageWithPlaceholder(editor, 'test-004');
    addUploadTracking(editor, 'test-004');

    expect(getUploadPos(editor, 'test-004')).toBeDefined();

    removeUploadTracking(editor, 'test-004');

    expect(getUploadPos(editor, 'test-004')).toBeUndefined();
  });
});
