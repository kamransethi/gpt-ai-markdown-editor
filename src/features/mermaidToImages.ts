/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

/**
 * @file mermaidToImages.ts
 * @description Convert Mermaid diagrams to images for Pandoc export
 * Replaces mermaid code blocks with embedded images in a temporary markdown file
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn, type ChildProcess } from 'child_process';

interface MermaidBlock {
  raw: string;
  code: string;
  id: string;
  imagePath?: string;
}

/**
 * Extract all mermaid blocks from markdown content
 */
export function extractMermaidBlocks(markdown: string): MermaidBlock[] {
  const blocks: MermaidBlock[] = [];
  const mermaidRegex = /```mermaid[^\r\n]*\r?\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = mermaidRegex.exec(markdown)) !== null) {
    blocks.push({
      raw: match[0],
      code: match[1].replace(/\r\n/g, '\n').trim(),
      id: `mermaid-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    });
  }

  return blocks;
}

/**
 * Convert mermaid blocks to images using mmdc (mermaid-cli)
 * Returns markdown with images or original if mermaid-cli not available
 */
export async function convertMermaidToImages(markdown: string, tmpDir: string): Promise<string> {
  const blocks = extractMermaidBlocks(markdown);

  if (blocks.length === 0) {
    return markdown;
  }

  let result = markdown;

  // Try to convert each mermaid block to an image
  for (const block of blocks) {
    try {
      const imagePath = await renderMermaidToPng(block.code, block.id, tmpDir);

      if (imagePath && fs.existsSync(imagePath)) {
        // Replace the exact matched block to avoid line-ending/spacing mismatches.
        result = result.replace(block.raw, `![Mermaid Diagram](${imagePath})`);
      }
    } catch (error) {
      console.warn(`[DK-AI] Failed to convert mermaid diagram to image:`, error);
      // Fall back to including code block as-is
    }
  }

  return result;
}

/**
 * Render a single mermaid diagram to PNG using mermaid-cli
 */
async function renderMermaidToPng(
  code: string,
  id: string,
  tmpDir: string
): Promise<string | undefined> {
  const outputPath = path.join(tmpDir, `${id}.png`);

  try {
    return await renderWithMermaidCli(code, outputPath);
  } catch (error) {
    console.warn('[DK-AI] Mermaid rendering failed:', error);
    return undefined;
  }
}

/**
 * Use mermaid-cli (mmdc) to render diagram
 */
async function renderWithMermaidCli(code: string, outputPath: string): Promise<string | undefined> {
  // Write code to temp file
  const inputPath = outputPath.replace('.png', '.mmd');
  fs.writeFileSync(inputPath, code);

  const mmdcCmd = process.platform === 'win32' ? 'mmdc.cmd' : 'mmdc';
  const localBinCmd = path.join(process.cwd(), 'node_modules', '.bin', mmdcCmd);
  const shellPath = process.env.SHELL || (process.platform === 'win32' ? 'cmd.exe' : '/bin/zsh');
  const baseArgs = ['-i', inputPath, '-o', outputPath, '-t', 'light', '-w', '1200', '-s', '2'];

  const candidates: Array<{ command: string; args: string[]; useShell?: boolean }> = [
    { command: mmdcCmd, args: baseArgs },
    { command: localBinCmd, args: baseArgs },
    // Shell fallback is important in VS Code extension host where PATH can differ
    // from the interactive terminal (e.g. nvm-managed Node/npm global bins).
    process.platform === 'win32'
      ? {
          command: 'cmd.exe',
          args: ['/d', '/s', '/c', `mmdc ${baseArgs.map(escapeCmdArg).join(' ')}`],
        }
      : {
          command: shellPath,
          args: ['-lic', `mmdc ${baseArgs.map(escapeShellArg).join(' ')}`],
        },
    { command: 'npx', args: ['--yes', '@mermaid-js/mermaid-cli', ...baseArgs] },
  ];

  let lastError: string | undefined;
  try {
    for (const candidate of candidates) {
      try {
        const rendered = await runMermaidCli(
          candidate.command,
          candidate.args,
          outputPath,
          candidate.useShell === true
        );
        if (rendered) {
          return rendered;
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }
  } finally {
    // Clean up temp source file irrespective of success/failure.
    try {
      fs.unlinkSync(inputPath);
    } catch {
      // Ignore cleanup errors
    }
  }

  throw new Error(lastError || 'mmdc rendering failed');
}

async function runMermaidCli(
  command: string,
  args: string[],
  outputPath: string,
  useShell = false
): Promise<string | undefined> {
  return new Promise((resolve, reject) => {
    const proc: ChildProcess = spawn(command, args, {
      stdio: 'pipe',
      shell: useShell,
    });

    let errorOutput = '';
    let stdOutput = '';

    proc.stderr?.on('data', (data: Buffer) => {
      errorOutput += data.toString();
    });

    proc.stdout?.on('data', (data: Buffer) => {
      stdOutput += data.toString();
    });

    proc.on('error', (error: Error) => {
      reject(error);
    });

    proc.on('close', (code: number | null) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        resolve(outputPath);
      } else {
        const details = [errorOutput, stdOutput].filter(Boolean).join('\n').trim();
        reject(new Error(details || `${command} exited with code ${String(code)}`));
      }
    });
  });
}

function escapeShellArg(arg: string): string {
  return `'${arg.replace(/'/g, `'\\''`)}'`;
}

function escapeCmdArg(arg: string): string {
  // Minimal escaping for cmd.exe argument wrapping.
  if (/\s|"/.test(arg)) {
    return `"${arg.replace(/"/g, '""')}"`;
  }
  return arg;
}
