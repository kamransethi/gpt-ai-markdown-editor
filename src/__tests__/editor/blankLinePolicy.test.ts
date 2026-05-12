import { applyBlankLinePolicy } from '../../shared/blankLinePolicy';

describe('applyBlankLinePolicy', () => {
  it('keeps content unchanged in preserve mode', () => {
    const input = 'A\n\n\nB\n';
    expect(applyBlankLinePolicy(input, 'preserve')).toBe(input);
  });

  it('collapses extra blank lines in strip mode', () => {
    const input = 'A\n\n\n\nB\n';
    expect(applyBlankLinePolicy(input, 'strip')).toBe('A\n\nB\n');
  });

  it('does not collapse blank lines inside fenced code blocks', () => {
    const input = ['```txt', 'a', '', '', 'b', '```', '', '', 'After', ''].join('\n');
    const output = applyBlankLinePolicy(input, 'strip');
    expect(output).toContain('a\n\n\nb');
    expect(output).toContain('```\n\nAfter');
  });
});
