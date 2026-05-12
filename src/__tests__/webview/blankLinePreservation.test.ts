/** @jest-environment node */

import { normalizeBlankLineGreedyTokens } from '../../webview/utils/markedLexerNormalizer';
import { getEditorMarkdownForSync } from '../../webview/utils/markdownSerialization';
import type { JSONContent } from '@tiptap/core';

// ─── Normalizer tests ────────────────────────────────────────────────────────

describe('normalizeBlankLineGreedyTokens – all block types', () => {
  const cases: Array<{ name: string; tokenType: string; raw: string; trimmedRaw: string }> = [
    {
      name: 'ordered list',
      tokenType: 'list',
      raw: '1. a\n2. b\n\n\n\n',
      trimmedRaw: '1. a\n2. b',
    },
    { name: 'unordered list', tokenType: 'list', raw: '- a\n- b\n\n\n', trimmedRaw: '- a\n- b' },
    { name: 'blockquote', tokenType: 'blockquote', raw: '> text\n\n\n', trimmedRaw: '> text' },
    {
      name: 'html block',
      tokenType: 'html',
      raw: '<div>hi</div>\n\n\n',
      trimmedRaw: '<div>hi</div>',
    },
    { name: 'heading', tokenType: 'heading', raw: '## H\n\n\n', trimmedRaw: '## H' },
    { name: 'table', tokenType: 'table', raw: '|a|\n|-|\n|1|\n\n\n', trimmedRaw: '|a|\n|-|\n|1|' },
    { name: 'code block', tokenType: 'code', raw: '```\nx\n```\n\n\n', trimmedRaw: '```\nx\n```' },
    { name: 'hr', tokenType: 'hr', raw: '---\n\n\n', trimmedRaw: '---' },
  ];

  it.each(cases)('splits trailing newlines from $name token', ({ tokenType, raw, trimmedRaw }) => {
    const tokens = [{ type: tokenType, raw }];
    const out = normalizeBlankLineGreedyTokens(tokens);

    expect(out.length).toBeGreaterThanOrEqual(2);
    expect(out[0]).toMatchObject({ type: tokenType, raw: trimmedRaw });
    expect(out[1]).toMatchObject({ type: 'space' });
    expect(out[1].raw).toMatch(/^\n{2,}$/);
  });

  it.each(cases)(
    'leaves $name token alone when it has only one trailing newline',
    ({ tokenType }) => {
      const tokens = [{ type: tokenType, raw: 'content\n' }];
      const out = normalizeBlankLineGreedyTokens(tokens);
      expect(out).toEqual(tokens);
    }
  );

  it('does not touch paragraph or space tokens', () => {
    const tokens = [
      { type: 'paragraph', raw: 'Para\n\n\n' },
      { type: 'space', raw: '\n\n\n' },
    ];
    const out = normalizeBlankLineGreedyTokens(tokens);
    expect(out).toEqual(tokens);
  });
});

// ─── Serialization tests ─────────────────────────────────────────────────────

/** Helper: build a mock Editor that returns the given doc JSON and uses
 *  the provided serialize spy. */
function mockEditor(
  docContent: JSONContent[],
  serialize: jest.Mock
): import('@tiptap/core').Editor {
  return {
    getJSON: jest.fn(() => ({ type: 'doc', content: docContent })),
    markdown: { serialize },
    getMarkdown: jest.fn(() => 'fallback'),
  } as unknown as import('@tiptap/core').Editor;
}

/** Serialize spy that recognises nodes by type/attrs and returns canned markdown. */
function makeSerialize(mapping: Record<string, string>): jest.Mock {
  return jest.fn((json: JSONContent) => {
    const child = Array.isArray(json.content) ? json.content[0] : null;
    if (!child) return '';
    // Try type + attrs key first, then just type
    const key = child.attrs?.language
      ? `${child.type}:${child.attrs.language}`
      : child.attrs?.alertType
        ? `${child.type}:${child.attrs.alertType}`
        : (child.type ?? '');
    return mapping[key] ?? mapping[child.type ?? ''] ?? '';
  });
}

describe('getEditorMarkdownForSync – blank line preservation across block types', () => {
  it('preserves blank line between heading and ordered list', () => {
    const serialize = makeSerialize({
      heading: '## Title',
      orderedList: '1. First\n2. Second',
    });
    const editor = mockEditor(
      [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Title' }] },
        { type: 'paragraph', content: [] }, // intentional blank
        { type: 'orderedList', content: [] },
        { type: 'paragraph', content: [] }, // trailing
      ],
      serialize
    );

    const md = getEditorMarkdownForSync(editor);
    expect(md).toBe('## Title\n\n\n1. First\n2. Second');
  });

  it('preserves blank line between ordered list and paragraph', () => {
    const serialize = makeSerialize({
      orderedList: '1. A\n2. B',
      paragraph: 'Next',
    });
    const editor = mockEditor(
      [
        { type: 'orderedList', content: [] },
        { type: 'paragraph', content: [] }, // blank
        { type: 'paragraph', content: [{ type: 'text', text: 'Next' }] },
        { type: 'paragraph', content: [] }, // trailing
      ],
      serialize
    );

    const md = getEditorMarkdownForSync(editor);
    expect(md).toBe('1. A\n2. B\n\n\nNext');
  });

  it('preserves blank line between blockquote and paragraph', () => {
    const serialize = makeSerialize({
      blockquote: '> Quote',
      paragraph: 'After',
    });
    const editor = mockEditor(
      [
        { type: 'blockquote', content: [] },
        { type: 'paragraph', content: [] }, // blank
        { type: 'paragraph', content: [{ type: 'text', text: 'After' }] },
      ],
      serialize
    );

    const md = getEditorMarkdownForSync(editor);
    expect(md).toBe('> Quote\n\n\nAfter');
  });

  it('preserves blank line between GitHub alert and paragraph', () => {
    const serialize = makeSerialize({
      'githubAlert:NOTE': '> [!NOTE]\n> Info here',
      paragraph: 'After',
    });
    const editor = mockEditor(
      [
        { type: 'githubAlert', attrs: { alertType: 'NOTE' }, content: [] },
        { type: 'paragraph', content: [] }, // blank
        { type: 'paragraph', content: [{ type: 'text', text: 'After' }] },
      ],
      serialize
    );

    const md = getEditorMarkdownForSync(editor);
    expect(md).toBe('> [!NOTE]\n> Info here\n\n\nAfter');
  });

  it('preserves blank line between code block and paragraph', () => {
    const serialize = makeSerialize({
      codeBlock: '```js\nconsole.log("hi")\n```',
      paragraph: 'After',
    });
    const editor = mockEditor(
      [
        { type: 'codeBlock', attrs: { language: 'js' }, content: [] },
        { type: 'paragraph', content: [] }, // blank
        { type: 'paragraph', content: [{ type: 'text', text: 'After' }] },
      ],
      serialize
    );

    const md = getEditorMarkdownForSync(editor);
    expect(md).toBe('```js\nconsole.log("hi")\n```\n\n\nAfter');
  });

  it('preserves blank line between mermaid and paragraph', () => {
    const serialize = makeSerialize({
      'mermaid:mermaid': '```mermaid\ngraph TD\n```',
      paragraph: 'After',
    });
    const editor = mockEditor(
      [
        { type: 'mermaid', attrs: { language: 'mermaid' }, content: [] },
        { type: 'paragraph', content: [] }, // blank
        { type: 'paragraph', content: [{ type: 'text', text: 'After' }] },
      ],
      serialize
    );

    const md = getEditorMarkdownForSync(editor);
    expect(md).toBe('```mermaid\ngraph TD\n```\n\n\nAfter');
  });

  it('preserves blank line after horizontal rule', () => {
    const serialize = makeSerialize({
      horizontalRule: '---',
      paragraph: 'After',
    });
    const editor = mockEditor(
      [
        { type: 'horizontalRule', content: [] },
        { type: 'paragraph', content: [] }, // blank
        { type: 'paragraph', content: [{ type: 'text', text: 'After' }] },
      ],
      serialize
    );

    const md = getEditorMarkdownForSync(editor);
    expect(md).toBe('---\n\n\nAfter');
  });

  it('preserves blank line after table', () => {
    const serialize = makeSerialize({
      table: '| a |\n|---|\n| 1 |',
      paragraph: 'After',
    });
    const editor = mockEditor(
      [
        { type: 'table', content: [] },
        { type: 'paragraph', content: [] }, // blank
        { type: 'paragraph', content: [{ type: 'text', text: 'After' }] },
      ],
      serialize
    );

    const md = getEditorMarkdownForSync(editor);
    expect(md).toBe('| a |\n|---|\n| 1 |\n\n\nAfter');
  });

  it('preserves multiple blank lines between blocks', () => {
    const serialize = makeSerialize({
      heading: '## A',
      paragraph: 'B',
    });
    const editor = mockEditor(
      [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'A' }] },
        { type: 'paragraph', content: [] },
        { type: 'paragraph', content: [] },
        { type: 'paragraph', content: [{ type: 'text', text: 'B' }] },
      ],
      serialize
    );

    const md = getEditorMarkdownForSync(editor);
    // 2 empty paragraphs → \n\n + 2 extra \n = \n\n\n\n
    expect(md).toBe('## A\n\n\n\nB');
  });

  it('standard gap (no empty paragraphs) uses double newline', () => {
    const serialize = makeSerialize({
      heading: '## A',
      paragraph: 'B',
    });
    const editor = mockEditor(
      [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'A' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'B' }] },
      ],
      serialize
    );

    const md = getEditorMarkdownForSync(editor);
    expect(md).toBe('## A\n\nB');
    expect(md).not.toContain('\n\n\n');
  });

  it('handles node that serializes to empty by treating it as blank', () => {
    const serialize = makeSerialize({
      heading: '## A',
      paragraph: 'C',
      // unknownNode is not mapped → returns ''
    });
    const editor = mockEditor(
      [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'A' }] },
        { type: 'unknownNode', content: [{ type: 'text', text: 'x' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'C' }] },
      ],
      serialize
    );

    const md = getEditorMarkdownForSync(editor);
    // unknownNode serialized to '' → treated as blank → extra \n
    expect(md).toBe('## A\n\n\nC');
  });
});
