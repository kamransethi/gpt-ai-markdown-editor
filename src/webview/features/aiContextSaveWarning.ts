/**
 * Copyright (c) 2025-2026 Concret.io
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

/**
 * AI Context Reference Save Warning Dialog
 *
 * Shown when the user triggers 'Copy AI Context Reference' on a dirty document.
 * The reference encodes line numbers from the on-disk file, so an unsaved buffer
 * would produce a stale reference. This dialog forces an explicit decision before
 * we save on the user's behalf.
 */

export interface AiContextSaveWarningResult {
  confirmed: boolean;
  rememberForSession: boolean;
}

/**
 * Show the save-before-copy confirmation dialog.
 * Resolves with `{ confirmed: false }` when the user cancels (button, overlay click, or Escape).
 */
export async function showAiContextSaveWarning(): Promise<AiContextSaveWarningResult> {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'ai-context-save-warning-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    const dialog = document.createElement('div');
    dialog.className = 'ai-context-save-warning-dialog';
    dialog.style.cssText = `
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      padding: 20px;
      min-width: 400px;
      max-width: 500px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    `;

    dialog.innerHTML = `
      <h3 style="margin: 0 0 16px 0; color: var(--vscode-foreground);">
        Save before copying AI reference?
      </h3>

      <p style="margin: 0 0 20px 0; color: var(--vscode-foreground); line-height: 1.5;">
        To copy content as AI context, the file must be saved first so the line numbers in the reference match the file on disk. Do you agree to save?
      </p>

      <div style="margin-bottom: 20px;">
        <label style="display: flex; align-items: center; color: var(--vscode-foreground); cursor: pointer;">
          <input type="checkbox" id="ai-context-remember-session" style="margin-right: 8px;">
          Remember choice for this session
        </label>
      </div>

      <div style="display: flex; gap: 8px; justify-content: flex-end;">
        <button id="ai-context-cancel-btn" style="
          padding: 6px 14px;
          background: var(--vscode-button-secondaryBackground);
          color: var(--vscode-button-secondaryForeground);
          border: none;
          border-radius: 3px;
          cursor: pointer;
          font-family: var(--vscode-font-family);
        ">Cancel</button>
        <button id="ai-context-confirm-btn" style="
          padding: 6px 14px;
          background: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border: none;
          border-radius: 3px;
          cursor: pointer;
          font-family: var(--vscode-font-family);
          font-weight: 500;
        ">Save & Copy</button>
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const rememberCheckbox = dialog.querySelector(
      '#ai-context-remember-session'
    ) as HTMLInputElement;
    const cancelBtn = dialog.querySelector('#ai-context-cancel-btn') as HTMLButtonElement;
    const confirmBtn = dialog.querySelector('#ai-context-confirm-btn') as HTMLButtonElement;

    confirmBtn.focus();

    let settled = false;
    const finish = (result: AiContextSaveWarningResult) => {
      if (settled) return;
      settled = true;
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      resolve(result);
    };

    const handleConfirm = () => {
      finish({ confirmed: true, rememberForSession: rememberCheckbox.checked });
    };

    const handleCancel = () => {
      finish({ confirmed: false, rememberForSession: false });
    };

    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
    overlay.addEventListener('click', e => {
      if (e.target === overlay) handleCancel();
    });

    dialog.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    });
  });
}
