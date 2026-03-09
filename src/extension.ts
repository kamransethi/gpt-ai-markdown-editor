/**
 * Copyright (c) 2025-2026 GPT-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

import * as vscode from 'vscode';
import { MarkdownEditorProvider } from './editor/MarkdownEditorProvider';
import { WordCountFeature } from './features/wordCount';
import { getActiveWebviewPanel } from './activeWebview';
import { outlineViewProvider } from './features/outlineView';

export function activate(context: vscode.ExtensionContext) {
  // Register the custom editor provider
  const provider = MarkdownEditorProvider.register(context);
  context.subscriptions.push(provider);

  // Clear active context when switching to non-gpt-ai-markdown-editor editors
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      // Custom editors appear as undefined in activeTextEditor, so if we get a text editor here, disable context
      if (editor && editor.document.languageId !== 'markdown') {
        // If a regular text editor is active, clear our active context
        // Note: markdown languageId for default text editor; webview handled via view state events
        vscode.commands.executeCommand('setContext', 'gptAiMarkdownEditor.isActive', false);
      }
    })
  );

  // Register outline tree view provider (Explorer)
  const outlineTreeView = vscode.window.createTreeView('gptAiMarkdownEditorOutline', {
    treeDataProvider: outlineViewProvider,
    showCollapseAll: true,
  });
  outlineViewProvider.setTreeView(outlineTreeView);
  context.subscriptions.push(outlineTreeView);

  // Initialize Word Count feature
  const wordCount = new WordCountFeature();
  wordCount.activate(context);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('gptAiMarkdownEditor.openFile', async (uri?: vscode.Uri) => {
      let targetUri = uri;

      const activeEditor = vscode.window.activeTextEditor;

      // If no URI passed (e.g. run from command palette), prefer the active markdown editor
      if (!targetUri && activeEditor && activeEditor.document.languageId === 'markdown') {
        const document = activeEditor.document;

        // Support both file and untitled schemes
        if (document.uri.scheme === 'file' || document.uri.scheme === 'untitled') {
          targetUri = document.uri;
        }
      }

      // If we still don't have a URI, ask user to pick a file
      if (!targetUri) {
        const uris = await vscode.window.showOpenDialog({
          canSelectMany: false,
          filters: {
            Markdown: ['md', 'markdown'],
          },
        });
        if (uris && uris[0]) {
          targetUri = uris[0];
        }
      }

      if (targetUri) {
        await vscode.commands.executeCommand(
          'vscode.openWith',
          targetUri,
          'gptAiMarkdownEditor.editor'
        );
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('gptAiMarkdownEditor.toggleSource', () => {
      // This will be handled by the webview
      vscode.window.activeTextEditor?.show();
    })
  );

  // Register word count detailed stats command
  context.subscriptions.push(
    vscode.commands.registerCommand('gptAiMarkdownEditor.showDetailedStats', () => {
      wordCount.showDetailedStats();
    })
  );

  // Register TOC outline toggle command (Option 2 - TOC Overlay)
  context.subscriptions.push(
    vscode.commands.registerCommand('gptAiMarkdownEditor.toggleTocOutlineView', () => {
      const panel = getActiveWebviewPanel();
      if (panel) {
        panel.webview.postMessage({ type: 'toggleTocOutlineView' });
      }
    })
  );

  // Navigate to heading from outline tree
  context.subscriptions.push(
    vscode.commands.registerCommand('gptAiMarkdownEditor.navigateToHeading', (pos: number) => {
      const panel = getActiveWebviewPanel();
      if (panel) {
        panel.webview.postMessage({ type: 'navigateToHeading', pos });
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('gptAiMarkdownEditor.outline.revealCurrent', () => {
      outlineViewProvider.revealActive(outlineTreeView);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('gptAiMarkdownEditor.outline.filter', () => {
      outlineViewProvider.showFilterInput();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('gptAiMarkdownEditor.outline.clearFilter', () => {
      outlineViewProvider.clearFilter();
    })
  );
}

export function deactivate() {
  // Cleanup handled by VS Code's subscription disposal
}
