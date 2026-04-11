/**
 * Chrome/Chromium executable detection, validation, and user-prompting.
 *
 * @module chromeDetection
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';

// ── Types ───────────────────────────────────────────────────────────

export interface ChromeValidationResult {
  valid: boolean;
  error?: string;
}

export interface ChromeDetectionResult {
  path: string | null;
  detected: boolean;
}

// ── Path normalisation ──────────────────────────────────────────────

/**
 * Normalize platform-specific Chrome paths (e.g. macOS .app bundles → inner executable)
 */
export function resolveChromeExecutable(rawPath: string): string {
  if (process.platform === 'darwin' && rawPath.endsWith('.app')) {
    const candidate = path.join(rawPath, 'Contents', 'MacOS', 'Google Chrome');
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    const chromiumCandidate = path.join(rawPath, 'Contents', 'MacOS', 'Chromium');
    if (fs.existsSync(chromiumCandidate)) {
      return chromiumCandidate;
    }
  }
  return rawPath;
}

// ── Validation ──────────────────────────────────────────────────────

export async function validateChromePath(chromePath: string): Promise<ChromeValidationResult> {
  const executablePath = resolveChromeExecutable(chromePath);

  if (!fs.existsSync(executablePath)) {
    return { valid: false, error: 'Chrome executable not found at the specified path' };
  }

  try {
    await new Promise<void>((resolve, reject) => {
      const chromeProcess = spawn(executablePath, ['--version'], { stdio: 'ignore' });
      chromeProcess.once('error', (error: Error) => {
        reject(new Error(`Failed to execute Chrome: ${error.message}`));
      });
      chromeProcess.once('exit', (code: number | null) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Chrome exited with code ${code}`));
        }
      });
    });
    return { valid: true };
  } catch {
    return {
      valid: false,
      error: 'The specified file is not a valid Chrome/Chromium executable',
    };
  }
}

// ── Detection ───────────────────────────────────────────────────────

export async function findChromeExecutable(): Promise<ChromeDetectionResult> {
  const config = vscode.workspace.getConfiguration('gptAiMarkdownEditor');
  const customChromePathRaw = config.get<string>('chromePath');
  const customChromePath = customChromePathRaw
    ? resolveChromeExecutable(customChromePathRaw)
    : undefined;
  if (customChromePath && fs.existsSync(customChromePath)) {
    return { path: customChromePath, detected: false };
  }

  const envCandidates = [process.env.CHROME_PATH, process.env.CHROMIUM_PATH].filter(
    Boolean
  ) as string[];
  for (const candidate of envCandidates) {
    if (fs.existsSync(candidate)) {
      return { path: candidate, detected: true };
    }
  }

  const platform = process.platform;
  const candidates: string[] = [];

  if (platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
      '/Applications/Chromium.app/Contents/MacOS/Chromium'
    );
  } else if (platform === 'win32') {
    candidates.push(
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Chromium\\Application\\chrome.exe'
    );
  } else if (platform === 'linux') {
    candidates.push(
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium'
    );
  }

  const pathExecutables =
    platform === 'win32'
      ? ['chrome.exe', 'msedge.exe', 'chromium.exe']
      : ['google-chrome', 'google-chrome-stable', 'chromium-browser', 'chromium'];

  const pathDirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const dir of pathDirs) {
    for (const binary of pathExecutables) {
      candidates.push(path.join(dir, binary));
    }
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return { path: candidate, detected: true };
    }
  }

  return { path: null, detected: false };
}

// ── User prompts ────────────────────────────────────────────────────

export async function promptForChromePath(detectedPath: string | null): Promise<string | null> {
  if (detectedPath) {
    const choice = await vscode.window.showInformationMessage(
      `Chrome detected at:\n${detectedPath}\n\nWould you like to use this for PDF export?`,
      { modal: true },
      'Use This Path',
      'Choose Different Path',
      'Cancel'
    );

    if (choice === 'Use This Path') {
      return detectedPath;
    } else if (choice === 'Choose Different Path') {
      return await showChromeFilePicker();
    } else {
      return null;
    }
  } else {
    const choice = await vscode.window.showInformationMessage(
      'Chrome/Chromium is required for PDF export but was not found on your system.\n\nYou can download Chrome or select an existing installation.',
      { modal: true },
      'Download Chrome',
      'Choose Chrome Path',
      'Cancel'
    );

    if (choice === 'Download Chrome') {
      await vscode.env.openExternal(vscode.Uri.parse('https://www.google.com/chrome/'));
      return null;
    } else if (choice === 'Choose Chrome Path') {
      return await showChromeFilePicker();
    } else {
      return null;
    }
  }
}

export async function showChromeFilePicker(): Promise<string | null> {
  const platform = process.platform;
  const filters: Record<string, string[]> = {};

  if (platform === 'win32') {
    filters['Chrome/Chromium'] = ['exe'];
  } else if (platform === 'darwin') {
    filters['Chrome/Chromium'] = ['app'];
  } else {
    filters['Chrome/Chromium'] = ['*'];
  }

  const result = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectFolders: platform === 'darwin',
    canSelectMany: false,
    filters,
    title: 'Select Chrome/Chromium Executable',
  });

  if (result && result.length > 0) {
    return result[0].fsPath;
  }

  return null;
}

/**
 * Minimal modal flow: validate existing Chrome path, auto-detect, or prompt user to supply one.
 * Returns a validated executable path or null if the user cancels.
 */
export async function ensureChromePath(
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
  const configuredRaw = config.get<string>('chromePath');
  if (configuredRaw) {
    const configuredPath = resolveChromeExecutable(configuredRaw);
    report('Validating configured Chrome path…', 20);
    const validation = await validateChromePath(configuredPath);
    if (validation.valid) {
      return configuredPath;
    }
  }

  // 2) Auto-detect common paths
  report('Detecting Chrome on this system…', 20);
  const detected = await findChromeExecutable();
  if (detected.path) {
    const detectedPath = resolveChromeExecutable(detected.path);
    const validation = await validateChromePath(detectedPath);
    if (validation.valid) {
      await config.update('chromePath', detectedPath, vscode.ConfigurationTarget.Global);
      return detectedPath;
    }
  }

  // 3) Inline resolver: ask user
  return await promptForChromePathInlineResolver(progress, token);
}

async function promptForChromePathInlineResolver(
  progress: vscode.Progress<{ message?: string; increment?: number }>,
  token: vscode.CancellationToken
): Promise<string | null> {
  let lastError: string | undefined;
  let lastValue: string | undefined;

  while (!token.isCancellationRequested) {
    const choice = await vscode.window.showInformationMessage(
      lastError
        ? `Chrome is required for PDF export.\nLast check failed: ${lastError}`
        : 'Chrome is required for PDF export. Provide a path to Chrome/Chromium.',
      { modal: true },
      'Browse…',
      'Enter Path',
      'Download Chrome',
      'Cancel'
    );

    if (!choice || choice === 'Cancel') {
      return null;
    }

    if (choice === 'Download Chrome') {
      await vscode.env.openExternal(vscode.Uri.parse('https://www.google.com/chrome/'));
      continue;
    }

    let candidate: string | null = null;

    if (choice === 'Browse…') {
      const picked = await showChromeFilePicker();
      candidate = picked ?? null;
    } else if (choice === 'Enter Path') {
      const input = await vscode.window.showInputBox({
        title: 'Enter Chrome/Chromium executable path',
        value: lastValue,
        prompt:
          'Examples:\n- /Applications/Google Chrome.app/Contents/MacOS/Google Chrome (macOS)\n- C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe (Windows)\n- /usr/bin/google-chrome (Linux)',
        ignoreFocusOut: true,
      });
      candidate = input ?? null;
      lastValue = input ?? lastValue;
    }

    if (!candidate) {
      lastError = 'No path selected';
      continue;
    }

    if (token.isCancellationRequested) {
      return null;
    }
    progress.report({ message: 'Validating Chrome path…' });
    const validation = await validateChromePath(candidate);
    if (validation.valid) {
      const resolved = resolveChromeExecutable(candidate);
      const config = vscode.workspace.getConfiguration('gptAiMarkdownEditor');
      await config.update('chromePath', resolved, vscode.ConfigurationTarget.Global);
      return resolved;
    }

    lastError = validation.error || 'Invalid Chrome path';
    await vscode.window.showErrorMessage(
      `Chrome not ready: ${lastError}. Please choose a valid Chrome/Chromium executable.`
    );
  }

  return null;
}
