/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

/**
 * Image Drop Confirmation Dialog
 *
 * Shows a confirmation dialog when images are dropped, allowing users to:
 * - Choose where to save images
 * - Cancel the operation
 * - Remember their choice for the session
 */

interface ImageDropOptions {
  targetFolder: string;
  rememberChoice: boolean;
}

/**
 * Show confirmation dialog for image drop
 * Returns null if user cancels, otherwise returns options
 */
export async function confirmImageDrop(
  fileCount: number,
  defaultFolder: string = 'images'
): Promise<ImageDropOptions | null> {
  const imagePathBase = (window as any).imagePathBase as string | undefined;
  const pathBaseLabel =
    imagePathBase === 'workspaceFolder'
      ? 'Relative to workspace folder'
      : 'Relative to current markdown file';

  return new Promise(resolve => {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'image-drop-overlay';
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

    // Create dialog
    const dialog = document.createElement('div');
    dialog.className = 'image-drop-dialog';
    dialog.style.cssText = `
      background: var(--md-background);
      border: 1px solid var(--md-border);
      border-radius: 6px;
      padding: 20px;
      min-width: 400px;
      max-width: 500px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    `;

    dialog.innerHTML = `
      <h3 style="margin: 0 0 16px 0; color: var(--md-foreground);">
        📸 Save ${fileCount} Image${fileCount > 1 ? 's' : ''}
      </h3>

      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 8px; color: var(--md-foreground);">
          Save to folder:
        </label>
        <input
          type="text"
          id="image-folder-input"
          value="${defaultFolder}"
          style="
            width: 100%;
            padding: 6px 8px;
            background: var(--md-input-bg);
            color: var(--md-input-fg);
            border: 1px solid var(--md-border);
            border-radius: 3px;
            font-family: var(--md-font-family);
          "
          placeholder="e.g., images, assets/img, docs/screenshots"
        />
        <small style="display: block; margin-top: 4px; color: var(--md-muted);">
          ${pathBaseLabel}
        </small>
      </div>

      <div style="margin-bottom: 20px;">
        <label style="display: flex; align-items: center; color: var(--md-foreground); cursor: pointer;">
          <input type="checkbox" id="remember-choice" style="margin-right: 8px;">
          Remember for this session
        </label>
      </div>

      <div style="display: flex; gap: 8px; justify-content: flex-end;">
        <button id="cancel-btn" style="
          padding: 6px 14px;
          background: var(--md-button-secondary-bg);
          color: var(--md-button-secondary-fg);
          border: none;
          border-radius: 3px;
          cursor: pointer;
          font-family: var(--md-font-family);
        ">Cancel</button>
        <button id="save-btn" style="
          padding: 6px 14px;
          background: var(--md-button-bg);
          color: var(--md-button-fg);
          border: none;
          border-radius: 3px;
          cursor: pointer;
          font-family: var(--md-font-family);
          font-weight: 500;
        ">Save Images</button>
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Get elements
    const folderInput = dialog.querySelector('#image-folder-input') as HTMLInputElement;
    const rememberCheckbox = dialog.querySelector('#remember-choice') as HTMLInputElement;
    const cancelBtn = dialog.querySelector('#cancel-btn') as HTMLButtonElement;
    const saveBtn = dialog.querySelector('#save-btn') as HTMLButtonElement;

    // Focus folder input
    folderInput.focus();
    folderInput.select();

    // Handle save
    const handleSave = () => {
      const folder = folderInput.value.trim() || defaultFolder;
      const remember = rememberCheckbox.checked;

      document.body.removeChild(overlay);
      resolve({
        targetFolder: folder,
        rememberChoice: remember,
      });
    };

    // Handle cancel
    const handleCancel = () => {
      document.body.removeChild(overlay);
      resolve(null);
    };

    // Event listeners
    saveBtn.addEventListener('click', handleSave);
    cancelBtn.addEventListener('click', handleCancel);
    overlay.addEventListener('click', e => {
      if (e.target === overlay) handleCancel();
    });

    // Enter to save, Escape to cancel
    dialog.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    });
  });
}

/**
 * Session storage for user's folder preference
 */
let rememberedFolder: string | null = null;

export function getRememberedFolder(): string | null {
  return rememberedFolder;
}

export function setRememberedFolder(folder: string | null): void {
  rememberedFolder = folder;
}

/**
 * Get the default image path from VS Code settings
 * Falls back to 'images' if setting is not available
 */
export function getDefaultImagePath(): string {
  const imagePath = (window as any).imagePath;
  return imagePath !== undefined && imagePath !== null ? imagePath : 'images';
}
