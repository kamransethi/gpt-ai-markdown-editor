/** @jest-environment jsdom */

import type { JSONContent } from '@tiptap/core';
import {
  getEditorMarkdownForSync,
  stripEmptyDocParagraphsFromJson,
} from '../../webview/utils/markdownSerialization';
import { EPIC_READER_FRIENDLY_MD } from '../fixtures/epicReaderFriendly';

describe('markdownSerialization', () => {
  it('strips empty doc-level paragraphs before serialization', () => {
    const headingLine = EPIC_READER_FRIENDLY_MD.split('\n').find(line => line.startsWith('## '));
    expect(headingLine).toBeTruthy();
    const headingText = (headingLine ?? '').replace(/^##\s+/, '');

    const firstImageLine = EPIC_READER_FRIENDLY_MD.split('\n').find(line =>
      line.startsWith('![image](')
    );
    expect(firstImageLine).toBeTruthy();
    const firstImageSrc = (firstImageLine ?? '').match(/!\[[^\]]*\]\(([^)]+)\)/)?.[1];
    expect(firstImageSrc).toBeTruthy();

    const heading: JSONContent = {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: headingText }],
    };

    const emptyParagraph: JSONContent = {
      type: 'paragraph',
      content: [],
    };

    const image: JSONContent = {
      type: 'image',
      attrs: { src: firstImageSrc },
    };

    const doc: JSONContent = {
      type: 'doc',
      content: [heading, emptyParagraph, image],
    };

    const normalized = stripEmptyDocParagraphsFromJson(doc);
    expect(normalized).toEqual({
      type: 'doc',
      content: [heading, image],
    });
  });

  it('strips doc-level paragraphs that contain only hardBreak nodes', () => {
    const heading: JSONContent = {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Title' }],
    };

    const hardBreakOnlyParagraph: JSONContent = {
      type: 'paragraph',
      content: [{ type: 'hardBreak' }],
    };

    const bodyParagraph: JSONContent = {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Body' }],
    };

    const doc: JSONContent = {
      type: 'doc',
      content: [heading, hardBreakOnlyParagraph, bodyParagraph],
    };

    const normalized = stripEmptyDocParagraphsFromJson(doc);
    expect(normalized).toEqual({
      type: 'doc',
      content: [heading, bodyParagraph],
    });
  });

  it('serializes with normalized JSON to avoid extra blank lines', () => {
    const headingLine = EPIC_READER_FRIENDLY_MD.split('\n').find(line => line.startsWith('## '));
    expect(headingLine).toBeTruthy();
    const headingText = (headingLine ?? '').replace(/^##\s+/, '');

    const firstImageLine = EPIC_READER_FRIENDLY_MD.split('\n').find(line =>
      line.startsWith('![image](')
    );
    expect(firstImageLine).toBeTruthy();
    const firstImageSrc = (firstImageLine ?? '').match(/!\[[^\]]*\]\(([^)]+)\)/)?.[1];
    expect(firstImageSrc).toBeTruthy();

    const serialize = jest.fn((json: JSONContent) => {
      const nodes = Array.isArray(json.content) ? json.content : [];
      const hasEmptyParagraph = nodes.some(node => {
        if (node.type !== 'paragraph') return false;
        return !Array.isArray(node.content) || node.content.length === 0;
      });

      const separator = hasEmptyParagraph ? '\n\n\n' : '\n\n';
      return `## ${headingText}${separator}![image](${firstImageSrc})`;
    });

    const editor = {
      getJSON: jest.fn(() => ({
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: headingText }],
          },
          {
            type: 'paragraph',
            content: [],
          },
          {
            type: 'image',
            attrs: { src: firstImageSrc },
          },
        ],
      })),
      markdown: {
        serialize,
      },
      getMarkdown: jest.fn(() => 'fallback'),
    } as unknown as import('@tiptap/core').Editor;

    const markdown = getEditorMarkdownForSync(editor);

    expect(markdown).toBe(`## ${headingText}\n\n![image](${firstImageSrc})`);
    expect(markdown.includes('\n\n\n')).toBe(false);
    expect(serialize).toHaveBeenCalledTimes(1);
    expect(serialize).toHaveBeenCalledWith({
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: headingText }],
        },
        {
          type: 'image',
          attrs: { src: firstImageSrc },
        },
      ],
    });
  });

  it('falls back to editor.getMarkdown when serializer returns empty for non-empty doc', () => {
    const serialize = jest.fn(() => '');
    const fallbackMarkdown = '# fallback content';

    const editor = {
      getJSON: jest.fn(() => ({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Hello world' }],
          },
        ],
      })),
      markdown: {
        serialize,
      },
      getMarkdown: jest.fn(() => fallbackMarkdown),
    } as unknown as import('@tiptap/core').Editor;

    const markdown = getEditorMarkdownForSync(editor);

    expect(markdown).toBe(fallbackMarkdown);
    expect(serialize).toHaveBeenCalledTimes(2);
    expect((editor as any).getMarkdown).toHaveBeenCalledTimes(1);
  });

  it('falls back to storage.markdown.getMarkdown when editor.getMarkdown is unavailable', () => {
    const serialize = jest.fn(() => '');
    const fallbackMarkdown = '# storage fallback content';

    const editor = {
      getJSON: jest.fn(() => ({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Hello from storage fallback' }],
          },
        ],
      })),
      markdown: {
        serialize,
        getMarkdown: jest.fn(() => fallbackMarkdown),
      },
    } as unknown as import('@tiptap/core').Editor;

    const markdown = getEditorMarkdownForSync(editor);

    expect(markdown).toBe(fallbackMarkdown);
    expect(serialize).toHaveBeenCalledTimes(2);
    expect((editor as any).markdown.getMarkdown).toHaveBeenCalledTimes(1);
  });

  it('compresses table markdown when compressTables is enabled', () => {
    const tableMarkdown = `| Name | Age |\n| --- | --- |\n| Alice | 30 |\n| Bob | 28 |\n`;
    const editor = {
      getJSON: jest.fn(() => ({ type: 'doc', content: [] })),
      markdown: {
        serialize: jest.fn(() => tableMarkdown),
      },
      getMarkdown: jest.fn(() => ''),
    } as unknown as import('@tiptap/core').Editor;

    const markdown = getEditorMarkdownForSync(editor, { compressTables: true });

    expect(markdown).toBe('|Name|Age|\n|---|---|\n|Alice|30|\n|Bob|28|\n');
  });

  it('compresses blank lines when trimBlankLines is enabled', () => {
    const content = 'Line 1\n\n\n\nLine 2\n\n\nLine 3\n';
    const editor = {
      getJSON: jest.fn(() => ({ type: 'doc', content: [] })),
      markdown: {
        serialize: jest.fn(() => content),
      },
      getMarkdown: jest.fn(() => ''),
    } as unknown as import('@tiptap/core').Editor;

    const markdown = getEditorMarkdownForSync(editor, { trimBlankLines: true });

    expect(markdown).toBe('Line 1\n\nLine 2\n\nLine 3');
  });

  it('preserves fenced code blocks while compressing surrounding markdown', () => {
    const content =
      '# Title\n\n| Value | Note |\n| --- | --- |\n| A | 1 |\n\n```\nfunction example() {\n  return \'code | block\';\n}\n```\n';
    const editor = {
      getJSON: jest.fn(() => ({ type: 'doc', content: [] })),
      markdown: {
        serialize: jest.fn(() => content),
      },
      getMarkdown: jest.fn(() => ''),
    } as unknown as import('@tiptap/core').Editor;

    const markdown = getEditorMarkdownForSync(editor, { compressTables: true, trimBlankLines: true });

    expect(markdown).toContain('```\nfunction example() {\n  return \'code | block\';\n}\n```');
    expect(markdown).toContain('|A|1|');
    expect(markdown).toContain('|---|---|');
  });

  it('preserves indented code blocks', () => {
    const content = 'Text\n\n    indented code\n    line 2\n\nMore text';
    const editor = {
      getJSON: jest.fn(() => ({ type: 'doc', content: [] })),
      markdown: {
        serialize: jest.fn(() => content),
      },
      getMarkdown: jest.fn(() => ''),
    } as unknown as import('@tiptap/core').Editor;

    const markdown = getEditorMarkdownForSync(editor, { compressTables: true, trimBlankLines: true });

    expect(markdown).toContain('    indented code\n    line 2');
  });
});
