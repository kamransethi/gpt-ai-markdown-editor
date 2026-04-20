/**
 * @jest-environment jsdom
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { DraggableBlocks } from '../../webview/extensions/draggableBlocks';

describe('DraggableBlocks Extension', () => {
  let editor: Editor;

  const createEditor = (initialContent: string = '') => {
    return new Editor({
      extensions: [StarterKit, DraggableBlocks],
      content: initialContent,
    });
  };

  afterEach(() => {
    if (editor) {
      editor.destroy();
    }
  });

  describe('Keyboard shortcuts (Alt+Up/Down)', () => {
    it('moves block up', () => {
      editor = createEditor('<p>Block 1</p><p>Block 2</p><p>Block 3</p>');

      // Set selection to Block 2
      editor.commands.setTextSelection(12); // inside "Block 2"

      const moved = editor.commands.moveBlockUp();
      expect(moved).toBe(true);

      expect(editor.getHTML()).toBe('<p>Block 2</p><p>Block 1</p><p>Block 3</p>');
    });

    it('moves block down', () => {
      editor = createEditor('<p>Block 1</p><p>Block 2</p><p>Block 3</p>');

      // Set selection to Block 2
      editor.commands.setTextSelection(12); // inside "Block 2"

      const moved = editor.commands.moveBlockDown();
      expect(moved).toBe(true);

      expect(editor.getHTML()).toBe('<p>Block 1</p><p>Block 3</p><p>Block 2</p>');
    });

    it('does not move block up if it is the first block', () => {
      editor = createEditor('<p>Block 1</p><p>Block 2</p>');
      editor.commands.setTextSelection(3); // inside "Block 1"

      const moved = editor.commands.moveBlockUp();
      expect(moved).toBe(false);

      expect(editor.getHTML()).toBe('<p>Block 1</p><p>Block 2</p>');
    });

    it('does not move block down if it is the last block', () => {
      editor = createEditor('<p>Block 1</p><p>Block 2</p>');
      editor.commands.setTextSelection(16); // inside "Block 2"

      const moved = editor.commands.moveBlockDown();
      expect(moved).toBe(false);

      expect(editor.getHTML()).toBe('<p>Block 1</p><p>Block 2</p>');
    });
  });

  describe('Drag-drop transaction: move first to last and last to first', () => {
    /**
     * These tests exercise the same insert-first/map/delete logic as onDrop,
     * without needing simulated drag events.
     */
    function applyDragDropTransaction(ed: Editor, draggedPos: number, dropInsertPos: number) {
      const state = ed.state;
      const draggedNode = state.doc.resolve(draggedPos).nodeAfter!;
      const draggedSize = draggedNode.nodeSize;

      if (dropInsertPos === draggedPos || dropInsertPos === draggedPos + draggedSize) {
        return; // no-op
      }

      const tr = state.tr;
      const content = state.doc.slice(draggedPos, draggedPos + draggedSize);
      tr.insert(dropInsertPos, content.content);
      const mappedDragPos = tr.mapping.map(draggedPos);
      tr.delete(mappedDragPos, mappedDragPos + draggedSize);
      ed.view.dispatch(tr);
    }

    it('moves first block to the end of the document', () => {
      editor = createEditor('<p>Block 1</p><p>Block 2</p><p>Block 3</p>');

      const draggedPos = 0; // first block
      const dropInsertPos = editor.state.doc.content.size; // end

      applyDragDropTransaction(editor, draggedPos, dropInsertPos);

      expect(editor.getHTML()).toBe('<p>Block 2</p><p>Block 3</p><p>Block 1</p>');
    });

    it('moves last block to the start of the document', () => {
      editor = createEditor('<p>Block 1</p><p>Block 2</p><p>Block 3</p>');

      // Find last block position
      const doc = editor.state.doc;
      const lastChild = doc.child(doc.childCount - 1);
      const lastChildPos = doc.content.size - lastChild.nodeSize;

      applyDragDropTransaction(editor, lastChildPos, 0);

      expect(editor.getHTML()).toBe('<p>Block 3</p><p>Block 1</p><p>Block 2</p>');
    });

    it('moves second block to end', () => {
      editor = createEditor('<p>Block 1</p><p>Block 2</p><p>Block 3</p>');

      // Position of second block = first block's nodeSize
      const firstSize = editor.state.doc.child(0).nodeSize;
      applyDragDropTransaction(editor, firstSize, editor.state.doc.content.size);

      expect(editor.getHTML()).toBe('<p>Block 1</p><p>Block 3</p><p>Block 2</p>');
    });

    it('moves second block to start', () => {
      editor = createEditor('<p>Block 1</p><p>Block 2</p><p>Block 3</p>');

      const firstSize = editor.state.doc.child(0).nodeSize;
      applyDragDropTransaction(editor, firstSize, 0);

      expect(editor.getHTML()).toBe('<p>Block 2</p><p>Block 1</p><p>Block 3</p>');
    });
  });

  describe('Drag and Drop API via Plugin', () => {
    it('should register DraggableBlocks extension', () => {
      editor = createEditor('<p>Block 1</p>');
      expect(editor.extensionManager.extensions.some(e => e.name === 'draggableBlocks')).toBe(true);
    });
  });
});
