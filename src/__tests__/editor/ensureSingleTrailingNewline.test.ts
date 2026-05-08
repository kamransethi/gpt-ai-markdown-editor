/**
 * Copyright (c) 2025-2026 Concret.io
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

import { ensureSingleTrailingNewline } from '../../editor/MarkdownEditorProvider';

describe('ensureSingleTrailingNewline (markdownlint MD047)', () => {
  test('appends a newline when missing', () => {
    expect(ensureSingleTrailingNewline('# Title')).toBe('# Title\n');
  });

  test('leaves a single trailing newline alone', () => {
    expect(ensureSingleTrailingNewline('# Title\n')).toBe('# Title\n');
  });

  test('collapses two trailing newlines to one', () => {
    expect(ensureSingleTrailingNewline('# Title\n\n')).toBe('# Title\n');
  });

  test('collapses many trailing newlines to one', () => {
    expect(ensureSingleTrailingNewline('# Title\n\n\n\n')).toBe('# Title\n');
  });

  test('preserves an empty string (do not materialize a lone newline)', () => {
    expect(ensureSingleTrailingNewline('')).toBe('');
  });

  test('does not touch interior newlines', () => {
    expect(ensureSingleTrailingNewline('a\n\nb')).toBe('a\n\nb\n');
    expect(ensureSingleTrailingNewline('a\n\nb\n')).toBe('a\n\nb\n');
  });

  test('preserves trailing non-newline whitespace before the newline', () => {
    // We intentionally only normalize trailing \n; a stray space at end of file
    // is a separate lint rule (MD009) outside this helper's scope.
    expect(ensureSingleTrailingNewline('# Title  ')).toBe('# Title  \n');
  });
});
