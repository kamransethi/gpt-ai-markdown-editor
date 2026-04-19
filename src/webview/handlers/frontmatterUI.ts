/**
 * Front Matter Message Handler
 *
 * Routes and processes front matter-related messages between
 * extension host and webview editor.
 */

import { Editor } from '@tiptap/core';
/** Generic message payload received from the extension host. */
type MessageData = { type: string; [key: string]: unknown };
import { MessageType } from '../../shared/messageTypes';
import * as YAML from 'js-yaml';

/**
 * Handle front matter validation messages from extension host
 */
export function handleFrontmatterValidate(
  _editor: Editor,
  message: MessageData & { type: 'FRONTMATTER_VALIDATE'; yaml?: string }
): void {
  const yaml: string = (message.yaml as string) || '';

  try {
    // Parse YAML to check validity
    const parsed = YAML.load(yaml);

    // Send validation result back to host
    window.vscode?.postMessage({
      type: MessageType.FRONTMATTER_VALIDATION_RESULT,
      success: true,
      yaml,
      parsed,
      timestamp: Date.now(),
    });
  } catch (error) {
    // Parsing failed - send error details
    const err = error as Error;
    window.vscode?.postMessage({
      type: MessageType.FRONTMATTER_VALIDATION_RESULT,
      success: false,
      yaml,
      error: err.message,
      errorLine: (err as any).mark?.line || 0,
      timestamp: Date.now(),
    });
  }
}

/**
 * Handle front matter save override decision
 */
export function handleFrontmatterSaveOverride(
  editor: Editor,
  message: MessageData & { type: 'FRONTMATTER_SAVE_OVERRIDE' }
): void {
  // User made a decision about saving with validation error
  const { override } = message;

  if (override === 'save-anyway') {
    // Proceed with save despite validation error
    window.vscode?.postMessage({
      type: MessageType.UPDATE,
      content: editor.getHTML(),
      override: true,
    });
  } else if (override === 'return-to-fix') {
    // User wants to return to editor (no action needed)
    // Just signal that we're ready for editing
    window.vscode?.postMessage({
      type: MessageType.READY,
    });
  }
}

/**
 * Handle front matter error dialog display
 */
export function handleFrontmatterError(
  _editor: Editor,
  message: MessageData & { type: 'FRONTMATTER_ERROR'; error: string; errorLine?: number; yaml: string }
): void {
  const { error, errorLine, yaml } = message;

  // Create error dialog with options
  const dialog = document.createElement('div');
  dialog.className = 'frontmatter-error-dialog';
  dialog.innerHTML = `
    <div class="frontmatter-error-content">
      <h3>Front Matter Validation Error</h3>
      <p class="error-message">${escapeHtml(error)}</p>
      ${errorLine ? `<p class="error-line">Line ${errorLine}: ${escapeHtml(yaml.split('\n')[errorLine - 1] || '')}</p>` : ''}
      <div class="error-actions">
        <button class="btn btn-primary" data-action="return-to-fix">Return to Fix</button>
        <button class="btn btn-secondary" data-action="save-anyway">Save Anyway</button>
      </div>
    </div>
  `;

  // Add event listeners
  dialog.querySelector('[data-action="return-to-fix"]')?.addEventListener('click', () => {
    window.vscode?.postMessage({
      type: MessageType.FRONTMATTER_SAVE_OVERRIDE,
      override: 'return-to-fix',
    });
    dialog.remove();
  });

  dialog.querySelector('[data-action="save-anyway"]')?.addEventListener('click', () => {
    window.vscode?.postMessage({
      type: MessageType.FRONTMATTER_SAVE_OVERRIDE,
      override: 'save-anyway',
    });
    dialog.remove();
  });

  // Mount dialog
  document.body.appendChild(dialog);
}

/**
 * Helper: Escape HTML
 */
function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, char => map[char]);
}

/**
 * Register front matter message handlers
 */
export function registerFrontmatterHandlers(_editor: Editor): void {
  // This will be called from messageRouter.ts to register handlers
  // The actual routing is done in the message switch statement in editor.ts
}

export default {
  handleFrontmatterValidate,
  handleFrontmatterSaveOverride,
  handleFrontmatterError,
  registerFrontmatterHandlers,
};
