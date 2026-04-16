/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

import { createModalOverlay, PRIMARY_BUTTON_STYLE, SECONDARY_BUTTON_STYLE } from './dialogFactory';

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
  const mediaPathBase = (window as any).mediaPathBase as string | undefined;
  const mediaPath = (window as any).mediaPath as string | undefined;

  // Generate user-friendly description of the storage configuration
  let configDescription = '';
  if (mediaPathBase === 'sameNameFolder') {
    configDescription = '📁 Saves to same-name folder next to your document (recommended)';
  } else if (mediaPathBase === 'workspaceFolder') {
    const pathLabel = mediaPath && mediaPath !== 'media' ? `→ ${mediaPath}` : '→ workspace root';
    configDescription = `📁 Saves to workspace root ${pathLabel}`;
  } else {
    // relativeToDocument or default
    const pathLabel = mediaPath || 'media';
    configDescription = `📁 Saves to document folder → ${pathLabel} subfolder`;
  }

  return new Promise(resolve => {
    let resolved = false;

    const handleSave = () => {
      if (resolved) return;
      resolved = true;
      const folder = folderInput.value.trim() || defaultFolder;
      const remember = rememberCheckbox.checked;
      remove();
      resolve({ targetFolder: folder, rememberChoice: remember });
    };

    const handleCancel = () => {
      if (resolved) return;
      resolved = true;
      remove();
      resolve(null);
    };

    const { dialog, remove } = createModalOverlay({ onClose: handleCancel });
    dialog.className = 'image-drop-dialog';

    dialog.innerHTML = `
      <h3 style="margin: 0 0 16px 0; color: var(--md-foreground);">
        📸 Save ${fileCount} Image${fileCount > 1 ? 's' : ''}
      </h3>

      <div style="margin-bottom: 16px; padding: 10px; background: var(--md-comment-bg, rgba(128, 128, 128, 0.1)); border-radius: 3px; border-left: 3px solid var(--md-accent);">
        <small style="color: var(--md-muted); display: block; line-height: 1.4;">
          ${configDescription}
        </small>
      </div>

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
          This setting is controlled by "Media Path Base" configuration
        </small>
      </div>

      <div style="margin-bottom: 20px;">
        <label style="display: flex; align-items: center; color: var(--md-foreground); cursor: pointer;">
          <input type="checkbox" id="remember-choice" style="margin-right: 8px;">
          Remember for this session
        </label>
      </div>

      <div style="display: flex; gap: 8px; justify-content: flex-end;">
        <button id="cancel-btn" style="${SECONDARY_BUTTON_STYLE}">Cancel</button>
        <button id="save-btn" style="${PRIMARY_BUTTON_STYLE}">Save Images</button>
      </div>
    `;

    const folderInput = dialog.querySelector('#image-folder-input') as HTMLInputElement;
    const rememberCheckbox = dialog.querySelector('#remember-choice') as HTMLInputElement;
    const cancelBtn = dialog.querySelector('#cancel-btn') as HTMLButtonElement;
    const saveBtn = dialog.querySelector('#save-btn') as HTMLButtonElement;

    folderInput.focus();
    folderInput.select();

    saveBtn.addEventListener('click', handleSave);
    cancelBtn.addEventListener('click', handleCancel);

    // Enter to save
    dialog.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSave();
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
