/**
 * Unit tests for spellCheck.ts — pure helper functions only.
 *
 * Tests cover:
 * - normaliseQuotes: smart apostrophe → ASCII
 * - maskUrls: URL/email masking
 * - prepareText: combined normalisation
 * - isNoScanNode: no-scan zone predicate
 *
 * No Worker, no DOM, no TipTap editor required.
 */

import { normaliseQuotes, maskUrls, prepareText, isNoScanNode } from '../../webview/extensions/spellCheck';
import type { Node as PmNode } from '@tiptap/pm/model';

// ── Helper: create a minimal fake PmNode ─────────────────────────────────────

function fakeNode(typeName: string): PmNode {
  return { type: { name: typeName } } as unknown as PmNode;
}

// ── normaliseQuotes ──────────────────────────────────────────────────────────

describe('normaliseQuotes', () => {
  it('replaces U+2019 (right single quote) with ASCII apostrophe', () => {
    expect(normaliseQuotes('don\u2019t')).toBe("don't");
    expect(normaliseQuotes('isn\u2019t')).toBe("isn't");
    expect(normaliseQuotes('you\u2019re')).toBe("you're");
  });

  it('replaces U+2018 (left single quote) with ASCII apostrophe', () => {
    expect(normaliseQuotes('\u2018hello\u2019')).toBe("'hello'");
  });

  it('leaves ASCII apostrophes unchanged', () => {
    expect(normaliseQuotes("don't")).toBe("don't");
  });

  it('leaves text without apostrophes unchanged', () => {
    expect(normaliseQuotes('hello world')).toBe('hello world');
  });

  it('handles multiple contractions in one string', () => {
    const input = 'don\u2019t isn\u2019t you\u2019re they\u2019ve';
    expect(normaliseQuotes(input)).toBe("don't isn't you're they've");
  });

  it('returns empty string for empty input', () => {
    expect(normaliseQuotes('')).toBe('');
  });
});

// ── maskUrls ─────────────────────────────────────────────────────────────────

describe('maskUrls', () => {
  it('masks https URLs with spaces of equal length', () => {
    const url = 'https://example.com/path';
    const result = maskUrls(`Visit ${url} now`);
    expect(result).toBe(`Visit ${' '.repeat(url.length)} now`);
  });

  it('masks http URLs', () => {
    const url = 'http://example.com';
    const result = maskUrls(url);
    expect(result).toBe(' '.repeat(url.length));
  });

  it('masks ftp URLs', () => {
    const url = 'ftp://files.example.com/file.txt';
    const result = maskUrls(url);
    expect(result).toBe(' '.repeat(url.length));
  });

  it('masks www.* bare domain patterns', () => {
    const url = 'www.example.com';
    const result = maskUrls(url);
    expect(result).toBe(' '.repeat(url.length));
  });

  it('masks email addresses', () => {
    const email = 'user@example.com';
    const result = maskUrls(email);
    expect(result).toBe(' '.repeat(email.length));
  });

  it('preserves surrounding normal text', () => {
    const result = maskUrls('See https://example.com for details');
    expect(result).toMatch(/^See\s+\s+for details$/);
    expect(result.length).toBe('See https://example.com for details'.length);
  });

  it('leaves plain text unchanged', () => {
    expect(maskUrls('hello world')).toBe('hello world');
  });

  it('returns empty string for empty input', () => {
    expect(maskUrls('')).toBe('');
  });
});

// ── prepareText ───────────────────────────────────────────────────────────────

describe('prepareText', () => {
  it('normalises smart quotes AND masks URLs in one pass', () => {
    const input = 'don\u2019t visit https://example.com';
    const result = prepareText(input);
    expect(result).toContain("don't");
    expect(result).not.toContain('https://');
  });

  it('URL length is preserved after normalisation', () => {
    const input = 'go to https://example.com now';
    const result = prepareText(input);
    expect(result.length).toBe(input.length);
  });
});

// ── isNoScanNode ─────────────────────────────────────────────────────────────

describe('isNoScanNode', () => {
  it.each([
    'codeBlock',
    'code',
    'image',
    'hardBreak',
    'horizontalRule',
    'frontmatterBlock',
    'mermaidBlock',
    'drawioBlock',
  ])('returns true for no-scan type: %s', (typeName) => {
    expect(isNoScanNode(fakeNode(typeName))).toBe(true);
  });

  it.each([
    'paragraph',
    'heading',
    'blockquote',
    'bulletList',
    'listItem',
    'text',
    'doc',
  ])('returns false for scannable type: %s', (typeName) => {
    expect(isNoScanNode(fakeNode(typeName))).toBe(false);
  });
});
