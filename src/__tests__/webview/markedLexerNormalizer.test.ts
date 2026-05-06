/** @jest-environment node */

import { normalizeBlankLineGreedyTokens } from '../../webview/utils/markedLexerNormalizer';

describe('normalizeBlankLineGreedyTokens', () => {
  it('splits trailing blank-line newlines off a heading token into a space token', () => {
    const tokens = [
      { type: 'heading', raw: '## Title\n\n\n\n\n', depth: 2, text: 'Title' },
      { type: 'paragraph', raw: 'Text\n', text: 'Text' },
    ];

    const out = normalizeBlankLineGreedyTokens(tokens);

    expect(out).toHaveLength(3);
    expect(out[0]).toMatchObject({ type: 'heading', raw: '## Title' });
    expect(out[1]).toEqual({ type: 'space', raw: '\n\n\n\n\n' });
    expect(out[2]).toMatchObject({ type: 'paragraph', raw: 'Text\n' });
  });

  it('splits trailing newlines off a table token', () => {
    const tokens = [
      { type: 'table', raw: '| a | b |\n|---|---|\n| 1 | 2 |\n\n\n\n\n' },
      { type: 'paragraph', raw: 'Text\n' },
    ];

    const out = normalizeBlankLineGreedyTokens(tokens);

    expect(out).toHaveLength(3);
    expect(out[0]).toMatchObject({
      type: 'table',
      raw: '| a | b |\n|---|---|\n| 1 | 2 |',
    });
    expect(out[1]).toEqual({ type: 'space', raw: '\n\n\n\n\n' });
  });

  it('leaves blocks with a single trailing newline alone', () => {
    const tokens = [
      { type: 'heading', raw: '## Title\n', depth: 2, text: 'Title' },
      { type: 'paragraph', raw: 'Text\n' },
    ];

    const out = normalizeBlankLineGreedyTokens(tokens);

    expect(out).toEqual(tokens);
  });

  it('does not touch paragraph or space tokens', () => {
    const tokens = [
      { type: 'paragraph', raw: 'Para1' },
      { type: 'space', raw: '\n\n\n' },
      { type: 'paragraph', raw: 'Para2' },
    ];

    const out = normalizeBlankLineGreedyTokens(tokens);

    expect(out).toEqual(tokens);
  });

  it('preserves the links side-channel that marked attaches to the tokens array', () => {
    const tokens: Array<{ type: string; raw: string }> = [
      { type: 'heading', raw: '## Title\n\n\n' },
    ];
    const links = { foo: { href: 'https://example.com', title: null } };
    (tokens as unknown as { links: typeof links }).links = links;

    const out = normalizeBlankLineGreedyTokens(tokens);

    expect((out as unknown as { links: typeof links }).links).toBe(links);
  });

  it('round-trip: greedy heading + 4 blank lines yields 3 extra empty paragraphs via BlankLinePreservation', () => {
    // Mirrors the behavior of BlankLinePreservation.parseMarkdown:
    //   extras = max(0, newlineCount - 2)
    const tokens = [{ type: 'heading', raw: '## Title\n\n\n\n\n' }];

    const [, spaceToken] = normalizeBlankLineGreedyTokens(tokens);
    const newlineCount = (spaceToken.raw?.match(/\n/g) ?? []).length;
    const extras = Math.max(0, newlineCount - 2);

    // Source had 5 newlines after "Title" = 1 line terminator + 4 visible blank
    // lines. Standard separator covers 1 blank → 3 extras remain.
    expect(extras).toBe(3);
  });
});
