/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

import { extractMermaidBlocks } from '../../features/mermaidToImages';
import { convertMermaidToImages } from '../../features/mermaidToImages';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawn } from 'child_process';

jest.mock('child_process', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fsLocal = require('fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { EventEmitter } = require('events');

  return {
    spawn: jest.fn((cmd: string, args: string[]) => {
      const proc = new EventEmitter() as any;
      proc.stderr = new EventEmitter();
      proc.stdout = new EventEmitter();

      if (cmd === 'mmdc' || String(cmd).includes('node_modules/.bin/mmdc')) {
        setImmediate(() => {
          proc.emit('error', new Error('ENOENT'));
        });
        return proc;
      }

      const outIdx = args.indexOf('-o');
      const outputPath = outIdx >= 0 ? args[outIdx + 1] : undefined;
      if (outputPath) {
        fsLocal.writeFileSync(outputPath, 'fake-png-bytes');
      }

      setImmediate(() => {
        proc.emit('close', 0);
      });

      return proc;
    }),
  };
});

describe('extractMermaidBlocks', () => {
  it('extracts fenced mermaid blocks with unix line endings', () => {
    const markdown = ['# Title', '', '```mermaid', 'graph TD', '  A --> B', '```', '', 'Text'].join(
      '\n'
    );

    const blocks = extractMermaidBlocks(markdown);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].code).toBe('graph TD\n  A --> B');
    expect(blocks[0].raw).toContain('```mermaid');
    expect(blocks[0].raw).toContain('A --> B');
  });

  it('extracts fenced mermaid blocks with windows line endings', () => {
    const markdown = ['```mermaid', 'sequenceDiagram', '  Alice->>Bob: Hi', '```'].join('\r\n');

    const blocks = extractMermaidBlocks(markdown);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].code).toBe('sequenceDiagram\n  Alice->>Bob: Hi');
  });

  it('supports info-string attributes on mermaid fences', () => {
    const markdown = ['```mermaid {#id .class}', 'flowchart LR', '  A --> B', '```'].join('\n');

    const blocks = extractMermaidBlocks(markdown);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].code).toContain('flowchart LR');
  });
});

describe('convertMermaidToImages', () => {
  beforeEach(() => {
    (spawn as jest.Mock).mockClear();
  });

  it('replaces mermaid fenced blocks with image markdown when mmdc succeeds', async () => {
    const markdown = ['# Doc', '', '```mermaid', 'graph TD', '  A --> B', '```', '', 'End'].join(
      '\n'
    );

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mermaid-test-'));
    try {
      const converted = await convertMermaidToImages(markdown, tmpDir);

      expect(converted).toContain('![Mermaid Diagram](');
      expect(converted).not.toContain('```mermaid');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('falls back to npx mermaid-cli when mmdc is unavailable', async () => {
    const markdown = ['```mermaid', 'graph TD', '  A --> B', '```'].join('\n');

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mermaid-test-'));
    try {
      const converted = await convertMermaidToImages(markdown, tmpDir);

      expect(converted).toContain('![Mermaid Diagram](');
      const commands = (spawn as jest.Mock).mock.calls.map(call => call[0]);
      expect(commands).toContain('mmdc');
      expect(
        commands.some(
          (cmd: unknown) =>
            typeof cmd === 'string' &&
            (cmd === process.env.SHELL || cmd === '/bin/zsh' || cmd === 'cmd.exe')
        )
      ).toBe(true);
      expect(commands).toContain('npx');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
