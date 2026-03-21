/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

import { createModalOverlay, PRIMARY_BUTTON_STYLE, SECONDARY_BUTTON_STYLE } from './dialogFactory';

/**
 * Huge Image Dialog
 *
 * Shows a dialog when user drops/pastes a very large image (>2000px or >2MB),
 * offering to resize it to a suggested resolution before inserting.
 */

export interface HugeImageOptions {
  action: 'resize-suggested' | 'resize-custom' | 'use-original';
  customWidth?: number;
  customHeight?: number;
}

/**
 * Check if image is huge (exceeds thresholds)
 */
export function isHugeImage(file: File): boolean {
  // File size threshold: > 2MB
  if (file.size > 2 * 1024 * 1024) {
    return true;
  }

  // Pixel threshold will be checked after image loads
  // For now, we'll check file size only
  return false;
}

/**
 * Get image dimensions from File
 * Returns null if dimensions can't be determined
 */
function getImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.width, height: img.height });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };

    img.src = url;
  });
}

/**
 * Calculate suggested resolution based on editor width
 * Uses 80% of editor content width (max-width: 1400px from CSS)
 */
function calculateSuggestedResolution(
  originalWidth: number,
  originalHeight: number
): { width: number; height: number } {
  // Editor max-width is 1400px, use 80% = 1120px
  const maxEditorWidth = 1400;
  const suggestedWidth = Math.min(Math.round(maxEditorWidth * 0.8), originalWidth);
  const aspectRatio = originalWidth / originalHeight;
  const suggestedHeight = Math.round(suggestedWidth / aspectRatio);

  return { width: suggestedWidth, height: suggestedHeight };
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Show huge image dialog
 * Returns null if user cancels, otherwise returns resize options
 */
export async function showHugeImageDialog(
  file: File,
  _cursorPosition?: { x: number; y: number }
): Promise<HugeImageOptions | null> {
  // Check file size first (quick check)
  const isHuge = isHugeImage(file);
  if (!isHuge) {
    return null; // Not huge, no dialog needed
  }

  // Get image dimensions
  const dimensions = await getImageDimensions(file);
  if (!dimensions) {
    // Can't determine dimensions, proceed with original
    return null;
  }

  // Check pixel threshold: > 2000px width OR > 2000px height
  const pixelThreshold = 2000;
  if (dimensions.width <= pixelThreshold && dimensions.height <= pixelThreshold) {
    return null; // Not huge by pixel count
  }

  // Calculate suggested resolution
  const suggested = calculateSuggestedResolution(dimensions.width, dimensions.height);

  return new Promise(resolve => {
    const thumbnailUrl = URL.createObjectURL(file);
    let resolved = false;

    const handleResizeSuggested = () => {
      if (resolved) return;
      resolved = true;
      URL.revokeObjectURL(thumbnailUrl);
      remove();
      resolve({
        action: 'resize-suggested',
        customWidth: suggested.width,
        customHeight: suggested.height,
      });
    };

    const handleUseOriginal = () => {
      if (resolved) return;
      resolved = true;
      URL.revokeObjectURL(thumbnailUrl);
      remove();
      resolve({ action: 'use-original' });
    };

    const handleCancel = () => {
      if (resolved) return;
      resolved = true;
      URL.revokeObjectURL(thumbnailUrl);
      remove();
      resolve(null);
    };

    const { dialog, remove } = createModalOverlay({
      onClose: handleCancel,
      extraDialogCss: 'display: flex; flex-direction: column; align-items: center;',
    });
    dialog.className = 'huge-image-dialog';

    // Thumbnail preview
    const thumbnail = document.createElement('img');
    thumbnail.src = thumbnailUrl;
    thumbnail.style.cssText = `
      max-width: 200px;
      max-height: 200px;
      object-fit: contain;
      border-radius: 4px;
      margin-bottom: 16px;
    `;
    dialog.appendChild(thumbnail);

    const content = document.createElement('div');
    content.style.cssText = 'width: 100%; text-align: center;';
    content.innerHTML = `
      <h3 style="margin: 0 0 16px 0; color: var(--md-foreground);">
        Large Image Detected
      </h3>
      <div style="margin-bottom: 16px;">
        <p style="margin: 0 0 8px 0; color: var(--md-foreground);">
          This image is very large:
        </p>
        <p style="margin: 0 0 8px 0; color: var(--md-muted); font-size: 0.9em;">
          ${dimensions.width} × ${dimensions.height}px (${formatFileSize(file.size)})
        </p>
        <p style="margin: 0; color: var(--md-muted); font-size: 0.9em;">
          Suggested size: ${suggested.width} × ${suggested.height}px
        </p>
      </div>
      <div style="display: flex; gap: 8px; justify-content: center; width: 100%;">
        <button id="resize-suggested-btn" style="${PRIMARY_BUTTON_STYLE} padding: 8px 16px;">Resize to Suggested</button>
        <button id="use-original-btn" style="${SECONDARY_BUTTON_STYLE} padding: 8px 16px;">Use Original</button>
      </div>
    `;
    dialog.appendChild(content);

    const resizeSuggestedBtn = content.querySelector('#resize-suggested-btn') as HTMLButtonElement;
    const useOriginalBtn = content.querySelector('#use-original-btn') as HTMLButtonElement;

    resizeSuggestedBtn.addEventListener('click', handleResizeSuggested);
    useOriginalBtn.addEventListener('click', handleUseOriginal);

    resizeSuggestedBtn.focus();
  });
}
