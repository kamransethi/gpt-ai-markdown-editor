/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

import * as vscode from 'vscode';

let activeWebviewPanel: vscode.WebviewPanel | undefined;

/** Currently selected text in the WYSIWYG editor (empty string = no selection). */
let currentSelectedText = '';

function setActiveContext(isActive: boolean) {
  vscode.commands.executeCommand('setContext', 'gptAiMarkdownEditor.isActive', isActive);
  if (!isActive) {
    // Clear selection when editor loses focus
    setSelectedText('');
  }
}

export function setActiveWebviewPanel(panel: vscode.WebviewPanel | undefined) {
  activeWebviewPanel = panel;
  setActiveContext(!!panel);
}

export function getActiveWebviewPanel(): vscode.WebviewPanel | undefined {
  return activeWebviewPanel;
}

/** Update the stored selection text and the hasSelection context key. */
export function setSelectedText(text: string) {
  currentSelectedText = text;
  vscode.commands.executeCommand('setContext', 'gptAiMarkdownEditor.hasSelection', text.length > 0);
}

/** Retrieve the current selected text (empty string when nothing is selected). */
export function getSelectedText(): string {
  return currentSelectedText;
}
