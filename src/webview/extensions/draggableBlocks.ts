import GlobalDragHandle from 'tiptap-extension-global-drag-handle';

/**
 * DraggableBlocks Extension
 * Wraps the tiptap-extension-global-drag-handle to provide an Notion-like
 * global block drag and drop experience.
 */
export const DraggableBlocks = GlobalDragHandle.configure({
  dragHandleWidth: 20,
  scrollTreshold: 100,
  excludedTagList: ['table', 'td', 'th', 'tr'],
});
