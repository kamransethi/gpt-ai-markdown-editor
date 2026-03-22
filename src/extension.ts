/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

import * as vscode from 'vscode';
import { MarkdownEditorProvider } from './editor/MarkdownEditorProvider';
import { WordCountFeature } from './features/wordCount';
import { getActiveWebviewPanel, getSelectedText } from './activeWebview';
import { outlineViewProvider } from './features/outlineView';
import { MessageType } from './shared/messageTypes';

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
        panel.webview.postMessage({ type: MessageType.TOGGLE_TOC_OUTLINE_VIEW });
      }
    })
  );

  // Navigate to heading from outline tree
  context.subscriptions.push(
    vscode.commands.registerCommand('gptAiMarkdownEditor.navigateToHeading', (pos: number) => {
      const panel = getActiveWebviewPanel();
      if (panel) {
        panel.webview.postMessage({ type: MessageType.NAVIGATE_TO_HEADING, pos });
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

  // Expose selected text so Copilot and other extensions can query our editor's selection
  context.subscriptions.push(
    vscode.commands.registerCommand('gptAiMarkdownEditor.getSelectedText', () => {
      return getSelectedText();
    })
  );

  // Register Copilot Chat Participant — makes the current document available to Copilot
  try {
    if (typeof vscode.chat?.createChatParticipant === 'function') {
      const participant = vscode.chat.createChatParticipant(
        'gptAiMarkdownEditor.chat',
        async (request, _context, stream, _token) => {
          // Provide the current document content as context
          let docContent = '';
          // Try to get the text from the active text document associated with our editor
          for (const doc of vscode.workspace.textDocuments) {
            if (doc.languageId === 'markdown' && !doc.isClosed) {
              docContent = doc.getText();
              break;
            }
          }

          if (!docContent) {
            stream.markdown(
              'No markdown document is currently open in the Visual AI Markdown Editor.'
            );
            return;
          }

          // Include currently selected text if any
          const selText = getSelectedText();

          // Use the language model to answer about the document
          const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
          const model = models[0];
          if (!model) {
            stream.markdown(
              'No language model available. Please ensure GitHub Copilot is installed.'
            );
            return;
          }

          let systemPrompt =
            'You are a writing assistant. The user is editing the following markdown document:\n\n---\n' +
            docContent +
            '\n---\n';
          if (selText) {
            systemPrompt +=
              '\nThe user currently has the following text selected in the editor:\n\n```\n' +
              selText +
              '\n```\n';
          }
          systemPrompt += `\nUser question: ${request.prompt}`;

          const messages = [vscode.LanguageModelChatMessage.User(systemPrompt)];

          const response = await model.sendRequest(messages, {}, _token);
          for await (const chunk of response.text) {
            stream.markdown(chunk);
          }
        }
      );
      participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'icon.png');
      context.subscriptions.push(participant);
    }
  } catch (error) {
    console.warn(
      '[DK-AI] Chat participant registration failed (Copilot may not be available):',
      error
    );
  }
}

export function deactivate() {
  // Cleanup handled by VS Code's subscription disposal
}
