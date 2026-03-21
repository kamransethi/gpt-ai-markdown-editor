/**
 * @jest-environment jsdom
 */

/**
 * Tests for BubbleMenuView toolbar and menu components
 */

import type { Editor } from '@tiptap/core';

// Mock the VS Code API
(global as any).acquireVsCodeApi = jest.fn(() => ({
  postMessage: jest.fn(),
  getState: jest.fn(),
  setState: jest.fn(),
}));

// Mock the imports
jest.mock('../../webview/mermaidTemplates', () => ({
  MERMAID_TEMPLATES: [{ label: 'Flowchart', diagram: 'graph TD\nA-->B' }],
}));

jest.mock('../../webview/features/tableInsert', () => ({
  showTableInsertDialog: jest.fn(),
}));

jest.mock('../../webview/features/linkDialog', () => ({
  showLinkDialog: jest.fn(),
}));

jest.mock('../../webview/features/imageInsertDialog', () => ({
  showImageInsertDialog: jest.fn().mockResolvedValue(undefined),
}));

const moveSelectedTableRowMock = jest.fn();
const moveSelectedTableColumnMock = jest.fn();

jest.mock('../../webview/utils/tableOperationActions', () => ({
  moveSelectedTableRow: (...args: unknown[]) => moveSelectedTableRowMock(...args),
  moveSelectedTableColumn: (...args: unknown[]) => moveSelectedTableColumnMock(...args),
  sortTableByColumn: jest.fn(),
}));

describe('BubbleMenuView', () => {
  let createFormattingToolbar: (editor: Editor) => HTMLElement;
  let createTableMenu: (editor: Editor) => HTMLElement;
  let updateToolbarStates: () => void;

  beforeEach(async () => {
    jest.resetModules();
    document.body.innerHTML = '';

    // Import after mocks are set up
    const module = await import('../../webview/BubbleMenuView');
    createFormattingToolbar = module.createFormattingToolbar;
    createTableMenu = module.createTableMenu;
    updateToolbarStates = module.updateToolbarStates;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    moveSelectedTableRowMock.mockReset();
    moveSelectedTableColumnMock.mockReset();
  });

  const createMockEditor = () => {
    const chainApi = {
      focus: jest.fn().mockReturnThis(),
      setTextSelection: jest.fn().mockReturnThis(),
      toggleBold: jest.fn().mockReturnThis(),
      toggleItalic: jest.fn().mockReturnThis(),
      toggleStrike: jest.fn().mockReturnThis(),
      toggleUnderline: jest.fn().mockReturnThis(),
      toggleCode: jest.fn().mockReturnThis(),
      toggleHeading: jest.fn().mockReturnThis(),
      toggleBulletList: jest.fn().mockReturnThis(),
      toggleOrderedList: jest.fn().mockReturnThis(),
      toggleTaskList: jest.fn().mockReturnThis(),
      toggleBlockquote: jest.fn().mockReturnThis(),
      setCodeBlock: jest.fn().mockReturnThis(),
      insertTable: jest.fn().mockReturnThis(),
      insertContent: jest.fn().mockReturnThis(),
      addRowBefore: jest.fn().mockReturnThis(),
      addRowAfter: jest.fn().mockReturnThis(),
      deleteRow: jest.fn().mockReturnThis(),
      addColumnBefore: jest.fn().mockReturnThis(),
      addColumnAfter: jest.fn().mockReturnThis(),
      deleteColumn: jest.fn().mockReturnThis(),
      deleteTable: jest.fn().mockReturnThis(),
      run: jest.fn(),
    };
    const chain = jest.fn(() => chainApi);

    return {
      chain,
      __chainApi: chainApi,
      isActive: jest.fn().mockReturnValue(false),
      getAttributes: jest.fn().mockReturnValue({}),
      on: jest.fn(), // Event listener registration
      off: jest.fn(), // Event listener removal
      state: {
        selection: { from: 0, to: 0 },
        doc: { textBetween: jest.fn().mockReturnValue('') },
      },
      view: {
        dom: document.createElement('div'),
      },
    } as unknown as Editor;
  };

  describe('createFormattingToolbar', () => {
    it('creates a toolbar element with correct class', () => {
      const editor = createMockEditor();
      const toolbar = createFormattingToolbar(editor);

      expect(toolbar).toBeInstanceOf(HTMLElement);
      expect(toolbar.className).toBe('formatting-toolbar');
    });

    it('contains formatting buttons', () => {
      const editor = createMockEditor();
      const toolbar = createFormattingToolbar(editor);

      // Check for essential buttons
      const buttons = toolbar.querySelectorAll('button');
      expect(buttons.length).toBeGreaterThan(0);
      expect(
        Array.from(buttons).some(button => {
          const ariaLabel = button.getAttribute('aria-label')?.toLowerCase();
          return ariaLabel?.includes('underline');
        })
      ).toBe(true);
    });

    it('registers selection update listener', () => {
      const editor = createMockEditor();
      createFormattingToolbar(editor);

      // Toolbar should register for selection updates
      expect(editor.on).toHaveBeenCalledWith('selectionUpdate', expect.any(Function));
    });

    it('dispatches toggleTocPane when Outline button is clicked', () => {
      const editor = createMockEditor();
      const toolbar = createFormattingToolbar(editor);
      const dispatchSpy = jest.spyOn(window, 'dispatchEvent');

      const viewButton = Array.from(toolbar.querySelectorAll('button')).find(
        button => button.getAttribute('aria-label')?.includes('Outline')
      ) as HTMLButtonElement | undefined;

      expect(viewButton).toBeTruthy();

      viewButton!.click();

      const outlineButton = Array.from(toolbar.querySelectorAll('.toolbar-dropdown-item')).find(
        item => item.textContent?.includes('Toggle outline pane')
      ) as HTMLButtonElement | undefined;

      expect(outlineButton).toBeTruthy();

      outlineButton!.click();

      expect(dispatchSpy).toHaveBeenCalledWith(expect.any(CustomEvent));
      const dispatchedEvent = dispatchSpy.mock.calls[0][0] as CustomEvent;
      expect(dispatchedEvent.type).toBe('toggleTocPane');
    });

    it('renders grouped dropdown controls', () => {
      const editor = createMockEditor();
      const toolbar = createFormattingToolbar(editor);

      expect(toolbar.querySelectorAll('.toolbar-group').length).toBeGreaterThan(1);
      expect(toolbar.querySelectorAll('.toolbar-dropdown-trigger').length).toBeGreaterThan(4);
    });
  });

  describe('createTableMenu', () => {
    it('creates a hidden menu element', () => {
      const editor = createMockEditor();
      const menu = createTableMenu(editor);

      expect(menu).toBeInstanceOf(HTMLElement);
      expect(menu.className).toBe('table-menu');
      expect(menu.style.display).toBe('none');
    });

    it('contains table operation items', () => {
      const editor = createMockEditor();
      const menu = createTableMenu(editor);

      // Icon buttons (INSERT/MOVE/DELETE rows) + text items (Sort/Export)
      const iconBtns = menu.querySelectorAll('.context-menu-icon-btn');
      const textItems = menu.querySelectorAll('.context-menu-item');
      expect(iconBtns.length + textItems.length).toBeGreaterThan(0);

      // Check for specific insert operation via title
      const addRowBtn = Array.from(iconBtns).find(btn => btn.getAttribute('title')?.includes('Insert row'));
      expect(addRowBtn).toBeTruthy();
    });

    it('calls editor commands on item click', () => {
      const editor = createMockEditor();
      const menu = createTableMenu(editor);

      const iconBtns = menu.querySelectorAll('.context-menu-icon-btn');
      const firstItem = iconBtns[0] as HTMLElement;

      if (firstItem) {
        firstItem.click();
        expect(editor.chain).toHaveBeenCalled();
      }
    });

    it('includes move row and move column actions', () => {
      const editor = createMockEditor();
      const menu = createTableMenu(editor);
      const iconBtns = Array.from(menu.querySelectorAll('.context-menu-icon-btn'));
      const titles = iconBtns.map(btn => btn.getAttribute('title'));

      expect(titles).toContain('Move row up');
      expect(titles).toContain('Move row down');
      expect(titles).toContain('Move column left');
      expect(titles).toContain('Move column right');
    });

    it('calls move helpers from move menu items', () => {
      const editor = createMockEditor();
      const menu = createTableMenu(editor);
      const iconBtns = Array.from(menu.querySelectorAll('.context-menu-icon-btn')) as HTMLElement[];

      const moveRowUp = iconBtns.find(btn => btn.getAttribute('title') === 'Move row up');
      const moveColumnRight = iconBtns.find(btn => btn.getAttribute('title') === 'Move column right');

      moveRowUp?.click();
      moveColumnRight?.click();

      expect(moveSelectedTableRowMock).toHaveBeenCalledWith(editor, 'up');
      expect(moveSelectedTableColumnMock).toHaveBeenCalledWith(editor, 'right');
    });

    it('restores stored table position before running move actions', () => {
      const editor = createMockEditor() as Editor & {
        __chainApi: { setTextSelection: jest.Mock; focus: jest.Mock; run: jest.Mock };
      };
      // view.hasFocus() returns false → triggers restoration via chain
      (editor as any).view.hasFocus = jest.fn().mockReturnValue(false);
      (editor as any).state.doc.content = { size: 100 };

      const menu = createTableMenu(editor);
      menu.dataset.contextPos = '12';

      const iconBtns = Array.from(menu.querySelectorAll('.context-menu-icon-btn')) as HTMLElement[];
      const moveColumnLeft = iconBtns.find(btn => btn.getAttribute('title') === 'Move column left');

      moveColumnLeft?.click();

      // Restoration uses a single chain: .focus().setTextSelection(12).run()
      expect(editor.__chainApi.focus).toHaveBeenCalled();
      expect(editor.__chainApi.setTextSelection).toHaveBeenCalledWith(12);
      expect(editor.__chainApi.run).toHaveBeenCalled();
      expect(moveSelectedTableColumnMock).toHaveBeenCalledWith(editor, 'left');
    });

    it('hides menu after item click', () => {
      const editor = createMockEditor();
      const menu = createTableMenu(editor);

      menu.style.display = 'block';

      const iconBtns = menu.querySelectorAll('.context-menu-icon-btn');
      const firstItem = iconBtns[0] as HTMLElement;

      if (firstItem) {
        firstItem.click();
        expect(menu.style.display).toBe('none');
      }
    });
  });

  describe('updateToolbarStates', () => {
    it('can be called without error when no toolbar exists', () => {
      expect(() => updateToolbarStates()).not.toThrow();
    });
  });
});
