import * as vscode from 'vscode';
import { WorkspaceEdit, Position, workspace } from 'vscode';
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

describe('MarkdownEditorProvider undo/redo safety', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should mark document clean when undo returns to original content', async () => {
    const provider = new MarkdownEditorProvider({} as unknown as vscode.ExtensionContext);
    const originalContent = 'alpha';
    let content = originalContent;
    const document = {
      getText: jest.fn(() => content),
      uri: { toString: () => 'file://test.md' },
      positionAt: jest.fn((offset: number) => new Position(0, offset)),
      isDirty: false,
    };

    (workspace.applyEdit as jest.Mock).mockImplementation(async (edit: WorkspaceEdit) => {
      const replaces = (edit as unknown as { replaces?: Array<{ text: string }> }).replaces || [];
      if (replaces.length > 0) {
        content = replaces[0].text;
        document.isDirty = content !== originalContent;
      }
      return true;
    });

    await (provider.sync as DocumentSync).applyEdit(
      'alpha beta',
      document as unknown as vscode.TextDocument
    );
    expect(document.isDirty).toBe(true);

    await (provider.sync as DocumentSync).applyEdit(
      originalContent,
      document as unknown as vscode.TextDocument
    );
    expect(document.isDirty).toBe(false);
  });

  it('should return to clean state after multiple edits are fully undone', async () => {
    const provider = new MarkdownEditorProvider({} as unknown as vscode.ExtensionContext);
    const originalContent = 'start';
    let content = originalContent;
    const document = {
      getText: jest.fn(() => content),
      uri: { toString: () => 'file://test.md' },
      positionAt: jest.fn((offset: number) => new Position(0, offset)),
      isDirty: false,
    };

    (workspace.applyEdit as jest.Mock).mockImplementation(async (edit: WorkspaceEdit) => {
      const replaces = (edit as unknown as { replaces?: Array<{ text: string }> }).replaces || [];
      if (replaces.length > 0) {
        content = replaces[0].text;
        document.isDirty = content !== originalContent;
      }
      return true;
    });

    // Apply multiple edits
    await (provider.sync as DocumentSync).applyEdit(
      'edit1',
      document as unknown as vscode.TextDocument
    );
    await (provider.sync as DocumentSync).applyEdit(
      'edit2',
      document as unknown as vscode.TextDocument
    );
    await (provider.sync as DocumentSync).applyEdit(
      'edit3',
      document as unknown as vscode.TextDocument
    );
    expect(document.isDirty).toBe(true);
    expect(content).toBe('edit3');

    // Undo sequence back to original
    await (provider.sync as DocumentSync).applyEdit(
      'edit2',
      document as unknown as vscode.TextDocument
    );
    await (provider.sync as DocumentSync).applyEdit(
      'edit1',
      document as unknown as vscode.TextDocument
    );
    await (provider.sync as DocumentSync).applyEdit(
      originalContent,
      document as unknown as vscode.TextDocument
    );

    expect(content).toBe(originalContent);
    expect(document.isDirty).toBe(false);
  });

  it('should skip applyEdit when content is unchanged', async () => {
    const provider = new MarkdownEditorProvider({} as unknown as vscode.ExtensionContext);
    const document = createDocument('hello world');

    const result = await (provider.sync as DocumentSync).applyEdit(
      'hello world',
      document as unknown as vscode.TextDocument
    );

    expect(result).toBe(true);
    expect(workspace.applyEdit).not.toHaveBeenCalled();
    expect((provider.sync as any).pendingEdits.size).toBe(0);
  });

  it('should apply edit and mark pending when content changes', async () => {
    const provider = new MarkdownEditorProvider({} as unknown as vscode.ExtensionContext);
    const document = createDocument('hello world');

    const result = await (provider.sync as DocumentSync).applyEdit(
      'hi world',
      document as unknown as vscode.TextDocument
    );

    expect(result).toBe(true);
    expect(workspace.applyEdit).toHaveBeenCalledTimes(1);

    const lastCall = (workspace.applyEdit as jest.Mock).mock.calls[0][0] as WorkspaceEdit;
    expect(lastCall).toBeInstanceOf(WorkspaceEdit);

    const replaces = (lastCall as unknown as { replaces?: Array<{ text: string }> }).replaces;
    expect(replaces).toHaveLength(1);
    expect(replaces?.[0]?.text).toBe('hi world');
    expect((provider.sync as any).pendingEdits.size).toBe(1);
  });

  it('should skip webview update when content matches last sent payload', () => {
    const provider = new MarkdownEditorProvider({} as unknown as vscode.ExtensionContext);
    const document = createDocument('same content');
    const webview = { postMessage: jest.fn() };

    (provider.sync as any).lastWebviewContent.set(document.uri.toString(), 'same content');

    (provider.sync as DocumentSync).updateWebview(
      document as unknown as vscode.TextDocument,
      webview as unknown as vscode.Webview
    );

    expect(webview.postMessage).not.toHaveBeenCalled();
  });

  it('should send webview update when content differs from last sent payload', () => {
    const provider = new MarkdownEditorProvider({} as unknown as vscode.ExtensionContext);
    const document = createDocument('fresh content');
    const webview = { postMessage: jest.fn() };

    (provider.sync as any).lastWebviewContent.set(document.uri.toString(), 'old content');

    (provider.sync as DocumentSync).updateWebview(
      document as unknown as vscode.TextDocument,
      webview as unknown as vscode.Webview
    );

    expect(webview.postMessage).toHaveBeenCalledTimes(1);
    const payload = (webview.postMessage as jest.Mock).mock.calls[0][0];
    expect(payload.type).toBe('update');
    expect(payload.content).toBe('fresh content');
    // Ensure a few important settings are present
    expect(payload).toHaveProperty('developerMode');
    expect(payload).toHaveProperty('editorZoomLevel');
  });
});
