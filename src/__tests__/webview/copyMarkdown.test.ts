/**
 * Tests for copyMarkdown - Copy selection as markdown
 *
 * Tests the copy functionality that serializes editor selection to markdown
 * and copies it to the system clipboard.
 */

// Mock navigator.clipboard before importing the module
const mockWriteText = jest.fn();
const mockExecCommand = jest.fn();

// Set up global mocks
Object.defineProperty(global, 'navigator', {
  value: {
    clipboard: {
      writeText: mockWriteText,
    },
  },
  writable: true,
});

Object.defineProperty(global, 'document', {
  value: {
    createElement: jest.fn(() => ({
      value: '',
      style: {},
      select: jest.fn(),
    })),
    body: {
      appendChild: jest.fn(),
      removeChild: jest.fn(),
    },
    execCommand: mockExecCommand,
    querySelector: jest.fn(),
  },
  writable: true,
});

import { copyToClipboard } from '../../webview/utils/copyMarkdown';

describe('copyMarkdown', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWriteText.mockResolvedValue(undefined);
    mockExecCommand.mockReturnValue(true);
  });

  describe('copyToClipboard', () => {
    it('should use Clipboard API when available', async () => {
      const markdown = '# Test Heading';

      const result = await copyToClipboard(markdown);

      expect(result.success).toBe(true);
      expect(result.markdown).toBe(markdown);
      expect(mockWriteText).toHaveBeenCalledWith(markdown);
    });

    it('should return success with correct markdown', async () => {
      const markdown = '**bold** and *italic*';

      const result = await copyToClipboard(markdown);

      expect(result.success).toBe(true);
      expect(result.markdown).toBe(markdown);
    });

    it('should fallback to execCommand when Clipboard API fails', async () => {
      mockWriteText.mockRejectedValue(new Error('Permission denied'));

      const markdown = 'Test content';
      const result = await copyToClipboard(markdown);

      expect(result.success).toBe(true);
      expect(mockExecCommand).toHaveBeenCalledWith('copy');
    });

    it('should return failure when both methods fail', async () => {
      mockWriteText.mockRejectedValue(new Error('Permission denied'));
      mockExecCommand.mockReturnValue(false);

      const result = await copyToClipboard('Test');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle empty string', async () => {
      const result = await copyToClipboard('');

      expect(result.success).toBe(true);
      expect(result.markdown).toBe('');
    });

    it('should handle multiline markdown', async () => {
      const markdown = `# Heading

This is a paragraph.

- List item 1
- List item 2

\`\`\`javascript
const x = 1;
\`\`\``;

      const result = await copyToClipboard(markdown);

      expect(result.success).toBe(true);
      expect(result.markdown).toBe(markdown);
    });

    it('should handle special characters', async () => {
      const markdown = '`code` and **<html>** & "quotes"';

      const result = await copyToClipboard(markdown);

      expect(result.success).toBe(true);
      expect(result.markdown).toBe(markdown);
    });

    it('should handle unicode content', async () => {
      const markdown = '# 你好世界 🌍\n\nПривет мир';

      const result = await copyToClipboard(markdown);

      expect(result.success).toBe(true);
      expect(result.markdown).toBe(markdown);
    });
  });

  // Note: getSelectionAsMarkdown and copySelectionAsMarkdown require a TipTap editor
  // instance which is complex to mock. Integration testing is more appropriate for those.
  // The following tests document expected behavior:

  describe('getSelectionAsMarkdown (behavior expectations)', () => {
    it.todo('should return null when selection is empty');
    it.todo('should serialize heading to markdown with # prefix');
    it.todo('should serialize bullet list to markdown');
    it.todo('should serialize code block with language');
    it.todo('should serialize links correctly');
    it.todo('should serialize task list items');
  });

  describe('visual feedback (behavior expectations)', () => {
    it.todo('should add .copied class on successful copy');
    it.todo('should add .copy-failed class on failed copy');
    it.todo('should add .no-selection class when nothing selected');
  });
});
