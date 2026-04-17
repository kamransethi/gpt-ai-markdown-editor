/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

import { createModalOverlay, PRIMARY_BUTTON_STYLE, SECONDARY_BUTTON_STYLE } from './dialogFactory';
import {
  getSessionMediaPathBase,
  getSessionMediaPath,
  setSessionMediaPathBase,
  setSessionMediaPath,
} from './imageConfirmation';

/**
 * File Drop Confirmation Dialog
 *
 * Shown when non-image files (or mixed image+file) are dropped onto the editor.
 * Reuses the same path configuration UI as the image drop dialog.
 * All dropped files are saved to the configured media folder and inserted
 * as a bulleted list of markdown links at the drop position.
 */

interface FileDropOptions {
  targetFolder: string;
  rememberChoice: boolean;
  mediaPathBase?: string;
  mediaPath?: string;
}

/**
 * Return a suitable emoji icon for a given filename based on its extension.
 */
function getFileIcon(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  const iconMap: Record<string, string> = {
    pdf: '📄',
    doc: '📝',
    docx: '📝',
    xls: '📊',
    xlsx: '📊',
    ppt: '📊',
    pptx: '📊',
    txt: '📃',
    csv: '📊',
    json: '📋',
    xml: '📋',
    html: '🌐',
    htm: '🌐',
    md: '📝',
    zip: '🗜',
    tar: '🗜',
    gz: '🗜',
    rar: '🗜',
    '7z': '🗜',
    mp3: '🎵',
    wav: '🎵',
    mp4: '🎬',
    mov: '🎬',
    avi: '🎬',
    mkv: '🎬',
    png: '🖼',
    jpg: '🖼',
    jpeg: '🖼',
    gif: '🖼',
    svg: '🖼',
    webp: '🖼',
  };
  return iconMap[ext] ?? '📎';
}

/**
 * Show confirmation dialog for mixed/non-image file drop.
 *
 * @param files - All files being dropped (images and non-images).
 * @returns Options chosen by the user, or null if cancelled.
 */
export async function confirmFileDrop(files: File[]): Promise<FileDropOptions | null> {
  const currentMediaPathBase =
    getSessionMediaPathBase() ||
    ((window as unknown as Record<string, unknown>).mediaPathBase as string | undefined) ||
    'sameNameFolder';
  const currentMediaPath =
    getSessionMediaPath() ||
    ((window as unknown as Record<string, unknown>).mediaPath as string | undefined) ||
    'media';

  const COMMON_FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif";
  const count = files.length;

  return new Promise(resolve => {
    let resolved = false;

    const handleSave = () => {
      if (resolved) return;
      resolved = true;

      const remember = rememberCheckbox.checked;
      const newMediaPathBase = pathBaseSelect.value;
      const newMediaPath = mediaPathInput.value.trim() || 'media';

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
        targetFolder: newMediaPath,
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
    dialog.className = 'image-drop-dialog'; // reuse existing dialog styles

    const fileListHtml = files
      .map(
        f =>
          `<li style="display:flex;align-items:center;gap:8px;padding:3px 0;font-size:13px;color:var(--md-foreground);">` +
          `<span style="font-size:15px;">${getFileIcon(f.name)}</span>` +
          `<span style="font-family:monospace;word-break:break-all;">${f.name}</span>` +
          `</li>`
      )
      .join('');

    dialog.innerHTML = `
      <div style="font-family: ${COMMON_FONT};">
        <h3 style="margin: 0 0 16px 0; color: var(--md-foreground); font-family: ${COMMON_FONT};">
          📎 Save ${count} File${count > 1 ? 's' : ''}
        </h3>

        <!-- File list -->
        <ul style="
          margin: 0 0 16px 0;
          padding: 8px 12px;
          background: var(--md-comment-bg, rgba(128,128,128,0.1));
          border-radius: 4px;
          list-style: none;
          max-height: 120px;
          overflow-y: auto;
          box-sizing: border-box;
        ">
          ${fileListHtml}
        </ul>

        <!-- Configuration Options -->
        <div style="margin-bottom: 16px; padding: 12px; background: var(--md-comment-bg, rgba(128,128,128,0.1)); border-radius: 4px; border-left: 3px solid var(--md-accent); box-sizing: border-box;">
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
              placeholder="e.g., media, assets/files"
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
            Save File${count > 1 ? 's' : ''}
          </button>
        </div>
      </div>
    `;

    const pathBaseSelect = dialog.querySelector('#path-base-select') as HTMLSelectElement;
    const mediaPathInput = dialog.querySelector('#media-path-input') as HTMLInputElement;
    const rememberCheckbox = dialog.querySelector('#remember-choice') as HTMLInputElement;
    const cancelBtn = dialog.querySelector('#cancel-btn') as HTMLButtonElement;
    const saveBtn = dialog.querySelector('#save-btn') as HTMLButtonElement;

    pathBaseSelect.value = currentMediaPathBase;

    mediaPathInput.focus();
    mediaPathInput.select();

    saveBtn.addEventListener('click', handleSave);
    cancelBtn.addEventListener('click', handleCancel);

    dialog.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target !== pathBaseSelect) {
        e.preventDefault();
        handleSave();
      }
    });
  });
}
