import { MarkdownManager } from '@tiptap/markdown';
import { Document } from '@tiptap/extension-document';
import { HardBreak } from '@tiptap/extension-hard-break';
import CodeBlock from '@tiptap/extension-code-block';
import Paragraph from '@tiptap/extension-paragraph';
import { CustomImage } from '../../webview/extensions/customImage';
import { IndentedImageCodeBlock } from '../../webview/extensions/indentedImageCodeBlock';

function createMarkdownManager() {
  return new MarkdownManager({
    markedOptions: {
      gfm: true,
      breaks: true,
    },
    extensions: [
      Document,
      // These match the real editor behavior closely enough for markdown parsing/serialization.
      Paragraph,
      HardBreak,
      CustomImage,
      // Must be before CodeBlock so it can intercept indented "code" tokens.
      IndentedImageCodeBlock,
      CodeBlock,
    ],
  });
}

describe('IndentedImageCodeBlock', () => {
  it('parses a 4-space indented image line as an image (not a code block)', () => {
    const manager = createMarkdownManager();
    const doc = manager.parse('    ![alt](./img.png)\n');

    expect(doc).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'image',
              attrs: {
                src: './img.png',
                alt: 'alt',
                'indent-prefix': '    ',
              },
            },
          ],
        },
      ],
    });
  });

  it('parses indented image lines with spaces in the path', () => {
    const manager = createMarkdownManager();
    const doc = manager.parse('    ![image in vs-code](./image in vs-code.png)\n');

    expect(doc).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'image',
              attrs: {
                src: './image in vs-code.png',
                alt: 'image in vs-code',
                'indent-prefix': '    ',
              },
            },
          ],
        },
      ],
    });

    expect(manager.serialize(doc)).toBe('    ![image in vs-code](<./image in vs-code.png>)');
  });

  it('parses tab-indented image lines and preserves per-line indentation', () => {
    const manager = createMarkdownManager();
    const markdown =
      '\t    ![Gemini](./new-images/pasted_Gemini.png)\n' +
      '\t\t![attempt](./new-images/pasted_attempt.png)\n';

    const doc = manager.parse(markdown);

    expect(doc).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'image',
              attrs: {
                src: './new-images/pasted_Gemini.png',
                alt: 'Gemini',
                'indent-prefix': '\t    ',
              },
            },
            { type: 'hardBreak' },
            {
              type: 'image',
              attrs: {
                src: './new-images/pasted_attempt.png',
                alt: 'attempt',
                'indent-prefix': '\t\t',
              },
            },
          ],
        },
      ],
    });
  });

  it('does not convert non-image indented code blocks', () => {
    const manager = createMarkdownManager();
    const doc = manager.parse('    const x = 1\n');

    expect(doc.content?.[0]?.type).toBe('codeBlock');
  });

  it('does not convert fenced code blocks containing image syntax', () => {
    const manager = createMarkdownManager();
    const doc = manager.parse('```md\n![alt](./img.png)\n```\n');

    expect(doc.content?.[0]?.type).toBe('codeBlock');
  });

  it('serializes indented images with their original indentation prefix', () => {
    const manager = createMarkdownManager();
    const doc = manager.parse('    ![alt](./img.png)\n');

    expect(manager.serialize(doc)).toBe('    ![alt](./img.png)');
  });
});

