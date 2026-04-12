/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

/**
 * @file documentExport.ts - PDF and Word document export (orchestrator)
 * @description Thin orchestrator that delegates to focused modules:
 *   - chromeDetection.ts — Chrome/Chromium detection, validation, user prompts
 *   - exportPathUtils.ts — image path resolution (markdown & HTML)
 *   - exportStyles.ts   — HTML/CSS generation for PDF export
 *
 * All public symbols are re-exported for backward compatibility with tests.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { toErrorMessage } from '../shared/errorUtils';
import * as os from 'os';
import { spawn, spawnSync } from 'child_process';
import { ensurePandocPath, getPandocTemplatePath, getLuaFiltersDir } from './pandocHelper';
import { convertMermaidToImages, extractMermaidBlocks } from './mermaidToImages';

// ── Re-exports from extracted modules (keeps existing import paths working) ──
export {
  type ChromeValidationResult,
  type ChromeDetectionResult,
  validateChromePath,
  findChromeExecutable,
  promptForChromePath,
  ensureChromePath,
  resolveChromeExecutable,
} from './chromeDetection';
export {
  resolveMarkdownImagePaths,
  resolveHtmlImagePaths,
  convertHtmlImagesToMarkdown,
} from './exportPathUtils';
export { buildExportHTML, getExportStyles } from './exportStyles';

// ── Local imports from extracted modules ──
import { ensureChromePath } from './chromeDetection';
import {
  resolveMarkdownImagePaths,
  resolveHtmlImagePaths,
  convertHtmlImagesToMarkdown,
} from './exportPathUtils';
import { buildExportHTML } from './exportStyles';

// ── Types ───────────────────────────────────────────────────────────

interface MermaidImage {
  id: string;
  pngDataUrl: string;
  originalSvg: string;
  width?: number;
  height?: number;
}

// ── Helpers ─────────────────────────────────────────────────────────

function getDocumentBasePath(document: vscode.TextDocument): string {
  if (document.uri.scheme === 'file') {
    return path.dirname(document.uri.fsPath);
  }
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
  if (workspaceFolder) {
    return workspaceFolder.uri.fsPath;
  }
  return os.homedir();
}

async function showExportWarning(format: string): Promise<boolean> {
  const formatName = format === 'pdf' ? 'PDF' : 'Word';
  const message = `Export to ${formatName} works best with simple markdown files.\n\nKnown limitations:\n• Images (especially remote URLs)\n• Mermaid diagrams\n• Complex markdown structures\n\nSome content may not render correctly in the exported document.`;
  const action = await vscode.window.showWarningMessage(message, { modal: true }, 'I Understand');
  return action === 'I Understand';
}

// ── Main entry point ────────────────────────────────────────────────

export async function exportDocument(
  format: string,
  html: string,
  mermaidImages: MermaidImage[],
  title: string,
  document: vscode.TextDocument
): Promise<void> {
  const userConfirmed = await showExportWarning(format);
  if (!userConfirmed) {
    return;
  }

  const docBasePath = getDocumentBasePath(document);
  const resolvedHtml = resolveHtmlImagePaths(html, docBasePath);
  const exportTheme = 'light';

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
    return;
  }

  const uri = saveUri;

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

// ── PDF export ──────────────────────────────────────────────────────

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

  const completeHtml = buildExportHTML(html, theme, 'pdf');
  const docDir = getDocumentBasePath(document);
  const htmlWithBase = completeHtml.replace('<head>', `<head><base href="file://${docDir}/">`);

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
    return true;
  } catch (error) {
    const errMessage =
      error instanceof Error ? error.message : 'Unknown error while exporting to PDF';
    const wrapped = new Error(errMessage) as Error & { cause?: unknown };
    wrapped.cause = error;
    throw wrapped;
  } finally {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.warn('[DK-AI] Failed to clean up temporary export directory:', cleanupError);
    }
  }
}

async function runChrome(executablePath: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const spawnOptions: {
      stdio: 'ignore';
      windowsHide?: boolean;
      detached?: boolean;
      shell?: boolean;
    } = {
      stdio: 'ignore',
    };

    if (process.platform === 'win32') {
      spawnOptions.windowsHide = true;
      spawnOptions.detached = false;
      spawnOptions.shell = false;
    }

    const chromeProcess = spawn(executablePath, args, spawnOptions);

    chromeProcess.once('error', (error: unknown) => {
      reject(
        new Error(
          `Failed to launch Chrome: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    });

    chromeProcess.once('exit', (code: number | null) => {
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

// ── Word export ─────────────────────────────────────────────────────

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

  let pandocPath = vscode.workspace
    .getConfiguration('gptAiMarkdownEditor')
    .get<string>('pandocPath');

  if (!pandocPath) {
    const tokenSource = new vscode.CancellationTokenSource();
    pandocPath = (await ensurePandocPath(progress, tokenSource.token)) ?? undefined;

    if (!pandocPath) {
      throw new Error('Pandoc not found. Please install Pandoc or configure its path in settings.');
    }
  }

  progress.report({ message: 'Preparing markdown source...', increment: 15 });

  const docDir = getDocumentBasePath(document);
  let markdown = resolveMarkdownImagePaths(document.getText(), docDir);
  markdown = convertHtmlImagesToMarkdown(markdown, docDir);

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
  }

  progress.report({ message: 'Writing temporary markdown file...', increment: 15 });

  try {
    // Preserve 2-newline runs to maintain list item boundaries; only collapse 3+ newlines
    processedMarkdown = processedMarkdown.replace(/\n{3,}(\s*([-*+]|\d+\.)\s+)/g, '\n\n$1');
  } catch {
    // Non-fatal
  }

  const tmpMarkdownPath = path.join(tmpDir, 'document.md');
  fs.writeFileSync(tmpMarkdownPath, processedMarkdown, 'utf-8');

  progress.report({ message: 'Running Pandoc...', increment: 20 });

  const pandocArgs: string[] = [
    tmpMarkdownPath,
    '-o',
    outputPath,
    '-t',
    'docx',
    '-f',
    'markdown+pipe_tables+task_lists+strikeout+emoji+tex_math_dollars+footnotes+backtick_code_blocks+fenced_code_blocks+fenced_code_attributes+autolink_bare_uris',
  ];

  const luaFiltersDir = getLuaFiltersDir();
  const luaFilters = ['github_alerts.lua', 'text_color.lua', 'mermaid_images.lua'];

  for (const filter of luaFilters) {
    const filterPath = path.join(luaFiltersDir, filter);
    if (fs.existsSync(filterPath)) {
      pandocArgs.push('--lua-filter', filterPath);
    }
  }

  const templatePath = getPandocTemplatePath();
  if (templatePath) {
    pandocArgs.push('--reference-doc', templatePath);
  }

  if (!templatePath) {
    pandocArgs.push('-M', 'no_reference_doc=true');
  }

  try {
    const resourcePath = `${tmpDir}${path.delimiter}${docDir}`;
    pandocArgs.push(`--resource-path=${resourcePath}`);
  } catch (e) {
    console.warn('[DK-AI] Failed to set Pandoc resource-path:', e);
  }

  const result = spawnSync(pandocPath, pandocArgs, {
    stdio: 'pipe',
    encoding: 'utf-8',
  });

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
  return true;
}

// ── Mermaid helpers ─────────────────────────────────────────────────

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

      let imageMarkdown = `![Mermaid Diagram](${imagePath})`;
      if (image.width && image.height) {
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
