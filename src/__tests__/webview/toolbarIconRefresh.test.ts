/**
 * @jest-environment jsdom
 */

import type { Editor } from '@tiptap/core';
import { createFormattingToolbar, updateToolbarStates } from '../../webview/BubbleMenuView';

type ChainProxy = {
  run: () => boolean;
  [key: string]: unknown;
};

const createMockEditor = () => {
  const run = jest.fn(() => true);
  const isActive = jest.fn<boolean, [string, Record<string, unknown>?]>(() => false);

  const chainTarget: Record<string, unknown> = { run };
  const chainProxy = new Proxy(chainTarget, {
    get: (target, prop) => {
      if (prop === 'run') {
        return run;
      }

      // Return a chainable no-op function for any command
      if (!(prop in target)) {
        return () => chainProxy;
      }

      return target[prop as string];
    },
  }) as ChainProxy;

  const canProxy = new Proxy({} as Record<string, unknown>, {
    get: () => () => false,
  });

  const editor = {
    chain: () => chainProxy,
    can: () => canProxy,
    isActive,
    getAttributes: jest.fn(() => ({})),
    on: jest.fn(),
    off: jest.fn(),
  } as unknown as Editor;

  return { editor, isActive, run };
};

describe('createFormattingToolbar', () => {
  it('renders icon-only action buttons with accessible label', () => {
    const { editor } = createMockEditor();
    const toolbar = createFormattingToolbar(editor);

    const boldButton = toolbar.querySelector('.toolbar-button.bold') as HTMLElement;

    expect(boldButton?.querySelector('.toolbar-icon')).toBeTruthy();
    expect(boldButton?.getAttribute('aria-label')?.toLowerCase()).toContain('bold');
  });

  it('toggles active state when updateToolbarStates runs', () => {
    const { editor, isActive } = createMockEditor();
    const toolbar = createFormattingToolbar(editor);

    isActive.mockImplementation((name: string) => name === 'bold');

    updateToolbarStates();

    const boldButton = toolbar.querySelector('.toolbar-button.bold') as HTMLElement;
    expect(boldButton?.classList.contains('active')).toBe(true);
    expect(boldButton?.getAttribute('aria-pressed')).toBe('true');
  });

  it('adds icons to dropdown menu items (when configured)', () => {
    const { editor } = createMockEditor();
    const toolbar = createFormattingToolbar(editor);

    const tableDropdown = Array.from(toolbar.querySelectorAll('.toolbar-dropdown')).find(
      dropdown => {
        const button = dropdown.querySelector('button');
        return button?.getAttribute('aria-label')?.toLowerCase().includes('table');
      }
    );

    expect(tableDropdown).toBeTruthy();

    const items = tableDropdown?.querySelectorAll('.toolbar-dropdown-item') ?? [];
    const itemIcons =
      tableDropdown?.querySelectorAll('.toolbar-dropdown-item .toolbar-dropdown-icon') ?? [];

    expect(items.length).toBeGreaterThan(0);
    expect(itemIcons.length).toBe(items.length);
  });

  it('disables focus-requiring buttons until the editor has focus and re-enables after blur', () => {
    const { editor } = createMockEditor();
    const toolbar = createFormattingToolbar(editor);

    const boldButton = toolbar.querySelector('.toolbar-button.bold') as HTMLButtonElement;

    expect(boldButton).toBeTruthy();
    expect(boldButton.disabled).toBe(true);

    window.dispatchEvent(new CustomEvent('editorFocusChange', { detail: { focused: true } }));
    expect(boldButton.disabled).toBe(false);

    window.dispatchEvent(new CustomEvent('editorFocusChange', { detail: { focused: false } }));
    expect(boldButton.disabled).toBe(true);
  });
});
