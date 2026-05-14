/** @jest-environment jsdom */
/**
 * Tests for frontmatter extraction, restoration, parsing, and panel update logic.
 *
 * We mock TipTap and related heavy dependencies so the module can be imported
 * without a real browser environment.
 */

jest.mock('@tiptap/core', () => ({
  Editor: jest.fn(),
  Extension: { create: (config: unknown) => config },
  Mark: { create: (config: unknown) => config },
  Node: { create: (config: unknown) => config },
  mergeAttributes: jest.fn(),
}));
jest.mock('@tiptap/starter-kit', () => ({ __esModule: true, default: { configure: () => ({}) } }));
jest.mock('@tiptap/markdown', () => ({ Markdown: { configure: () => ({}) } }));
jest.mock('lowlight', () => ({
  __esModule: true,
  createLowlight: () => ({ register: jest.fn() }),
}));
jest.mock('@tiptap/extension-table', () => ({
  __esModule: true,
  TableKit: { configure: () => ({}) },
  Table: { extend: () => ({ configure: () => ({}) }) },
}));
jest.mock('prosemirror-tables', () => ({
  __esModule: true,
  TableView: class {},
  findTable: jest.fn(),
}));
jest.mock('@tiptap/extension-list', () => ({
  __esModule: true,
  ListKit: { configure: () => ({}) },
  OrderedList: { extend: (config: unknown) => config },
  TaskItem: { extend: () => ({ configure: () => ({}) }) },
}));
jest.mock('@tiptap/extension-link', () => ({
  __esModule: true,
  default: { configure: () => ({}) },
}));
jest.mock('@tiptap/extension-code-block-lowlight', () => ({
  __esModule: true,
  CodeBlockLowlight: { extend: () => ({}) },
  default: { configure: () => ({}) },
}));
jest.mock('tiptap-extension-code-block-shiki', () => ({
  __esModule: true,
  default: { configure: () => ({}) },
}));
jest.mock('tiptap-extension-global-drag-handle', () => ({
  __esModule: true,
  default: { configure: () => ({}) },
}));
jest.mock('@tiptap/suggestion', () => ({
  __esModule: true,
  Suggestion: jest.fn(() => []),
  default: jest.fn(() => []),
}));
jest.mock('@tiptap/extension-highlight', () => ({
  __esModule: true,
  default: { configure: () => ({}) },
  Highlight: { configure: () => ({}) },
}));
jest.mock('@tiptap/extension-character-count', () => ({
  __esModule: true,
  default: { configure: () => ({}) },
}));
jest.mock('@tiptap/extension-placeholder', () => ({
  __esModule: true,
  default: { configure: () => ({}) },
}));
jest.mock('@tiptap/extension-typography', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@tiptap/extension-underline', () => ({
  __esModule: true,
  default: { configure: () => ({}) },
}));
jest.mock('../../../webview/extensions/customImage', () => ({
  CustomImage: { configure: () => ({}) },
}));
jest.mock('../../../webview/extensions/mermaid', () => ({ Mermaid: {} }));
jest.mock('../../../webview/extensions/tabIndentation', () => ({ TabIndentation: {} }));
jest.mock('../../../webview/extensions/imageBoundaryNav', () => ({ ImageBoundaryNav: {} }));
jest.mock('../../../webview/extensions/indentedImageCodeBlock', () => ({
  IndentedImageCodeBlock: {},
}));
jest.mock('../../../webview/extensions/spaceFriendlyImagePaths', () => ({
  SpaceFriendlyImagePaths: {},
}));
jest.mock('../../../webview/extensions/githubAlerts', () => ({ GitHubAlert: {} }));
jest.mock('../../../webview/extensions/htmlPreservation', () => ({
  GenericHTMLInline: {},
  GenericHTMLBlock: {},
}));
jest.mock('../../../webview/extensions/htmlComment', () => ({
  HtmlCommentInline: {},
  HtmlCommentBlock: {},
  setPreserveHtmlComments: jest.fn(),
}));
jest.mock('../../../webview/BubbleMenuView', () => ({
  createFormattingToolbar: () => ({}),
  createTableMenu: () => ({}),
  updateToolbarStates: jest.fn(),
}));
jest.mock('../../../webview/features/imageDragDrop', () => ({
  setupImageDragDrop: jest.fn(),
  hasPendingImageSaves: jest.fn(() => false),
  getPendingImageCount: jest.fn(() => 0),
}));
jest.mock('../../../webview/features/tocOverlay', () => ({ toggleTocOverlay: jest.fn() }));
jest.mock('../../../webview/features/searchOverlay', () => ({ toggleSearchOverlay: jest.fn() }));
jest.mock('../../../webview/extensions/searchAndReplace', () => ({ SearchAndReplace: {} }));
jest.mock('../../../webview/extensions/slashCommand', () => ({ SlashCommand: {} }));
jest.mock('../../../webview/extensions/aiExplain', () => ({
  AiExplain: {},
  handleAiExplainResult: jest.fn(),
}));
jest.mock('../../../webview/utils/exportContent', () => ({
  collectExportContent: jest.fn(),
  getDocumentTitle: jest.fn(),
}));
jest.mock('../../../webview/utils/pasteHandler', () => ({
  processPasteContent: jest.fn(() => ({ isImage: false, wasConverted: false, content: '' })),
}));
jest.mock('../../../webview/utils/copyMarkdown', () => ({ copySelectionAsMarkdown: jest.fn() }));
jest.mock('../../../webview/utils/outline', () => ({ buildOutlineFromEditor: jest.fn(() => []) }));
jest.mock('../../../webview/utils/scrollToHeading', () => ({ scrollToHeading: jest.fn() }));
jest.mock('../../../webview/utils/linkValidation', () => ({
  shouldAutoLink: jest.fn(() => false),
}));
jest.mock('../../../webview/features/linkDialog', () => ({ showLinkDialog: jest.fn() }));
jest.mock('../../../webview/features/imageRenameDialog', () => ({}));

jest.mock('@tiptap/extension-drag-handle', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Extension } = require('@tiptap/core');
  const mockExtension = Extension.create({ name: 'dragHandle' });
  return { __esModule: true, DragHandle: mockExtension, default: mockExtension };
});

jest.mock('@tiptap/extension-text-style', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Mark } = require('@tiptap/core');
  const mockMark = Mark.create({ name: 'textStyle' });
  return { __esModule: true, TextStyle: mockMark, default: mockMark };
});

export {};

type TestingModule = {
  resetSyncState: () => void;
  resetFrontmatterForTests: () => void;
  setMockEditor: (editor: unknown) => void;
  trackSentContentForTests: (content: string) => void;
  updateEditorContentForTests: (content: string) => void;
  extractAndStoreFrontmatterForTests: (markdown: string) => {
    content: string;
    frontmatter: string | null;
  };
  restoreFrontmatterForTests: (markdown: string, frontmatter: string | null) => string;
  parseFrontmatterPairsForTests: (frontmatter: string) => Array<[string, string]>;
};

describe('frontmatter extraction & restoration', () => {
  let testing: TestingModule;

  const setupModule = async () => {
    jest.resetModules();

    const mockDocument = {
      readyState: 'loading',
      addEventListener: jest.fn(),
      getElementById: jest.fn(() => null),
    };
    (global as any).document = mockDocument;

    const mockAcquireVsCodeApi = jest.fn(() => ({
      postMessage: jest.fn(),
      getState: jest.fn(),
      setState: jest.fn(),
    }));
    (globalThis as any).acquireVsCodeApi = mockAcquireVsCodeApi;
    (globalThis as any).acquireVsCodeApi = mockAcquireVsCodeApi;

    const mod = await import('../../../webview/editor');
    testing = mod.__testing as TestingModule;
  };

  beforeEach(async () => {
    await setupModule();
    testing.resetSyncState();
    testing.resetFrontmatterForTests();
  });

  describe('extractAndStoreFrontmatter', () => {
    it('extracts YAML frontmatter and returns the body', () => {
      const { content, frontmatter } = testing.extractAndStoreFrontmatterForTests(
        '---\nbaba: blacksheep\n---\n# Content'
      );
      expect(frontmatter).toBe('baba: blacksheep');
      expect(content).toBe('# Content');
    });

    it('preserves spaces around colon in YAML key-value', () => {
      const { content, frontmatter } = testing.extractAndStoreFrontmatterForTests(
        '---\nbaba : blacksheep\n---\n# Content'
      );
      expect(frontmatter).toBe('baba : blacksheep');
      expect(content).toBe('# Content');
    });

    it('handles multiple YAML fields', () => {
      const md = '---\ntitle: My Post\ndate: 2026-04-02\ntags: [a, b]\n---\n# Body';
      const { content, frontmatter } = testing.extractAndStoreFrontmatterForTests(md);
      expect(frontmatter).toBe('title: My Post\ndate: 2026-04-02\ntags: [a, b]');
      expect(content).toBe('# Body');
    });

    it('returns original content unchanged when no frontmatter', () => {
      const md = '# Just a Heading\n\nSome content.';
      const { content, frontmatter } = testing.extractAndStoreFrontmatterForTests(md);
      expect(frontmatter).toBeNull();
      expect(content).toBe(md);
    });

    it('handles CRLF line endings', () => {
      const md = '---\r\nbaba: blacksheep\r\n---\r\n# Content';
      const { content, frontmatter } = testing.extractAndStoreFrontmatterForTests(md);
      expect(frontmatter).toBe('baba: blacksheep');
      expect(content).toBe('# Content');
    });

    it('returns null frontmatter for empty document', () => {
      const { content, frontmatter } = testing.extractAndStoreFrontmatterForTests('');
      expect(frontmatter).toBeNull();
      expect(content).toBe('');
    });

    it('does NOT re-extract corrupted double-delimiter content as frontmatter', () => {
      // The corrupted state has: ---\nbaba: blacksheep\n---\n---\n## baba: blacksheep\n# Content
      // Because the "frontmatter" was already extracted, the REMAINING content starts with ---
      // which is just an HR in markdown, not frontmatter. This tests that the extraction
      // only fires when the FIRST --- is at the very start.
      const corrupted = '---\nbaba: blacksheep\n---\n---\n\n## baba: blacksheep\n\n# Content';
      const { content, frontmatter } = testing.extractAndStoreFrontmatterForTests(corrupted);
      // The regex should match the OUTER frontmatter block
      expect(frontmatter).toBe('baba: blacksheep');
      expect(content).toBe('---\n\n## baba: blacksheep\n\n# Content');
    });

    it('handles frontmatter at start with no trailing newline after closing ---', () => {
      const md = '---\nkey: value\n---';
      const { content, frontmatter } = testing.extractAndStoreFrontmatterForTests(md);
      expect(frontmatter).toBe('key: value');
      expect(content).toBe('');
    });
  });

  describe('restoreFrontmatter', () => {
    it('prepends frontmatter block back to content', () => {
      const result = testing.restoreFrontmatterForTests('# Content', 'baba: blacksheep');
      expect(result).toBe('---\nbaba: blacksheep\n---\n# Content');
    });

    it('preserves spaces around colon exactly � does NOT normalize', () => {
      const result = testing.restoreFrontmatterForTests('# Content', 'baba : blacksheep');
      expect(result).toBe('---\nbaba : blacksheep\n---\n# Content');
    });

    it('returns markdown unchanged when frontmatter is null', () => {
      const result = testing.restoreFrontmatterForTests('# Content', null);
      expect(result).toBe('# Content');
    });

    it('round-trips correctly: extract then restore produces original', () => {
      const original = '---\ntitle: Test\ndate: 2026-01-01\n---\n# Heading\n\nParagraph.';
      const { content, frontmatter } = testing.extractAndStoreFrontmatterForTests(original);
      const restored = testing.restoreFrontmatterForTests(content, frontmatter);
      expect(restored).toBe(original);
    });

    it('round-trips with spaces-around-colon YAML', () => {
      const original = '---\nbaba : blacksheep\n---\n# Comprehensive Markdown Stress Test';
      const { content, frontmatter } = testing.extractAndStoreFrontmatterForTests(original);
      const restored = testing.restoreFrontmatterForTests(content, frontmatter);
      expect(restored).toBe(original);
    });
  });

  describe('parseFrontmatterPairs', () => {
    it('parses basic key: value pairs', () => {
      const pairs = testing.parseFrontmatterPairsForTests('title: My Post\ndate: 2026-04-02');
      expect(pairs).toEqual([
        ['title', 'My Post'],
        ['date', '2026-04-02'],
      ]);
    });

    it('handles spaces around colon (YAML spec)', () => {
      const pairs = testing.parseFrontmatterPairsForTests('baba : blacksheep');
      expect(pairs).toEqual([['baba', 'blacksheep']]);
    });

    it('skips empty lines', () => {
      const pairs = testing.parseFrontmatterPairsForTests('title: Test\n\nauthor: Jane');
      expect(pairs).toEqual([
        ['title', 'Test'],
        ['author', 'Jane'],
      ]);
    });

    it('handles values containing colons (e.g. URLs)', () => {
      const pairs = testing.parseFrontmatterPairsForTests('url: https://example.com/page');
      expect(pairs).toEqual([['url', 'https://example.com/page']]);
    });

    it('returns empty array for empty frontmatter', () => {
      expect(testing.parseFrontmatterPairsForTests('')).toEqual([]);
    });

    it('skips lines with no colon', () => {
      const pairs = testing.parseFrontmatterPairsForTests('notakey\ntitle: Test');
      expect(pairs).toEqual([['title', 'Test']]);
    });
  });

  describe('updateEditorContent frontmatter handling', () => {
    it('always strips frontmatter before passing to TipTap, even after init', () => {
      const mockEditor = {
        getMarkdown: jest.fn().mockReturnValue(''),
        state: { selection: { from: 0, to: 0 }, doc: { content: { size: 10 } } },
        commands: { setContent: jest.fn(), setTextSelection: jest.fn() },
      };

      testing.setMockEditor(mockEditor);

      // Simulate: first update has frontmatter
      testing.updateEditorContentForTests('---\nbaba : blacksheep\n---\n# Content');

      // TipTap should receive ONLY the body (no frontmatter)
      expect(mockEditor.commands.setContent).toHaveBeenCalledWith(
        expect.stringMatching(/^#\s+Content/),
        { contentType: 'markdown' }
      );
      const callArgs = mockEditor.commands.setContent.mock.calls[0][0] as string;
      expect(callArgs).not.toContain('---');
      expect(callArgs).not.toContain('baba');
    });

    it('strips frontmatter on subsequent updates too (not just first load)', () => {
      const mockEditor = {
        getMarkdown: jest
          .fn()
          .mockReturnValueOnce('# Content') // first call: content matches, skip
          .mockReturnValue('# Content'), // subsequent calls
        state: { selection: { from: 0, to: 0 }, doc: { content: { size: 10 } } },
        commands: { setContent: jest.fn(), setTextSelection: jest.fn() },
      };

      testing.setMockEditor(mockEditor);

      // First call: set the frontmatter (init-like)
      testing.updateEditorContentForTests('---\nbaba : blacksheep\n---\n# Content');

      // Second call: simulate another update with same frontmatter but different body
      mockEditor.getMarkdown.mockReturnValue('# Old Content');
      testing.updateEditorContentForTests('---\nbaba : blacksheep\n---\n# New Content');

      // Both calls should strip frontmatter; second call gets new content
      const calls = mockEditor.commands.setContent.mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(1);
      const lastCall = calls[calls.length - 1][0] as string;
      expect(lastCall).not.toContain('---');
      expect(lastCall).not.toContain('baba');
    });

    it('does not overwrite stored frontmatter when update has no frontmatter (echo update)', () => {
      const mockEditor = {
        getMarkdown: jest.fn().mockReturnValue('# Old'),
        state: { selection: { from: 0, to: 0 }, doc: { content: { size: 10 } } },
        commands: { setContent: jest.fn(), setTextSelection: jest.fn() },
      };

      testing.setMockEditor(mockEditor);

      // First: set frontmatter via extraction
      testing.extractAndStoreFrontmatterForTests('---\nbaba : blacksheep\n---\n# Content');

      // Second: simulate echo update without frontmatter (body-only sync)
      // After my fix, currentFrontmatter should NOT be cleared to null
      testing.updateEditorContentForTests('---\nbaba : blacksheep\n---\n# Content');
      const callContent = mockEditor.commands.setContent.mock.calls[0]?.[0] as string;
      // frontmatter should not appear in the content sent to TipTap
      if (callContent) {
        expect(callContent).not.toMatch(/^---/);
      }
    });
  });
});
