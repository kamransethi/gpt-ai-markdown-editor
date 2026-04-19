/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

/**
 * Local Image Outside Repo Dialog
 *
 * Shows a dialog when user tries to resize an image that's on the local filesystem
 * but outside the current workspace/repo. Offers two options:
 * 1. Edit in place (resize the original file)
 * 2. Copy to repo and edit (copy to user's chosen directory, then resize)
 */

import { getRememberedFolder, setRememberedFolder, getDefaultImagePath } from './imageConfirmation';
import { createModalOverlay, PRIMARY_BUTTON_STYLE, SECONDARY_BUTTON_STYLE } from './dialogFactory';

/**
 * Options for handling local image outside repo
 */
export interface LocalImageOutsideRepoOptions {
  action: 'edit-in-place' | 'copy-to-repo';
  targetFolder?: string; // Only used if action is 'copy-to-repo'
}

/**
 * Show dialog for local image outside repo
 */
export async function showLocalImageOutsideRepoDialog(
  imagePath: string,
  defaultFolder?: string
): Promise<LocalImageOutsideRepoOptions | null> {
  return new Promise(resolve => {
    // Check if we have a remembered folder preference
    const rememberedFolder = getRememberedFolder();
    const targetFolder = rememberedFolder || defaultFolder || getDefaultImagePath();

    let resolved = false;

    // Handle confirm
    const handleConfirm = () => {
      if (resolved) return;
      resolved = true;
      const action = editInPlaceRadio.checked ? 'edit-in-place' : 'copy-to-repo';
      const folder = copyToRepoRadio.checked
        ? copyFolderInput.value.trim() || defaultFolder
        : undefined;
      const remember = rememberCheckbox.checked;

      if (remember && folder) {
        setRememberedFolder(folder);
      }

      remove();
      resolve({
        action: action as 'edit-in-place' | 'copy-to-repo',
        targetFolder: folder,
      });
    };

    const handleCancel = () => {
      if (resolved) return;
      resolved = true;
      remove();
      resolve(null);
    };

    const { dialog, remove } = createModalOverlay({
      onClose: handleCancel,
      minWidth: '450px',
      maxWidth: '550px',
    });
    dialog.className = 'local-image-outside-repo-dialog';

    dialog.innerHTML = `
      <div style="display: flex; align-items: center; margin-bottom: 16px;">
        <span style="font-size: 24px; margin-right: 12px;">📁</span>
        <h3 style="margin: 0; color: var(--md-foreground);">
          Image Outside Workspace
        </h3>
      </div>

      <p style="margin: 0 0 16px 0; color: var(--md-foreground); line-height: 1.5;">
        This image is on your local disk but outside the current workspace. How would you like to proceed?
      </p>

      <div style="margin-bottom: 12px; padding: 8px; background: var(--md-quote-bg); border-left: 3px solid var(--md-quote-border); border-radius: 3px;">
        <div style="font-size: 11px; color: var(--md-muted); margin-bottom: 4px;">Image Path:</div>
        <div style="font-size: 12px; color: var(--md-foreground); word-break: break-all; font-family: var(--md-mono-font);">
          ${imagePath}
        </div>
      </div>

      <div style="margin-bottom: 20px;">
        <label style="display: flex; align-items: flex-start; padding: 12px; border: 1px solid var(--md-border); border-radius: 4px; margin-bottom: 8px; cursor: pointer; background: var(--md-hover-bg);">
          <input type="radio" name="local-image-action" value="edit-in-place" checked style="margin-right: 12px; margin-top: 2px;">
          <div style="flex: 1;">
            <div style="font-weight: 500; color: var(--md-foreground); margin-bottom: 4px;">Edit in Place</div>
            <div style="font-size: 11px; color: var(--md-muted);">
              Resize the original image file directly. The image will be modified at its current location.
            </div>
          </div>
        </label>

        <label style="display: flex; align-items: flex-start; padding: 12px; border: 1px solid var(--md-border); border-radius: 4px; cursor: pointer;">
          <input type="radio" name="local-image-action" value="copy-to-repo" style="margin-right: 12px; margin-top: 2px;">
          <div style="flex: 1;">
            <div style="font-weight: 500; color: var(--md-foreground); margin-bottom: 4px;">Copy to Workspace & Edit</div>
            <div style="font-size: 11px; color: var(--md-muted); margin-bottom: 8px;">
              Copy the image to your workspace first, then resize it. The original file remains unchanged.
            </div>
            <div id="copy-folder-input-container" style="display: none; margin-top: 8px;">
              <input
                type="text"
                id="copy-image-folder-input"
                value="${targetFolder}"
                style="
                  width: 100%;
                  padding: 6px 8px;
                  background: var(--md-input-bg);
                  color: var(--md-input-fg);
                  border: 1px solid var(--md-border);
                  border-radius: 3px;
                  font-family: var(--md-font-family);
                  font-size: 12px;
                "
                placeholder="e.g., images, assets/img"
              />
              <small style="display: block; margin-top: 4px; color: var(--md-muted); font-size: 11px;">
                Relative to current markdown file
              </small>
            </div>
          </div>
        </label>
      </div>

      <div style="margin-bottom: 20px;">
        <label style="display: flex; align-items: center; color: var(--md-foreground); cursor: pointer;">
          <input type="checkbox" id="remember-local-choice" style="margin-right: 8px;">
          Remember for this session
        </label>
      </div>

      <div style="display: flex; gap: 8px; justify-content: flex-end;">
        <button id="cancel-local-image" style="${SECONDARY_BUTTON_STYLE}">Cancel</button>
        <button id="confirm-local-image" style="${PRIMARY_BUTTON_STYLE}">Continue</button>
      </div>
    `;

    const editInPlaceRadio = dialog.querySelector(
      'input[value="edit-in-place"]'
    ) as HTMLInputElement;
    const copyToRepoRadio = dialog.querySelector('input[value="copy-to-repo"]') as HTMLInputElement;
    const copyFolderContainer = dialog.querySelector('#copy-folder-input-container') as HTMLElement;
    const copyFolderInput = dialog.querySelector('#copy-image-folder-input') as HTMLInputElement;
    const rememberCheckbox = dialog.querySelector('#remember-local-choice') as HTMLInputElement;
    const cancelBtn = dialog.querySelector('#cancel-local-image') as HTMLButtonElement;
    const confirmBtn = dialog.querySelector('#confirm-local-image') as HTMLButtonElement;

    // Show/hide folder input based on selection
    const updateFolderInputVisibility = () => {
      if (copyToRepoRadio.checked) {
        copyFolderContainer.style.display = 'block';
        copyFolderInput.focus();
      } else {
        copyFolderContainer.style.display = 'none';
      }
    };

    editInPlaceRadio.addEventListener('change', updateFolderInputVisibility);
    copyToRepoRadio.addEventListener('change', updateFolderInputVisibility);

    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);

    // Enter to confirm
    dialog.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm();
      }
    });
  });
}
