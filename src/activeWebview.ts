/**
 * Copyright (c) 2025-2026 GPT-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

import * as vscode from 'vscode';

let activeWebviewPanel: vscode.WebviewPanel | undefined;

function setActiveContext(isActive: boolean) {
  vscode.commands.executeCommand('setContext', 'gptAiMarkdownEditor.isActive', isActive);
}

export function setActiveWebviewPanel(panel: vscode.WebviewPanel | undefined) {
  activeWebviewPanel = panel;
  setActiveContext(!!panel);
}

export function getActiveWebviewPanel(): vscode.WebviewPanel | undefined {
  return activeWebviewPanel;
}
