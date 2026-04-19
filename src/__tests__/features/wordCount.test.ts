/**
 * Word Count Feature Tests
 *
 * Tests the pure logic functions (calculateStats, formatStatsTooltip)
 * and the WordCountFeature class using VS Code API mocks.
 */

import {
  calculateStats,
  formatStatsTooltip,
  DocumentStats,
  WordCountFeature,
  isMarkdownDocument,
} from '../../features/wordCount';
import * as vscode from 'vscode';
import {
  window,
  workspace,
  createMockTextDocument,
  createMockTextEditor,
  mockStatusBarItem,
} from '../../__mocks__/vscode';

describe('calculateStats', () => {
  describe('word counting', () => {
    it('should count words in simple text', () => {
      const stats = calculateStats('Hello world');
      expect(stats.words).toBe(2);
    });

    it('should handle multiple spaces between words', () => {
      const stats = calculateStats('Hello    world');
      expect(stats.words).toBe(2);
    });

    it('should handle tabs and newlines as word separators', () => {
      const stats = calculateStats('Hello\tworld\nfoo bar');
      expect(stats.words).toBe(4);
    });

    it('should count hyphenated words as single words', () => {
      const stats = calculateStats('well-known fact');
      expect(stats.words).toBe(2);
    });

    it('should handle markdown formatting', () => {
      const stats = calculateStats('**bold** and *italic* text');
      expect(stats.words).toBe(4);
    });

    it('should count words with numbers', () => {
      const stats = calculateStats('There are 42 answers');
      expect(stats.words).toBe(4);
    });

    it('should handle contractions', () => {
      const stats = calculateStats("don't can't won't");
      expect(stats.words).toBe(3);
    });
  });

  describe('empty and whitespace-only text', () => {
    it('should return zeros for empty string', () => {
      const stats = calculateStats('');
      expect(stats.words).toBe(0);
      expect(stats.characters).toBe(0);
      expect(stats.charactersNoSpaces).toBe(0);
      expect(stats.paragraphs).toBe(0);
      expect(stats.readingTime).toBe(0);
    });

    it('should return zeros for whitespace-only string', () => {
      const stats = calculateStats('   \t\n  ');
      expect(stats.words).toBe(0);
      expect(stats.paragraphs).toBe(0);
      expect(stats.readingTime).toBe(0);
    });

    it('should count lines in whitespace-only string', () => {
      const stats = calculateStats('\n\n\n');
      expect(stats.lines).toBe(4); // 3 newlines = 4 lines
    });
  });

  describe('character counting', () => {
    it('should count all characters including spaces', () => {
      const stats = calculateStats('Hello world');
      expect(stats.characters).toBe(11);
    });

    it('should count characters without spaces', () => {
      const stats = calculateStats('Hello world');
      expect(stats.charactersNoSpaces).toBe(10);
    });

    it('should handle unicode characters', () => {
      const stats = calculateStats('Hello 世界');
      expect(stats.characters).toBe(8);
      expect(stats.charactersNoSpaces).toBe(7);
    });

    it('should count emojis', () => {
      const stats = calculateStats('Hello 👋 world');
      // Note: emoji may count as 2 chars due to JS string handling
      expect(stats.words).toBe(3);
    });
  });

  describe('line counting', () => {
    it('should count single line', () => {
      const stats = calculateStats('Hello world');
      expect(stats.lines).toBe(1);
    });

    it('should count multiple lines', () => {
      const stats = calculateStats('Line 1\nLine 2\nLine 3');
      expect(stats.lines).toBe(3);
    });

    it('should count empty lines', () => {
      const stats = calculateStats('Line 1\n\nLine 3');
      expect(stats.lines).toBe(3);
    });

    it('should handle trailing newline', () => {
      const stats = calculateStats('Line 1\nLine 2\n');
      expect(stats.lines).toBe(3);
    });
  });

  describe('paragraph counting', () => {
    it('should count single paragraph', () => {
      const stats = calculateStats('This is a paragraph.');
      expect(stats.paragraphs).toBe(1);
    });

    it('should count multiple paragraphs', () => {
      const stats = calculateStats('Paragraph 1.\n\nParagraph 2.\n\nParagraph 3.');
      expect(stats.paragraphs).toBe(3);
    });

    it('should handle multiple blank lines between paragraphs', () => {
      const stats = calculateStats('Paragraph 1.\n\n\n\nParagraph 2.');
      expect(stats.paragraphs).toBe(2);
    });

    it('should not count blank paragraphs', () => {
      const stats = calculateStats('Paragraph 1.\n\n   \n\nParagraph 2.');
      expect(stats.paragraphs).toBe(2);
    });
  });

  describe('reading time calculation', () => {
    it('should calculate 1 minute for short text', () => {
      const stats = calculateStats('A short sentence.');
      expect(stats.readingTime).toBe(1);
    });

    it('should calculate correct time for longer text', () => {
      // 400 words should be 2 minutes at 200 WPM
      const words = Array(400).fill('word').join(' ');
      const stats = calculateStats(words);
      expect(stats.readingTime).toBe(2);
    });

    it('should round up reading time', () => {
      // 250 words should round up to 2 minutes
      const words = Array(250).fill('word').join(' ');
      const stats = calculateStats(words);
      expect(stats.readingTime).toBe(2);
    });

    it('should return 0 for empty text', () => {
      const stats = calculateStats('');
      expect(stats.readingTime).toBe(0);
    });
  });

  describe('real-world markdown documents', () => {
    it('should handle a typical markdown document', () => {
      const markdown = `# Heading

This is a paragraph with **bold** and *italic* text.

## Subheading

- List item 1
- List item 2
- List item 3

\`\`\`javascript
const code = "example";
\`\`\`

Another paragraph here.`;

      const stats = calculateStats(markdown);

      expect(stats.words).toBeGreaterThan(10);
      expect(stats.paragraphs).toBeGreaterThan(3);
      expect(stats.lines).toBeGreaterThan(10);
    });

    it('should handle document with frontmatter', () => {
      const markdown = `---
title: My Document
date: 2024-01-01
---

# My Document

Content here.`;

      const stats = calculateStats(markdown);

      // Frontmatter YAML counts as words/paragraphs
      expect(stats.words).toBeGreaterThan(5);
      expect(stats.paragraphs).toBeGreaterThan(2);
    });
  });
});

describe('formatStatsTooltip', () => {
  it('should format stats into readable tooltip', () => {
    const stats: DocumentStats = {
      words: 1234,
      characters: 5678,
      charactersNoSpaces: 4444,
      lines: 100,
      paragraphs: 25,
      readingTime: 6,
    };

    const tooltip = formatStatsTooltip(stats);

    expect(tooltip).toContain('5,678 characters');
    expect(tooltip).toContain('4,444 characters (no spaces)');
    expect(tooltip).toContain('100 lines');
    expect(tooltip).toContain('25 paragraphs');
    expect(tooltip).toContain('~6 min read');
  });

  it('should handle zero values', () => {
    const stats: DocumentStats = {
      words: 0,
      characters: 0,
      charactersNoSpaces: 0,
      lines: 0,
      paragraphs: 0,
      readingTime: 0,
    };

    const tooltip = formatStatsTooltip(stats);

    expect(tooltip).toContain('0 characters');
    expect(tooltip).toContain('0 lines');
  });

  it('should use locale-aware number formatting', () => {
    const stats: DocumentStats = {
      words: 1000000,
      characters: 5000000,
      charactersNoSpaces: 4000000,
      lines: 50000,
      paragraphs: 10000,
      readingTime: 5000,
    };

    const tooltip = formatStatsTooltip(stats);

    // Should have thousands separators (locale-dependent)
    // Handles both Western (5,000,000) and Indian (50,00,000) numbering systems
    // Match either format: "5,000,000" (Western) or "50,00,000" (Indian) or "5.000.000" (European)
    expect(tooltip).toMatch(/(5,000,000|50,00,000|5\.000\.000|5000000) characters/);
  });
});

describe('edge cases', () => {
  it('should handle very long lines', () => {
    const longLine = 'word '.repeat(10000);
    const stats = calculateStats(longLine);
    expect(stats.words).toBe(10000);
    expect(stats.lines).toBe(1);
  });

  it('should handle many short lines', () => {
    const manyLines = Array(10000).fill('word').join('\n');
    const stats = calculateStats(manyLines);
    expect(stats.lines).toBe(10000);
  });

  it('should handle mixed whitespace', () => {
    const mixed = 'word\t\n  \t\nword';
    const stats = calculateStats(mixed);
    expect(stats.words).toBe(2);
  });

  it('should handle non-ASCII text', () => {
    const japanese = 'これは日本語のテキストです。';
    const stats = calculateStats(japanese);
    // Each character separated by empty string counts as 1 "word" with current impl
    expect(stats.characters).toBe(14);
  });
});

describe('isMarkdownDocument', () => {
  it('should return true for markdown documents', () => {
    const doc = createMockTextDocument('# Hello', 'markdown');
    expect(isMarkdownDocument(doc)).toBe(true);
  });

  it('should return false for non-markdown documents', () => {
    const doc = createMockTextDocument('const x = 1;', 'javascript');
    expect(isMarkdownDocument(doc)).toBe(false);
  });

  it('should return false for plaintext documents', () => {
    const doc = createMockTextDocument('Hello world', 'plaintext');
    expect(isMarkdownDocument(doc)).toBe(false);
  });
});

describe('WordCountFeature', () => {
  let feature: WordCountFeature;
  let mockContext: {
    subscriptions: { push: jest.Mock };
  };

  beforeEach(() => {
    feature = new WordCountFeature();
    mockContext = {
      subscriptions: { push: jest.fn() },
    };
    // Reset window mock
    window.activeTextEditor = undefined;
  });

  afterEach(() => {
    feature.dispose();
  });

  describe('activate', () => {
    it('should register status bar item', () => {
      feature.activate(mockContext as unknown as vscode.ExtensionContext);

      // Should have registered status bar and event listeners
      expect(mockContext.subscriptions.push).toHaveBeenCalled();
      expect(vscode.window.createStatusBarItem).toHaveBeenCalledWith(
        vscode.StatusBarAlignment.Right,
        100
      );
    });

    it('should register event listeners', () => {
      feature.activate(mockContext as unknown as vscode.ExtensionContext);

      expect(workspace.onDidChangeTextDocument).toHaveBeenCalled();
      expect(window.onDidChangeActiveTextEditor).toHaveBeenCalled();
      expect(window.onDidChangeTextEditorSelection).toHaveBeenCalled();
    });
  });

  describe('status bar updates', () => {
    it('should hide status bar when no editor is active', () => {
      window.activeTextEditor = undefined;

      feature.activate(mockContext as unknown as vscode.ExtensionContext);

      // The update method should have been called, hiding the status bar
      expect(mockStatusBarItem.hide).toHaveBeenCalled();
    });

    it('should hide status bar for non-markdown files', () => {
      const doc = createMockTextDocument('const x = 1;', 'javascript');
      window.activeTextEditor = createMockTextEditor(doc);

      feature.activate(mockContext as unknown as vscode.ExtensionContext);

      expect(mockStatusBarItem.hide).toHaveBeenCalled();
    });

    it('should show word count for markdown files', () => {
      const doc = createMockTextDocument('Hello world foo bar', 'markdown');
      window.activeTextEditor = createMockTextEditor(doc);

      feature.activate(mockContext as unknown as vscode.ExtensionContext);

      expect(mockStatusBarItem.show).toHaveBeenCalled();
      expect(mockStatusBarItem.text).toContain('words');
    });
  });

  describe('showDetailedStats', () => {
    it('should show info message when no markdown document is open', () => {
      window.activeTextEditor = undefined;

      feature.showDetailedStats();

      expect(window.showInformationMessage).toHaveBeenCalledWith('No markdown document open');
    });

    it('should show stats for markdown document', () => {
      const doc = createMockTextDocument('Hello world test', 'markdown');
      window.activeTextEditor = createMockTextEditor(doc);

      feature.showDetailedStats();

      expect(window.showInformationMessage).toHaveBeenCalled();
      const message = (window.showInformationMessage as jest.Mock).mock.calls[0][0];
      expect(message).toContain('Document Statistics');
      expect(message).toContain('Words');
    });
  });

  describe('dispose', () => {
    it('should dispose of status bar item', () => {
      feature.activate(mockContext as unknown as vscode.ExtensionContext);
      feature.dispose();

      expect(mockStatusBarItem.dispose).toHaveBeenCalled();
    });
  });
});
