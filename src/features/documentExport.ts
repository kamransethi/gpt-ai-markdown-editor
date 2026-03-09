/**
 * Copyright (c) 2025-2026 GPT-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

/**
 * @file documentExport.ts - PDF and Word document export
 * @description Handles exporting markdown documents to PDF (via local Chrome) and Word (via docx).
 * Applies export theme settings and embeds Mermaid diagrams as high-quality images.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { spawn } from 'child_process';
import { imageSize } from 'image-size';

/**
 * Mermaid image data
 */
interface MermaidImage {
  id: string;
  pngDataUrl: string;
  originalSvg: string;
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

  // Convert all images (local and remote) to data URLs for embedding
  // html = await convertImagesToDataUrls(html, document);

  // Export theme is always light
  const exportTheme = 'light';

  // Show file save dialog
  const defaultFilename = title.replace(/[<>:"/\\|?*]/g, '-') || 'document';
  const extension = format === 'pdf' ? 'pdf' : 'docx';
  const filters: Record<string, string[]> = {};
  filters[format === 'pdf' ? 'PDF Document' : 'Word Document'] = [extension];

  const docBasePath = getDocumentBasePath(document);
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
            html,
            mermaidImages,
            exportTheme,
            uri.fsPath,
            progress,
            document,
            token
          );
        } else if (format === 'docx') {
          exportSucceeded = await exportToWord(
            html,
            mermaidImages,
            exportTheme,
            uri.fsPath,
            progress,
            document
          );
        }

        // Only show success message if export actually completed
        if (exportSucceeded) {
          vscode.window.showInformationMessage(
            `Document exported successfully to ${path.basename(uri.fsPath)}`
          );

          // Auto-open PDF in default viewer (only for PDF format)
          if (format === 'pdf') {
            try {
              // Verify file exists before opening
              if (fs.existsSync(uri.fsPath)) {
                await vscode.env.openExternal(vscode.Uri.file(uri.fsPath));
              }
            } catch (error) {
              // Log error but don't fail export - opening is a convenience feature
              console.warn('[GPT-AI] Failed to open PDF:', error);
            }
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Export failed: ${errorMessage}`);
        console.error('[GPT-AI] Export error:', error);
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

      chromeProcess.once('error', error => {
        reject(new Error(`Failed to execute Chrome: ${error.message}`));
      });

      chromeProcess.once('exit', code => {
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
    throw new Error(`Failed to write temporary HTML for export: ${error}`);
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
    throw new Error(errMessage);
  } finally {
    // Clean up temp files
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.warn('[GPT-AI] Failed to clean up temporary export directory:', cleanupError);
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
 * Export to Word using docx library
 *
 * @returns true if export succeeded
 */
async function exportToWord(
  html: string,
  _mermaidImages: MermaidImage[],
  theme: string,
  outputPath: string,
  progress: vscode.Progress<{ message?: string; increment?: number }>,
  document: vscode.TextDocument
): Promise<boolean> {
  progress.report({ message: 'Converting to Word format...', increment: 30 });

  try {
    const docxModule = await import('docx');
    const docx = (docxModule as any).default ?? docxModule;

    progress.report({ message: 'Building document...', increment: 30 });

    // Parse HTML and convert to docx elements
    const children = await htmlToDocx(html, docx, theme, document);

    const doc = new docx.Document({
      sections: [
        {
          properties: {},
          children,
        },
      ],
    });

    progress.report({ message: 'Saving Word document...', increment: 20 });

    // Generate buffer and write to file
    const buffer = await docx.Packer.toBuffer(doc);
    fs.writeFileSync(outputPath, buffer);

    progress.report({ increment: 20 });
    return true; // Export succeeded
  } catch (error) {
    if (error && (error as any).code === 'MODULE_NOT_FOUND') {
      throw new Error('Word export requires docx library. Install with: npm install docx');
    }
    throw error;
  }
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
      margin-bottom: 1em;
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
      margin-left: 2em;
      margin-bottom: 1em;
    }

    li {
      margin-bottom: 0.5em;
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
 * Convert HTML to docx elements using Cheerio for reliable parsing
 * Handles headings, paragraphs, lists, tables, and images with nested tags
 */
async function htmlToDocx(
  html: string,
  docx: any,
  theme: string,
  document: vscode.TextDocument
): Promise<any[]> {
  const children: any[] = [];

  // Parse HTML with Cheerio (proper DOM parser, handles nested tags)
  // Lazy-load to keep module init and test transforms lightweight.
  const cheerioModule = await import('cheerio');
  const cheerio = (cheerioModule as any).default ?? cheerioModule;
  const $ = cheerio.load(html);

  // Select all block-level elements we care about, maintaining document order
  // Cheerio traverses in document order automatically
  // Select all block-level elements we care about
  // We need to use a loop that supports await
  const elements = $('h1, h2, h3, h4, h5, h6, p, li, blockquote, table').toArray();

  for (const element of elements) {
    const $el = $(element);
    const tagName = element.tagName.toLowerCase();

    // Skip elements inside other processed elements (e.g. p inside blockquote handled by blockquote)
    if ($el.parents('blockquote, li').length > 0) {
      continue;
    }

    if (tagName.match(/^h[1-6]$/)) {
      // Heading
      const textContent = $el.text().trim();
      if (textContent) {
        children.push(
          new docx.Paragraph({
            text: textContent,
            heading: getHeadingLevel(tagName, docx),
            spacing: { before: 400, after: 200 },
          })
        );
      }
    } else if (tagName === 'p') {
      // Paragraph - handle mixed content (text, images, links)
      const paragraphChildren = await parseParagraphChildren($, element, docx, document);
      if (paragraphChildren.length > 0) {
        children.push(
          new docx.Paragraph({
            children: paragraphChildren,
            spacing: { after: 200 },
          })
        );
      }
    } else if (tagName === 'li') {
      // List item
      const paragraphChildren = await parseParagraphChildren($, element, docx, document);
      if (paragraphChildren.length > 0) {
        children.push(
          new docx.Paragraph({
            children: paragraphChildren,
            bullet: { level: 0 },
            spacing: { after: 100 },
          })
        );
      }
    } else if (tagName === 'blockquote') {
      // Blockquote
      const textContent = $el.text().trim();
      if (textContent) {
        children.push(
          new docx.Paragraph({
            text: textContent,
            italics: true,
            spacing: { before: 200, after: 200, left: 400 },
            border: {
              left: {
                color: theme === 'editor' ? '444444' : 'DDDDDD',
                space: 1,
                value: 'single',
                size: 24,
              },
            },
          })
        );
      }
    }
  }

  return children;
}

/**
 * Helper to get heading level
 */
function getHeadingLevel(tagName: string, docx: any): any {
  switch (tagName) {
    case 'h1':
      return docx.HeadingLevel.HEADING_1;
    case 'h2':
      return docx.HeadingLevel.HEADING_2;
    case 'h3':
      return docx.HeadingLevel.HEADING_3;
    case 'h4':
      return docx.HeadingLevel.HEADING_4;
    case 'h5':
      return docx.HeadingLevel.HEADING_5;
    case 'h6':
      return docx.HeadingLevel.HEADING_6;
    default:
      return docx.HeadingLevel.HEADING_1;
  }
}

/**
 * Parse children of a paragraph-like element (p, li) into docx Runs
 */
async function parseParagraphChildren(
  $: any,
  element: any,
  docx: any,
  document: vscode.TextDocument
): Promise<any[]> {
  const runs: any[] = [];
  const contents = $(element).contents();

  // Process nodes sequentially to handle async image loading
  for (let i = 0; i < contents.length; i++) {
    const node = contents[i];

    if (node.type === 'text') {
      // Text node
      const text = $(node).text();
      if (text) {
        runs.push(new docx.TextRun({ text }));
      }
    } else if (node.type === 'tag') {
      const tagName = $(node).prop('tagName').toLowerCase();
      if (tagName === 'img') {
        // Image
        const src = $(node).attr('src');
        const markdownSrc = $(node).attr('data-markdown-src');
        const resolvableSrc = markdownSrc || src;

        if (resolvableSrc) {
          try {
            let buffer: Buffer | undefined;

            if (resolvableSrc.startsWith('data:')) {
              // Data URL
              const matches = resolvableSrc.match(/^data:([A-Za-z+/-]+);base64,(.+)$/);
              if (matches && matches.length === 3) {
                buffer = Buffer.from(matches[2], 'base64');
              }
            } else if (
              resolvableSrc.startsWith('http://') ||
              resolvableSrc.startsWith('https://')
            ) {
              // KNOWN LIMITATION: Remote images (HTTP/HTTPS URLs) are not embedded in Word exports.
              // This is intentional to avoid network dependencies during export and potential
              // security concerns with fetching arbitrary remote resources.
              // Workaround: Download images locally before exporting to Word.
              // TODO: Consider adding a user-facing warning when document contains remote images.
              console.warn(`[GPT-AI] Word export: Skipping remote image: ${resolvableSrc}`);
            } else {
              // Local file or vscode-webview://
              let absolutePath = resolvableSrc;

              if (resolvableSrc.startsWith('vscode-webview://')) {
                // const docDir = path.dirname(document.uri.fsPath);
                // const decodedSrc = decodeURIComponent(resolvableSrc);
                // This is a simplification. Real webview resolution is complex.
                // But if we have data-markdown-src (which we prioritize), it usually has the original path
                // If resolvableSrc is still webview://, it means we didn't have data-markdown-src
                // In that case, we might fail to resolve.
              } else if (!path.isAbsolute(resolvableSrc)) {
                const docDir = getDocumentBasePath(document);
                absolutePath = path.resolve(docDir, decodeURIComponent(resolvableSrc));
              }

              if (fs.existsSync(absolutePath)) {
                buffer = fs.readFileSync(absolutePath);
              }
            }

            if (buffer) {
              // Get dimensions
              let width = 400;
              let height = 300;

              try {
                const dimensions = imageSize(buffer);
                if (dimensions.width && dimensions.height) {
                  // Scale down if too large (e.g. max width 600px)
                  const maxWidth = 600;
                  if (dimensions.width > maxWidth) {
                    const ratio = maxWidth / dimensions.width;
                    width = maxWidth;
                    height = Math.round(dimensions.height * ratio);
                  } else {
                    width = dimensions.width;
                    height = dimensions.height;
                  }
                }
              } catch (e) {
                console.warn('[GPT-AI] Failed to get image dimensions:', e);
              }

              runs.push(
                new docx.ImageRun({
                  data: buffer,
                  transformation: { width, height },
                })
              );
            }
          } catch (e) {
            console.error('[GPT-AI] Failed to process image in paragraph:', e);
          }
        }
      } else if (tagName === 'strong' || tagName === 'b') {
        // Bold
        runs.push(
          new docx.TextRun({
            text: $(node).text(),
            bold: true,
          })
        );
      } else if (tagName === 'em' || tagName === 'i') {
        // Italic
        runs.push(
          new docx.TextRun({
            text: $(node).text(),
            italics: true,
          })
        );
      } else if (tagName === 'code') {
        // Inline code
        runs.push(
          new docx.TextRun({
            text: $(node).text(),
            font: 'Courier New',
            color: 'C7254E', // Red-ish color for code
          })
        );
      } else {
        // Other tags - just treat as text for now
        runs.push(new docx.TextRun({ text: $(node).text() }));
      }
    }
  }

  return runs;
}
