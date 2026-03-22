/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 *
 * Document synchronization between VS Code TextDocument and webview.
 * Owns edit queuing, feedback-loop prevention, and frontmatter wrapping.
 */

import * as vscode from 'vscode';
import { MessageType } from '../../shared/messageTypes';

export interface WebviewSettings {
  [key: string]: unknown;
}

/**
 * Manages document sync state between the VS Code host and the webview editor.
 *
 * Owns three pieces of per-document state:
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

    // Transform content for webview (wrap frontmatter in code block)
    const transformedContent = this.wrapFrontmatterForWebview(currentContent);

    // Remember the ORIGINAL content (what we expect back from webview after unwrapping)
    // This prevents false dirty state when webview sends back unwrapped frontmatter
    this.lastWebviewContent.set(docUri, currentContent);

    // Get skip warning setting
    const settings = this.getWebviewSettings();

    webview.postMessage({
      type: MessageType.UPDATE,
      content: transformedContent,
      ...settings,
    });
  }

  /**
   * Apply edits from webview to TextDocument.
   * Marks the edit with a timestamp to prevent feedback loops.
   *
   * @param content - Markdown content from webview (may include wrapped frontmatter)
   * @param document - Target VS Code document to update
   * @returns Promise resolving to true if edit succeeded, false otherwise
   * @throws Never - errors are caught and shown to user
   */
  async applyEdit(content: string, document: vscode.TextDocument): Promise<boolean> {
    const unwrappedContent = this.unwrapFrontmatterFromWebview(content);
    console.log(
      `[DK-AI] applyEdit: rawLen=${content.length}, unwrappedLen=${unwrappedContent.length}`
    );

    // Normalize newlines of both strings before comparison to avoid phantom dirty states
    // caused by different line ending flavors (\r\n vs \n)
    const normalizedNew = unwrappedContent.replace(/\r\n/g, '\n');
    const normalizedOld = document.getText().replace(/\r\n/g, '\n');

    if (normalizedNew === normalizedOld) {
      console.log(`[DK-AI] applyEdit: content already matches (length=${normalizedNew.length})`);
      return true;
    }

    console.log(
      `[DK-AI] applyEdit: content mismatch. New=${normalizedNew.length} chars, Old=${normalizedOld.length} chars`
    );

    // Mark this edit to prevent feedback loop
    const docUri = document.uri.toString();
    this.pendingEdits.set(docUri, Date.now());
    this.lastWebviewContent.set(docUri, unwrappedContent);

    const edit = new vscode.WorkspaceEdit();

    // Use a robust full-document range to ensure everything is replaced
    const fullRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(document.getText().length)
    );

    edit.replace(document.uri, fullRange, unwrappedContent);

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

  /**
   * Wrap YAML frontmatter in a fenced code block for webview rendering.
   * Returns original content when no frontmatter is present.
   */
  wrapFrontmatterForWebview(content: string): string {
    const match = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?/);
    if (!match) return content;

    const usesCrLf = match[0].includes('\r\n');
    const newline = usesCrLf ? '\r\n' : '\n';
    const frontmatterBlock = match[0].replace(/\s+$/, ''); // keep delimiters
    const body = content.slice(match[0].length);

    const pieces = ['```yaml', frontmatterBlock, '```'];
    if (body.length > 0) {
      // Ensure exactly one blank line between fenced block and body
      const trimmedBody =
        body.startsWith('\n') || body.startsWith('\r\n') ? body.replace(/^\r?\n/, '') : body;
      pieces.push('', trimmedBody);
    }

    return pieces.join(newline);
  }

  /**
   * Unwrap a fenced frontmatter code block back to YAML delimiters.
   * If no wrapped frontmatter is detected, returns the original content.
   */
  unwrapFrontmatterFromWebview(content: string): string {
    // If it's a code block, unwrap it. Trim leading whitespace to be resilient to serializer quirks.
    const trimmed = content.trimStart();
    if (!trimmed.startsWith('```')) return content;

    const usesCrLf = content.includes('\r\n');
    const newline = usesCrLf ? '\r\n' : '\n';
    const lines = content.split(/\r?\n/);

    const firstLine = lines[0].trim().toLowerCase();
    if (firstLine !== '```yaml' && firstLine !== '```yml' && firstLine !== '```json') {
      return content;
    }

    const closingIndex = lines.findIndex((line, idx) => idx > 0 && line.trim() === '```');
    if (closingIndex === -1) return content;

    const insideLines = lines.slice(1, closingIndex);
    // Expect inside to start with '---'
    if (insideLines.length === 0 || insideLines[0].trim() !== '---') {
      return content;
    }

    const frontmatterSection = insideLines.join(newline);
    const bodyLines = lines.slice(closingIndex + 1);
    const body = bodyLines.join(newline);

    const separator = body.length > 0 ? newline : '';
    return frontmatterSection + separator + body;
  }
}
