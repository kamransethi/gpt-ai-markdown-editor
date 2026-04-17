/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

import * as vscode from 'vscode';
import { MarkdownEditorProvider } from './editor/MarkdownEditorProvider';
import { WordCountFeature } from './features/wordCount';
import { getActiveWebviewPanel, getSelectedText, getActiveDocumentUri } from './activeWebview';
import { outlineViewProvider } from './features/outlineView';
import { MessageType } from './shared/messageTypes';
import { getProviderAvailabilityCached } from './features/llm/providerAvailability';
import { handleProviderError } from './features/llm/providerErrorMessages';
import { openSettingsPanel } from './editor/SettingsPanel';

/**
 * Constants for default markdown viewer prompt feature
 */
const DEFAULT_VIEWER_CONFIG_KEY = 'gptAiMarkdownEditor.defaultMarkdownViewer';

/**
 * Show prompt to set Flux Flow Markdown Editor as default markdown viewer.
 * Only shows on first activation; respects user's prior decision.
 *
 * Implements: FR-001 through FR-008
 * See: specs/001-default-markdown-viewer/spec.md
 *
 * @param _context Extension context (unused - settings stored in global scope)
 */
export async function showDefaultViewerPrompt(_context: vscode.ExtensionContext): Promise<void> {
  try {
    // FR-001: Check if user has already made a decision
    const config = vscode.workspace.getConfiguration();
    const savedChoice = config.get<string | null>(DEFAULT_VIEWER_CONFIG_KEY);

    // If user previously made a choice (saved to settings), don't prompt again
    if (savedChoice !== null && (savedChoice === 'dk-ai' || savedChoice === 'vscode')) {
      return;
    }

    // FR-002: Display modal dialog with Yes/No buttons
    const message = 'Set Flux Flow Markdown Editor as your default markdown viewer?';
    const selectedAction = await vscode.window.showInformationMessage(
      message,
      { modal: true }, // FR-002: Must be blocking
      'Yes',
      'No'
    );

    // FR-003, FR-005: Handle user response
    if (selectedAction === 'Yes') {
      // FR-004: Update configuration when user clicks Yes
      // AC-1: Persist to gptAiMarkdownEditor.defaultMarkdownViewer setting
      // AC-1: Use Global scope so choice persists across all workspaces
      await config.update(DEFAULT_VIEWER_CONFIG_KEY, 'dk-ai', vscode.ConfigurationTarget.Global);
    } else if (selectedAction === 'No') {
      // FR-005: Do not modify configuration
      // AC-1: Persist the explicit No decision so prompt doesn't reappear
      await config.update(DEFAULT_VIEWER_CONFIG_KEY, 'vscode', vscode.ConfigurationTarget.Global);
    }
    // If user dismisses (selectedAction === undefined), don't persist
    // This allows re-prompting on next activation (intentional per spec)
  } catch (error) {
    // IX. Error Handling: Silent failure, log only
    // Non-fatal: Don't interrupt extension activation
    if (error instanceof Error) {
      console.error(`[DK-AI] Default viewer prompt error: ${error.message}`);
    }
  }
}

export function activate(context: vscode.ExtensionContext) {
  // Show default viewer prompt on first activation (FR-001)
  void showDefaultViewerPrompt(context);
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

  // Register command to switch to Ollama provider
  context.subscriptions.push(
    vscode.commands.registerCommand('gptAiMarkdownEditor.switchToOllamaProvider', async () => {
      await vscode.workspace
        .getConfiguration('gptAiMarkdownEditor')
        .update('llmProvider', 'Ollama', vscode.ConfigurationTarget.Global);

      vscode.window.showInformationMessage(
        '✅ Switched to Ollama provider. Try your AI feature again!'
      );
    })
  );

  // Expose the active document URI so Copilot and other extensions can discover the file
  context.subscriptions.push(
    vscode.commands.registerCommand('gptAiMarkdownEditor.getActiveDocumentUri', () => {
      return getActiveDocumentUri()?.toString();
    })
  );

  // Open custom settings panel
  context.subscriptions.push(
    vscode.commands.registerCommand('gptAiMarkdownEditor.openSettingsPanel', () => {
      openSettingsPanel(context);
    })
  );

  // Register Copilot Chat Participant — makes the current document available to Copilot
  try {
    if (typeof vscode.chat?.createChatParticipant === 'function') {
      const participant = vscode.chat.createChatParticipant(
        'gptAiMarkdownEditor.chat',
        async (request, _context, stream, _token) => {
          // Check provider availability before attempting to use Chat
          const availability = await getProviderAvailabilityCached();
          const selectedProvider = vscode.workspace
            .getConfiguration('gptAiMarkdownEditor')
            .get<string>('llmProvider', 'GitHub Copilot');

          // Validate that the selected provider is available
          if (selectedProvider === 'GitHub Copilot' && !availability.copilotAvailable) {
            // Try to handle the error and switch to Ollama if available
            const couldRetry = await handleProviderError({
              availability,
              attemptedProvider: 'copilot',
              feature: 'Chat Participant',
            });

            if (!couldRetry) {
              stream.markdown(
                '**Chat Participant is not available**\n\nPlease configure an LLM provider (GitHub Copilot or Ollama) to use this feature.'
              );
              return;
            }

            // If we switched to Ollama, re-check availability
            const newAvailability = await getProviderAvailabilityCached();
            if (!newAvailability.ollamaAvailable) {
              stream.markdown(
                '**Ollama is not available**\n\nPlease start your Ollama server and try again.'
              );
              return;
            }
          }

          if (selectedProvider === 'Ollama' && !availability.ollamaAvailable) {
            stream.markdown(
              '**Ollama is not reachable**\n\nPlease ensure Ollama is running at the configured endpoint and try again.'
            );
            return;
          }

          // Provide the current document content as context
          let docContent = '';
          let docUri: vscode.Uri | undefined;

          // First, try the explicitly tracked active document URI
          const activeUri = getActiveDocumentUri();
          if (activeUri) {
            for (const doc of vscode.workspace.textDocuments) {
              if (doc.uri.toString() === activeUri.toString() && !doc.isClosed) {
                docContent = doc.getText();
                docUri = doc.uri;
                break;
              }
            }
          }

          // Fallback: find any open markdown document
          if (!docContent) {
            for (const doc of vscode.workspace.textDocuments) {
              if (doc.languageId === 'markdown' && !doc.isClosed) {
                docContent = doc.getText();
                docUri = doc.uri;
                break;
              }
            }
          }

          if (!docContent) {
            stream.markdown(
              'No markdown document is currently open in the Visual AI Markdown Editor.'
            );
            return;
          }

          // Reference the active file so Copilot knows the context
          if (docUri) {
            stream.reference(docUri);
          }

          // Include currently selected text if any
          const selText = getSelectedText();

          // Use the language model to answer about the document
          // Try Copilot first if selected
          if (selectedProvider === 'GitHub Copilot') {
            try {
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
            } catch (error) {
              console.error('[DK-AI] Chat Participant error:', error);
              stream.markdown(
                '**Error using GitHub Copilot**\n\nPlease ensure you have Copilot enabled and try again.'
              );
            }
          } else {
            // Ollama provider
            stream.markdown(
              '**Ollama provider selected**\n\nChat Participant via Ollama is not yet implemented. Please switch to GitHub Copilot or use the AI Explain feature instead.'
            );
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
