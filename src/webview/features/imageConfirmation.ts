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
 * - Configure media path base and media path
 * - Cancel the operation
 * - Remember their choice for the session
 */

interface ImageDropOptions {
  targetFolder: string;
  rememberChoice: boolean;
  mediaPathBase?: string;
  mediaPath?: string;
}

/**
 * Session storage for config changes
 */
let sessionMediaPathBase: string | null = null;
let sessionMediaPath: string | null = null;

export function getSessionMediaPathBase(): string | null {
  return sessionMediaPathBase;
}

export function setSessionMediaPathBase(value: string | null): void {
  sessionMediaPathBase = value;
}

export function getSessionMediaPath(): string | null {
  return sessionMediaPath;
}

export function setSessionMediaPath(value: string | null): void {
  sessionMediaPath = value;
}

/**
 * Show confirmation dialog for image drop
 * Returns null if user cancels, otherwise returns options
 */
export async function confirmImageDrop(fileCount: number): Promise<ImageDropOptions | null> {
  // Get current settings (use session overrides if available)
  const currentMediaPathBase =
    sessionMediaPathBase ||
    ((window as any).mediaPathBase as string | undefined) ||
    'sameNameFolder';
  const currentMediaPath =
    sessionMediaPath || ((window as any).mediaPath as string | undefined) || 'media';

  const COMMON_FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif";

  return new Promise(resolve => {
    let resolved = false;

    const handleSave = () => {
      if (resolved) return;
      resolved = true;
      const remember = rememberCheckbox.checked;
      const newMediaPathBase = pathBaseSelect.value;
      const newMediaPath = mediaPathInput.value.trim() || 'media';
      const targetFolder = newMediaPath; // Use mediaPath as the folder

      // Save to session storage
      if (
        remember ||
        newMediaPathBase !== currentMediaPathBase ||
        newMediaPath !== currentMediaPath
      ) {
        setSessionMediaPathBase(newMediaPathBase);
        setSessionMediaPath(newMediaPath);
      }

      remove();
      resolve({
        targetFolder,
        rememberChoice: remember,
        mediaPathBase: newMediaPathBase,
        mediaPath: newMediaPath,
      });
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
      <div style="font-family: ${COMMON_FONT};">
        <h3 style="margin: 0 0 16px 0; color: var(--md-foreground); font-family: ${COMMON_FONT};">
          📸 Save ${fileCount} Image${fileCount > 1 ? 's' : ''}
        </h3>

        <!-- Configuration Options -->
        <div style="margin-bottom: 16px; padding: 12px; background: var(--md-comment-bg, rgba(128, 128, 128, 0.1)); border-radius: 4px; border-left: 3px solid var(--md-accent); box-sizing: border-box;">
          <div style="margin-bottom: 12px;">
            <label style="display: block; margin-bottom: 6px; color: var(--md-foreground); font-size: 13px; font-weight: 500; font-family: ${COMMON_FONT};">
              Media Path Base (where to store):
            </label>
            <select
              id="path-base-select"
              style="
                width: 100%;
                padding: 6px 8px;
                background: var(--md-input-bg);
                color: var(--md-input-fg);
                border: 1px solid var(--md-border);
                border-radius: 3px;
                font-family: ${COMMON_FONT};
                font-size: 13px;
                box-sizing: border-box;
              "
            >
              <option value="sameNameFolder">Same-name folder (next to document) - Recommended</option>
              <option value="relativeToDocument">Relative to document folder</option>
              <option value="workspaceFolder">Relative to workspace root</option>
            </select>
            <small style="display: block; margin-top: 4px; color: var(--md-muted); font-family: ${COMMON_FONT};">
              Choose where your media files will be stored
            </small>
          </div>

          <div>
            <label style="display: block; margin-bottom: 6px; color: var(--md-foreground); font-size: 13px; font-weight: 500; font-family: ${COMMON_FONT};">
              Media Path (subfolder name):
            </label>
            <input
              type="text"
              id="media-path-input"
              value="${currentMediaPath}"
              style="
                width: 100%;
                padding: 6px 8px;
                background: var(--md-input-bg);
                color: var(--md-input-fg);
                border: 1px solid var(--md-border);
                border-radius: 3px;
                font-family: ${COMMON_FONT};
                font-size: 13px;
                box-sizing: border-box;
              "
              placeholder="e.g., media, assets/images"
            />
            <small style="display: block; margin-top: 4px; color: var(--md-muted); font-family: ${COMMON_FONT};">
              Used only with "Relative to document" or "Workspace root" options
            </small>
          </div>
        </div>

        <!-- Remember Choice -->
        <div style="margin-bottom: 20px;">
          <label style="display: flex; align-items: center; color: var(--md-foreground); cursor: pointer; font-family: ${COMMON_FONT}; font-size: 13px;">
            <input type="checkbox" id="remember-choice" style="margin-right: 8px; cursor: pointer;">
            Save these settings for next time
          </label>
        </div>

        <!-- Buttons -->
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
          <button id="cancel-btn" style="${SECONDARY_BUTTON_STYLE} font-family: ${COMMON_FONT}; font-size: 13px;">
            Cancel
          </button>
          <button id="save-btn" style="${PRIMARY_BUTTON_STYLE} font-family: ${COMMON_FONT}; font-size: 13px;">
            Save Images
          </button>
        </div>
      </div>
    `;

    const pathBaseSelect = dialog.querySelector('#path-base-select') as HTMLSelectElement;
    const mediaPathInput = dialog.querySelector('#media-path-input') as HTMLInputElement;
    const rememberCheckbox = dialog.querySelector('#remember-choice') as HTMLInputElement;
    const cancelBtn = dialog.querySelector('#cancel-btn') as HTMLButtonElement;
    const saveBtn = dialog.querySelector('#save-btn') as HTMLButtonElement;

    // Set current values
    pathBaseSelect.value = currentMediaPathBase;

    mediaPathInput.focus();
    mediaPathInput.select();

    saveBtn.addEventListener('click', handleSave);
    cancelBtn.addEventListener('click', handleCancel);

    // Enter in any field (except dropdown) to save
    dialog.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target !== pathBaseSelect) {
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
