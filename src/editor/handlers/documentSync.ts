/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 *
 * Document synchronization between VS Code TextDocument and webview.
 * Owns edit queuing, feedback-loop prevention.
 */

import * as vscode from 'vscode';
import { MessageType } from '../../shared/messageTypes';

export interface WebviewSettings {
  [key: string]: unknown;
}

/**
 * Manages document sync state between the VS Code host and the webview editor.
 *
 * Owns two pieces of per-document state:
 * - `pendingEdits` — timestamp of last webview-originated edit (feedback-loop guard)
 * - `lastWebviewContent` — last content sent to/from webview (redundancy guard)
 * - `editQueue` — promise queue per document (serialise overlapping edits)
 */
export class DocumentSync {
  private pendingEdits = new Map<string, number>();
  private lastWebviewContent = new Map<string, string>();
  private editQueue = new Map<string, Promise<void>>();

  constructor(private readonly getWebviewSettings: () => WebviewSettings) {}

  /**
   * Send document content to webview.
   * Skips update if it's from a recent webview edit (avoid feedback loop).
   *
   * Sends the full original content as-is to TipTap, which handles YAML frontmatter
   * natively via its Markdown extension. Webview displays frontmatter in a separate panel.
   */
  updateWebview(document: vscode.TextDocument, webview: vscode.Webview, force = false) {
    const docUri = document.uri.toString();
    const lastEditTime = this.pendingEdits.get(docUri);
    const currentContent = document.getText();

    // Skip update if content matches what we already sent from the webview
    const lastSentContent = this.lastWebviewContent.get(docUri);
    if (!force && lastSentContent !== undefined && lastSentContent === currentContent) {
      return;
    }

    // Skip update if this change came from webview within last 100ms
    // This prevents feedback loops while allowing external Git changes to sync
    if (!force && lastEditTime && Date.now() - lastEditTime < 100) {
      return;
    }

    this.lastWebviewContent.set(docUri, currentContent);

    // Get skip warning setting
    const settings = this.getWebviewSettings();

    webview.postMessage({
      type: MessageType.UPDATE,
      content: currentContent,
      ...settings,
    });
  }

  /**
   * Apply edits from webview to TextDocument.
   * Marks the edit with a timestamp to prevent feedback loops.
   *
   * @param content - Full markdown content from webview (with YAML frontmatter if present)
   * @param document - Target VS Code document to update
   * @returns Promise resolving to true if edit succeeded, false otherwise
   * @throws Never - errors are caught and shown to user
   */
  async applyEdit(content: string, document: vscode.TextDocument): Promise<boolean> {
    const docUri = document.uri.toString();

    // Normalize newlines for comparison
    const normalizedNew = content.replace(/\r\n/g, '\n');
    const normalizedOld = document.getText().replace(/\r\n/g, '\n');

    if (normalizedNew === normalizedOld) {
      console.log(`[DK-AI] applyEdit: content already matches (length=${normalizedNew.length})`);
      return true;
    }

    console.log(
      `[DK-AI] applyEdit: changes detected (new=${normalizedNew.length}, old=${normalizedOld.length})`
    );

    // Mark this edit to prevent feedback loop
    this.pendingEdits.set(docUri, Date.now());
    this.lastWebviewContent.set(docUri, content);

    const edit = new vscode.WorkspaceEdit();

    // Use a robust full-document range to ensure everything is replaced
    const fullRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(document.getText().length)
    );

    edit.replace(document.uri, fullRange, content);

    try {
      const success = await vscode.workspace.applyEdit(edit);
      if (!success) {
        const errorMsg = 'Failed to save changes. The file may be read-only or locked.';
        vscode.window.showErrorMessage(errorMsg);
        console.error('[DK-AI] applyEdit failed:', { uri: docUri });
      }
      return success;
    } catch (error) {
      const errorMsg =
        error instanceof Error
          ? `Failed to save changes: ${error.message}`
          : 'Failed to save changes: Unknown error';
      vscode.window.showErrorMessage(errorMsg);
      console.error('[DK-AI] applyEdit exception:', error);
      return false;
    }
  }

  /**
   * Helper to enqueue an operation for a specific document URI.
   * Ensures edits are processed sequentially to avoid conflicts.
   */
  async enqueueEdit(docUri: string, editFn: () => Promise<any>): Promise<any> {
    const lastEdit = this.editQueue.get(docUri) || Promise.resolve();
    const nextEdit = lastEdit.then(async () => {
      try {
        await editFn();
      } catch (err) {
        console.error(`[DK-AI] Error in enqueued edit:`, err);
      }
    });

    this.editQueue.set(docUri, nextEdit);
    return nextEdit;
  }

  /**
   * Clean up tracking state for a disposed document.
   */
  cleanup(docUri: string) {
    this.pendingEdits.delete(docUri);
    this.lastWebviewContent.delete(docUri);
  }

  // Tip: frontmatter is handled natively by the Markdown/TipTap stack now.
}
