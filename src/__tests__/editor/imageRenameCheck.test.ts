import { handleCheckImageRename } from '../../editor/handlers/imageHandlers';
import * as vscode from 'vscode';

jest.mock('vscode', () => ({
  window: {
    showErrorMessage: jest.fn(),
    showInformationMessage: jest.fn(),
  },
  workspace: {
    getWorkspaceFolder: jest.fn(),
    workspaceFolders: undefined,
    getConfiguration: jest.fn(() => ({
      get: jest.fn((_key: string, defaultValue?: unknown) => defaultValue),
      update: jest.fn(),
    })),
    onDidChangeTextDocument: jest.fn(),
    onDidChangeConfiguration: jest.fn(),
    applyEdit: jest.fn(),
    fs: {
      stat: jest.fn(),
    },
  },
  Uri: {
    file: jest.fn((p: string) => ({ fsPath: p, scheme: 'file' })),
  },
  TreeItem: class TreeItem {
    constructor(
      public label: unknown,
      public collapsibleState?: unknown
    ) {}
  },
  TreeItemCollapsibleState: {
    None: 0,
    Collapsed: 1,
    Expanded: 2,
  },
  ThemeIcon: class ThemeIcon {
    constructor(
      public id: string,
      public color?: unknown
    ) {}
  },
  ThemeColor: class ThemeColor {
    constructor(public id: string) {}
  },
  EventEmitter: class EventEmitter<T> {
    public event = jest.fn();
    fire = jest.fn((_data?: T) => {});
    dispose = jest.fn();
  },
  ViewColumn: {
    Beside: 2,
    Active: -1,
  },
  commands: {
    executeCommand: jest.fn(),
    registerCommand: jest.fn(() => ({ dispose: jest.fn() })),
  },
  WorkspaceEdit: jest.fn(),
  Range: jest.fn(),
  Position: jest.fn(),
}));

function createMockTextDocument(): vscode.TextDocument {
  return {
    getText: jest.fn(() => ''),
    uri: vscode.Uri.file('/workspace/docs/doc.md'),
    fileName: '/workspace/docs/doc.md',
    lineCount: 1,
  } as unknown as vscode.TextDocument;
}

describe('MarkdownEditorProvider - checkImageRename', () => {
  const mockGetConfig = <T>(_key: string, defaultValue: T): T => defaultValue;

  it('returns exists=true when the target filename already exists', async () => {
    const document = createMockTextDocument();
    const mockWebview = { postMessage: jest.fn() };

    (vscode.workspace.fs.stat as jest.Mock).mockImplementation(async (uri: vscode.Uri) => {
      // Normalize path separators for cross-platform matching (remove drive letter if present)
      const normalizedPath = uri.fsPath.replace(/\\/g, '/').replace(/^[A-Za-z]:/, '');
      if (
        normalizedPath.endsWith('/images/cat.png') ||
        normalizedPath.includes('/images/cat.png')
      ) {
        return {} as vscode.FileStat;
      }
      if (
        normalizedPath.endsWith('/images/dog.png') ||
        normalizedPath.includes('/images/dog.png')
      ) {
        return {} as vscode.FileStat;
      }
      throw new Error(`Unexpected path: ${uri.fsPath}`);
    });

    await handleCheckImageRename(
      { type: 'checkImageRename', requestId: 'req-1', oldPath: './images/cat.png', newName: 'dog' },
      { document, webview: mockWebview as unknown as vscode.Webview, getConfig: mockGetConfig }
    );

    expect(mockWebview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'imageRenameCheck',
        requestId: 'req-1',
        exists: true,
        newFilename: 'dog.png',
        newPath: './images/dog.png',
      })
    );
  });
});
