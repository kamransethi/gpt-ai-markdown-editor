import * as vscode from 'vscode';
import * as path from 'path';

export interface ResizeBackupLocation {
  backupDir: string;
  backupFilePath: string;
}

/**
 * Builds the path and directory for an image resize backup.
 */
export function buildResizeBackupLocation(params: {
  backupWorkspaceRoot: string;
  imageAbsolutePath: string;
  oldWidth: number;
  oldHeight: number;
  now: Date;
}): ResizeBackupLocation {
  const { backupWorkspaceRoot, imageAbsolutePath, oldWidth, oldHeight, now } = params;

  // Store all backups in a single flat directory: .gptai/image-backups
  const backupDir = path.join(backupWorkspaceRoot, '.gptai', 'image-backups');

  // Format: YYYYMMDD-HHMMSS (like the tests expect: \d{8}-\d{6})
  const timestamp = now.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15); // YYYYMMDD-HHMMSS

  const originalName = path.basename(imageAbsolutePath);
  const ext = path.extname(originalName);
  const nameWithoutExt = path.parse(originalName).name;

  // Filename: original_[name]_[dimensions]_[timestamp][ext]
  const backupFilename = `original_${nameWithoutExt}_${oldWidth}x${oldHeight}px_${timestamp}${ext}`;
  const backupFilePath = path.join(backupDir, backupFilename);

  return { backupDir, backupFilePath };
}

/**
 * Resolves a backup path with collision detection.
 * If the target backup file somehow exists (unlikely given timestamp), appends a suffix.
 */
export async function resolveBackupPathWithCollisionDetection(targetPath: string): Promise<string> {
  const uri = vscode.Uri.file(targetPath);
  try {
    await vscode.workspace.fs.stat(uri);
  } catch {
    // File doesn't exist, use this path
    return targetPath;
  }

  const parsed = path.parse(targetPath);
  const dir = parsed.dir;
  const name = parsed.name;
  const ext = parsed.ext;

  for (let i = 1; i < 100; i++) {
    const candidate = path.join(dir, `${name}-${i}${ext}`);
    try {
      await vscode.workspace.fs.stat(vscode.Uri.file(candidate));
    } catch {
      return candidate;
    }
  }

  return targetPath; // Fallback
}
