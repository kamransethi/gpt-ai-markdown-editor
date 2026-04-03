import { WorkspaceEdit, Position, workspace, ExtensionContext, TextDocument } from 'vscode';
import { MarkdownEditorProvider } from '../../editor/MarkdownEditorProvider';
import { DocumentSync } from '../../editor/handlers/documentSync';

// Helper to create a minimal mock TextDocument
function createDocument(content: string, uri = 'file://test.md') {
  return {
    getText: jest.fn(() => content),
    uri: {
      toString: () => uri,
    },
    positionAt: jest.fn((offset: number) => new Position(0, offset)),
  };
}

describe('MarkdownEditorProvider frontmatter rendering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('wraps YAML frontmatter in a fenced code block when sending to webview', () => {
    const provider = new MarkdownEditorProvider({} as ExtensionContext);
    const content = [
      '---',
      'title: Example',
      'slug: example',
      '---',
      '',
      '# Heading',
      'body content',
    ].join('\n');

    const document = createDocument(content);
    const webview = { postMessage: jest.fn() };

    (provider.sync as DocumentSync).updateWebview(
      document as unknown as TextDocument,
      webview as unknown as import('vscode').Webview
    );

    expect(webview.postMessage).toHaveBeenCalledTimes(1);
    const payload = (webview.postMessage as jest.Mock).mock.calls[0][0];
    expect(payload.type).toBe('update');

    const sent = payload.content as string;
    expect(sent.startsWith('---')).toBe(true);
    expect(sent).toContain('title: Example');
    expect(sent).toContain('slug: example');
    expect(sent.trimEnd()).toContain('# Heading');
  });

  it('restores YAML delimiters when saving an edited fenced block', async () => {
    const provider = new MarkdownEditorProvider({} as ExtensionContext);
    const original = ['---', 'title: Old', '---', '', '# Heading'].join('\n');
    const document = createDocument(original) as unknown as TextDocument;
    const webview = { postMessage: jest.fn() };

    // Seed any internal caches via updateWebview
    (provider.sync as DocumentSync).updateWebview(
      document,
      webview as unknown as import('vscode').Webview
    );

    const editedRaw = ['---', 'title: New', '---', '', '# Heading'].join('\n');

    let savedText = '';
    (workspace.applyEdit as jest.Mock).mockImplementation(async (edit: WorkspaceEdit) => {
      const replaces = (edit as unknown as { replaces?: Array<{ text: string }> }).replaces || [];
      if (replaces.length > 0) {
        savedText = replaces[0].text;
      }
      return true;
    });

    await (provider.sync as DocumentSync).applyEdit(editedRaw, document);

    expect(savedText.startsWith('---\ntitle: New')).toBe(true);
    expect(savedText).toContain('\n---\n\n# Heading');
  });
});
