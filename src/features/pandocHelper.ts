/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

/**
 * @file pandocHelper.ts
 * @description Pandoc path detection, validation, and utility functions
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

/**
 * Result of Pandoc validation
 */
export interface PandocValidationResult {
  valid: boolean;
  version?: string;
  error?: string;
}

/**
 * Ensure Pandoc is available and return its executable path
 * Follows same pattern as Chrome detection: config → auto-detect → prompt user
 */
export async function ensurePandocPath(
  progress: vscode.Progress<{ message?: string; increment?: number }>,
  token: vscode.CancellationToken
): Promise<string | null> {
  const config = vscode.workspace.getConfiguration('gptAiMarkdownEditor');
  const report = (message: string, increment?: number) => {
    if (token.isCancellationRequested) {
      return;
    }
    progress.report({ message, increment });
  };

  // 1) Use configured path if valid
  const configuredRaw = config.get<string>('pandocPath');
  if (configuredRaw) {
    report('Validating configured Pandoc path…', 20);
    const validation = await validatePandocPath(configuredRaw);
    if (validation.valid) {
      return configuredRaw;
    }
  }

  // 2) Auto-detect common paths
  report('Detecting Pandoc on this system…', 20);
  const detected = await findPandocExecutable();
  if (detected) {
    const validation = await validatePandocPath(detected);
    if (validation.valid) {
      // Save for future runs
      await config.update('pandocPath', detected, vscode.ConfigurationTarget.Global);
      return detected;
    }
  }

  // 3) Prompt user to provide path
  return await promptForPandocPath(progress, token);
}

/**
 * Validate that a path points to a working Pandoc executable
 */
export async function validatePandocPath(pandocPath: string): Promise<PandocValidationResult> {
  try {
    const version = execSync(`"${pandocPath}" --version`, {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: 'pipe',
    });

    if (version && version.includes('pandoc')) {
      return { valid: true, version };
    }
    return { valid: false, error: 'Not a valid Pandoc executable' };
  } catch (error) {
    return {
      valid: false,
      error: `Could not execute Pandoc: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Auto-detect Pandoc executable in common paths
 */
async function findPandocExecutable(): Promise<string | null> {
  const candidates: string[] = [];

  if (process.platform === 'darwin') {
    // macOS
    candidates.push('/usr/local/bin/pandoc', '/opt/homebrew/bin/pandoc');
  } else if (process.platform === 'win32') {
    // Windows
    candidates.push(
      'C:\\Program Files\\Pandoc\\pandoc.exe',
      `${process.env.ProgramFiles}\\Pandoc\\pandoc.exe`,
      `${process.env['ProgramFiles(x86)']}\\Pandoc\\pandoc.exe`
    );
  } else {
    // Linux
    candidates.push('/usr/bin/pandoc', '/usr/local/bin/pandoc', '/snap/bin/pandoc');
  }

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      const validation = await validatePandocPath(candidate);
      if (validation.valid) {
        return candidate;
      }
    }
  }

  return null;
}

/**
 * Prompt user to provide Pandoc path
 */
async function promptForPandocPath(
  progress: vscode.Progress<{ message?: string; increment?: number }>,
  _token: vscode.CancellationToken
): Promise<string | null> {
  progress.report({ message: 'Pandoc not found. Please provide path…', increment: 30 });

  const path = await vscode.window.showInputBox({
    prompt: 'Path to Pandoc executable',
    placeHolder:
      process.platform === 'win32'
        ? 'C:\\Program Files\\Pandoc\\pandoc.exe'
        : '/usr/local/bin/pandoc',
    validateInput: async value => {
      if (!value) {
        return 'Path is required';
      }
      const validation = await validatePandocPath(value);
      return validation.valid ? '' : validation.error || 'Invalid path';
    },
  });

  if (path) {
    const config = vscode.workspace.getConfiguration('gptAiMarkdownEditor');
    await config.update('pandocPath', path, vscode.ConfigurationTarget.Global);
    return path;
  }

  return null;
}

/**
 * Get configured Pandoc template path if set
 */
export function getPandocTemplatePath(): string | null {
  const config = vscode.workspace.getConfiguration('gptAiMarkdownEditor');
  const template = config.get<string>('pandocTemplatePath');

  if (template && fs.existsSync(template)) {
    return template;
  }

  return null;
}

/**
 * Get lua filters directory
 */
export function getLuaFiltersDir(): string {
  const extensionPath = vscode.extensions.getExtension(
    'kamransethi.gpt-ai-markdown-editor'
  )?.extensionPath;
  const candidates: string[] = [];

  if (extensionPath) {
    candidates.push(
      path.join(extensionPath, 'dist', 'lua'),
      path.join(extensionPath, 'src', 'features', 'pandoc', 'lua')
    );
  }

  candidates.push(
    path.join(__dirname, '..', 'lua'),
    path.join(__dirname, '..', '..', 'src', 'features', 'pandoc', 'lua'),
    path.join(process.cwd(), 'src', 'features', 'pandoc', 'lua')
  );

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // Best-effort default for diagnostics.
  return path.join(process.cwd(), 'src', 'features', 'pandoc', 'lua');
}
