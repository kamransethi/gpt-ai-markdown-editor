/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Image operation handlers for the markdown editor.
 * Extracted from MarkdownEditorProvider for modularity.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { MessageType } from '../../shared/messageTypes';
import { toErrorMessage } from '../../shared/errorUtils';
import { type HandlerContext, type MessageRouter } from '../messageRouter';
import {
  getDocumentDirectory,
  getImageBasePath,
  getImageStorageBasePath,
  resolveMediaTargetFolder,
  isWithinWorkspace,
  getWorkspaceFolderPath,
  isValidRelativePath,
  fileExists,
} from '../utils/pathUtils';
import { normalizeImagePath, buildImageFilenameForUserRename } from '../MarkdownEditorProvider';

/** Register all image-related message handlers with the router. */
export function registerImageHandlers(router: MessageRouter): void {
  router.register(MessageType.RESOLVE_IMAGE_URI, handleResolveImageUri);
  router.register(MessageType.HANDLE_WORKSPACE_IMAGE, handleWorkspaceImage);
  router.register(MessageType.SAVE_IMAGE, handleSaveImage);
  router.register(MessageType.GET_IMAGE_REFERENCES, handleGetImageReferences);
  router.register(MessageType.CHECK_IMAGE_RENAME, handleCheckImageRename);
  router.register(MessageType.RENAME_IMAGE, handleRenameImage);
  router.register(MessageType.CHECK_IMAGE_IN_WORKSPACE, handleCheckImageInWorkspace);
  router.register(MessageType.GET_IMAGE_METADATA, handleGetImageMetadata);
  router.register(MessageType.REVEAL_IMAGE_IN_OS, handleRevealImageInOS);
  router.register(MessageType.REVEAL_IMAGE_IN_EXPLORER, handleRevealImageInExplorer);
  router.register(MessageType.COPY_LOCAL_IMAGE_TO_WORKSPACE, handleCopyLocalImageToWorkspace);
  router.register(MessageType.OPEN_IMAGE_PICKER, handleOpenImagePicker);
}

/**
 * Resolve a relative image path to a webview URI
 *
 * Normalizes URL-encoded paths (e.g. `Hero%20Image.png`) before resolving
 * so that images with spaces or special characters in filenames work correctly.
 */
export function handleResolveImageUri(
  message: { type: string; [key: string]: unknown },
  ctx: HandlerContext
): void {
  const { document, webview } = ctx;
  const rawRelativePath = message.relativePath as string;
  const requestId = message.requestId as string;

  // Normalize the path (decode URL-encoded segments like %20 → space)
  const relativePath = normalizeImagePath(rawRelativePath);

  // Resolve relative to document base path
  const basePath = getImageBasePath(document);
  if (!basePath) {
    webview.postMessage({
      type: MessageType.IMAGE_URI_RESOLVED,
      requestId,
      webviewUri: '',
      relativePath: rawRelativePath,
      error: 'Cannot resolve image path: no base directory available',
    });
    return;
  }
  const absolutePath = path.resolve(basePath, relativePath);
  const fileUri = vscode.Uri.file(absolutePath);

  // Convert to webview URI
  const webviewUri = webview.asWebviewUri(fileUri);

  webview.postMessage({
    type: MessageType.IMAGE_URI_RESOLVED,
    requestId,
    webviewUri: webviewUri.toString(),
    relativePath: rawRelativePath, // Return original path for consistency
  });
}

/**
 * Handle workspace image drop (from VS Code file explorer)
 * Computes relative path from document to the image, or copies image if outside workspace
 */
export async function handleWorkspaceImage(
  message: { type: string; [key: string]: unknown },
  ctx: HandlerContext
): Promise<void> {
  const { document, webview } = ctx;
  const sourcePath = message.sourcePath as string;
  const fileName = message.fileName as string;
  const insertPosition = message.insertPosition as number | undefined;

  console.log(`[DK-AI] Handling workspace image: ${sourcePath}`);

  // Get the document base path
  const basePath = getImageBasePath(document);
  if (!basePath) {
    console.error(`[DK-AI] Cannot compute relative path: no base directory available`);
    return;
  }

  // Normalize paths for comparison
  const normalizedSource = path.normalize(sourcePath);
  const normalizedBase = path.normalize(basePath);

  // Get the workspace folder for strict "within workspace" check
  const workspacePath = getWorkspaceFolderPath(document);
  const withinWorkspace = workspacePath
    ? isWithinWorkspace(normalizedSource, workspacePath)
    : isWithinWorkspace(normalizedSource, normalizedBase);

  // Compute relative path from document base to image
  let relativePath = path.relative(normalizedBase, normalizedSource);

  // Ensure forward slashes for markdown compatibility
  relativePath = relativePath.replace(/\\/g, '/');

  // Validate the relative path
  const isValidPath = isValidRelativePath(relativePath);

  // If path is invalid or image is outside workspace, copy it to workspace
  if (!isValidPath || !withinWorkspace) {
    console.log(`[DK-AI] Image is outside workspace or has invalid path, copying to workspace...`);

    try {
      // Read the source image
      const sourceUri = vscode.Uri.file(normalizedSource);
      const imageData = await vscode.workspace.fs.readFile(sourceUri);

      // Get save location
      const saveBasePath = getImageStorageBasePath(document, ctx.getConfig);
      if (!saveBasePath) {
        const errorMessage = 'Cannot copy image: no base directory available';
        vscode.window.showErrorMessage(errorMessage);
        return;
      }

      const imageFolderName = ctx.getConfig<string>('mediaPath', 'media');
      const imagesDir = path.join(saveBasePath, imageFolderName);

      // Create folder if needed
      await vscode.workspace.fs.createDirectory(vscode.Uri.file(imagesDir));

      // Generate filename from source
      const sourceFilename = path.basename(normalizedSource);
      const parsedName = path.parse(sourceFilename);
      const baseFilename = parsedName.name || 'image';
      const extension = parsedName.ext || '';

      let finalFilename = sourceFilename;
      let targetPath = path.join(imagesDir, finalFilename);
      let targetUri = vscode.Uri.file(targetPath);

      // Handle filename collisions
      if (await fileExists(targetUri)) {
        let foundAvailableName = false;
        for (let suffix = 2; suffix < 1000; suffix += 1) {
          finalFilename = `${baseFilename}-${suffix}${extension}`;
          targetPath = path.join(imagesDir, finalFilename);
          targetUri = vscode.Uri.file(targetPath);
          if (!(await fileExists(targetUri))) {
            foundAvailableName = true;
            break;
          }
        }
        if (!foundAvailableName) {
          throw new Error(
            `Cannot copy image: too many existing files matching "${baseFilename}-N${extension}"`
          );
        }
      }

      // Copy file to workspace
      await vscode.workspace.fs.writeFile(targetUri, imageData);

      // Calculate relative path for markdown
      const markdownDir =
        document.uri.scheme === 'file' ? path.dirname(document.uri.fsPath) : saveBasePath;
      let copiedRelativePath = path.relative(markdownDir, targetPath).replace(/\\/g, '/');
      if (!copiedRelativePath.startsWith('..') && !copiedRelativePath.startsWith('./')) {
        copiedRelativePath = './' + copiedRelativePath;
      }

      console.log(`[DK-AI] Image copied to workspace. Path: ${copiedRelativePath}`);

      // Extract alt text from filename (remove extension)
      const altText = fileName.replace(/\.[^.]+$/, '');

      // Send message to webview to insert the image with relative path
      // Use insertWorkspaceImage message type for consistency
      webview.postMessage({
        type: MessageType.INSERT_WORKSPACE_IMAGE,
        relativePath: copiedRelativePath,
        altText,
        insertPosition,
      });
    } catch (error) {
      const errorMessage = toErrorMessage(error);
      console.error(`[DK-AI] Failed to copy workspace image: ${errorMessage}`);
      vscode.window.showErrorMessage(`Failed to copy image: ${errorMessage}`);
    }
    return;
  }

  // Image is within workspace and path is valid - use relative path directly
  // Add ./ prefix if it doesn't start with .. (going up directories)
  if (!relativePath.startsWith('..') && !relativePath.startsWith('./')) {
    relativePath = './' + relativePath;
  }

  console.log(`[DK-AI] Computed relative path: ${relativePath}`);

  // Extract alt text from filename (remove extension)
  const altText = fileName.replace(/\.[^.]+$/, '');

  // Send the markdown image syntax back to webview
  webview.postMessage({
    type: MessageType.INSERT_WORKSPACE_IMAGE,
    relativePath,
    altText,
    insertPosition,
  });
}

/**
 * Handle image save from webview
 * Saves the image to the workspace and returns the relative path
 */
export async function handleSaveImage(
  message: { type: string; [key: string]: unknown },
  ctx: HandlerContext
): Promise<void> {
  const { document, webview } = ctx;
  const placeholderId = message.placeholderId as string;
  const name = message.name as string;
  const data = message.data as number[];
  const mimeType = message.mimeType as string;

  // Use user-selected folder from confirmation dialog
  const imageFolderName = (message.targetFolder as string) || 'images';

  // Resolve where to save new images (may be doc-relative, workspace-level, or sameNameFolder).
  const imagesDir = resolveMediaTargetFolder(document, imageFolderName, ctx.getConfig);
  if (!imagesDir) {
    const errorMessage = 'Cannot save image: no base directory available';
    vscode.window.showErrorMessage(errorMessage);
    webview.postMessage({
      type: MessageType.IMAGE_ERROR,
      placeholderId,
      error: errorMessage,
    });
    return;
  }

  console.log(`[DK-AI] Saving image "${name}" to folder: ${imagesDir}`);

  try {
    // Create folder if needed
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(imagesDir));

    // Save image (collision-safe: never overwrite silently)
    const parsedName = path.parse(name);
    const baseFilename = parsedName.name || 'image';
    const extension = parsedName.ext || '';

    let finalFilename = name;
    let imagePath = path.join(imagesDir, finalFilename);
    let imageUri = vscode.Uri.file(imagePath);

    if (await fileExists(imageUri)) {
      let foundAvailableName = false;
      for (let suffix = 2; suffix < 1000; suffix += 1) {
        finalFilename = `${baseFilename}-${suffix}${extension}`;
        imagePath = path.join(imagesDir, finalFilename);
        imageUri = vscode.Uri.file(imagePath);
        if (!(await fileExists(imageUri))) {
          foundAvailableName = true;
          break;
        }
      }
      if (!foundAvailableName) {
        throw new Error(
          `Cannot save image: too many existing files matching "${baseFilename}-N${extension}"`
        );
      }
    }

    await vscode.workspace.fs.writeFile(imageUri, new Uint8Array(data));

    // Markdown link should always be relative to the markdown file directory (portable in git).
    const docDir = getDocumentDirectory(document);
    const markdownDir =
      docDir ?? (document.uri.scheme === 'file' ? path.dirname(document.uri.fsPath) : os.homedir());
    let relativePath = path.relative(markdownDir, imagePath).replace(/\\/g, '/');

    if (!relativePath.startsWith('..') && !relativePath.startsWith('./')) {
      relativePath = './' + relativePath;
    }

    console.log(`[DK-AI] Image saved successfully. Path: ${relativePath}`);

    webview.postMessage({
      type: MessageType.IMAGE_SAVED,
      placeholderId,
      newSrc: relativePath, // Use relative path (markdown-friendly)
    });

    // Log success (mimeType used for potential future validation)
    if (mimeType) {
      // Image type validation could be added here
    }
  } catch (error) {
    const errorMessage = toErrorMessage(error);
    vscode.window.showErrorMessage(`Failed to save image: ${errorMessage}`);
    webview.postMessage({
      type: MessageType.IMAGE_ERROR,
      placeholderId,
      error: errorMessage,
    });
  }
}

/**
 * Compute image reference counts across the workspace for UI previews.
 *
 * Returns:
 * - currentFileCount: number of occurrences in the current document
 * - otherFiles: list of other markdown files referencing the same image (with line numbers)
 */
export async function handleGetImageReferences(
  message: { type: string; [key: string]: unknown },
  ctx: HandlerContext
): Promise<void> {
  const { document, webview } = ctx;
  const requestId = message.requestId as string;
  const imagePath = message.imagePath as string;

  try {
    const basePath = getImageBasePath(document);
    if (!basePath) {
      throw new Error('Cannot resolve image base path');
    }

    const normalizedTargetPath = normalizeImagePath(imagePath);
    const absoluteTargetPath = path.resolve(basePath, normalizedTargetPath);
    const normalizedAbsoluteTarget = path.normalize(absoluteTargetPath);

    const fileDir = document.uri.scheme === 'file' ? path.dirname(document.uri.fsPath) : basePath;

    const imageRefRegex = /!\[([^\]]*)\]\(([^)]+)\)|<img[^>]+src=["']([^"']+)["']/g;
    const currentFileMatches: Array<{ line: number; text: string }> = [];
    const lines = document.getText().split('\n');

    lines.forEach((line, index) => {
      imageRefRegex.lastIndex = 0;
      let match;
      while ((match = imageRefRegex.exec(line)) !== null) {
        const ref = match[2] || match[3];
        if (!ref) continue;

        const normalizedRefPath = normalizeImagePath(ref);
        const absoluteRefPath = path.isAbsolute(normalizedRefPath)
          ? normalizedRefPath
          : path.resolve(fileDir, normalizedRefPath);
        if (path.normalize(absoluteRefPath) === normalizedAbsoluteTarget) {
          currentFileMatches.push({ line: index, text: line });
        }
      }
    });

    const allReferences = await findImageReferences(imagePath, basePath);
    const otherFiles =
      document.uri.scheme === 'file'
        ? allReferences.filter(ref => ref.file.fsPath !== document.uri.fsPath)
        : allReferences;

    webview.postMessage({
      type: MessageType.IMAGE_REFERENCES,
      requestId,
      imagePath,
      currentFileCount: currentFileMatches.length,
      otherFiles: otherFiles.map(ref => ({
        fsPath: ref.file.fsPath,
        matches: ref.matches,
      })),
    });
  } catch (error) {
    const errorMessage = toErrorMessage(error);
    console.error(`[DK-AI] Failed to compute image references: ${errorMessage}`);
    webview.postMessage({
      type: MessageType.IMAGE_REFERENCES,
      requestId,
      imagePath,
      currentFileCount: 0,
      otherFiles: [],
      error: errorMessage,
    });
  }
}

/**
 * Find all markdown files that reference an image
 */
export async function findImageReferences(
  oldImagePath: string,
  basePath: string
): Promise<Array<{ file: vscode.Uri; matches: Array<{ line: number; text: string }> }>> {
  // Find all markdown files
  const markdownFiles = await vscode.workspace.findFiles('**/*.md', null, 1000);

  const results: Array<{ file: vscode.Uri; matches: Array<{ line: number; text: string }> }> = [];

  // Normalize the old path for comparison
  const normalizedOldPath = normalizeImagePath(oldImagePath);
  const absoluteOldPath = path.resolve(basePath, normalizedOldPath);

  for (const file of markdownFiles) {
    try {
      const doc = await vscode.workspace.openTextDocument(file);
      const text = doc.getText();
      const lines = text.split('\n');

      // Match markdown image syntax: ![alt](path) and <img src="path">
      const imageRefRegex = /!\[([^\]]*)\]\(([^)]+)\)|<img[^>]+src=["']([^"']+)["']/g;
      const matches: Array<{ line: number; text: string }> = [];

      lines.forEach((line, index) => {
        let match;
        // Reset regex lastIndex for each line
        imageRefRegex.lastIndex = 0;
        while ((match = imageRefRegex.exec(line)) !== null) {
          const imagePath = match[2] || match[3]; // Markdown or HTML syntax
          if (!imagePath) continue;

          // Normalize the path from the markdown file
          const fileDir = path.dirname(file.fsPath);
          const normalizedRefPath = normalizeImagePath(imagePath);
          let absoluteRefPath: string;

          // Handle different path formats
          if (path.isAbsolute(normalizedRefPath)) {
            absoluteRefPath = normalizedRefPath;
          } else if (normalizedRefPath.startsWith('./') || normalizedRefPath.startsWith('../')) {
            absoluteRefPath = path.resolve(fileDir, normalizedRefPath);
          } else {
            // Relative path without ./ prefix
            absoluteRefPath = path.resolve(fileDir, normalizedRefPath);
          }

          // Normalize paths for comparison (handle different separators)
          const normalizedAbsoluteOld = path.normalize(absoluteOldPath);
          const normalizedAbsoluteRef = path.normalize(absoluteRefPath);

          // Check if paths match (same file)
          if (normalizedAbsoluteOld === normalizedAbsoluteRef) {
            matches.push({ line: index, text: line });
          }
        }
      });

      if (matches.length > 0) {
        results.push({ file, matches });
      }
    } catch (error) {
      // Skip files that can't be read
      console.warn(`[DK-AI] Failed to read file ${file.fsPath}: ${error}`);
    }
  }

  return results;
}

/**
 * Update image references in markdown files
 */
export async function updateImageReferences(
  references: Array<{ file: vscode.Uri; matches: Array<{ line: number; text: string }> }>,
  oldFilename: string,
  newFilename: string
): Promise<number> {
  const edit = new vscode.WorkspaceEdit();
  let filesUpdated = 0;

  for (const { file, matches } of references) {
    try {
      const doc = await vscode.workspace.openTextDocument(file);
      const text = doc.getText();
      const lines = text.split('\n');

      // Escape filename for regex
      const escapedOldFilename = oldFilename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Match the filename when preceded by / or ( and followed by ) or " or '
      // This ensures we only replace in path contexts, not random text
      const imagePathRegex = new RegExp(`([(/])${escapedOldFilename}([)"'])`, 'g');

      let updated = false;
      const updatedLines = lines.map((line, index) => {
        // Only update lines that have matches
        if (matches.some(m => m.line === index)) {
          const updatedLine = line.replace(imagePathRegex, `$1${newFilename}$2`);
          if (updatedLine !== line) {
            updated = true;
            return updatedLine;
          }
        }
        return line;
      });

      if (updated) {
        const updatedText = updatedLines.join('\n');
        edit.replace(file, new vscode.Range(0, 0, doc.lineCount, 0), updatedText);
        filesUpdated++;
      }
    } catch (error) {
      console.warn(`[DK-AI] Failed to update file ${file.fsPath}: ${error}`);
    }
  }

  if (filesUpdated > 0) {
    await vscode.workspace.applyEdit(edit);
  }

  return filesUpdated;
}

export async function handleCheckImageRename(
  message: { type: string; [key: string]: unknown },
  ctx: HandlerContext
): Promise<void> {
  const { document, webview } = ctx;
  const requestId = message.requestId as string;
  const oldPath = message.oldPath as string;
  const newName = message.newName as string;

  try {
    const basePath = getImageBasePath(document);
    if (!basePath) {
      throw new Error('Cannot resolve image path: no base directory available');
    }

    const normalizedOldPath = normalizeImagePath(oldPath);
    const absoluteOldPath = path.resolve(basePath, normalizedOldPath);
    const oldUri = vscode.Uri.file(absoluteOldPath);

    // Ensure the source exists
    await vscode.workspace.fs.stat(oldUri);

    const oldExt = path.extname(absoluteOldPath);
    const newFilename = buildImageFilenameForUserRename(newName, oldExt);

    const oldDir = path.dirname(absoluteOldPath);
    const absoluteNewPath = path.join(oldDir, newFilename);
    const newUri = vscode.Uri.file(absoluteNewPath);

    let exists = false;
    try {
      await vscode.workspace.fs.stat(newUri);
      exists = true;
    } catch {
      exists = false;
    }

    const relativeNewPath = path.relative(basePath, absoluteNewPath).replace(/\\/g, '/');
    const normalizedNewPath = relativeNewPath.startsWith('.')
      ? relativeNewPath
      : `./${relativeNewPath}`;

    webview.postMessage({
      type: MessageType.IMAGE_RENAME_CHECK,
      requestId,
      exists,
      newFilename,
      newPath: normalizedNewPath,
    });
  } catch (error) {
    const errorMessage = toErrorMessage(error);
    console.error(`[DK-AI] Failed to check rename target: ${errorMessage}`);
    webview.postMessage({
      type: MessageType.IMAGE_RENAME_CHECK,
      requestId,
      exists: false,
      newFilename: '',
      newPath: '',
      error: errorMessage,
    });
  }
}

/**
 * Handle image rename request from webview
 * Renames the file and updates references in markdown files across workspace
 */
export async function handleRenameImage(
  message: { type: string; [key: string]: unknown },
  ctx: HandlerContext
): Promise<void> {
  const { document, webview } = ctx;
  const oldPath = message.oldPath as string;
  const newName = message.newName as string;
  const updateAllReferences = (message.updateAllReferences as boolean) ?? true;
  const allowOverwrite = (message.allowOverwrite as boolean) ?? false;

  console.log(`[DK-AI] Renaming image: ${oldPath} to ${newName}`);

  try {
    // Resolve the old path
    const basePath = getImageBasePath(document);
    if (!basePath) {
      throw new Error('Cannot resolve image path: no base directory available');
    }

    const normalizedOldPath = normalizeImagePath(oldPath);
    const absoluteOldPath = path.resolve(basePath, normalizedOldPath);
    const oldUri = vscode.Uri.file(absoluteOldPath);

    // Check if old file exists
    try {
      await vscode.workspace.fs.stat(oldUri);
    } catch {
      throw new Error(`Image not found: ${oldPath}`);
    }

    // Get old filename (used for reference updates)
    const oldFilename = path.basename(absoluteOldPath);

    // Build new filename for manual rename:
    // - Respect the user's chosen name (no auto-dimensions, no auto prefix)
    const oldExt = path.extname(absoluteOldPath);
    const newFilename = buildImageFilenameForUserRename(newName, oldExt);

    const oldDir = path.dirname(absoluteOldPath);
    const absoluteNewPath = path.join(oldDir, newFilename);
    const newUri = vscode.Uri.file(absoluteNewPath);

    // Check if new file already exists
    let targetExists = false;
    try {
      await vscode.workspace.fs.stat(newUri);
      targetExists = true;
    } catch {
      targetExists = false;
    }

    if (targetExists && !allowOverwrite) {
      throw new Error(`File already exists: ${newFilename}`);
    }

    // Find all references if updating all files
    let references: Array<{ file: vscode.Uri; matches: Array<{ line: number; text: string }> }> =
      [];
    if (updateAllReferences) {
      references = await findImageReferences(oldPath, basePath);
    }

    if (targetExists && allowOverwrite) {
      try {
        await vscode.workspace.fs.delete(newUri, { useTrash: true });
      } catch (error) {
        console.warn(`[DK-AI] Could not move existing file to trash, deleting directly: ${error}`);
        await vscode.workspace.fs.delete(newUri);
      }
    }

    // Rename the file
    await vscode.workspace.fs.rename(oldUri, newUri);
    console.log(`[DK-AI] File renamed to: ${newFilename}`);

    // Calculate new relative path for markdown
    const newRelativePath = path.relative(basePath, absoluteNewPath).replace(/\\/g, '/');
    const normalizedNewPath = newRelativePath.startsWith('.')
      ? newRelativePath
      : `./${newRelativePath}`;

    // Update references
    let filesUpdated = 0;
    if (updateAllReferences && references.length > 0) {
      filesUpdated = await updateImageReferences(references, oldFilename, newFilename);
    } else {
      // Update only current document
      const docText = document.getText();
      const escapedOldFilename = oldFilename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const imagePathRegex = new RegExp(`([(/])${escapedOldFilename}([)"'])`, 'g');
      const updatedText = docText.replace(imagePathRegex, `$1${newFilename}$2`);

      if (updatedText !== docText) {
        const edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), updatedText);
        await vscode.workspace.applyEdit(edit);
        filesUpdated = 1;
      }
    }

    // Notify webview of success
    webview.postMessage({
      type: MessageType.IMAGE_RENAMED,
      success: true,
      oldPath,
      newPath: normalizedNewPath,
      filesUpdated,
    });

    if (filesUpdated > 1) {
      vscode.window.showInformationMessage(
        `Image renamed to ${newFilename} (updated ${filesUpdated} files)`
      );
    } else {
      vscode.window.showInformationMessage(`Image renamed to ${newFilename}`);
    }
  } catch (error) {
    const errorMessage = toErrorMessage(error);
    console.error(`[DK-AI] Failed to rename image: ${errorMessage}`);
    vscode.window.showErrorMessage(`Failed to rename image: ${errorMessage}`);
    webview.postMessage({
      type: MessageType.IMAGE_RENAMED,
      success: false,
      error: errorMessage,
    });
  }
}

/**
 * Check if image is in workspace
 */
export async function handleCheckImageInWorkspace(
  message: { type: string; [key: string]: unknown },
  ctx: HandlerContext
): Promise<void> {
  const { document, webview } = ctx;
  const imagePath = message.imagePath as string;
  const requestId = message.requestId as string;

  try {
    // Resolve image path relative to document base path
    const basePath = getImageBasePath(document);
    if (!basePath) {
      webview.postMessage({
        type: MessageType.IMAGE_WORKSPACE_CHECK,
        requestId,
        inWorkspace: false,
        absolutePath: undefined,
      });
      return;
    }
    const normalizedPath = normalizeImagePath(imagePath);
    const absolutePath = path.resolve(basePath, normalizedPath);

    // Check if file exists
    const imageUri = vscode.Uri.file(absolutePath);
    let fileExists = false;
    try {
      await vscode.workspace.fs.stat(imageUri);
      fileExists = true;
    } catch {
      fileExists = false;
    }

    // Check if path is within workspace
    // For untitled files, getWorkspaceFolder may not work, so check workspaceFolders first
    let workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (
      !workspaceFolder &&
      document.uri.scheme === 'untitled' &&
      vscode.workspace.workspaceFolders &&
      vscode.workspace.workspaceFolders.length > 0
    ) {
      workspaceFolder = vscode.workspace.workspaceFolders[0];
    }

    let inWorkspace = false;

    if (workspaceFolder && fileExists) {
      const workspacePath = workspaceFolder.uri.fsPath;
      // Check if absolute path is within workspace
      inWorkspace =
        absolutePath.startsWith(workspacePath + path.sep) || absolutePath === workspacePath;
    }

    webview.postMessage({
      type: MessageType.IMAGE_WORKSPACE_CHECK,
      requestId,
      inWorkspace,
      absolutePath: fileExists ? absolutePath : undefined,
    });
  } catch (error) {
    const errorMessage = toErrorMessage(error);
    console.error(`[DK-AI] Failed to check image in workspace: ${errorMessage}`);
    webview.postMessage({
      type: MessageType.IMAGE_WORKSPACE_CHECK,
      requestId,
      inWorkspace: false,
      absolutePath: undefined,
    });
  }
}

/**
 * Get image metadata (file size, dimensions, last modified, etc.)
 */
export async function handleGetImageMetadata(
  message: { type: string; [key: string]: unknown },
  ctx: HandlerContext
): Promise<void> {
  const { document, webview } = ctx;
  const imagePath = message.imagePath as string;
  const requestId = message.requestId as string;

  try {
    // Resolve image path relative to document base path
    const basePath = getImageBasePath(document);
    if (!basePath) {
      webview.postMessage({
        type: MessageType.IMAGE_METADATA,
        requestId,
        metadata: null,
      });
      return;
    }

    const normalizedPath = normalizeImagePath(imagePath);
    const absolutePath = path.resolve(basePath, normalizedPath);
    const imageUri = vscode.Uri.file(absolutePath);

    // Check if file exists
    let fileStat: vscode.FileStat;
    try {
      fileStat = await vscode.workspace.fs.stat(imageUri);
    } catch {
      webview.postMessage({
        type: MessageType.IMAGE_METADATA,
        requestId,
        metadata: null,
      });
      return;
    }

    // Get image dimensions (requires reading the file)
    // For now, we'll use file size and last modified
    // Dimensions would require image decoding which is expensive
    // We can get dimensions from the img element in the webview instead
    const filename = path.basename(absolutePath);
    const relativePath = path.relative(basePath, absolutePath).replace(/\\/g, '/');
    const normalizedRelativePath = relativePath.startsWith('.')
      ? relativePath
      : `./${relativePath}`;

    webview.postMessage({
      type: MessageType.IMAGE_METADATA,
      requestId,
      metadata: {
        filename,
        size: fileStat.size,
        dimensions: { width: 0, height: 0 }, // Will be filled by webview from img element
        lastModified: fileStat.mtime,
        path: normalizedRelativePath,
      },
    });
  } catch (error) {
    const errorMessage = toErrorMessage(error);
    console.error(`[DK-AI] Failed to get image metadata: ${errorMessage}`);
    webview.postMessage({
      type: MessageType.IMAGE_METADATA,
      requestId,
      metadata: null,
    });
  }
}

/**
 * Handle reveal image in OS file manager (Finder/Explorer)
 */
export async function handleRevealImageInOS(
  message: { type: string; [key: string]: unknown },
  ctx: HandlerContext
): Promise<void> {
  const { document } = ctx;
  const imagePath = message.imagePath as string;

  try {
    // Check if image is external (http/https/data URI)
    if (
      imagePath.startsWith('http://') ||
      imagePath.startsWith('https://') ||
      imagePath.startsWith('data:')
    ) {
      vscode.window.showErrorMessage('Cannot reveal external images in file manager');
      return;
    }

    // Resolve image path relative to document base path
    const basePath = getImageBasePath(document);
    if (!basePath) {
      vscode.window.showErrorMessage('Cannot reveal image: no base directory available');
      return;
    }

    const normalizedPath = normalizeImagePath(imagePath);
    const absolutePath = path.resolve(basePath, normalizedPath);
    const fileUri = vscode.Uri.file(absolutePath);

    // Check if file exists
    try {
      await vscode.workspace.fs.stat(fileUri);
    } catch {
      vscode.window.showErrorMessage(`Image not found: ${imagePath}`);
      return;
    }

    // Reveal file in OS file manager
    await vscode.commands.executeCommand('revealFileInOS', fileUri);
  } catch (error) {
    const errorMessage = toErrorMessage(error);
    console.error(`[DK-AI] Failed to reveal image in OS: ${errorMessage}`);
    vscode.window.showErrorMessage(`Failed to reveal image: ${errorMessage}`);
  }
}

/**
 * Handle reveal image in VS Code Explorer
 */
export async function handleRevealImageInExplorer(
  message: { type: string; [key: string]: unknown },
  ctx: HandlerContext
): Promise<void> {
  const { document } = ctx;
  const imagePath = message.imagePath as string;

  try {
    // Check if image is external (http/https/data URI)
    if (
      imagePath.startsWith('http://') ||
      imagePath.startsWith('https://') ||
      imagePath.startsWith('data:')
    ) {
      vscode.window.showErrorMessage('Cannot reveal external images in Explorer');
      return;
    }

    // Resolve image path relative to document base path
    const basePath = getImageBasePath(document);
    if (!basePath) {
      vscode.window.showErrorMessage('Cannot reveal image: no base directory available');
      return;
    }

    const normalizedPath = normalizeImagePath(imagePath);
    const absolutePath = path.resolve(basePath, normalizedPath);
    const fileUri = vscode.Uri.file(absolutePath);

    // Check if file exists
    try {
      await vscode.workspace.fs.stat(fileUri);
    } catch {
      vscode.window.showErrorMessage(`Image not found: ${imagePath}`);
      return;
    }

    // Reveal file in VS Code Explorer
    await vscode.commands.executeCommand('revealInExplorer', fileUri);
  } catch (error) {
    const errorMessage = toErrorMessage(error);
    console.error(`[DK-AI] Failed to reveal image in Explorer: ${errorMessage}`);
    vscode.window.showErrorMessage(`Failed to reveal image: ${errorMessage}`);
  }
}

/**
 * Copy local image (outside workspace) to workspace
 */
export async function handleCopyLocalImageToWorkspace(
  message: { type: string; [key: string]: unknown },
  ctx: HandlerContext
): Promise<void> {
  const { document, webview } = ctx;
  const absolutePath = message.absolutePath as string;
  const placeholderId = message.placeholderId as string;
  const targetFolder = (message.targetFolder as string) || 'images';

  console.log(`[DK-AI] Copying local image to workspace: ${absolutePath}`);

  try {
    // Read the source image
    const sourceUri = vscode.Uri.file(absolutePath);
    const imageData = await vscode.workspace.fs.readFile(sourceUri);

    const saveBasePath = getImageStorageBasePath(document, ctx.getConfig);
    if (!saveBasePath) {
      const errorMessage = 'Cannot copy image: no base directory available';
      vscode.window.showErrorMessage(errorMessage);
      webview.postMessage({
        type: MessageType.LOCAL_IMAGE_COPY_ERROR,
        placeholderId,
        error: errorMessage,
      });
      return;
    }
    const imagesDir = path.join(saveBasePath, targetFolder);

    // Create folder if needed
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(imagesDir));

    // Generate filename from source
    const sourceFilename = path.basename(absolutePath);
    const parsedName = path.parse(sourceFilename);
    const baseFilename = parsedName.name || 'image';
    const extension = parsedName.ext || '';

    let finalFilename = sourceFilename;
    let targetPath = path.join(imagesDir, finalFilename);
    let targetUri = vscode.Uri.file(targetPath);

    if (await fileExists(targetUri)) {
      let foundAvailableName = false;
      for (let suffix = 2; suffix < 1000; suffix += 1) {
        finalFilename = `${baseFilename}-${suffix}${extension}`;
        targetPath = path.join(imagesDir, finalFilename);
        targetUri = vscode.Uri.file(targetPath);
        if (!(await fileExists(targetUri))) {
          foundAvailableName = true;
          break;
        }
      }
      if (!foundAvailableName) {
        throw new Error(
          `Cannot copy image: too many existing files matching "${baseFilename}-N${extension}"`
        );
      }
    }

    // Copy file to workspace
    await vscode.workspace.fs.writeFile(targetUri, imageData);

    // Calculate relative path for markdown
    const markdownDir =
      document.uri.scheme === 'file' ? path.dirname(document.uri.fsPath) : saveBasePath;
    let relativePath = path.relative(markdownDir, targetPath).replace(/\\/g, '/');
    if (!relativePath.startsWith('..') && !relativePath.startsWith('./')) {
      relativePath = './' + relativePath;
    }

    console.log(`[DK-AI] Local image copied successfully. Path: ${relativePath}`);

    webview.postMessage({
      type: MessageType.LOCAL_IMAGE_COPIED,
      placeholderId,
      relativePath,
      originalPath: absolutePath, // For finding the image node
    });
  } catch (error) {
    const errorMessage = toErrorMessage(error);
    console.error(`[DK-AI] Failed to copy local image: ${errorMessage}`);
    vscode.window.showErrorMessage(`Failed to copy image: ${errorMessage}`);
    webview.postMessage({
      type: MessageType.LOCAL_IMAGE_COPY_ERROR,
      placeholderId,
      error: errorMessage,
    });
  }
}
/**
 * Open native VS Code file picker to select images.
 * Delegates to handleWorkspaceImage for each selected file to determine
 * if it should be linked (if in workspace) or copied (if outside).
 */
export async function handleOpenImagePicker(
  message: { type: string; [key: string]: unknown },
  ctx: HandlerContext
): Promise<void> {
  const options: vscode.OpenDialogOptions = {
    canSelectMany: true,
    openLabel: 'Insert Images',
    filters: {
      Images: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'],
    },
  };

  const fileUris = await vscode.window.showOpenDialog(options);
  if (!fileUris || fileUris.length === 0) {
    return;
  }

  for (const uri of fileUris) {
    // Use the existing logic to decide between linking or copying
    await handleWorkspaceImage(
      {
        type: MessageType.HANDLE_WORKSPACE_IMAGE,
        sourcePath: uri.fsPath,
        fileName: path.basename(uri.fsPath),
        insertPosition: message.insertPosition as number | undefined,
      },
      ctx
    );
  }
}
