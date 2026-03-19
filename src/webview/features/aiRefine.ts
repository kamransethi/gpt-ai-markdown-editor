/**
 * Copyright (c) 2025-2026 GPT-AI
 *
 * Webview-side AI text refinement module.
 * Sends selected text + mode to the extension host via postMessage,
 * and handles the response by replacing the selection.
 *
 * @module aiRefine (webview)
 */

import type { Editor } from '@tiptap/core';

// ── State ───────────────────────────────────────────────────────────

let loadingOverlay: HTMLElement | null = null;

// ── API ─────────────────────────────────────────────────────────────

/**
 * Send a refine request to the extension host.
 * The extension host will invoke vscode.lm and reply with aiRefineResult.
 */
export function requestAiRefine(
  mode: string,
  selectedText: string,
  from: number,
  to: number
): void {
  const vscodeApi = (window as any).vscode;
  if (!vscodeApi) {
    console.error('[GPT-AI] Cannot send AI refine: vscode API not available');
    return;
  }

  vscodeApi.postMessage({
    type: 'aiRefine',
    mode,
    selectedText,
    from,
    to,
  });

  // Show loading indicator
  showLoadingOverlay(`Refining text (${mode})…`);
}

/**
 * Handle the AI refine response from the extension host.
 * Replaces the original selection range with the refined text.
 */
export function handleAiRefineResult(
  editor: Editor,
  data: { success: boolean; refinedText?: string; error?: string; from: number; to: number }
): void {
  hideLoadingOverlay();

  if (!data.success || !data.refinedText) {
    console.error('[GPT-AI] AI Refine failed:', data.error);
    return;
  }

  // Replace the original selection range with the refined text
  try {
    const { from, to } = data;
    const docLength = editor.state.doc.content.size;

    // Validate positions are still within document bounds
    const safeFrom = Math.min(from, docLength);
    const safeTo = Math.min(to, docLength);

    editor
      .chain()
      .focus()
      .insertContentAt({ from: safeFrom, to: safeTo }, data.refinedText)
      .run();
  } catch (error) {
    console.error('[GPT-AI] Failed to apply AI refinement:', error);
  }
}

/**
 * Show a modal input for custom refine instructions.
 */
export function showCustomRefineInput(
  editor: Editor,
  selectedText: string,
  from: number,
  to: number
): void {
  // Create a simple modal overlay for custom text input
  const overlay = document.createElement('div');
  overlay.className = 'ai-refine-overlay';

  const dialog = document.createElement('div');
  dialog.className = 'ai-refine-dialog';

  const title = document.createElement('div');
  title.className = 'ai-refine-dialog-title';
  title.textContent = 'Custom refinement';
  dialog.appendChild(title);

  const description = document.createElement('div');
  description.className = 'ai-refine-dialog-description';
  description.textContent = 'Describe how you want the text to be refined:';
  dialog.appendChild(description);

  const input = document.createElement('textarea');
  input.className = 'ai-refine-dialog-input';
  input.placeholder = 'e.g., Make it sound more professional…';
  input.rows = 3;
  dialog.appendChild(input);

  const buttonRow = document.createElement('div');
  buttonRow.className = 'ai-refine-dialog-buttons';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'ai-refine-dialog-btn ai-refine-dialog-btn-cancel';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick = () => {
    overlay.remove();
    editor.commands.focus();
  };

  const submitBtn = document.createElement('button');
  submitBtn.type = 'button';
  submitBtn.className = 'ai-refine-dialog-btn ai-refine-dialog-btn-submit';
  submitBtn.textContent = 'Refine';
  submitBtn.onclick = () => {
    const customInstruction = input.value.trim();
    if (!customInstruction) return;
    overlay.remove();
    requestAiRefine(`custom:${customInstruction}`, selectedText, from, to);
  };

  buttonRow.appendChild(cancelBtn);
  buttonRow.appendChild(submitBtn);
  dialog.appendChild(buttonRow);

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  // Handle Escape
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      overlay.remove();
      editor.commands.focus();
      document.removeEventListener('keydown', onKeyDown);
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      submitBtn.click();
      document.removeEventListener('keydown', onKeyDown);
    }
  };
  document.addEventListener('keydown', onKeyDown);

  // Focus input after render
  requestAnimationFrame(() => input.focus());
}

// ── Loading overlay ─────────────────────────────────────────────────

function showLoadingOverlay(message: string): void {
  hideLoadingOverlay();
  loadingOverlay = document.createElement('div');
  loadingOverlay.className = 'ai-refine-loading';

  const spinner = document.createElement('div');
  spinner.className = 'ai-refine-spinner';
  loadingOverlay.appendChild(spinner);

  const label = document.createElement('span');
  label.textContent = message;
  loadingOverlay.appendChild(label);

  document.body.appendChild(loadingOverlay);
}

function hideLoadingOverlay(): void {
  if (loadingOverlay) {
    loadingOverlay.remove();
    loadingOverlay = null;
  }
}
