/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

/**
 * Image Drag & Drop / Paste Handler
 *
 * Enables intuitive image insertion:
 * - Drag & drop images directly (no shift key required!)
 * - Paste images from clipboard
 * - Auto-saves to configurable folder
 *
 * NO shift key required for drag-drop
 */

import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode, Schema as ProseMirrorSchema } from '@tiptap/pm/model';
import { Fragment, Slice } from '@tiptap/pm/model';
import { dropPoint } from '@tiptap/pm/transform';
import { confirmImageDrop, getRememberedFolder, setRememberedFolder } from './imageConfirmation';
import { confirmFileDrop } from './fileDropConfirmation';
import { showHugeImageDialog, isHugeImage } from './hugeImageDialog';
import { devLog } from '../utils/devLog';
import { MessageType } from '../../shared/messageTypes';
import {
  addUploadTracking,
  getUploadPos,
  removeUploadTracking,
} from '../extensions/imageUploadPlugin';

/**
 * Track images currently being saved to prevent document sync race conditions
 */
const pendingImageSaves = new Set<string>();

/**
 * Pending file-drop insert positions, keyed by requestId.
 * Used to insert the bullet list at the original drop position after save completes.
 */
const pendingFileDropPositions = new Map<string, number>();

/**
 * Module-level references stored by setupImageDragDrop so that
 * queueImageFromUrl can trigger uploads without needing to re-acquire them.
 */
let _moduleVscodeApi: VsCodeApi | null = null;
let _moduleEditor: Editor | null = null;

/**
 * Check if any images are currently being saved
 */
export function hasPendingImageSaves(): boolean {
  return pendingImageSaves.size > 0;
}

type EditorForInsertPosition = {
  state: {
    doc: ProseMirrorNode;
    schema: ProseMirrorSchema;
    selection: { from: number };
  };
};

export function resolveImageInsertPosition(editor: EditorForInsertPosition, pos?: number): number {
  const fallback = editor.state.selection.from;
  const requestedPos = pos ?? fallback;

  const maxPos = editor.state.doc.content.size;
  if (pos !== undefined && (requestedPos < 0 || requestedPos > maxPos)) {
    return fallback;
  }

  const boundedPos = Math.max(0, Math.min(requestedPos, maxPos));

  const imageType = editor.state.schema.nodes.image;
  if (!imageType) {
    return boundedPos;
  }

  const node = imageType.create({ src: 'x', alt: null });
  const slice = new Slice(Fragment.from(node), 0, 0);

  try {
    const safePos = dropPoint(editor.state.doc, boundedPos, slice);
    return safePos ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Get count of pending image saves (for debugging)
 */
export function getPendingImageCount(): number {
  return pendingImageSaves.size;
}

/**
 * VS Code API type
 */
interface VsCodeApi {
  postMessage: (message: unknown) => void;
}

/**
 * Supported image MIME types
 */
const SUPPORTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
];

const IMAGE_PATH_REGEX = /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i;

/**
 * Setup image drag & drop and paste handling for the editor
 */
export function setupImageDragDrop(editor: Editor, vscodeApi: VsCodeApi): void {
  _moduleVscodeApi = vscodeApi;
  _moduleEditor = editor;

  const editorElement = document.querySelector('.ProseMirror');
  if (!editorElement) {
    console.warn('[DK-AI] Editor element not found for image drag-drop setup');
    return;
  }

  // Drag over styling (keep as DOM listeners — purely cosmetic, no routing logic)
  editorElement.addEventListener('dragover', handleDragOver);
  editorElement.addEventListener('dragleave', handleDragLeave);

  // Drop and paste are now routed through editorProps.handleDrop / editorProps.handlePaste
  // (registered in editor.ts). No DOM listeners needed here for routing.

  // Listen for image save confirmations and file save confirmations from extension
  window.addEventListener('message', event => handleImageMessage(event, editor));

  // Guard against VS Code opening a new window when dropping images/files outside the editor
  const blockWindowDrop = (e: DragEvent) => {
    if (hasAnyDroppedFiles(e.dataTransfer) || extractImagePathFromDataTransfer(e.dataTransfer)) {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'none';
      }
    }
  };

  // Clear drag-over styling when leaving the window entirely
  const handleWindowDragLeave = (e: DragEvent) => {
    if (e.relatedTarget === null) {
      editorElement.classList.remove('drag-over');
    }
  };

  window.addEventListener('dragover', blockWindowDrop);
  window.addEventListener('drop', blockWindowDrop);
  window.addEventListener('dragleave', handleWindowDragLeave as EventListener);

  // Clean up window listeners when editor is destroyed to prevent memory leaks
  editor.on('destroy', () => {
    window.removeEventListener('dragover', blockWindowDrop);
    window.removeEventListener('drop', blockWindowDrop);
    window.removeEventListener('dragleave', handleWindowDragLeave as EventListener);
  });
}

/**
 * Queue an image URL (from a web-pasted <img src>) for download and upload.
 * Fetches the URL as a Blob, wraps it in a File, and routes it through insertImage
 * so it is saved to the workspace like any other pasted/dropped image.
 *
 * Requires setupImageDragDrop() to have been called first.
 *
 * @param editor - TipTap editor instance
 * @param url - Absolute image URL extracted from pasted HTML
 * @param pos - Optional editor position to insert at (defaults to cursor)
 */
export async function queueImageFromUrl(editor: Editor, url: string, pos?: number): Promise<void> {
  const vscodeApi = _moduleVscodeApi;
  if (!vscodeApi) {
    console.warn('[DK-AI] queueImageFromUrl called before setupImageDragDrop — skipping');
    return;
  }

  let file: File;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[DK-AI] Could not fetch image at ${url}: ${response.status}`);
      return;
    }
    const blob = await response.blob();
    const mimeType = blob.type || 'image/png';
    if (!mimeType.startsWith('image/')) {
      console.warn(`[DK-AI] URL did not return image MIME type: ${mimeType}`);
      return;
    }
    const filename = url.split('/').pop()?.split('?')[0] || 'pasted-image.png';
    file = new File([blob], filename, { type: mimeType });
  } catch (err) {
    console.warn('[DK-AI] Failed to fetch image from URL:', url, err);
    return;
  }

  const targetFolder = getRememberedFolder() || '';
  await insertImage(editor, file, vscodeApi, targetFolder, 'pasted', pos);
}

// ---------------------------------------------------------------------------
// editorProps handlers — registered in editor.ts via editorProps.handleDrop
// and editorProps.handlePaste. These replace the old DOM event listeners so
// all image routing runs through TipTap's event pipeline (FR-004).
// ---------------------------------------------------------------------------

/**
 * TipTap editorProps.handleDrop handler.
 * Returns true (handled) for image/file drops; false to defer to ProseMirror default.
 * Start the async drop logic as fire-and-forget and return synchronously.
 */
export function imageDragDropHandler(
  _view: unknown,
  event: Event,
  _slice: unknown,
  _moved: boolean
): boolean {
  const editor = _moduleEditor;
  const vscodeApi = _moduleVscodeApi;
  if (!editor || !vscodeApi) return false;

  const dragEvent = event as DragEvent;
  const dt = dragEvent.dataTransfer;
  if (!dt) return false;

  const allFiles = Array.from(dt.files);
  const hasFiles = allFiles.length > 0;
  const hasImagePath = !!extractImagePathFromDataTransfer(dt);

  if (!hasFiles && !hasImagePath) return false; // let ProseMirror handle plain-text drops

  // We own this drop — start async handler, return true immediately
  void handleDrop(dragEvent, editor, vscodeApi);
  return true;
}

/**
 * TipTap editorProps.handlePaste handler.
 * Returns true (handled) for image-only paste events; false to let
 * clipboardHandling.ts and TipTap's native paste run for text/HTML.
 * Start the async paste logic as fire-and-forget and return synchronously.
 */
export function imagePasteHandler(_view: unknown, event: Event, _slice: unknown): boolean {
  const editor = _moduleEditor;
  const vscodeApi = _moduleVscodeApi;
  if (!editor || !vscodeApi) return false;

  const pasteEvent = event as ClipboardEvent;
  const clipboardData = pasteEvent.clipboardData;
  if (!clipboardData) return false;

  // Only handle when there are image files or an image file path.
  // Text/HTML content is handled by clipboardHandling.ts (capture-phase listener).
  const imagePath = extractImagePathFromDataTransfer(clipboardData);
  const imageFiles = getImageFiles(clipboardData);
  const items = Array.from(clipboardData.items || []);
  const hasBinaryImage = items.some(item => item.type.startsWith('image/'));

  if (!imagePath && imageFiles.length === 0 && !hasBinaryImage) return false;

  // We own this paste — start async handler, return true immediately
  void handlePaste(pasteEvent, editor, vscodeApi);
  return true;
}

/**
 */
export function extractImagePathFromDataTransfer(dt: DataTransfer | null): string | null {
  if (!dt) return null;

  const uriList = dt.getData('text/uri-list') || '';
  const textPlain = dt.getData('text/plain') || '';

  const candidate = (uriList || textPlain).trim();
  if (!candidate) return null;

  const firstLine = candidate.split(/\r?\n/).find(Boolean) || '';
  return IMAGE_PATH_REGEX.test(firstLine) ? firstLine : null;
}

/**
 * Handle dragover event - show drop zone styling
 */
function handleDragOver(e: Event): void {
  const dragEvent = e as DragEvent;
  dragEvent.preventDefault();

  const hasFiles = hasAnyDroppedFiles(dragEvent.dataTransfer);
  const hasImagePath = extractImagePathFromDataTransfer(dragEvent.dataTransfer);

  if (hasFiles || hasImagePath) {
    dragEvent.dataTransfer!.dropEffect = 'copy';
    (e.currentTarget as Element).classList.add('drag-over');
  }
}

/**
 * Handle dragleave event - remove drop zone styling
 */
function handleDragLeave(e: Event): void {
  const dragEvent = e as DragEvent;
  const target = e.currentTarget as Element;

  // Only remove if leaving the editor entirely
  if (!target.contains(dragEvent.relatedTarget as Node)) {
    target.classList.remove('drag-over');
  }
}

/**
 * Handle workspace image drop (from VS Code file explorer)
 * These come as file:// URIs or absolute paths, not File objects
 */
async function handleWorkspaceImageDrop(
  uriOrPath: string,
  editor: Editor,
  vscodeApi: VsCodeApi,
  e?: DragEvent,
  insertPosOverride?: number
): Promise<void> {
  devLog('[DK-AI] Handling workspace image drop:', uriOrPath);

  // Clean up the path - could be file:// URI or absolute path
  let filePath = uriOrPath.trim();

  // Handle file:// URI
  if (filePath.startsWith('file://')) {
    filePath = decodeURIComponent(filePath.replace('file://', ''));
  }

  // Extract filename from path
  const fileName = filePath.split('/').pop() || 'image.png';

  // Get drop position in editor
  const pos =
    insertPosOverride ??
    (e
      ? editor.view.posAtCoords({
          left: e.clientX,
          top: e.clientY,
        })?.pos
      : editor.state.selection.from);

  // For workspace images, we ask the extension to handle the copy/link
  // Send message to extension with the source path
  vscodeApi.postMessage({
    type: MessageType.HANDLE_WORKSPACE_IMAGE,
    sourcePath: filePath,
    fileName: fileName,
    insertPosition: pos,
  });
}

/**
 * Handle drop event - insert dropped images or files.
 * - Pure image drops: use existing image flow (base64 preview, then replace).
 * - Any non-image in the drop: "File mode" — all files saved & inserted as a
 *   bulleted list of markdown links at the drop position.
 *
 * NO SHIFT KEY REQUIRED for better user experience.
 */
async function handleDrop(e: DragEvent, editor: Editor, vscodeApi: VsCodeApi): Promise<void> {
  e.preventDefault();
  (e.currentTarget as Element).classList.remove('drag-over');

  const dt = e.dataTransfer;
  if (!dt) return;

  const allFiles = Array.from(dt.files);

  devLog('[DK-AI] Drop payload types:', {
    types: Array.from(dt.types || []),
    fileCount: allFiles.length,
    imageCount: allFiles.filter(isImageFile).length,
  });

  // Case 1: No File objects — check for VS Code file explorer drops (URI as text)
  if (allFiles.length === 0) {
    const imagePath = extractImagePathFromDataTransfer(dt);
    if (imagePath) {
      await handleWorkspaceImageDrop(imagePath, editor, vscodeApi, e);
      return;
    }
    devLog('[DK-AI] Drop ignored: no files or image paths detected');
    return;
  }

  const nonImageFiles = allFiles.filter(f => !isImageFile(f));

  // Case 2: Any non-image file present → File mode (all files, including images)
  if (nonImageFiles.length > 0) {
    // Stop fileLinkDrop.ts from also handling this drop
    e.stopImmediatePropagation();
    await handleFileDrop(allFiles, editor, vscodeApi, e);
    return;
  }

  // Case 3: Pure image drop — existing flow unchanged
  const files = allFiles; // all are images at this point

  // Check if we have a remembered folder preference
  let targetFolder = getRememberedFolder();

  // If no remembered preference, show confirmation dialog
  if (!targetFolder) {
    const options = await confirmImageDrop(files.length);
    if (!options) {
      // User cancelled
      return;
    }

    targetFolder = options.targetFolder;

    // Remember choice if requested
    if (options.rememberChoice) {
      setRememberedFolder(targetFolder);
    }
  }

  // Get drop position in editor
  const pos = editor.view.posAtCoords({
    left: e.clientX,
    top: e.clientY,
  });

  // Insert all dropped images
  for (const file of files) {
    // Check if image is huge and show dialog
    let resizeOptions: { width: number; height: number } | undefined;
    if (isHugeImage(file)) {
      const hugeImageOptions = await showHugeImageDialog(file, {
        x: e.clientX,
        y: e.clientY,
      });

      if (!hugeImageOptions) {
        // User cancelled
        continue;
      }

      if (
        hugeImageOptions.action === 'resize-suggested' &&
        hugeImageOptions.customWidth &&
        hugeImageOptions.customHeight
      ) {
        resizeOptions = {
          width: hugeImageOptions.customWidth,
          height: hugeImageOptions.customHeight,
        };
      } else if (hugeImageOptions.action === 'use-original') {
        // Use original, no resize
        resizeOptions = undefined;
      }
    }

    await insertImage(editor, file, vscodeApi, targetFolder, 'dropped', pos?.pos, resizeOptions);
  }
}

/**
 * Handle a "File mode" drop: save all files (images + non-images) to the
 * configured media folder and insert a bulleted list of markdown links.
 */
async function handleFileDrop(
  files: File[],
  editor: Editor,
  vscodeApi: VsCodeApi,
  e: DragEvent
): Promise<void> {
  const options = await confirmFileDrop(files);
  if (!options) return; // user cancelled

  // Capture cursor/drop position before the async round-trip
  const dropPos =
    editor.view.posAtCoords({ left: e.clientX, top: e.clientY })?.pos ??
    editor.state.selection.from;

  // Encode each file's binary data for transport
  const filesPayload = await Promise.all(
    files.map(async f => {
      const buffer = await f.arrayBuffer();
      return {
        name: f.name,
        mimeType: f.type || 'application/octet-stream',
        data: Array.from(new Uint8Array(buffer)),
      };
    })
  );

  const requestId = `fd-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  pendingFileDropPositions.set(requestId, dropPos);

  vscodeApi.postMessage({
    type: MessageType.SAVE_FILES,
    requestId,
    files: filesPayload,
    targetFolder: options.targetFolder,
    mediaPathBase: options.mediaPathBase,
  });
}

/**
 * Handle paste event - insert pasted images from clipboard
 */
async function handlePaste(e: ClipboardEvent, editor: Editor, vscodeApi: VsCodeApi): Promise<void> {
  const clipboardData = e.clipboardData as DataTransfer | null;
  const imagePath = extractImagePathFromDataTransfer(clipboardData);
  const files = getImageFiles(clipboardData);
  const items = Array.from(clipboardData?.items || []);
  const imageItem = items.find(item => item.type.startsWith('image/'));

  // Priority order for paste handling:
  // 1. Image path (workspace files) - highest priority
  // 2. File objects (screenshots, copied files) - high priority
  // 3. Binary clipboard image (data URL) - lowest priority

  // Workspace-aware paste: if text payload contains an image path, insert via relative path
  if (imagePath) {
    e.preventDefault();
    await handleWorkspaceImageDrop(
      imagePath,
      editor,
      vscodeApi,
      undefined,
      editor.state.selection.from
    );
    return;
  }

  // Pasted files (e.g., screenshots provided as File)
  // IMPORTANT: Check this BEFORE imageItem to prevent double insertion
  // When copying images from browser, clipboard has BOTH File and data URL
  if (files.length > 0) {
    e.preventDefault();

    let targetFolder = getRememberedFolder();
    if (!targetFolder) {
      const options = await confirmImageDrop(files.length);
      if (!options) {
        return;
      }
      targetFolder = options.targetFolder;
      if (options.rememberChoice) {
        setRememberedFolder(targetFolder);
        // Send config changes back to extension to update settings
        if (options.mediaPathBase && options.mediaPathBase !== (window as any).mediaPathBase) {
          vscodeApi.postMessage({
            type: MessageType.UPDATE_SETTING,
            key: 'gptAiMarkdownEditor.mediaPathBase',
            value: options.mediaPathBase,
          });
        }
        if (options.mediaPath && options.mediaPath !== (window as any).mediaPath) {
          vscodeApi.postMessage({
            type: MessageType.UPDATE_SETTING,
            key: 'gptAiMarkdownEditor.mediaPath',
            value: options.mediaPath,
          });
        }
      }
    }

    const pos = editor.state.selection.from;
    for (const file of files) {
      // Check if image is huge and show dialog
      let resizeOptions: { width: number; height: number } | undefined;
      if (isHugeImage(file)) {
        const hugeImageOptions = await showHugeImageDialog(file);

        if (!hugeImageOptions) {
          // User cancelled
          continue;
        }

        if (
          hugeImageOptions.action === 'resize-suggested' &&
          hugeImageOptions.customWidth &&
          hugeImageOptions.customHeight
        ) {
          resizeOptions = {
            width: hugeImageOptions.customWidth,
            height: hugeImageOptions.customHeight,
          };
        } else if (hugeImageOptions.action === 'use-original') {
          // Use original, no resize
          resizeOptions = undefined;
        }
      }

      await insertImage(editor, file, vscodeApi, targetFolder, 'pasted', pos, resizeOptions);
    }
    return;
  }

  // Binary clipboard image (no file path)
  if (imageItem) {
    e.preventDefault();
    const file = imageItem.getAsFile();
    if (file) {
      let targetFolder = getRememberedFolder();

      if (!targetFolder) {
        const options = await confirmImageDrop(1);
        if (!options) {
          return;
        }

        targetFolder = options.targetFolder;

        if (options.rememberChoice) {
          setRememberedFolder(targetFolder);
          // Send config changes back to extension to update settings
          if (options.mediaPathBase && options.mediaPathBase !== (window as any).mediaPathBase) {
            vscodeApi.postMessage({
              type: MessageType.UPDATE_SETTING,
              key: 'gptAiMarkdownEditor.mediaPathBase',
              value: options.mediaPathBase,
            });
          }
          if (options.mediaPath && options.mediaPath !== (window as any).mediaPath) {
            vscodeApi.postMessage({
              type: MessageType.UPDATE_SETTING,
              key: 'gptAiMarkdownEditor.mediaPath',
              value: options.mediaPath,
            });
          }
        }
      }

      // Check if image is huge and show dialog
      let resizeOptions: { width: number; height: number } | undefined;
      if (isHugeImage(file)) {
        const hugeImageOptions = await showHugeImageDialog(file);

        if (!hugeImageOptions) {
          // User cancelled
          return;
        }

        if (
          hugeImageOptions.action === 'resize-suggested' &&
          hugeImageOptions.customWidth &&
          hugeImageOptions.customHeight
        ) {
          resizeOptions = {
            width: hugeImageOptions.customWidth,
            height: hugeImageOptions.customHeight,
          };
        } else if (hugeImageOptions.action === 'use-original') {
          // Use original, no resize
          resizeOptions = undefined;
        }
      }

      await insertImage(editor, file, vscodeApi, targetFolder, 'pasted', undefined, resizeOptions);
    }
  }
}

/**
 * Handle messages from extension (image save confirmations)
 */
function handleImageMessage(event: MessageEvent, editor: Editor): void {
  const message = event.data;

  // Only log our messages
  if (
    message.type === MessageType.IMAGE_SAVED ||
    message.type === MessageType.IMAGE_ERROR ||
    message.type === MessageType.INSERT_WORKSPACE_IMAGE
  ) {
    devLog('[DK-AI] Received message from extension:', message.type, message);
  }

  switch (message.type) {
    case MessageType.FILES_SAVED: {
      const requestId = message.requestId as string;
      const savedFiles = message.savedFiles as Array<{ name: string; relativePath: string }>;
      const insertPos = pendingFileDropPositions.get(requestId);
      pendingFileDropPositions.delete(requestId);

      if (!savedFiles || savedFiles.length === 0) break;

      // Build an HTML bulleted list of markdown-style file links
      const itemsHtml = savedFiles
        .map(f => `<li><a href="${f.relativePath}">${f.name}</a></li>`)
        .join('');
      const listHtml = `<ul>${itemsHtml}</ul>`;

      if (typeof insertPos === 'number') {
        editor.chain().focus().insertContentAt(insertPos, listHtml).run();
      } else {
        editor.commands.insertContent(listHtml);
      }
      break;
    }
    case MessageType.FILE_SAVE_ERROR: {
      console.error('[DK-AI] File save failed:', message.error);
      const reqId = message.requestId as string;
      pendingFileDropPositions.delete(reqId);
      break;
    }
    case MessageType.IMAGE_SAVED: {
      // Update placeholder with final path
      devLog(
        `[DK-AI] Processing imageSaved: placeholderId=${message.placeholderId}, newSrc=${message.newSrc}`
      );
      updateImageSrc(message.placeholderId, message.newSrc, editor);
      // Remove from pending saves
      pendingImageSaves.delete(message.placeholderId);
      devLog(`[DK-AI] Removed from pending saves. Remaining: ${pendingImageSaves.size}`);
      break;
    }
    case MessageType.IMAGE_ERROR: {
      // Remove placeholder on error
      console.error('[DK-AI] Image save failed:', message.error);
      removeImagePlaceholder(message.placeholderId, editor);
      // Remove from pending saves
      pendingImageSaves.delete(message.placeholderId);
      devLog(`[DK-AI] Removed from pending saves (error). Remaining: ${pendingImageSaves.size}`);
      break;
    }
    case MessageType.INSERT_WORKSPACE_IMAGE: {
      // Insert image from workspace with relative path
      devLog(`[DK-AI] Inserting workspace image: ${message.relativePath}, alt: ${message.altText}`);
      insertWorkspaceImage(editor, message.relativePath, message.altText, message.insertPosition);
      break;
    }
  }
}

/**
 * Insert a workspace image with relative path (no copying needed)
 */
function insertWorkspaceImage(
  editor: Editor,
  relativePath: string,
  altText: string,
  pos?: number
): void {
  devLog(`[DK-AI] insertWorkspaceImage called with:`, {
    relativePath,
    altText,
    pos,
    currentSelection: editor.state.selection.from,
  });

  try {
    const safePos = resolveImageInsertPosition(editor, pos);
    const result = editor
      .chain()
      .focus()
      .insertContentAt(safePos, {
        type: 'image',
        attrs: {
          src: relativePath,
          alt: altText,
        },
      })
      .run();

    devLog(`[DK-AI] Inserted workspace image: ${relativePath}, success: ${result}`);

    // Verify the image was actually inserted
    setTimeout(() => {
      const images = document.querySelectorAll(`img[src="${relativePath}"]`);
      devLog(`[DK-AI] Verification: Found ${images.length} images with src="${relativePath}"`);
    }, 100);
  } catch (error) {
    console.error(`[DK-AI] Failed to insert workspace image:`, error);
  }
}

/**
 * Check if DataTransfer contains image files
 */
export function hasImageFiles(dt: DataTransfer | null): boolean {
  if (!dt) return false;
  return Array.from(dt.types).includes('Files') && Array.from(dt.files).some(f => isImageFile(f));
}

/**
 * Check if DataTransfer contains any files (image or non-image)
 */
export function hasAnyDroppedFiles(dt: DataTransfer | null): boolean {
  if (!dt) return false;
  return Array.from(dt.types).includes('Files') && dt.files.length > 0;
}

/**
 * Check if DataTransfer contains non-image files
 */
export function hasNonImageFiles(dt: DataTransfer | null): boolean {
  if (!dt) return false;
  return Array.from(dt.files).some(f => !isImageFile(f));
}

/**
 * Get image files from DataTransfer
 */
export function getImageFiles(dt: DataTransfer | null): File[] {
  if (!dt) return [];
  return Array.from(dt.files).filter(f => isImageFile(f));
}

/**
 * Check if a file is a supported image type
 */
export function isImageFile(file: File): boolean {
  return SUPPORTED_IMAGE_TYPES.includes(file.type);
}

/**
 * Resize image using canvas API
 */
async function resizeImage(file: File, targetWidth: number, targetHeight: number): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Create canvas
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      // Draw resized image
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      // Convert to blob
      canvas.toBlob(
        blob => {
          if (!blob) {
            reject(new Error('Failed to create blob from canvas'));
            return;
          }

          // Create new File with same name and type
          const resizedFile = new File([blob], file.name, { type: file.type });
          resolve(resizedFile);
        },
        file.type || 'image/png',
        0.92 // Quality for JPEG (ignored for PNG)
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for resizing'));
    };

    img.src = url;
  });
}

/**
 * Insert an image into the editor
 *
 * @param editor - TipTap editor instance
 * @param file - Image file to insert
 * @param vscodeApi - VS Code API for messaging
 * @param targetFolder - Target folder for saving
 * @param source - How the image was added ('dropped' or 'pasted')
 * @param pos - Optional insertion position
 * @param resizeOptions - Optional resize dimensions (from huge image dialog)
 */
export async function insertImage(
  editor: Editor,
  file: File,
  vscodeApi: VsCodeApi,
  targetFolder: string,
  source: ImageSourceType,
  pos?: number,
  resizeOptions?: { width: number; height: number }
): Promise<void> {
  // Generate unique placeholder ID
  const placeholderId = `img-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  try {
    // Resize image if requested (from huge image dialog)
    let imageFile = file;
    if (resizeOptions) {
      imageFile = await resizeImage(file, resizeOptions.width, resizeOptions.height);
    }

    // Extract dimensions from the FINAL image (after resize if applicable)
    // This ensures the filename reflects the actual saved dimensions
    const dimensions = await getImageDimensions(imageFile);
    const finalDimensions: ImageDimensions = dimensions || { width: 0, height: 0 };

    // Convert to base64 for immediate preview
    const base64 = await fileToBase64(imageFile);

    const safePos = resolveImageInsertPosition(editor, pos);

    // Insert image with base64 preview
    editor
      .chain()
      .focus()
      .insertContentAt(safePos, {
        type: 'image',
        attrs: {
          src: base64,
          alt: file.name.replace(/\.[^.]+$/, ''),
          'data-placeholder-id': placeholderId,
        },
      })
      .run();

    // Track insertion position via plugin state so concurrent edits don't
    // invalidate the position (replaces DOM-scraping in updateImageSrc).
    addUploadTracking(editor, placeholderId);

    // Add to pending saves to prevent document sync race condition
    pendingImageSaves.add(placeholderId);
    devLog(`[DK-AI] Added to pending saves. Total pending: ${pendingImageSaves.size}`);

    // Generate filename with source type and dimensions
    const imageName = generateImageName(file.name, source, finalDimensions);

    // Send to extension to save to workspace
    const buffer = await imageFile.arrayBuffer();
    devLog(
      `[DK-AI] Sending saveImage message: placeholderId=${placeholderId}, name=${imageName}, targetFolder=${targetFolder}`
    );

    vscodeApi.postMessage({
      type: MessageType.SAVE_IMAGE,
      placeholderId,
      name: imageName,
      data: Array.from(new Uint8Array(buffer)),
      mimeType: file.type,
      targetFolder, // User-selected folder
    });
  } catch (error) {
    console.error('[DK-AI] Failed to insert image:', error);
  }
}

/**
 * Update image src after save (replace base64 with workspace-relative path).
 * Uses plugin state to find the current position — handles concurrent edits
 * correctly because the plugin maps positions on every transaction.
 */
function updateImageSrc(placeholderId: string, newSrc: string, editor: Editor): void {
  devLog(`[DK-AI] updateImageSrc called: placeholder=${placeholderId}`);

  const pos = getUploadPos(editor, placeholderId);
  if (pos === undefined) {
    console.warn(
      `[DK-AI] updateImageSrc: placeholder ${placeholderId} not in plugin state — may have been deleted`
    );
    return;
  }

  const node = editor.state.doc.nodeAt(pos);
  devLog(`[DK-AI] Node at position ${pos}: ${node?.type.name}`);

  if (node && node.type.name === 'image') {
    editor
      .chain()
      .setNodeSelection(pos)
      .updateAttributes('image', {
        src: newSrc,
        'data-placeholder-id': null,
      })
      .run();
    removeUploadTracking(editor, placeholderId);
    devLog(`[DK-AI] Updated image src to: ${newSrc}`);
  } else {
    console.warn(`[DK-AI] Node at position ${pos} is not an image: ${node?.type.name}`);
    removeUploadTracking(editor, placeholderId);
  }
}

/**
 * Remove image placeholder on error.
 * Uses plugin state position — safe even if the user has typed around the image.
 */
function removeImagePlaceholder(placeholderId: string, editor: Editor): void {
  const pos = getUploadPos(editor, placeholderId);
  if (pos === undefined) {
    devLog(`[DK-AI] removeImagePlaceholder: placeholder ${placeholderId} already gone`);
    return;
  }

  const node = editor.state.doc.nodeAt(pos);
  if (node && node.type.name === 'image') {
    editor
      .chain()
      .focus()
      .deleteRange({ from: pos, to: pos + node.nodeSize })
      .run();
  }
  removeUploadTracking(editor, placeholderId);
}

/**
 * Convert file to base64 data URL for preview
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Image source type for naming context
 */
export type ImageSourceType = 'dropped' | 'pasted';

/**
 * Image dimensions
 */
export interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Parsed image filename components
 */
export interface ParsedImageFilename {
  source: ImageSourceType | null;
  name: string;
  dimensions: ImageDimensions | null;
  extension: string;
}

/**
 * Get image dimensions from a File object
 * Returns dimensions or null if they can't be determined
 */
export function getImageDimensions(file: File): Promise<ImageDimensions | null> {
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
 * Parse an image filename to extract components
 * Pattern: {source}_{name}_{width}x{height}px.{ext}
 * Also handles old format with timestamps for backward compatibility
 */
export function parseImageFilename(filename: string): ParsedImageFilename {
  // Check old pattern WITH timestamp FIRST (more specific)
  // Pattern: (dropped_|pasted_)?(.+?)_(\d{13})_(\d+)x(\d+)px\.(\w+)$
  const oldTimestampPattern = /^(dropped_|pasted_)?(.+?)_\d{13}_(\d+)x(\d+)px\.(\w+)$/;
  const oldTimestampMatch = filename.match(oldTimestampPattern);

  if (oldTimestampMatch) {
    const [, sourcePrefix, name, width, height, extension] = oldTimestampMatch;
    return {
      source: sourcePrefix ? (sourcePrefix.replace('_', '') as ImageSourceType) : null,
      name,
      dimensions: { width: parseInt(width, 10), height: parseInt(height, 10) },
      extension,
    };
  }

  // New pattern (no timestamp): (dropped_|pasted_)?(.+?)_(\d+)x(\d+)px\.(\w+)$
  const newPattern = /^(dropped_|pasted_)?(.+?)_(\d+)x(\d+)px\.(\w+)$/;
  const newMatch = filename.match(newPattern);

  if (newMatch) {
    const [, sourcePrefix, name, width, height, extension] = newMatch;
    return {
      source: sourcePrefix ? (sourcePrefix.replace('_', '') as ImageSourceType) : null,
      name,
      dimensions: { width: parseInt(width, 10), height: parseInt(height, 10) },
      extension,
    };
  }

  // Legacy format: {name}-{timestamp}.{ext}
  const legacyPattern = /^(.+?)-\d{13}\.(\w+)$/;
  const legacyMatch = filename.match(legacyPattern);

  if (legacyMatch) {
    const [, name, extension] = legacyMatch;
    return {
      source: null,
      name,
      dimensions: null,
      extension,
    };
  }

  // Can't parse - return basic info
  const ext = filename.split('.').pop()?.toLowerCase() || 'png';
  const nameWithoutExt = filename.replace(/\.[^.]+$/, '');
  return {
    source: null,
    name: nameWithoutExt,
    dimensions: null,
    extension: ext,
  };
}

/**
 * Generate a safe image filename for saving into the workspace.
 *
 * Rules:
 * - Keep primary filenames clean (no dimensions).
 * - Only add `dropped_` / `pasted_` when the original name is missing or generic.
 * - Generic names use a timestamp (UTC, up to seconds) to reduce collisions.
 *
 * @param originalName - Original filename
 * @param source - How the image was added ('dropped' or 'pasted')
 * @param dimensions - Image dimensions (width x height)
 */
export function generateImageName(
  originalName: string,
  source: ImageSourceType,
  _dimensions: ImageDimensions
): string {
  const trimmedName = (originalName || '').trim();
  const dotIndex = trimmedName.lastIndexOf('.');
  const hasExtension = dotIndex > 0 && dotIndex < trimmedName.length - 1;

  const isExtensionOnly =
    dotIndex === 0 && trimmedName.length > 1 && /^[.][a-zA-Z0-9]+$/.test(trimmedName);

  const rawStem = isExtensionOnly
    ? ''
    : hasExtension
      ? trimmedName.slice(0, dotIndex)
      : trimmedName;
  const rawExt = isExtensionOnly
    ? trimmedName.slice(1)
    : hasExtension
      ? trimmedName.slice(dotIndex + 1)
      : '';
  const extension = rawExt ? rawExt.toLowerCase() : 'png';

  const stem = rawStem
    .replace(/[^a-zA-Z0-9-_]/g, '-') // Replace unsafe chars with hyphen
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-|-$/g, '') // Trim leading/trailing hyphens
    .slice(0, 50); // Limit length

  const safeStem = stem || 'image';

  const genericImageStems = new Set(['image', 'screenshot', 'clipboard-image', 'clipboard_image']);
  const isGeneric = genericImageStems.has(safeStem.toLowerCase());

  const timestamp = (() => {
    const iso = new Date().toISOString(); // e.g. 2025-12-15T12:34:56.000Z
    const yyyymmdd = iso.slice(0, 10).replace(/-/g, '');
    const hhmmss = iso.slice(11, 19).replace(/:/g, '');
    return `${yyyymmdd}-${hhmmss}`;
  })();

  if (isGeneric) {
    return `${source}_${timestamp}.${extension}`;
  }

  return `${safeStem}.${extension}`;
}
