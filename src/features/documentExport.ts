/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

/**
 * @file documentExport.ts - PDF and Word document export
 * @description Handles exporting markdown documents to PDF (via local Chrome) and Word (via Pandoc).
 * Applies export theme settings and embeds Mermaid diagrams as high-quality images.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { toErrorMessage } from '../shared/errorUtils';
import * as os from 'os';
import { spawn, spawnSync } from 'child_process';
import { ensurePandocPath, getPandocTemplatePath, getLuaFiltersDir } from './pandocHelper';
import { convertMermaidToImages, extractMermaidBlocks } from './mermaidToImages';

/**
 * Mermaid image data
 */
interface MermaidImage {
  id: string;
  pngDataUrl: string;
  originalSvg: string;
  width?: number; // Rendered width in pixels
  height?: number; // Rendered height in pixels
}

/**
 * Get the document directory for file-based documents, or workspace folder/home directory for untitled files
 * Returns home directory if document is untitled and has no workspace
 */
function getDocumentBasePath(document: vscode.TextDocument): string {
  if (document.uri.scheme === 'file') {
    return path.dirname(document.uri.fsPath);
  }
  // For untitled files, use workspace folder as fallback
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
  if (workspaceFolder) {
    return workspaceFolder.uri.fsPath;
  }
  // Fallback to home directory for untitled files without workspace
  return os.homedir();
}

/**
 * Show export warning dialog and wait for user confirmation
 *
 * @param format - Export format ('pdf' or 'docx')
 * @returns true if user confirmed, false if cancelled
 */
async function showExportWarning(format: string): Promise<boolean> {
  const formatName = format === 'pdf' ? 'PDF' : 'Word';
  const message = `Export to ${formatName} works best with simple markdown files.\n\nKnown limitations:\n• Images (especially remote URLs)\n• Mermaid diagrams\n• Complex markdown structures\n\nSome content may not render correctly in the exported document.`;

  const action = await vscode.window.showWarningMessage(message, { modal: true }, 'I Understand');

  return action === 'I Understand';
}

/**
 * Export document to PDF or Word format
 *
 * @param format - Export format ('pdf' or 'docx')
 * @param html - HTML content from editor
 * @param mermaidImages - Mermaid diagrams as PNG data URLs
 * @param title - Document title
 * @param document - Source VS Code document
 */
export async function exportDocument(
  format: string,
  html: string,
  mermaidImages: MermaidImage[],
  title: string,
  document: vscode.TextDocument
): Promise<void> {
  // Show warning dialog and wait for user confirmation
  const userConfirmed = await showExportWarning(format);
  if (!userConfirmed) {
    return; // User cancelled
  }

  const docBasePath = getDocumentBasePath(document);
  // Transform HTML images to use absolute paths to ensure Chrome renderer finds them
  const resolvedHtml = resolveHtmlImagePaths(html, docBasePath);

  // Convert all images (local and remote) to data URLs for embedding
  // html = await convertImagesToDataUrls(html, document);

  // Export theme is always light
  const exportTheme = 'light';

  // Show file save dialog
  const sourceFileName =
    document.uri.scheme === 'file'
      ? path.basename(document.uri.fsPath, path.extname(document.uri.fsPath))
      : title;
  const defaultFilename = (sourceFileName || 'document').replace(/[<>:"/\\|?*]/g, '-');
  const extension = format === 'pdf' ? 'pdf' : 'docx';
  const filters: Record<string, string[]> = {};
  filters[format === 'pdf' ? 'PDF Document' : 'Word Document'] = [extension];

  const saveUri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(path.join(docBasePath, `${defaultFilename}.${extension}`)),
    filters,
  });

  if (!saveUri) {
    return; // User cancelled
  }

  const uri = saveUri;

  // Show progress
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Exporting to ${format.toUpperCase()}...`,
      cancellable: true,
    },
    async (progress, token) => {
      try {
        let exportSucceeded = false;

        if (format === 'pdf') {
          exportSucceeded = await exportToPDF(
            resolvedHtml,
            mermaidImages,
            exportTheme,
            uri.fsPath,
            progress,
            document,
            token
          );
        } else if (format === 'docx') {
          exportSucceeded = await exportToWord(
            resolvedHtml,
            mermaidImages,
            exportTheme,
            uri.fsPath,
            progress,
            document
          );
        }

        // Only show success message if export actually completed
        if (exportSucceeded) {
          const fileName = path.basename(uri.fsPath);
          const openLabel = 'Open';
          const showInFolderLabel = 'Show in Folder';
          const choice = await vscode.window.showInformationMessage(
            `Document exported successfully to ${fileName}`,
            openLabel,
            showInFolderLabel
          );
          if (choice === openLabel) {
            try {
              if (fs.existsSync(uri.fsPath)) {
                await vscode.env.openExternal(vscode.Uri.file(uri.fsPath));
              }
            } catch (error) {
              console.warn('[DK-AI] Failed to open file:', error);
            }
          } else if (choice === showInFolderLabel) {
            try {
              if (fs.existsSync(uri.fsPath)) {
                // Reveal in system file manager
                await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(uri.fsPath));
              }
            } catch (error) {
              console.warn('[DK-AI] Failed to reveal file:', error);
            }
          }
        }
      } catch (error) {
        const errorMessage = toErrorMessage(error);
        vscode.window.showErrorMessage(`Export failed: ${errorMessage}`);
        console.error('[DK-AI] Export error:', error);
      }
    }
  );
}

/**
 * Chrome path validation result
 */
export interface ChromeValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Minimal modal flow: validate existing Chrome path, auto-detect, or prompt user to supply one.
 * Returns a validated executable path or null if the user cancels.
 */
async function ensureChromePath(
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
      // Save for future runs
      await config.update('chromePath', detectedPath, vscode.ConfigurationTarget.Global);
      return detectedPath;
    }
  }

  // 3) Inline resolver: ask user to provide a path and validate it
  return await promptForChromePathInlineResolver(progress, token);
}

/**
 * Normalize platform-specific Chrome paths (e.g. macOS .app bundles → inner executable)
 */
function resolveChromeExecutable(rawPath: string): string {
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

/**
 * Validate that a path points to a valid Chrome/Chromium executable
 *
 * @param chromePath - Path to validate
 * @returns Validation result with error message if invalid
 */
export async function validateChromePath(chromePath: string): Promise<ChromeValidationResult> {
  const executablePath = resolveChromeExecutable(chromePath);

  // Check if file exists
  if (!fs.existsSync(executablePath)) {
    return { valid: false, error: 'Chrome executable not found at the specified path' };
  }

  // Try running Chrome with --version to verify it's actually Chrome/Chromium
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

/**
 * Prompt user to configure Chrome path
 * Shows different dialogs based on whether Chrome was auto-detected
 *
 * @param detectedPath - Auto-detected Chrome path, or null if not found
 * @returns User-selected Chrome path, or null if cancelled
 */
export async function promptForChromePath(detectedPath: string | null): Promise<string | null> {
  if (detectedPath) {
    // Chrome was detected - offer to use it or choose different
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
      return null; // Cancelled
    }
  } else {
    // Chrome not detected - offer to choose path or download
    const choice = await vscode.window.showInformationMessage(
      'Chrome/Chromium is required for PDF export but was not found on your system.\n\nYou can download Chrome or select an existing installation.',
      { modal: true },
      'Download Chrome',
      'Choose Chrome Path',
      'Cancel'
    );

    if (choice === 'Download Chrome') {
      // Open Chrome download page
      await vscode.env.openExternal(vscode.Uri.parse('https://www.google.com/chrome/'));
      return null; // User needs to install and try again
    } else if (choice === 'Choose Chrome Path') {
      return await showChromeFilePicker();
    } else {
      return null; // Cancelled
    }
  }
}

/**
 * Show file picker for selecting Chrome executable
 */
async function showChromeFilePicker(): Promise<string | null> {
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
    canSelectFolders: platform === 'darwin', // allow picking .app bundles
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
 * Inline resolver used by the minimal modal flow.
 * Re-prompts until a valid Chrome path is provided or the user cancels.
 */
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

    // Validate with progress feedback
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

/**
 * Export to PDF using the user's local Chrome/Chromium installation
 *
 * @returns true if export succeeded, false if user cancelled
 */
async function exportToPDF(
  html: string,
  _mermaidImages: MermaidImage[],
  theme: string,
  outputPath: string,
  progress: vscode.Progress<{ message?: string; increment?: number }>,
  document: vscode.TextDocument,
  token: vscode.CancellationToken
): Promise<boolean> {
  progress.report({ message: 'Preparing PDF export…', increment: 20 });

  const chromePath = await ensureChromePath(progress, token);
  if (!chromePath) {
    return false;
  }

  // Build complete HTML document
  const completeHtml = buildExportHTML(html, theme, 'pdf');

  // Set content with the document's directory as the base URL
  // This allows relative paths (src="./foo.png") to be resolved correctly by Chrome
  const docDir = getDocumentBasePath(document);

  // Inject base tag to ensure relative paths are resolved correctly
  const htmlWithBase = completeHtml.replace('<head>', `<head><base href="file://${docDir}/">`);

  // Write the HTML to a temp file for Chrome to print
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'gpt-ai-export-'));
  const tempHtmlPath = path.join(tempDir, 'export.html');

  try {
    await fs.promises.writeFile(tempHtmlPath, htmlWithBase, 'utf8');
  } catch (error) {
    const wrapped = new Error(`Failed to write temporary HTML for export: ${error}`) as Error & {
      cause?: unknown;
    };
    wrapped.cause = error;
    throw wrapped;
  }

  try {
    progress.report({ message: 'Launching Chrome...', increment: 20 });

    const chromeArgs = [
      '--headless=chrome',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-software-rasterizer',
      '--disable-dev-shm-usage',
      '--allow-file-access-from-files',
      '--print-to-pdf=' + outputPath,
      `file://${tempHtmlPath}`,
    ];

    progress.report({ message: 'Rendering PDF...', increment: 30 });
    await runChrome(chromePath, chromeArgs);
    progress.report({ increment: 20 });
    return true; // Export succeeded
  } catch (error) {
    // Surface a user-friendly error
    const errMessage =
      error instanceof Error ? error.message : 'Unknown error while exporting to PDF';
    const wrapped = new Error(errMessage) as Error & { cause?: unknown };
    wrapped.cause = error;
    throw wrapped;
  } finally {
    // Clean up temp files
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.warn('[DK-AI] Failed to clean up temporary export directory:', cleanupError);
    }
  }
}

async function runChrome(executablePath: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    // On Windows, use CREATE_NO_WINDOW flag to prevent any window from showing
    const spawnOptions: {
      stdio: 'ignore';
      windowsHide?: boolean;
      detached?: boolean;
      shell?: boolean;
    } = {
      stdio: 'ignore',
    };

    if (process.platform === 'win32') {
      // Prevent any window from appearing on Windows
      spawnOptions.windowsHide = true;
      spawnOptions.detached = false;
      spawnOptions.shell = false;
    }

    const chromeProcess = spawn(executablePath, args, spawnOptions);

    chromeProcess.once('error', error => {
      reject(
        new Error(`Failed to launch Chrome: ${error instanceof Error ? error.message : error}`)
      );
    });

    chromeProcess.once('exit', code => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `Chrome exited with code ${code}. Install or point to a working Chrome/Chromium via "gptAiMarkdownEditor.chromePath".`
          )
        );
      }
    });
  });
}

/**
 * Chrome detection result
 */
export interface ChromeDetectionResult {
  path: string | null;
  detected: boolean; // true if auto-detected, false if user-configured or not found
}

/**
 * Find Chrome executable path
 * Returns result object instead of throwing to allow graceful handling
 *
 * @returns Chrome path and whether it was auto-detected
 */
export async function findChromeExecutable(): Promise<ChromeDetectionResult> {
  // User-configured path takes precedence
  const config = vscode.workspace.getConfiguration('gptAiMarkdownEditor');
  const customChromePathRaw = config.get<string>('chromePath');
  const customChromePath = customChromePathRaw
    ? resolveChromeExecutable(customChromePathRaw)
    : undefined;
  if (customChromePath && fs.existsSync(customChromePath)) {
    return { path: customChromePath, detected: false };
  }

  // Common environment variable hints
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

  // Add PATH-based lookup for common binary names
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

/**
 * Export to Word using Pandoc
 *
 * @returns true if export succeeded
 */
async function exportToWord(
  _html: string,
  mermaidImages: MermaidImage[],
  _theme: string,
  outputPath: string,
  progress: vscode.Progress<{ message?: string; increment?: number }>,
  document: vscode.TextDocument
): Promise<boolean> {
  progress.report({ message: 'Initializing Pandoc...', increment: 20 });

  console.log('[DK-AI] exportToWord: mermaidImages length=', mermaidImages?.length || 0);

  try {
    // Ensure Pandoc is available
    let pandocPath = vscode.workspace
      .getConfiguration('gptAiMarkdownEditor')
      .get<string>('pandocPath');

    if (!pandocPath) {
      // Try to find Pandoc
      const tokenSource = new vscode.CancellationTokenSource();
      pandocPath = (await ensurePandocPath(progress, tokenSource.token)) ?? undefined;

      if (!pandocPath) {
        throw new Error(
          'Pandoc not found. Please install Pandoc or configure its path in settings.'
        );
      }
    }

    progress.report({ message: 'Preparing markdown source...', increment: 15 });

    // Document directory used to resolve relative image paths during export
    const docDir = getDocumentBasePath(document);

    // Use the source markdown directly to preserve tables, callouts, and markdown-native syntax.
    // Convert relative image paths to absolute to ensure Pandoc finds them.
    let markdown = resolveMarkdownImagePaths(document.getText(), docDir);

    // Also resolve raw HTML image tags scattered in the markdown
    markdown = resolveHtmlImagePaths(markdown, docDir);

    // Convert mermaid blocks to images
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pandoc-export-'));
    let processedMarkdown = markdown;

    try {
      const mermaidBlocks = extractMermaidBlocks(markdown);

      console.log(
        '[DK-AI] Found mermaid blocks:',
        mermaidBlocks.length,
        'provided images:',
        mermaidImages?.length || 0
      );

      // First preference: use already-rendered Mermaid PNGs from the webview payload.
      // This avoids environment/PATH issues in extension host mmdc execution.
      if (mermaidBlocks.length > 0 && mermaidImages.length > 0) {
        console.log('[DK-AI] Replacing Mermaid blocks with provided images...');
        processedMarkdown = replaceMermaidBlocksWithProvidedImages(
          processedMarkdown,
          mermaidImages,
          tmpDir
        );
        const afterReplace = extractMermaidBlocks(processedMarkdown);
        console.log('[DK-AI] After replacement: remaining Mermaid blocks:', afterReplace.length);
      }

      // Second preference: for any remaining Mermaid code blocks, try CLI conversion.
      if (extractMermaidBlocks(processedMarkdown).length > 0) {
        console.log('[DK-AI] Converting remaining Mermaid blocks with mmdc...');
        processedMarkdown = await convertMermaidToImages(processedMarkdown, tmpDir);
      }

      if (mermaidBlocks.length > 0) {
        const replacedMermaidImages = (processedMarkdown.match(/!\[Mermaid Diagram\]\(/g) || [])
          .length;
        console.log(
          '[DK-AI] Mermaid replacement result: found',
          replacedMermaidImages,
          'image references in output'
        );
        if (replacedMermaidImages === 0) {
          void vscode.window.showWarningMessage(
            'Mermaid diagrams could not be converted to images. Install mermaid-cli (mmdc) or ensure it is available in PATH. Export will include Mermaid code blocks instead.'
          );
        }
      }
    } catch (error) {
      console.warn('[DK-AI] Mermaid conversion failed, continuing without images:', error);
      // Continue with original markdown if mermaid conversion fails
    }

    progress.report({ message: 'Writing temporary markdown file...', increment: 15 });

    // Write markdown to temporary file
    // Reduce extra blank lines between list items to produce tighter lists
    // This helps reduce vertical spacing in generated DOCX when no reference
    // document is provided. It collapses multiple blank lines that separate
    // list items while leaving other structure untouched.
    try {
      processedMarkdown = processedMarkdown.replace(/\n{2,}(\s*([-*+]|\d+\.)\s+)/g, '\n$1');
    } catch {
      // Non-fatal; continue with original markdown
    }

    const tmpMarkdownPath = path.join(tmpDir, 'document.md');
    fs.writeFileSync(tmpMarkdownPath, processedMarkdown, 'utf-8');

    progress.report({ message: 'Running Pandoc...', increment: 20 });

    // Build Pandoc command
    const pandocArgs: string[] = [
      tmpMarkdownPath,
      '-o',
      outputPath,
      '-t',
      'docx',
      '-f',
      'gfm+alerts+raw_html+pipe_tables+task_lists+strikeout+emoji+tex_math_dollars+footnotes',
    ];

    // Add lua filters
    const luaFiltersDir = getLuaFiltersDir();
    const filters = ['github_alerts.lua', 'text_color.lua', 'mermaid_images.lua'];

    for (const filter of filters) {
      const filterPath = path.join(luaFiltersDir, filter);
      if (fs.existsSync(filterPath)) {
        pandocArgs.push('--lua-filter', filterPath);
      }
    }

    // Add template if configured
    const templatePath = getPandocTemplatePath();
    if (templatePath) {
      pandocArgs.push('--reference-doc', templatePath);
    }

    // If no reference doc is provided, mark metadata so Lua filters
    // can apply fallback styling (e.g., table borders) for DOCX output.
    if (!templatePath) {
      pandocArgs.push('-M', 'no_reference_doc=true');
    }

    // Ensure Pandoc can resolve local images referenced by relative paths
    // by adding the document directory (and temporary dir) to resource-path.
    try {
      const resourcePath = `${tmpDir}${path.delimiter}${docDir}`;
      pandocArgs.push(`--resource-path=${resourcePath}`);
    } catch (e) {
      console.warn('[DK-AI] Failed to set Pandoc resource-path:', e);
    }

    // Run Pandoc
    const result = spawnSync(pandocPath, pandocArgs, {
      stdio: 'pipe',
      encoding: 'utf-8',
    });

    // Cleanup temporary directory
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('[DK-AI] Failed to cleanup temp directory:', error);
    }

    if (result.error) {
      throw result.error;
    }

    if (result.status !== 0) {
      throw new Error(`Pandoc failed: ${result.stderr || 'Unknown error'}`);
    }

    if (!fs.existsSync(outputPath)) {
      throw new Error('Pandoc did not produce output file');
    }

    progress.report({ increment: 30 });
    return true; // Export succeeded
  } catch (error) {
    throw error;
  }
}

function replaceMermaidBlocksWithProvidedImages(
  markdown: string,
  mermaidImages: MermaidImage[],
  tmpDir: string
): string {
  const blocks = extractMermaidBlocks(markdown);
  console.log(
    '[DK-AI] replaceMermaidBlocksWithProvidedImages: blocks=',
    blocks.length,
    'images=',
    mermaidImages.length
  );

  if (blocks.length === 0 || mermaidImages.length === 0) {
    console.log('[DK-AI] No blocks or no images, returning unchanged markdown');
    return markdown;
  }

  let result = markdown;
  const count = Math.min(blocks.length, mermaidImages.length);

  for (let i = 0; i < count; i++) {
    const block = blocks[i];
    const image = mermaidImages[i];

    console.log(
      `[DK-AI] Block ${i}: raw length=${block.raw?.length}, image.pngDataUrl length=${image?.pngDataUrl?.length || 0}, width=${image?.width}, height=${image?.height}`
    );

    if (!image?.pngDataUrl) {
      console.log(`[DK-AI] Block ${i}: No pngDataUrl, skipping`);
      continue;
    }

    const match = image.pngDataUrl.match(/^data:image\/[A-Za-z0-9.+-]+;base64,(.+)$/);
    if (!match) {
      console.log(`[DK-AI] Block ${i}: Failed to match base64 pattern in pngDataUrl`);
      continue;
    }

    try {
      const imagePath = path.join(tmpDir, `mermaid-provided-${i + 1}.png`);
      const buffer = Buffer.from(match[1], 'base64');
      fs.writeFileSync(imagePath, buffer);
      console.log(`[DK-AI] Block ${i}: Wrote PNG to ${imagePath}, size=${buffer.length} bytes`);

      // Build markdown image syntax with Pandoc-compatible attributes for sizing
      // Use percentage widths which Pandoc respects better in DOCX export
      let imageMarkdown = `![Mermaid Diagram](${imagePath})`;
      if (image.width && image.height) {
        // Use width percentage based on approximate page width (7.5 inches at 96 DPI = ~720px)
        const pageWidthPx = 720;
        const widthPercent = Math.min(100, Math.round((image.width / pageWidthPx) * 100));
        imageMarkdown += `{width=${widthPercent}%}`;
        console.log(
          `[DK-AI] Block ${i}: Using width ${widthPercent}% (${image.width}px diagram, ${pageWidthPx}px page)`
        );
      }

      result = result.replace(block.raw, imageMarkdown);
      console.log(`[DK-AI] Block ${i}: Replaced markdown, new length=${result.length}`);
    } catch (error) {
      console.warn('[DK-AI] Failed to write provided Mermaid image for export:', error);
    }
  }

  return result;
}

/**
 * Build complete HTML document for PDF export with styling
 */
function buildExportHTML(contentHtml: string, theme: string, _format: 'pdf' | 'html'): string {
  const styles = getExportStyles(theme);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        ${styles}
      </style>
    </head>
    <body>
      <div class="content">
        ${contentHtml}
      </div>
    </body>
    </html>
  `;
}

/**
 * Get CSS styles for exported documents
 */
function getExportStyles(theme: string): string {
  const baseStyles = `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Charter', 'Georgia', 'Cambria', 'Times New Roman', serif;
      font-size: 16px;
      line-height: 1.6;
      color: ${theme === 'light' ? '#1a1a1a' : '#e0e0e0'};
      background: ${theme === 'light' ? '#ffffff' : '#1e1e1e'};
    }

    .content {
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
    }

    h1, h2, h3, h4, h5, h6 {
      font-weight: 600;
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      line-height: 1.3;
    }

    h1 { font-size: 2.5em; margin-top: 0; }
    h2 { font-size: 2em; }
    h3 { font-size: 1.5em; }
    h4 { font-size: 1.25em; }
    h5 { font-size: 1.1em; }
    h6 { font-size: 1em; }

    p {
      margin-bottom: 0.9em;
    }

    code {
      font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
      background: ${theme === 'light' ? '#f5f5f5' : '#2d2d2d'};
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 0.9em;
    }

    pre {
      background: ${theme === 'light' ? '#f5f5f5' : '#2d2d2d'};
      padding: 16px;
      border-radius: 6px;
      overflow-x: auto;
      margin-bottom: 1em;
    }

    pre code {
      background: none;
      padding: 0;
    }

    blockquote {
      border-left: 4px solid ${theme === 'light' ? '#ddd' : '#444'};
      padding-left: 16px;
      margin: 1em 0;
      color: ${theme === 'light' ? '#666' : '#aaa'};
    }

    table {
      border-collapse: collapse;
      width: 100%;
      margin: 1em 0;
    }

    th, td {
      border: 1px solid ${theme === 'light' ? '#ddd' : '#444'};
      padding: 8px 12px;
      text-align: left;
    }

    th {
      background: ${theme === 'light' ? '#f5f5f5' : '#2d2d2d'};
      font-weight: 600;
    }

    ul, ol {
      margin-left: 1.4em;
      margin-bottom: 0.5em;
    }

    li {
      margin-bottom: 0.25em;
    }

    li p {
      margin-bottom: 0.2em;
    }

    img, .mermaid-export-image {
      max-width: 100%;
      height: auto;
      margin: 1em 0;
    }

    a {
      color: ${theme === 'light' ? '#0066cc' : '#4dabf7'};
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }
  `;

  return baseStyles;
}

/**
 * Resolve relative image paths in markdown to absolute paths
 *
 * @param markdown The raw markdown content
 * @param baseDir The base directory resolving relative paths against
 * @returns Markdown string with image references pointing to absolute local paths
 */
export function resolveMarkdownImagePaths(markdown: string, baseDir: string): string {
  // Regex extracts: 1=alt text, 2=url, 3=optional title with quotes
  const imgRegex = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+("[^"]*"))?\)/g;

  return markdown.replace(imgRegex, (match, alt, url, title) => {
    let imgUrl = url;
    const imgTitle = title ? ` ${title}` : '';

    // Skip absolute URLs or data URIs
    if (
      imgUrl.startsWith('http://') ||
      imgUrl.startsWith('https://') ||
      imgUrl.startsWith('data:') ||
      imgUrl.startsWith('file://') ||
      path.isAbsolute(imgUrl) // Mac/Linux '/' or Windows 'C:\'
    ) {
      return match;
    }

    try {
      // Decode encoded URIs (e.g %20 -> space)
      imgUrl = decodeURIComponent(imgUrl);
    } catch {
      // Ignore decoding errors
    }

    // Convert relative path to absolute
    const absolutePath = path.join(baseDir, imgUrl);
    return `![${alt}](${absolutePath}${imgTitle})`;
  });
}

/**
 * Resolve relative image paths in HTML to absolute paths
 *
 * @param html The raw HTML string
 * @param baseDir The base directory to resolve relative paths against
 * @returns HTML string with img src attributes pointing to absolute local paths
 */
export function resolveHtmlImagePaths(html: string, baseDir: string): string {
  // Regex extracts: 1=quote type (single or double), 2=url
  const imgRegex = /<img[^>]+src=(['"])(.*?)\1/g;

  return html.replace(imgRegex, (match, quote, url) => {
    // Skip absolute URLs or data URIs
    if (
      url.startsWith('http://') ||
      url.startsWith('https://') ||
      url.startsWith('data:') ||
      url.startsWith('file://') ||
      path.isAbsolute(url)
    ) {
      return match;
    }

    try {
      url = decodeURIComponent(url);
    } catch {
      // Ignore
    }

    const absolutePath = path.join(baseDir, url);
    return match.replace(`src=${quote}${url}${quote}`, `src=${quote}${absolutePath}${quote}`);
  });
}
