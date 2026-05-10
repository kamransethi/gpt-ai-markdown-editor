/**
 * Test Suite: Open as Rich Text Button — openFile command URI resolution
 *
 * Specification: specs/041-open-as-rich-text-button/spec.md
 *
 * Tests the URI resolution logic inside the gptAiMarkdownEditor.openFile command:
 * - When called with an explicit URI, uses it directly
 * - When called without URI and a markdown file is active, uses the active editor's URI
 * - When called without URI and active editor is non-markdown, opens the file picker
 * - When called without URI and no active editor, opens the file picker
 */

import * as vscode from 'vscode';

// Extract the openFile command handler logic into a testable function
// mirroring the exact logic in extension.ts
async function openFileCommandLogic(
  uri: vscode.Uri | undefined,
  activeTextEditor: { document: { languageId: string; uri: vscode.Uri } } | undefined,
  showOpenDialog: (options: vscode.OpenDialogOptions) => Thenable<vscode.Uri[] | undefined>,
  executeCommand: (command: string, ...args: unknown[]) => Thenable<unknown>
): Promise<void> {
  let targetUri = uri;

  if (!targetUri && activeTextEditor && activeTextEditor.document.languageId === 'markdown') {
    const document = activeTextEditor.document;
    if (document.uri.scheme === 'file' || document.uri.scheme === 'untitled') {
      targetUri = document.uri;
    }
  }

  if (!targetUri) {
    const uris = await showOpenDialog({
      canSelectMany: false,
      filters: { Markdown: ['md', 'markdown'] },
    });
    if (uris && uris[0]) {
      targetUri = uris[0];
    }
  }

  if (targetUri) {
    await executeCommand('vscode.openWith', targetUri, 'gptAiMarkdownEditor.editor');
  }
}

describe('041: openFile command — URI resolution', () => {
  let executeCommand: jest.Mock;
  let showOpenDialog: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    executeCommand = jest.fn().mockResolvedValue(undefined);
    showOpenDialog = jest.fn().mockResolvedValue(undefined);
  });

  it('uses the explicitly passed URI when provided', async () => {
    const uri = vscode.Uri.file('/workspace/doc.md');
    await openFileCommandLogic(uri, undefined, showOpenDialog, executeCommand);

    expect(executeCommand).toHaveBeenCalledWith(
      'vscode.openWith',
      uri,
      'gptAiMarkdownEditor.editor'
    );
    expect(showOpenDialog).not.toHaveBeenCalled();
  });

  it('uses the active text editor URI when no explicit URI is passed and active file is markdown', async () => {
    const activeEditorUri = vscode.Uri.file('/workspace/readme.md');
    const activeEditor = {
      document: { languageId: 'markdown', uri: activeEditorUri },
    };

    await openFileCommandLogic(undefined, activeEditor, showOpenDialog, executeCommand);

    expect(executeCommand).toHaveBeenCalledWith(
      'vscode.openWith',
      activeEditorUri,
      'gptAiMarkdownEditor.editor'
    );
    expect(showOpenDialog).not.toHaveBeenCalled();
  });

  it('falls back to open dialog when no URI and active editor is not markdown', async () => {
    const pickedUri = vscode.Uri.file('/workspace/other.md');
    showOpenDialog.mockResolvedValue([pickedUri]);

    const activeEditor = {
      document: {
        languageId: 'typescript',
        uri: vscode.Uri.file('/workspace/index.ts'),
      },
    };

    await openFileCommandLogic(undefined, activeEditor, showOpenDialog, executeCommand);

    expect(showOpenDialog).toHaveBeenCalledWith(
      expect.objectContaining({ canSelectMany: false })
    );
    expect(executeCommand).toHaveBeenCalledWith(
      'vscode.openWith',
      pickedUri,
      'gptAiMarkdownEditor.editor'
    );
  });

  it('does nothing when no URI, no active editor, and dialog is cancelled', async () => {
    showOpenDialog.mockResolvedValue(undefined);

    await openFileCommandLogic(undefined, undefined, showOpenDialog, executeCommand);

    expect(showOpenDialog).toHaveBeenCalled();
    expect(executeCommand).not.toHaveBeenCalled();
  });

  it('does not use active editor URI when its scheme is not file or untitled', async () => {
    const pickedUri = vscode.Uri.file('/workspace/chosen.md');
    showOpenDialog.mockResolvedValue([pickedUri]);

    // git:// scheme — should not be used directly
    const gitUri = { fsPath: '/workspace/doc.md', path: '/workspace/doc.md', scheme: 'git' };
    const activeEditor = {
      document: { languageId: 'markdown', uri: gitUri as unknown as vscode.Uri },
    };

    await openFileCommandLogic(undefined, activeEditor, showOpenDialog, executeCommand);

    expect(executeCommand).toHaveBeenCalledWith(
      'vscode.openWith',
      pickedUri,
      'gptAiMarkdownEditor.editor'
    );
  });
});
