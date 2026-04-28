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

  it('preserves middle empty paragraphs as extra blank lines', () => {
    const heading: JSONContent = {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Title' }],
    };

    const image: JSONContent = {
      type: 'image',
      attrs: { src: 'image.png' },
    };

    // Serialize is now called once per content node (individual mini-docs)
    const serialize = jest.fn((json: JSONContent) => {
      const child = Array.isArray(json.content) ? json.content[0] : null;
      if (child?.type === 'heading') return '## Title';
      if (child?.type === 'image') return '![image](image.png)';
      return '';
    });

    const editor = {
      getJSON: jest.fn(() => ({
        type: 'doc',
        content: [
          heading,
          { type: 'paragraph', content: [] }, // intentional blank line
          image,
          { type: 'paragraph', content: [] }, // trailing cursor placeholder
        ],
      })),
      markdown: { serialize },
      getMarkdown: jest.fn(() => 'fallback'),
    } as unknown as import('@tiptap/core').Editor;

    const markdown = getEditorMarkdownForSync(editor);

    // Middle empty paragraph → one extra blank line beyond the standard separator
    expect(markdown).toBe('## Title\n\n\n![image](image.png)');
    expect(markdown.includes('\n\n\n')).toBe(true);
    // Serialize is called once per content node, trailing empty is stripped
    expect(serialize).toHaveBeenCalledTimes(2);
  });

  it('produces standard single blank line when no empty paragraphs between blocks', () => {
    const heading: JSONContent = {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Title' }],
    };

    const body: JSONContent = {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Body' }],
    };

    const serialize = jest.fn((json: JSONContent) => {
      const child = Array.isArray(json.content) ? json.content[0] : null;
      if (child?.type === 'heading') return '## Title';
      if (child?.type === 'paragraph') return 'Body';
      return '';
    });

    const editor = {
      getJSON: jest.fn(() => ({
        type: 'doc',
        content: [
          heading,
          body,
          { type: 'paragraph', content: [] }, // trailing cursor placeholder
        ],
      })),
      markdown: { serialize },
      getMarkdown: jest.fn(() => 'fallback'),
    } as unknown as import('@tiptap/core').Editor;

    const markdown = getEditorMarkdownForSync(editor);

    expect(markdown).toBe('## Title\n\nBody');
    expect(markdown.includes('\n\n\n')).toBe(false);
    expect(serialize).toHaveBeenCalledTimes(2);
  });
});
