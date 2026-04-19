/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Path resolution utilities for the markdown editor.
 * All functions are pure (no class instance / `this` dependency) for testability.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { toErrorMessage } from '../../shared/errorUtils';

/** Callback used by functions that need a configuration value. */
export type ConfigGetter = <T>(key: string, defaultValue: T) => T;

// ---------------------------------------------------------------------------
// Document / workspace path helpers
// ---------------------------------------------------------------------------

/**
 * Get the document directory for file-based documents, or workspace folder for untitled files.
 * Returns null if document is untitled and has no workspace.
 */
export function getDocumentDirectory(document: vscode.TextDocument): string | null {
  if (document.uri.scheme === 'file') {
    return path.dirname(document.uri.fsPath);
  }
  if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
    return vscode.workspace.workspaceFolders[0].uri.fsPath;
  }
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
  if (workspaceFolder) {
    return workspaceFolder.uri.fsPath;
  }
  return null;
}

/**
 * Get the workspace folder path that contains the document, when available.
 * For untitled documents, falls back to the first workspace folder.
 */
export function getWorkspaceFolderPath(document: vscode.TextDocument): string | null {
  const direct = vscode.workspace.getWorkspaceFolder(document.uri);
  if (direct) {
    return direct.uri.fsPath;
  }

  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return null;
  }

  if (document.uri.scheme === 'untitled') {
    return folders[0].uri.fsPath;
  }

  if (document.uri.scheme === 'file') {
    const docPath = document.uri.fsPath;
    const containing = [...folders]
      .sort((a, b) => b.uri.fsPath.length - a.uri.fsPath.length)
      .find(
        folder => docPath === folder.uri.fsPath || docPath.startsWith(folder.uri.fsPath + path.sep)
      );
    return containing?.uri.fsPath ?? null;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Image base-path helpers
// ---------------------------------------------------------------------------

/**
 * Get base path for resolving existing markdown image links.
 * Returns document directory if available, otherwise home directory.
 */
export function getImageBasePath(document: vscode.TextDocument): string | null {
  const docDir = getDocumentDirectory(document);
  if (docDir) {
    return docDir;
  }
  return os.homedir();
}

/**
 * Get the base directory where new images should be saved.
 * Separate from `getImageBasePath` (resolution) — this respects the `mediaPathBase` setting.
 */
export function getImageStorageBasePath(
  document: vscode.TextDocument,
  getConfig: ConfigGetter
): string | null {
  const mediaPathBase = getConfig<string>('mediaPathBase', 'sameNameFolder');

  if (document.uri.scheme === 'untitled') {
    return getWorkspaceFolderPath(document) ?? getImageBasePath(document);
  }

  if (mediaPathBase === 'sameNameFolder') {
    const docPath = document.uri.fsPath;
    const docDir = path.dirname(docPath);
    const ext = path.extname(docPath);
    const baseName = path.basename(docPath, ext);
    return path.join(docDir, baseName);
  }

  if (mediaPathBase === 'workspaceFolder') {
    return getWorkspaceFolderPath(document) ?? getImageBasePath(document);
  }

  // Default: relativeToDocument
  return getDocumentDirectory(document) ?? getWorkspaceFolderPath(document) ?? os.homedir();
}

/**
 * Get the resolved target folder for saving media.
 * Returns the absolute *folder* path where the media file will be placed.
 */
export function resolveMediaTargetFolder(
  document: vscode.TextDocument,
  requestedFolder: string,
  getConfig: ConfigGetter
): string | null {
  const mediaPathBase = getConfig<string>('mediaPathBase', 'sameNameFolder');

  if (mediaPathBase === 'sameNameFolder' || requestedFolder === '__sameNameFolder__') {
    const docPath = document.uri.fsPath;
    if (document.uri.scheme !== 'file') {
      return path.join(os.homedir(), 'media');
    }
    const docDir = path.dirname(docPath);
    const ext = path.extname(docPath);
    const baseName = path.basename(docPath, ext);
    return path.join(docDir, baseName);
  }

  const saveBasePath = getImageStorageBasePath(document, getConfig);
  if (!saveBasePath) return null;
  return path.join(saveBasePath, requestedFolder);
}

// ---------------------------------------------------------------------------
// Path validation helpers
// ---------------------------------------------------------------------------

/**
 * Check if relative path is valid (doesn't contain absolute path).
 * Works on both Windows and Mac/Linux.
 */
export function isValidRelativePath(relativePath: string): boolean {
  const windowsAbsolutePattern = /[a-zA-Z]:/;
  const unixAbsolutePattern = /^\/[^/]/;

  return (
    !windowsAbsolutePattern.test(relativePath) &&
    !unixAbsolutePattern.test(relativePath) &&
    !path.isAbsolute(relativePath)
  );
}

/**
 * Check if source is within workspace/document directory (cross-platform).
 */
export function isWithinWorkspace(sourcePath: string, basePath: string): boolean {
  const normalizedSource = path.normalize(sourcePath);
  const normalizedBase = path.normalize(basePath);

  const sourceLower =
    process.platform === 'win32' ? normalizedSource.toLowerCase() : normalizedSource;
  const baseLower = process.platform === 'win32' ? normalizedBase.toLowerCase() : normalizedBase;

  return sourceLower.startsWith(baseLower + path.sep) || sourceLower === baseLower;
}

/**
 * Get relative path from workspace root, using forward slashes for markdown compatibility.
 */
export function getRelativePath(fileUri: vscode.Uri, workspaceUri: vscode.Uri): string {
  const filePath = fileUri.fsPath;
  const workspacePath = workspaceUri.fsPath;

  if (filePath.startsWith(workspacePath)) {
    let relative = path.relative(workspacePath, filePath);
    relative = relative.replace(/\\/g, '/');
    return relative;
  }

  return path.basename(filePath);
}

// ---------------------------------------------------------------------------
// File-name helpers
// ---------------------------------------------------------------------------

/**
 * Format a file name for display in a link label.
 * E.g. "my_doc.pdf" → "My Doc (PDF)"
 */
export function formatFileLinkLabel(fileName: string): string {
  const trimmed = fileName.trim();
  if (!trimmed) {
    return 'Attachment';
  }

  const extensionMatch = trimmed.match(/\.([^.]+)$/);
  const extension = extensionMatch ? extensionMatch[1].toUpperCase() : '';
  const baseName = extensionMatch ? trimmed.slice(0, -extensionMatch[0].length) : trimmed;
  const normalizedBase = baseName
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, character => character.toUpperCase());

  return extension ? `${normalizedBase} (${extension})` : normalizedBase;
}

// ---------------------------------------------------------------------------
// File-system helpers
// ---------------------------------------------------------------------------

/**
 * Check whether a file exists at the given URI.
 * Returns false for ENOENT/FileNotFound; re-throws unknown errors.
 */
export async function fileExists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch (error) {
    const message = toErrorMessage(error);
    if (message.includes('ENOENT') || message.includes('FileNotFound')) {
      return false;
    }
    throw error;
  }
}

/**
 * Generate a unique file URI by appending `-2`, `-3`, etc. if the target already exists.
 */
export async function createUniqueTargetFile(
  directoryUri: vscode.Uri,
  fileName: string
): Promise<vscode.Uri> {
  const parsed = path.parse(fileName);
  let candidate = vscode.Uri.joinPath(directoryUri, `${parsed.name}${parsed.ext}`);

  const exists = async (uri: vscode.Uri): Promise<boolean> => {
    try {
      await vscode.workspace.fs.stat(uri);
      return true;
    } catch {
      return false;
    }
  };

  if (!(await exists(candidate))) {
    return candidate;
  }

  for (let suffix = 2; suffix < 1000; suffix += 1) {
    candidate = vscode.Uri.joinPath(directoryUri, `${parsed.name}-${suffix}${parsed.ext}`);
    if (!(await exists(candidate))) {
      return candidate;
    }
  }

  throw new Error(`Too many files named ${fileName} in attachments folder.`);
}
