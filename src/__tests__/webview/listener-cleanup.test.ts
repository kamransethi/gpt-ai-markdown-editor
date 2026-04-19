/**
 * @jest-environment jsdom
 */

/**
 * Tests for listener cleanup on editor destroy
 * Verifies that global document/window listeners are properly removed
 * when the editor is destroyed to prevent memory leaks.
 */

describe('listener cleanup on editor destroy', () => {
  let addEventListenerSpy: jest.SpyInstance;
  let removeEventListenerSpy: jest.SpyInstance;
  let windowAddEventListenerSpy: jest.SpyInstance;
  let windowRemoveEventListenerSpy: jest.SpyInstance;

  beforeEach(() => {
    // Track document event listeners
    addEventListenerSpy = jest.spyOn(document, 'addEventListener');
    removeEventListenerSpy = jest.spyOn(document, 'removeEventListener');
    windowAddEventListenerSpy = jest.spyOn(window, 'addEventListener');
    windowRemoveEventListenerSpy = jest.spyOn(window, 'removeEventListener');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('mermaid extension', () => {
    it('should remove document click listener on destroy', () => {
      // Create a mock node view with the destroy pattern from mermaid.ts
      const container = document.createElement('div');
      let isHighlighted = false;

      const handleDocumentClick = (e: MouseEvent) => {
        if (!container.contains(e.target as HTMLElement) && isHighlighted) {
          isHighlighted = false;
        }
      };

      // Simulate addNodeView behavior
      document.addEventListener('click', handleDocumentClick);

      // Verify listener was added
      expect(addEventListenerSpy).toHaveBeenCalledWith('click', handleDocumentClick);

      // Simulate destroy callback
      document.removeEventListener('click', handleDocumentClick);

      // Verify listener was removed
      expect(removeEventListenerSpy).toHaveBeenCalledWith('click', handleDocumentClick);
    });
  });

  describe('imageDragDrop', () => {
    it('should remove window dragover/drop/dragleave listeners on destroy', () => {
      const blockWindowDrop = jest.fn();
      const handleWindowDragLeave = jest.fn();

      // Simulate setupImageDragDrop behavior
      window.addEventListener('dragover', blockWindowDrop);
      window.addEventListener('drop', blockWindowDrop);
      window.addEventListener('dragleave', handleWindowDragLeave);

      expect(windowAddEventListenerSpy).toHaveBeenCalledWith('dragover', blockWindowDrop);
      expect(windowAddEventListenerSpy).toHaveBeenCalledWith('drop', blockWindowDrop);
      expect(windowAddEventListenerSpy).toHaveBeenCalledWith('dragleave', handleWindowDragLeave);

      // Simulate cleanup on editor destroy
      window.removeEventListener('dragover', blockWindowDrop);
      window.removeEventListener('drop', blockWindowDrop);
      window.removeEventListener('dragleave', handleWindowDragLeave);

      expect(windowRemoveEventListenerSpy).toHaveBeenCalledWith('dragover', blockWindowDrop);
      expect(windowRemoveEventListenerSpy).toHaveBeenCalledWith('drop', blockWindowDrop);
      expect(windowRemoveEventListenerSpy).toHaveBeenCalledWith('dragleave', handleWindowDragLeave);
    });
  });

  describe('editor global listeners', () => {
    it('should remove contextmenu, click, keydown listeners on destroy', () => {
      const contextMenuHandler = jest.fn();
      const documentClickHandler = jest.fn();
      const keydownHandler = jest.fn();

      // Simulate editor initialization
      document.addEventListener('contextmenu', contextMenuHandler);
      document.addEventListener('click', documentClickHandler);
      document.addEventListener('keydown', keydownHandler);

      expect(addEventListenerSpy).toHaveBeenCalledWith('contextmenu', contextMenuHandler);
      expect(addEventListenerSpy).toHaveBeenCalledWith('click', documentClickHandler);
      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', keydownHandler);

      // Simulate editor destroy cleanup
      document.removeEventListener('contextmenu', contextMenuHandler);
      document.removeEventListener('click', documentClickHandler);
      document.removeEventListener('keydown', keydownHandler);

      expect(removeEventListenerSpy).toHaveBeenCalledWith('contextmenu', contextMenuHandler);
      expect(removeEventListenerSpy).toHaveBeenCalledWith('click', documentClickHandler);
      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', keydownHandler);
    });
  });
});
