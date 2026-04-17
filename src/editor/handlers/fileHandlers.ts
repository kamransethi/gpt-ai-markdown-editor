/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * File and navigation handlers for the markdown editor.
 * Extracted from MarkdownEditorProvider for modularity.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { MessageType } from '../../shared/messageTypes';
import { toErrorMessage } from '../../shared/errorUtils';
import { type HandlerContext, type MessageRouter } from '../messageRouter';
import {
  getRelativePath,
  formatFileLinkLabel,
  isWithinWorkspace,
  resolveMediaTargetFolder,
  createUniqueTargetFile,
} from '../utils/pathUtils';

/** Register all file/navigation message handlers with the router. */
export function registerFileHandlers(router: MessageRouter): void {
  router.register(MessageType.OPEN_FILE_AT_LOCATION, handleOpenFileAtLocation);
  router.register(MessageType.SEARCH_FILES, handleSearchFiles);
  router.register(MessageType.GET_FILE_HEADINGS, handleGetFileHeadings);
  router.register(MessageType.OPEN_EXTERNAL_LINK, handleOpenExternalLink);
  router.register(MessageType.OPEN_IMAGE, handleOpenImage);
  router.register(MessageType.OPEN_FILE_LINK, handleOpenFileLink);
  router.register(MessageType.BROWSE_LOCAL_FILE, handleBrowseLocalFile);
  router.register(MessageType.HANDLE_FILE_LINK_DROP, handleFileLinkDrop);
  router.register(MessageType.GET_MARKDOWN_FILES, handleGetMarkdownFiles);
  router.register(MessageType.SAVE_AND_OPEN_FILE, handleSaveAndOpenFile);
  router.register(MessageType.SAVE_FILES, handleSaveFiles);
  router.register(MessageType.OPEN_DRAWIO_FILE, handleOpenDrawioFile);
}

export async function handleOpenFileAtLocation(
  message: { type: string; [key: string]: unknown },
  _ctx: HandlerContext
): Promise<void> {
  const fsPath = message.fsPath as string;
  const line = message.line as number | undefined;
  const openToSide = (message.openToSide as boolean) ?? false;

  try {
    if (!fsPath) {
      throw new Error('Missing fsPath');
    }

    const uri = vscode.Uri.file(fsPath);
    const doc = await vscode.workspace.openTextDocument(uri);

    const zeroBasedLine = typeof line === 'number' && line > 0 ? line - 1 : 0;
    const position = new vscode.Position(zeroBasedLine, 0);
    const selection = new vscode.Range(position, position);

    await vscode.window.showTextDocument(doc, {
      viewColumn: openToSide ? vscode.ViewColumn.Beside : vscode.ViewColumn.Active,
      selection,
      preserveFocus: false,
    });
  } catch (error) {
    const errorMessage = toErrorMessage(error);
    console.error(`[DK-AI] Failed to open file: ${errorMessage}`);
    vscode.window.showErrorMessage(`Failed to open file: ${errorMessage}`);
  }
}

/**
 * Handle file search request from webview
 */
export async function handleSearchFiles(
  message: { type: string; [key: string]: unknown },
  ctx: HandlerContext
): Promise<void> {
  const { webview, document } = ctx;
  try {
    const query = (message.query as string) || '';
    const requestId = (message.requestId as number) || 0;

    console.log('[DK-AI] File search request:', { query, requestId });

    if (!query || query.trim().length < 1) {
      console.log('[DK-AI] Empty query, returning empty results');
      webview.postMessage({
        type: MessageType.FILE_SEARCH_RESULTS,
        results: [],
        requestId,
      });
      return;
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      console.warn('[DK-AI] No workspace folders found');
      webview.postMessage({
        type: MessageType.FILE_SEARCH_RESULTS,
        results: [],
        requestId,
      });
      return;
    }

    // More permissive exclude pattern - only exclude truly unnecessary directories
    const excludePattern =
      '{**/node_modules/**,**/.git/**,**/.vscode/**,**/dist/**,**/build/**,**/.next/**,**/coverage/**}';
    console.log('[DK-AI] Searching files with pattern:', excludePattern);

    // Increase max results to ensure we have enough files to search through
    const allFiles = await vscode.workspace.findFiles('**/*', excludePattern, 10000);
    console.log('[DK-AI] Found', allFiles.length, 'files total');

    const filteredFiles = allFiles;

    const queryLower = query.toLowerCase().trim();
    const queryParts = queryLower.split(/\s+/).filter((p: string) => p.length > 0);

    // Enhanced matching: search by filename, path, and individual query parts
    const matchingFiles = filteredFiles.filter(uri => {
      const filename = path.basename(uri.fsPath);
      const filenameLower = filename.toLowerCase();
      const relativePath = getRelativePath(uri, workspaceFolders[0].uri);
      const pathLower = relativePath.toLowerCase();

      // Primary match: filename contains query
      if (filenameLower.includes(queryLower)) {
        return true;
      }

      // Secondary match: path contains query
      if (pathLower.includes(queryLower)) {
        return true;
      }

      // Tertiary match: all query parts appear in filename or path
      if (queryParts.length > 1) {
        const allPartsMatch = queryParts.every(
          (part: string) => filenameLower.includes(part) || pathLower.includes(part)
        );
        if (allPartsMatch) {
          return true;
        }
      }

      // Match filename without extension
      const filenameWithoutExt = path.parse(filename).name.toLowerCase();
      if (filenameWithoutExt.includes(queryLower)) {
        return true;
      }

      return false;
    });

    console.log('[DK-AI] Found', matchingFiles.length, 'matching files');

    // Sort results: exact filename matches first, then path matches, then partial matches
    const sortedFiles = matchingFiles.sort((a, b) => {
      const aFilename = path.basename(a.fsPath).toLowerCase();
      const bFilename = path.basename(b.fsPath).toLowerCase();
      const aPath = getRelativePath(a, workspaceFolders[0].uri).toLowerCase();
      const bPath = getRelativePath(b, workspaceFolders[0].uri).toLowerCase();

      // Exact filename match gets highest priority
      const aExactMatch = aFilename === queryLower;
      const bExactMatch = bFilename === queryLower;
      if (aExactMatch && !bExactMatch) return -1;
      if (!aExactMatch && bExactMatch) return 1;

      // Filename starts with query gets second priority
      const aStartsWith = aFilename.startsWith(queryLower);
      const bStartsWith = bFilename.startsWith(queryLower);
      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;

      // Filename contains query gets third priority
      const aFilenameContains = aFilename.includes(queryLower);
      const bFilenameContains = bFilename.includes(queryLower);
      if (aFilenameContains && !bFilenameContains) return -1;
      if (!aFilenameContains && bFilenameContains) return 1;

      // Path contains query gets fourth priority
      const aPathContains = aPath.includes(queryLower);
      const bPathContains = bPath.includes(queryLower);
      if (aPathContains && !bPathContains) return -1;
      if (!aPathContains && bPathContains) return 1;

      // Alphabetical by filename
      return aFilename.localeCompare(bFilename);
    });

    const results = sortedFiles.slice(0, 20).map(uri => {
      const filename = path.basename(uri.fsPath);
      // Compute path relative to the current document's directory so markdown
      // links work correctly (e.g. `./sibling.md` instead of `dir/sibling.md`
      // from workspace root).
      const docDir = path.dirname(document.uri.fsPath);
      let relativePath = path.relative(docDir, uri.fsPath).replace(/\\/g, '/');
      // Fallback: if path.relative produced an empty string (same file), use filename
      if (!relativePath) {
        relativePath = filename;
      }
      return {
        filename,
        path: relativePath,
      };
    });

    console.log('[DK-AI] Sending', results.length, 'results to webview');
    webview.postMessage({
      type: MessageType.FILE_SEARCH_RESULTS,
      results,
      requestId,
    });
  } catch (error) {
    console.error('[DK-AI] Error searching files:', error);
    const requestId = (message.requestId as number) || 0;
    webview.postMessage({
      type: MessageType.FILE_SEARCH_RESULTS,
      results: [],
      requestId,
      error: 'Failed to search files',
    });
  }
}

/**
 * Extract headings from a markdown file for cross-file heading linking.
 * Uses regex-based extraction since TipTap is not available on the extension side.
 */
export async function handleGetFileHeadings(
  message: { type: string; [key: string]: unknown },
  ctx: HandlerContext
): Promise<void> {
  const { document, webview } = ctx;
  try {
    const filePath = message.filePath as string;
    const requestId = (message.requestId as number) || 0;

    if (!filePath) {
      webview.postMessage({ type: MessageType.FILE_HEADINGS_RESULT, headings: [], requestId });
      return;
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      webview.postMessage({ type: MessageType.FILE_HEADINGS_RESULT, headings: [], requestId });
      return;
    }

    // Resolve the file path relative to the current document's directory
    const docDir = path.dirname(document.uri.fsPath);
    let resolvedPath: string;

    if (path.isAbsolute(filePath)) {
      resolvedPath = filePath;
    } else {
      // Try document-relative first
      const docRelative = path.resolve(docDir, filePath);
      const workspaceRelative = path.resolve(workspaceFolders[0].uri.fsPath, filePath);

      const fs = await import('fs');
      if (fs.existsSync(docRelative)) {
        resolvedPath = docRelative;
      } else if (fs.existsSync(workspaceRelative)) {
        resolvedPath = workspaceRelative;
      } else {
        webview.postMessage({ type: MessageType.FILE_HEADINGS_RESULT, headings: [], requestId });
        return;
      }
    }

    const fileUri = vscode.Uri.file(resolvedPath);
    const fileContent = await vscode.workspace.fs.readFile(fileUri);
    const text = Buffer.from(fileContent).toString('utf-8');

    // Extract headings using regex (ATX-style headings: # Heading)
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const headings: Array<{ text: string; level: number; slug: string }> = [];
    const existingSlugs = new Set<string>();
    let match: RegExpExecArray | null;

    while ((match = headingRegex.exec(text)) !== null) {
      const level = match[1].length;
      const headingText = match[2].replace(/\s*#+\s*$/, '').trim(); // Remove trailing # markers

      // Generate GFM slug with duplicate handling
      const slug = headingText
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

      let finalSlug = slug;
      let counter = 1;
      while (existingSlugs.has(finalSlug)) {
        finalSlug = `${slug}-${counter}`;
        counter++;
      }
      existingSlugs.add(finalSlug);

      headings.push({ text: headingText, level, slug: finalSlug });
    }

    webview.postMessage({ type: MessageType.FILE_HEADINGS_RESULT, headings, requestId });
  } catch (error) {
    console.error('[DK-AI] Error extracting file headings:', error);
    const requestId = (message.requestId as number) || 0;
    webview.postMessage({ type: MessageType.FILE_HEADINGS_RESULT, headings: [], requestId });
  }
}

/**
 * Handle external link navigation (open in browser)
 */
export async function handleOpenExternalLink(
  message: { type: string; [key: string]: unknown },
  _ctx: HandlerContext
): Promise<void> {
  try {
    const url = (message.url as string) || '';
    console.log('[DK-AI] handleOpenExternalLink called with URL:', url);

    if (!url) {
      console.warn('[DK-AI] No URL provided for external link');
      return;
    }

    // Validate URL format
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('mailto:')) {
      console.warn('[DK-AI] Invalid external URL format:', url);
      return;
    }

    console.log('[DK-AI] Opening external link:', url);
    await vscode.env.openExternal(vscode.Uri.parse(url));
    console.log('[DK-AI] Successfully opened external link');
  } catch (error) {
    const errorMessage = toErrorMessage(error);
    console.error('[DK-AI] Failed to open external link:', errorMessage, error);
    vscode.window.showErrorMessage(`Failed to open link: ${errorMessage}`);
  }
}

/**
 * Handle image link navigation (open image in VS Code preview)
 */
export async function handleOpenImage(
  message: { type: string; [key: string]: unknown },
  ctx: HandlerContext
): Promise<void> {
  const { document } = ctx;
  const imagePath = String(message.path || '');
  if (!imagePath) {
    console.warn('[DK-AI] No image path provided');
    return;
  }

  console.log('[DK-AI] handleOpenImage called with path:', imagePath);

  // Normalize path: remove ./ prefix if present for path resolution
  const normalizedPath = imagePath.startsWith('./') ? imagePath.slice(2) : imagePath;

  // Try document-relative first
  let baseDir: string | undefined;
  if (document.uri.scheme === 'file') {
    baseDir = path.dirname(document.uri.fsPath);
  } else {
    baseDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }

  if (!baseDir) {
    console.error('[DK-AI] Cannot resolve image path: no base directory');
    vscode.window.showWarningMessage('Cannot resolve image path');
    return;
  }

  let imageFullPath = path.resolve(baseDir, normalizedPath);
  let imageUri = vscode.Uri.file(imageFullPath);
  console.log('[DK-AI] Trying document-relative path:', imageFullPath);

  // Check if file exists at document-relative path
  let fileExists = false;
  try {
    await vscode.workspace.fs.stat(imageUri);
    fileExists = true;
    console.log('[DK-AI] Image found at document-relative path');
  } catch {
    console.log('[DK-AI] Image not found at document-relative path, trying workspace root');

    // Fallback: try workspace root
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      const workspacePath = workspaceFolder.uri.fsPath;
      imageFullPath = path.resolve(workspacePath, normalizedPath);
      imageUri = vscode.Uri.file(imageFullPath);
      console.log('[DK-AI] Trying workspace-relative path:', imageFullPath);

      try {
        await vscode.workspace.fs.stat(imageUri);
        fileExists = true;
        console.log('[DK-AI] Image found at workspace-relative path');
      } catch {
        console.log('[DK-AI] Image not found at workspace-relative path either');
      }
    }
  }

  if (!fileExists) {
    const errorMsg = `Image not found: ${imagePath}`;
    console.error('[DK-AI]', errorMsg);
    vscode.window.showErrorMessage(errorMsg);
    return;
  }

  try {
    console.log('[DK-AI] Opening image:', imageUri.fsPath);
    await vscode.commands.executeCommand('vscode.open', imageUri);
    console.log('[DK-AI] Successfully opened image');
  } catch (err) {
    const errorMessage = toErrorMessage(err);
    console.error('[DK-AI] Failed to open image:', errorMessage, err);
    vscode.window.showErrorMessage(`Failed to open image: ${errorMessage}`);
  }
}

/**
 * Handle file link navigation (open file in VS Code)
 */
export async function handleOpenFileLink(
  message: { type: string; [key: string]: unknown },
  ctx: HandlerContext
): Promise<void> {
  const { document } = ctx;
  try {
    const filePath = (message.path as string) || '';
    console.log('[DK-AI] handleOpenFileLink called with path:', filePath);

    if (!filePath) {
      console.warn('[DK-AI] No path provided for file link');
      return;
    }

    // Resolve relative path from current document
    const basePath = path.dirname(document.uri.fsPath);

    // Normalize path: remove ./ prefix if present for path resolution
    const normalizedFilePath = filePath.startsWith('./') ? filePath.slice(2) : filePath;
    const absolutePath = path.resolve(basePath, normalizedFilePath);
    let fileUri = vscode.Uri.file(absolutePath);
    console.log('[DK-AI] Resolved file URI (document-relative):', fileUri.fsPath);

    // Check if file exists
    let fileExists = false;
    try {
      await vscode.workspace.fs.stat(fileUri);
      fileExists = true;
      console.log('[DK-AI] File exists (document-relative):', fileUri.fsPath);
    } catch {
      // File doesn't exist, try to find it in workspace
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (workspaceFolders && workspaceFolders.length > 0) {
        // Try relative to workspace root
        const workspacePath = workspaceFolders[0].uri.fsPath;
        // Use normalized path (already normalized above)
        const workspaceFileUri = vscode.Uri.file(path.resolve(workspacePath, normalizedFilePath));
        console.log('[DK-AI] Trying workspace-relative path:', workspaceFileUri.fsPath);
        try {
          await vscode.workspace.fs.stat(workspaceFileUri);
          fileUri = workspaceFileUri;
          fileExists = true;
          console.log('[DK-AI] File exists (workspace-relative):', fileUri.fsPath);
        } catch {
          // Not found in workspace either
          console.log('[DK-AI] File not found in workspace-relative path');
        }
      }
    }

    if (!fileExists) {
      // File not found, show error
      vscode.window.showWarningMessage(`File not found: ${filePath}`);
      console.warn('[DK-AI] File not found:', filePath);
      return;
    }

    // Check if file is an image
    const imageExtensions = [
      '.png',
      '.jpg',
      '.jpeg',
      '.gif',
      '.svg',
      '.webp',
      '.bmp',
      '.ico',
      '.tiff',
      '.tif',
    ];
    const fileExtension = path.extname(fileUri.fsPath).toLowerCase();
    const isImage = imageExtensions.includes(fileExtension);
    console.log('[DK-AI] File extension:', fileExtension, '| Is image:', isImage);

    if (isImage) {
      // For image files, use vscode.open command directly
      // This automatically opens images in VS Code's image preview
      console.log('[DK-AI] Attempting to open image file with vscode.open command');
      try {
        await vscode.commands.executeCommand('vscode.open', fileUri);
        console.log('[DK-AI] Successfully opened image file:', fileUri.fsPath);
      } catch (error) {
        const errorMessage = toErrorMessage(error);
        console.error('[DK-AI] Failed to open image file:', errorMessage, error);
        vscode.window.showErrorMessage(`Failed to open image file: ${errorMessage}`);
      }
    } else {
      // For text files, use openTextDocument (or custom editor for .md files)
      console.log('[DK-AI] Attempting to open text file with openTextDocument');
      try {
        if (fileExtension === '.md') {
          // Open .md files in the WYSIWYG markdown editor instead of the default text editor
          await vscode.commands.executeCommand(
            'vscode.openWith',
            fileUri,
            'gptAiMarkdownEditor.editor'
          );
          console.log('[DK-AI] Successfully opened .md file in WYSIWYG editor:', fileUri.fsPath);
        } else {
          const doc = await vscode.workspace.openTextDocument(fileUri);
          await vscode.window.showTextDocument(doc);
          console.log('[DK-AI] Successfully opened file link:', fileUri.fsPath);
        }
      } catch (error) {
        // If it's not a text file, try vscode.open command as fallback
        const errorMessage = toErrorMessage(error);
        console.log('[DK-AI] openTextDocument failed, error:', errorMessage);
        if (errorMessage.includes('Binary') || errorMessage.includes('binary')) {
          console.log('[DK-AI] File is binary, trying vscode.open command as fallback');
          try {
            await vscode.commands.executeCommand('vscode.open', fileUri);
            console.log('[DK-AI] Opened binary file using vscode.open command');
          } catch (fallbackError) {
            console.error('[DK-AI] Failed to open file:', fallbackError);
            vscode.window.showErrorMessage(`Failed to open file: ${errorMessage}`);
          }
        } else {
          throw error;
        }
      }
    }
  } catch (error) {
    const errorMessage = toErrorMessage(error);
    console.error('[DK-AI] Failed to open file link:', errorMessage, error);
    vscode.window.showErrorMessage(`Failed to open file: ${errorMessage}`);
  }
}

/**
 * Handle browsing for a local file to link
 */
export async function handleBrowseLocalFile(
  _message: { type: string; [key: string]: unknown },
  ctx: HandlerContext
): Promise<void> {
  const { document, webview } = ctx;
  const documentDir = vscode.Uri.joinPath(document.uri, '..');
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
  const workspacePath = workspaceFolder?.uri.fsPath;

  const uris = await vscode.window.showOpenDialog({
    canSelectMany: false,
    openLabel: 'Select File',
    defaultUri: documentDir,
  });

  if (uris && uris.length > 0) {
    const selectedUri = uris[0];
    const selectedPath = selectedUri.fsPath;
    const pathModule = await import('path');

    let finalUri = selectedUri;
    const isOutsideWorkspace = workspacePath
      ? !selectedPath.startsWith(workspacePath + pathModule.sep) && selectedPath !== workspacePath
      : true;

    if (isOutsideWorkspace) {
      // Copy file to workspace media folder
      const mediaFolderName = ctx.getConfig<string>('mediaPath', 'media');
      const targetDir = resolveMediaTargetFolder(document, mediaFolderName, ctx.getConfig);

      if (targetDir) {
        try {
          // Ensure target directory exists
          await vscode.workspace.fs.createDirectory(vscode.Uri.file(targetDir));

          const fileName = pathModule.basename(selectedPath);
          const targetPath = pathModule.join(targetDir, fileName);
          const targetUri = vscode.Uri.file(targetPath);

          // Copy the file
          await vscode.workspace.fs.copy(selectedUri, targetUri, { overwrite: true });
          finalUri = targetUri;

          // Generate user-friendly message about file location
          const mediaPathBase = ctx.getConfig<string>('mediaPathBase', 'sameNameFolder');
          let locationMsg = '';
          if (mediaPathBase === 'sameNameFolder') {
            locationMsg = `Copied to same-name folder (Media Path Base: sameNameFolder)`;
          } else if (mediaPathBase === 'workspaceFolder') {
            locationMsg = `Copied to workspace root → ${mediaFolderName}/ (Media Path Base: workspaceFolder)`;
          } else {
            // relativeToDocument
            locationMsg = `Copied to document folder → ${mediaFolderName}/ (Media Path Base: relativeToDocument)`;
          }
          vscode.window.showInformationMessage(locationMsg);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to copy file: ${toErrorMessage(error)}`);
          // Continue with original path if copy fails
        }
      }
    }

    // Calculate relative path from document directory to final file
    const docDirPath = documentDir.fsPath;
    const finalFsPath = finalUri.fsPath;

    let relativePath = pathModule.relative(docDirPath, finalFsPath);
    // Ensure forward slashes
    relativePath = relativePath.replace(/\\/g, '/');

    webview.postMessage({
      type: MessageType.LOCAL_FILE_SELECTED,
      filename: pathModule.basename(finalFsPath),
      path: relativePath,
      suggestedText: formatFileLinkLabel(pathModule.basename(finalFsPath)),
    });
  }
}

export async function handleFileLinkDrop(
  message: { type: string; [key: string]: unknown },
  ctx: HandlerContext
): Promise<void> {
  const { document, webview } = ctx;
  const sourcePath = typeof message.sourcePath === 'string' ? message.sourcePath : '';
  const fileName =
    typeof message.fileName === 'string' ? message.fileName : path.basename(sourcePath);
  const insertPosition =
    typeof message.insertPosition === 'number' ? message.insertPosition : undefined;

  if (!sourcePath) {
    vscode.window.showErrorMessage('Could not determine the dropped file path.');
    return;
  }

  const sourceUri = sourcePath.startsWith('file://')
    ? vscode.Uri.file(decodeURIComponent(sourcePath.replace('file://', '')))
    : vscode.Uri.file(sourcePath);

  let finalUri = sourceUri;
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
  const workspacePath = workspaceFolder?.uri.fsPath;
  const sourceIsInWorkspace = workspacePath
    ? isWithinWorkspace(sourceUri.fsPath, workspacePath)
    : false;

  if (!sourceIsInWorkspace) {
    const mediaFolderName = ctx.getConfig<string>('mediaPath', 'media');
    const targetDir = resolveMediaTargetFolder(document, mediaFolderName, ctx.getConfig);

    if (!targetDir) {
      vscode.window.showErrorMessage('Cannot determine the attachments folder for dropped files.');
      return;
    }

    try {
      await vscode.workspace.fs.createDirectory(vscode.Uri.file(targetDir));
      const targetUri = await createUniqueTargetFile(vscode.Uri.file(targetDir), fileName);
      await vscode.workspace.fs.copy(sourceUri, targetUri, { overwrite: false });
      finalUri = targetUri;
    } catch (error) {
      const errorMessage = toErrorMessage(error);
      vscode.window.showErrorMessage(`Failed to copy dropped file: ${errorMessage}`);
      return;
    }
  }

  const documentDir = path.dirname(document.uri.fsPath);
  let relativePath = path.relative(documentDir, finalUri.fsPath).replace(/\\/g, '/');
  if (!relativePath.startsWith('..') && !relativePath.startsWith('./')) {
    relativePath = `./${relativePath}`;
  }

  webview.postMessage({
    type: MessageType.INSERT_FILE_LINK,
    relativePath,
    text: formatFileLinkLabel(path.basename(finalUri.fsPath)),
    insertPosition,
  });
}

/**
 * Get list of markdown files in the same folder as the current document.
 * Returns up to 30 files, sorted alphabetically.
 */
export async function handleGetMarkdownFiles(
  _message: { type: string; [key: string]: unknown },
  ctx: HandlerContext
): Promise<void> {
  const { document, webview } = ctx;

  try {
    const documentDir = path.dirname(document.uri.fsPath);
    const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(documentDir));

    const markdownFiles = entries
      .filter(([name, type]) => {
        // File type 1 = file, and ends with .md
        return type === vscode.FileType.File && name.toLowerCase().endsWith('.md');
      })
      .map(([name]) => ({
        name,
        path: path.join(documentDir, name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 30); // Limit to 30 files

    webview.postMessage({
      type: MessageType.MARKDOWN_FILES_RESULT,
      files: markdownFiles,
    });
  } catch (error) {
    const errorMessage = toErrorMessage(error);
    console.error(`[DK-AI] Failed to get markdown files: ${errorMessage}`);
    webview.postMessage({
      type: MessageType.MARKDOWN_FILES_RESULT,
      files: [],
      error: errorMessage,
    });
  }
}

/**
 * Open the selected markdown file with the Flux Flow editor.
 */
export async function handleSaveAndOpenFile(
  message: { type: string; [key: string]: unknown },
  _ctx: HandlerContext
): Promise<void> {
  const targetPath = message.filePath as string;

  try {
    if (!targetPath) {
      throw new Error('Missing filePath');
    }

    // Open the target file with the Flux Flow custom editor
    const uri = vscode.Uri.file(targetPath);
    await vscode.commands.executeCommand('vscode.openWith', uri, 'gptAiMarkdownEditor.editor');
  } catch (error) {
    const errorMessage = toErrorMessage(error);
    console.error(`[DK-AI] Failed to open file: ${errorMessage}`);
    vscode.window.showErrorMessage(`Failed to open file: ${errorMessage}`);
  }
}

/**
 * Handle a multi-file drop: save all provided files to the workspace media
 * folder and return their relative paths so the webview can build a bullet list.
 *
 * Reuses the same media-folder resolution and collision-safe naming as image saves.
 */
export async function handleSaveFiles(
  message: { type: string; [key: string]: unknown },
  ctx: HandlerContext
): Promise<void> {
  const { document, webview } = ctx;
  const requestId = message.requestId as string;
  const filesToSave = message.files as Array<{ name: string; data: number[]; mimeType: string }>;
  const targetFolderName =
    (message.targetFolder as string) || ctx.getConfig<string>('mediaPath', 'media');

  if (!filesToSave || filesToSave.length === 0) {
    webview.postMessage({ type: MessageType.FILES_SAVED, requestId, savedFiles: [] });
    return;
  }

  const targetDir = resolveMediaTargetFolder(document, targetFolderName, ctx.getConfig);
  if (!targetDir) {
    const err = 'Cannot save files: no base directory available';
    vscode.window.showErrorMessage(err);
    webview.postMessage({ type: MessageType.FILE_SAVE_ERROR, requestId, error: err });
    return;
  }

  try {
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(targetDir));

    const savedFiles: Array<{ name: string; relativePath: string }> = [];

    for (const file of filesToSave) {
      const targetUri = await createUniqueTargetFile(vscode.Uri.file(targetDir), file.name);
      await vscode.workspace.fs.writeFile(targetUri, new Uint8Array(file.data));

      const docDir = path.dirname(document.uri.fsPath);
      let relativePath = path.relative(docDir, targetUri.fsPath).replace(/\\/g, '/');
      if (!relativePath.startsWith('..') && !relativePath.startsWith('./')) {
        relativePath = './' + relativePath;
      }

      savedFiles.push({ name: path.basename(targetUri.fsPath), relativePath });
    }

    webview.postMessage({ type: MessageType.FILES_SAVED, requestId, savedFiles });
  } catch (error) {
    const errorMessage = toErrorMessage(error);
    vscode.window.showErrorMessage(`Failed to save files: ${errorMessage}`);
    webview.postMessage({ type: MessageType.FILE_SAVE_ERROR, requestId, error: errorMessage });
  }
}

/**
 * Open a .drawio.svg file in the Draw.io Integration extension.
 *
 * Resolution order:
 * 1. Resolve the relative path against the current document's directory.
 * 2. Try to open with `hediet.vscode-drawio` editor ID.
 * 3. If that fails (extension not installed), offer two actions:
 *    - "Install Draw.io Integration" → opens marketplace page
 *    - "Open as SVG" → falls back to default VS Code viewer
 */
export async function handleOpenDrawioFile(
  message: { type: string; [key: string]: unknown },
  ctx: HandlerContext
): Promise<void> {
  const { document } = ctx;
  const rawPath = String(message.path || '');
  if (!rawPath) return;

  // Resolve to absolute path (same strategy as handleOpenImage)
  const normalizedPath = rawPath.startsWith('./') ? rawPath.slice(2) : rawPath;
  let baseDir: string | undefined;
  if (document.uri.scheme === 'file') {
    baseDir = path.dirname(document.uri.fsPath);
  } else {
    baseDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }

  if (!baseDir) {
    vscode.window.showWarningMessage('Cannot resolve diagram path: no base directory available');
    return;
  }

  const fullPath = path.resolve(baseDir, normalizedPath);
  const fileUri = vscode.Uri.file(fullPath);

  // Verify the file exists before attempting to open
  try {
    await vscode.workspace.fs.stat(fileUri);
  } catch {
    // Try workspace root as fallback
    let found = false;
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      const wsFullPath = path.resolve(workspaceFolder.uri.fsPath, normalizedPath);
      const wsUri = vscode.Uri.file(wsFullPath);
      try {
        await vscode.workspace.fs.stat(wsUri);
        // Use workspace-root-relative path
        await openWithDrawio(vscode.Uri.file(wsFullPath));
        found = true;
      } catch {
        // not found there either
      }
    }
    if (!found) {
      vscode.window.showErrorMessage(`Diagram file not found: ${rawPath}`);
    }
    return;
  }

  await openWithDrawio(fileUri);
}

/**
 * Open `uri` using VS Code's default handler.
 * If Draw.io Integration is installed it will open as a diagram editor;
 * otherwise VS Code falls back to displaying the file as SVG/text.
 */
async function openWithDrawio(uri: vscode.Uri): Promise<void> {
  try {
    // ViewColumn.Active opens as a new tab in the same editor group.
    // The markdown editor tab stays and can be clicked back to.
    await vscode.commands.executeCommand('vscode.open', uri, vscode.ViewColumn.Active);
  } catch (err) {
    vscode.window.showErrorMessage(`Failed to open diagram: ${toErrorMessage(err)}`);
  }
}
