/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

import * as vscode from 'vscode';
import { openChatPanel } from './chatPanel';
import { initFoamAdapter, disposeFoamAdapter, getFoamSnapshot } from '../foam/foamAdapter';
import { openGraphPanel, updateGraphPanel } from '../foam/graphPanel';

let currentWorkspacePath: string | null = null;
let disposables: vscode.Disposable[] = [];

// Debounce handle for updateGraphPanel — avoids hammering the webview on every
// single file change during workspace indexing (can be 1000+ rapid fires).
let _graphUpdateTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Register Graph Chat command.
 * Called from extension.ts activate() unconditionally.
 */
export function registerCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('gptAiMarkdownEditor.graphChat', () => {
      openChatPanel(context, () => currentWorkspacePath);
    }),
    vscode.commands.registerCommand('gptAiMarkdownEditor.openKnowledgeGraph', () => {
      openGraphPanel(context);
    })
  );
}

/**
 * Initialize Graph Chat system.
 * Call from extension.ts activate() to set workspace path.
 */
export async function initialize(_context: vscode.ExtensionContext): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) return;

  const workspacePath = workspaceFolder.uri.fsPath;
  currentWorkspacePath = workspacePath;

  console.log('[Graph Chat] Initialized with workspace:', workspacePath);

  // Bootstrap Foam workspace indexer
  try {
    const config = vscode.workspace.getConfiguration('gptAiMarkdownEditor');
    const indexedFileTypes: string[] = config.get('indexedFileTypes', ['md']);
    const includeGlobs = indexedFileTypes.map(ext => `**/*.${ext}`);

    await initFoamAdapter({ includeGlobs }, snapshot => {
      // Debounce graph panel updates — indexing fires onUpdate per file (1000+
      // rapid calls during initial scan).  Coalesce into a single repaint.
      if (_graphUpdateTimer) clearTimeout(_graphUpdateTimer);
      _graphUpdateTimer = setTimeout(() => {
        _graphUpdateTimer = undefined;
        updateGraphPanel();
        console.log(`[Graph Chat] Foam index ready: ${snapshot.notes.length} notes`);
      }, 500);
    });

    const snapshot = getFoamSnapshot();
    if (snapshot) {
      console.log(
        `[Graph Chat] Foam index ready: ${snapshot.notes.length} notes, ${snapshot.allTags.length} tags`
      );
    }
  } catch (err) {
    console.warn('[Graph Chat] Foam indexer failed to start (non-fatal):', err);
  }
}

/**
 * Cleanup on deactivation.
 */
export function deactivate(): void {
  disposeFoamAdapter();
  disposables.forEach(d => d.dispose());
  disposables = [];
}

/**
 * Get graph callbacks for message routing.
 * (Kept for compatibility with MarkdownEditorProvider)
 */
export function getGraphCallbacks(): Record<string, () => void> {
  return {};
}
