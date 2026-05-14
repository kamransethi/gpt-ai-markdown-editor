import { MarkdownManager } from '@tiptap/markdown';
import { Document } from '@tiptap/extension-document';
import { HardBreak } from '@tiptap/extension-hard-break';
import Paragraph from '@tiptap/extension-paragraph';
import { CustomImage } from '../../../webview/extensions/customImage';
import { SpaceFriendlyImagePaths } from '../../../webview/extensions/spaceFriendlyImagePaths';

function createMarkdownManager() {
  return new MarkdownManager({
    markedOptions: {
      gfm: true,
      breaks: true,
    },
    extensions: [Document, SpaceFriendlyImagePaths, Paragraph, HardBreak, CustomImage],
  });
}

describe('SpaceFriendlyImagePaths', () => {
  it('parses a standalone image line with spaces in the path', () => {
    const manager = createMarkdownManager();
    const doc = manager.parse('![image in vs-code](./image in vs-code.png)\n');

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
                'indent-prefix': '',
              },
            },
          ],
        },
      ],
    });
  });

  it('serializes image paths with spaces using <...> so markdown stays valid', () => {
    const manager = createMarkdownManager();
    const doc = manager.parse('![image in vs-code](./image in vs-code.png)\n');

    expect(manager.serialize(doc)).toBe('![image in vs-code](<./image in vs-code.png>)');
  });
});
