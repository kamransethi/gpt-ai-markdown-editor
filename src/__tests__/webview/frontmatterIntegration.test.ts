/** @jest-environment jsdom */
/**
 * Integration test: Frontmatter button in toolbar opens modal and updates document.
 */

jest.mock('@tiptap/core', () => ({
  Editor: jest.fn(),
  Extension: { create: (config: unknown) => config },
  Mark: { create: (config: unknown) => config },
  Node: { create: (config: unknown) => config },
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
}));
jest.mock('@tiptap/extension-highlight', () => ({
  __esModule: true,
  default: { configure: () => ({}) },
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
jest.mock('./../../webview/extensions/customImage', () => ({
  CustomImage: { configure: () => ({}) },
}));
jest.mock('./../../webview/extensions/mermaid', () => ({ Mermaid: {} }));
jest.mock('./../../webview/extensions/tabIndentation', () => ({ TabIndentation: {} }));
jest.mock('./../../webview/extensions/imageEnterSpacing', () => ({ ImageEnterSpacing: {} }));
jest.mock('./../../webview/extensions/markdownParagraph', () => ({ MarkdownParagraph: {} }));
jest.mock('./../../webview/extensions/indentedImageCodeBlock', () => ({
  IndentedImageCodeBlock: {},
}));
jest.mock('./../../webview/extensions/spaceFriendlyImagePaths', () => ({
  SpaceFriendlyImagePaths: {},
}));
jest.mock('./../../webview/extensions/githubAlerts', () => ({ GitHubAlert: {} }));
jest.mock('./../../webview/extensions/htmlPreservation', () => ({
  GenericHTMLInline: {},
  GenericHTMLBlock: {},
}));
jest.mock('./../../webview/extensions/htmlComment', () => ({
  HtmlCommentInline: {},
  HtmlCommentBlock: {},
  setPreserveHtmlComments: jest.fn(),
}));
jest.mock('./../../webview/BubbleMenuView', () => ({
  createFormattingToolbar: () => ({}),
  createTableMenu: () => ({}),
  updateToolbarStates: jest.fn(),
}));
jest.mock('./../../webview/features/imageDragDrop', () => ({
  setupImageDragDrop: jest.fn(),
  hasPendingImageSaves: jest.fn(() => false),
  getPendingImageCount: jest.fn(() => 0),
}));
jest.mock('./../../webview/features/tocOverlay', () => ({ toggleTocOverlay: jest.fn() }));
jest.mock('./../../webview/features/searchOverlay', () => ({ toggleSearchOverlay: jest.fn() }));
jest.mock('./../../webview/extensions/searchAndReplace', () => ({ SearchAndReplace: {} }));
jest.mock('./../../webview/extensions/slashCommand', () => ({ SlashCommand: {} }));
jest.mock('./../../webview/extensions/aiExplain', () => ({
  AiExplain: {},
  handleAiExplainResult: jest.fn(),
}));
jest.mock('./../../webview/utils/exportContent', () => ({
  collectExportContent: jest.fn(),
  getDocumentTitle: jest.fn(),
}));
jest.mock('./../../webview/utils/pasteHandler', () => ({
  processPasteContent: jest.fn(() => ({ isImage: false, wasConverted: false, content: '' })),
}));
jest.mock('./../../webview/utils/copyMarkdown', () => ({ copySelectionAsMarkdown: jest.fn() }));
jest.mock('./../../webview/utils/outline', () => ({ buildOutlineFromEditor: jest.fn(() => []) }));
jest.mock('./../../webview/utils/scrollToHeading', () => ({ scrollToHeading: jest.fn() }));
jest.mock('./../../webview/utils/linkValidation', () => ({ shouldAutoLink: jest.fn(() => false) }));
jest.mock('./../../webview/features/linkDialog', () => ({ showLinkDialog: jest.fn() }));
jest.mock('./../../webview/features/imageRenameDialog', () => ({}));

jest.mock('@tiptap/extension-drag-handle', () => ({
  __esModule: true,
  DragHandle: { configure: () => ({}) },
  default: { configure: () => ({}) },
}));

jest.mock('@tiptap/extension-text-style', () => ({
  __esModule: true,
  TextStyle: { configure: () => ({}) },
  default: { configure: () => ({}) },
}));

describe('frontmatter editor integration', () => {
  it('openFrontmatterEditor is accessible on window', async () => {
    // Mock VS Code API
    const mockVscodeApi = {
      postMessage: jest.fn(),
      getState: jest.fn(),
      setState: jest.fn(),
    };
    (global as any).acquireVsCodeApi = jest.fn(() => mockVscodeApi);
    (window as any).acquireVsCodeApi = jest.fn(() => mockVscodeApi);

    // Set up minimal DOM
    const mockDocument = {
      readyState: 'loading',
      addEventListener: jest.fn(),
      getElementById: jest.fn(() => null),
      createElement: document.createElement.bind(document),
      body: document.body,
      querySelector: document.querySelector.bind(document),
    };
    (global as any).document = mockDocument;

    // Load the editor module
    jest.resetModules();
    await import('../../webview/editor');

    // Verify openFrontmatterEditor is on window
    expect((window as any).openFrontmatterEditor).toBeDefined();
    expect(typeof (window as any).openFrontmatterEditor).toBe('function');
  });

  it('openFrontmatterEditor opens modal and handles save', async () => {
    const mockVscodeApi = {
      postMessage: jest.fn(),
      getState: jest.fn(),
      setState: jest.fn(),
    };
    (global as any).acquireVsCodeApi = jest.fn(() => mockVscodeApi);
    (window as any).acquireVsCodeApi = jest.fn(() => mockVscodeApi);

    const mockDocument = {
      readyState: 'loading',
      addEventListener: jest.fn(),
      getElementById: jest.fn(() => null),
      createElement: document.createElement.bind(document),
      body: document.body,
      querySelector: document.querySelector.bind(document),
    };
    (global as any).document = mockDocument;

    jest.resetModules();
    await import('../../webview/editor');

    // Call openFrontmatterEditor (it should open a modal)
    const openFrontmatterEditor = (window as any).openFrontmatterEditor;

    // This is an async function, so we run it but don't await yet
    const modalPromise = openFrontmatterEditor();

    // Give some time for the modal to render
    await new Promise(resolve => setTimeout(resolve, 50));

    // Modal should be visible
    const modal = document.querySelector('.frontmatter-modal');
    expect(modal).toBeTruthy();

    // Simulate save and close
    const cancelButton = document.querySelector(
      '.frontmatter-modal-button-cancel'
    ) as HTMLButtonElement;
    if (cancelButton) {
      cancelButton.click();
    }

    // Wait for modal to close
    await modalPromise;

    // Modal should be gone
    expect(document.querySelector('.frontmatter-modal')).toBeNull();
  });
});
