/** @jest-environment jsdom */

/**
 * Tests for Search Overlay - In-document Search Feature
 *
 * Tests the search functionality that allows users to find text
 * within the document with highlighting and navigation.
 *
 * Note: These tests focus on pure logic functions that can be tested
 * without a full DOM or editor instance. Integration testing would
 * require a more complete browser environment.
 */

/**
 * NOTE: The logic tests below are DOM-free. The UI tests use a lightweight mock
 * of the search overlay to validate focus/keyboard behavior without pulling in
 * the full TipTap editor.
 */

jest.mock('@tiptap/pm/view', () => {
  const Decoration = {
    inline: jest.fn(() => ({})),
  };
  type MockDecorationSet = { map: ReturnType<typeof jest.fn> };
  const makeSet = (): MockDecorationSet => ({
    map: jest.fn(() => makeSet()),
  });
  const DecorationSet = {
    empty: makeSet(),
    create: jest.fn(() => makeSet()),
  };
  return { Decoration, DecorationSet };
});

jest.mock('@tiptap/pm/state', () => {
  class PluginKey {
    key: string;
    constructor(key: string) {
      this.key = key;
    }
  }
  class Plugin {
    key: string | undefined;
    props: Record<string, unknown>;
    spec: { props?: Record<string, unknown>; key?: string };
    constructor(spec: { props?: Record<string, unknown>; key?: string }) {
      this.spec = spec;
      this.props = spec.props || {};
      this.key = spec.key;
    }
  }
  return { PluginKey, Plugin };
});

import type { Editor } from '@tiptap/core';
import {
  findMatches,
  showSearchOverlay,
  hideSearchOverlay,
} from '../../webview/features/searchOverlay';

type MockEditor = {
  view: {
    dispatch: ReturnType<typeof jest.fn>;
    coordsAtPos: ReturnType<typeof jest.fn>;
    domAtPos: ReturnType<typeof jest.fn>;
  };
  commands: {
    setTextSelection: ReturnType<typeof jest.fn>;
    focus: ReturnType<typeof jest.fn>;
  };
  state: {
    tr: { scrollIntoView: ReturnType<typeof jest.fn> };
    plugins: unknown[];
    selection: { from: number; to: number };
    doc: {
      descendants: ReturnType<typeof jest.fn>;
      textBetween: ReturnType<typeof jest.fn>;
    };
  };
  registerPlugin: ReturnType<typeof jest.fn>;
};

// Minimal DOM + editor mocks for UI behavior tests
function createMockEditorWithView(text: string): MockEditor {
  const dispatch = jest.fn();
  const coordsAtPos = jest.fn().mockReturnValue({ left: 0, top: 100 });
  const domAtPos = jest.fn().mockReturnValue({
    node: (() => {
      const el = document.createElement('div');
      (el as unknown as { scrollIntoView?: ReturnType<typeof jest.fn> }).scrollIntoView = jest.fn();
      return el;
    })(),
    offset: 0,
  });
  const view = { dispatch, coordsAtPos, domAtPos };

  const commands = {
    setTextSelection: jest.fn(),
    focus: jest.fn(),
  };

  const tr: {
    mapping: Record<string, unknown>;
    scrollIntoView: ReturnType<typeof jest.fn>;
    setMeta: ReturnType<typeof jest.fn>;
    getMeta: ReturnType<typeof jest.fn>;
  } = {
    mapping: {},
    scrollIntoView: jest.fn(() => tr),
    setMeta: jest.fn(() => tr),
    getMeta: jest.fn(() => undefined),
  };

  const state = {
    tr,
    plugins: [] as Array<{ key?: string; props?: Record<string, unknown> }>,
    selection: { from: 0, to: text.length },
    doc: {
      descendants: jest.fn(
        (cb: (node: { isText: boolean; text: string }, pos: number) => boolean) => {
          cb({ isText: true, text }, 1);
          return true;
        }
      ),
      textBetween: jest.fn(() => text),
    },
  };

  return {
    view,
    commands,
    state,
    registerPlugin: jest.fn((plugin: { key?: string; props?: Record<string, unknown> }) => {
      state.plugins.push(plugin);
    }),
  };
}

// Mock TipTap editor for testing
function createMockEditor(content: string) {
  // Simulate document structure: paragraphs with text nodes
  const textNodes: Array<{ text: string; pos: number }> = [];
  let pos = 1; // ProseMirror positions start at 1

  // Split content by newlines to simulate paragraphs
  const paragraphs = content.split('\n');
  paragraphs.forEach(para => {
    if (para.length > 0) {
      textNodes.push({ text: para, pos });
    }
    pos += para.length + 2; // +2 for paragraph node overhead
  });

  return {
    state: {
      doc: {
        descendants: (
          callback: (node: { isText: boolean; text: string }, pos: number) => boolean
        ) => {
          textNodes.forEach(({ text, pos }) => {
            callback({ isText: true, text }, pos);
          });
          return true;
        },
      },
    },
  };
}

describe('Search Overlay', () => {
  describe('findMatches', () => {
    it('should return empty array for empty query', () => {
      const editor = createMockEditor('Hello world');
      const result = findMatches(editor as unknown as Editor, '');
      expect(result).toEqual([]);
    });

    it('should find single match', () => {
      const editor = createMockEditor('Hello world');
      const result = findMatches(editor as unknown as Editor, 'world');

      expect(result).toHaveLength(1);
      expect(result[0].to - result[0].from).toBe(5); // 'world' length
    });

    it('should find multiple matches', () => {
      const editor = createMockEditor('Hello world, wonderful world');
      const result = findMatches(editor as unknown as Editor, 'world');

      expect(result).toHaveLength(2);
    });

    it('should be case-insensitive', () => {
      const editor = createMockEditor('Hello WORLD, World, world');
      const result = findMatches(editor as unknown as Editor, 'world');

      expect(result).toHaveLength(3);
    });

    it('should find overlapping matches', () => {
      const editor = createMockEditor('aaaa');
      const result = findMatches(editor as any, 'aa');

      // Should find matches at positions 0, 1, 2
      expect(result).toHaveLength(3);
    });

    it('should return empty array when no matches found', () => {
      const editor = createMockEditor('Hello world');
      const result = findMatches(editor as any, 'xyz');

      expect(result).toEqual([]);
    });

    it('should handle single character search', () => {
      const editor = createMockEditor('aaa');
      const result = findMatches(editor as any, 'a');

      expect(result).toHaveLength(3);
    });

    it('should handle special characters in search', () => {
      const editor = createMockEditor('Hello (world)');
      const result = findMatches(editor as any, '(world)');

      expect(result).toHaveLength(1);
    });

    it('should handle whitespace in query', () => {
      const editor = createMockEditor('Hello world');
      const result = findMatches(editor as any, 'lo wo');

      expect(result).toHaveLength(1);
    });

    it('should handle unicode characters', () => {
      const editor = createMockEditor('Hello 世界');
      const result = findMatches(editor as any, '世界');

      expect(result).toHaveLength(1);
    });

    it('should handle emoji in text', () => {
      const editor = createMockEditor('Hello 🎉 world');
      const result = findMatches(editor as any, '🎉');

      expect(result).toHaveLength(1);
    });
  });

  describe('match positions', () => {
    it('should return correct from/to positions', () => {
      const editor = createMockEditor('Hello world');
      const result = findMatches(editor as unknown as Editor, 'world');

      expect(result).toHaveLength(1);
      // The exact position depends on the mock structure
      // but to - from should always equal query length
      expect(result[0].to - result[0].from).toBe(5);
    });

    it('should track position across multiple text nodes', () => {
      const editor = createMockEditor('First line\nSecond line');
      const result = findMatches(editor as any, 'line');

      // Should find 'line' in both paragraphs
      expect(result).toHaveLength(2);
    });
  });

  describe('edge cases', () => {
    it('should handle empty document', () => {
      const editor = createMockEditor('');
      const result = findMatches(editor as any, 'test');

      expect(result).toEqual([]);
    });

    it('should handle query longer than document', () => {
      const editor = createMockEditor('Hi');
      const result = findMatches(editor as any, 'This is a very long query');

      expect(result).toEqual([]);
    });

    it('should handle very long document', () => {
      const longContent = 'test '.repeat(1000);
      const editor = createMockEditor(longContent);
      const result = findMatches(editor as any, 'test');

      expect(result).toHaveLength(1000);
    });

    it('should handle special regex characters safely', () => {
      const editor = createMockEditor('Hello [world] (test) {foo}');

      // These should not throw errors (no regex interpretation)
      expect(() => findMatches(editor as unknown as Editor, '[world]')).not.toThrow();
      expect(() => findMatches(editor as unknown as Editor, '(test)')).not.toThrow();
      expect(() => findMatches(editor as unknown as Editor, '{foo}')).not.toThrow();
      expect(() => findMatches(editor as unknown as Editor, '.*')).not.toThrow();
    });

    it('should handle backslash in query', () => {
      const editor = createMockEditor('path\\to\\file');
      const result = findMatches(editor as unknown as Editor, '\\');

      expect(result).toHaveLength(2);
    });
  });
});

describe('Search Overlay UI behaviors', () => {
  let editor: MockEditor;

  beforeEach(() => {
    // Clean DOM between tests
    document.body.innerHTML = '';
    // Mock window.scrollTo (not implemented in jsdom)
    window.scrollTo = jest.fn();
    editor = createMockEditorWithView('hello hello');
  });

  afterEach(() => {
    hideSearchOverlay(editor as unknown as Editor, false);
  });

  it('focuses the search input when shown', () => {
    showSearchOverlay(editor as unknown as Editor);
    const input = document.querySelector('.search-overlay-input') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(document.activeElement).toBe(input);
  });

  it('Cmd/Ctrl+A selects all text within the search input', () => {
    showSearchOverlay(editor as unknown as Editor);
    const input = document.querySelector('.search-overlay-input') as HTMLInputElement;
    input.value = 'hello world';
    input.setSelectionRange(5, 5);

    const evt = new KeyboardEvent('keydown', { key: 'a', metaKey: true, bubbles: true });
    Object.defineProperty(evt, 'preventDefault', { value: jest.fn(), writable: true });
    Object.defineProperty(evt, 'stopPropagation', { value: jest.fn(), writable: true });
    input.dispatchEvent(evt);

    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(input.value.length);
  });

  it('Enter cycles to next match and keeps input focused', () => {
    showSearchOverlay(editor as unknown as Editor);
    const input = document.querySelector('.search-overlay-input') as HTMLInputElement;
    input.value = 'hello';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    // First match selected on initial search
    const firstSelection = editor.commands.setTextSelection.mock.calls.slice(-1)[0]?.[0];
    expect(firstSelection?.from).toBeDefined();

    // Press Enter to go to next match
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    input.dispatchEvent(enter);

    const secondSelection = editor.commands.setTextSelection.mock.calls.slice(-1)[0]?.[0];
    expect(secondSelection?.from).toBeGreaterThan(firstSelection.from);
    expect(document.activeElement).toBe(input);
  });
});

describe('Search Overlay UI behavior (future tests)', () => {
  // Placeholder for additional integration tests that require a full editor environment
  describe('integration tests requiring full TipTap', () => {
    it.todo('should highlight all matches with ProseMirror decorations');
    it.todo('should wrap around from last to first match');
    it.todo('should restore cursor position when closed without navigation');
  });
});
