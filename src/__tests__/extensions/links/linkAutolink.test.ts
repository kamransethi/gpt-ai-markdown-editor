/**
 * @jest-environment jsdom
 *
 * Tests for Link autolink prevention - bare extensions like .MD should NOT become links
 *
 * Tests both:
 * 1. Markdown parsing (setContent with contentType: 'markdown')
 * 2. Input simulation (typing text that triggers autolink)
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { Markdown } from '@tiptap/markdown';
import { shouldAutoLink } from '../../../webview/utils/linkValidation';

describe('Link autolink prevention', () => {
  let editor: Editor;

  const createEditor = (linkConfig: Record<string, unknown> = {}) => {
    return new Editor({
      extensions: [
        StarterKit.configure({ link: false }),
        Markdown,
        Link.configure({
          openOnClick: false,
          autolink: true,
          shouldAutoLink,
          ...linkConfig,
        }),
      ],
    });
  };

  afterEach(() => {
    editor?.destroy();
  });

  describe('bare extensions should NOT become links (markdown parse)', () => {
    const bareExtensions = ['.MD', '.md', '.txt', '.pdf', '.doc'];

    bareExtensions.forEach(ext => {
      it(`should not auto-link bare extension "${ext}"`, () => {
        editor = createEditor();
        editor.commands.setContent(`This is a ${ext} file`, { contentType: 'markdown' });

        const json = editor.getJSON();
        const hasLinkMark = JSON.stringify(json).includes('"type":"link"');
        expect(hasLinkMark).toBe(false);
      });
    });
  });

  describe('filename.ext patterns should NOT become links (markdown parse)', () => {
    const filePatterns = ['readme.MD', 'document.md', 'file.txt', 'report.pdf'];

    filePatterns.forEach(file => {
      it(`should not auto-link filename pattern "${file}"`, () => {
        editor = createEditor();
        editor.commands.setContent(`Check out ${file} for details`, { contentType: 'markdown' });

        const json = editor.getJSON();
        const hasLinkMark = JSON.stringify(json).includes('"type":"link"');
        expect(hasLinkMark).toBe(false);
      });
    });
  });

  describe('autolink on input (typing simulation)', () => {
    const nonLinkPatterns = ['readme.MD', 'file.md', 'document.txt', '.MD', '.md', 'test.pdf'];

    nonLinkPatterns.forEach(pattern => {
      it(`should NOT auto-link "${pattern}" when typed`, () => {
        editor = createEditor();

        // Simulate typing by inserting text followed by space
        editor.commands.insertContent(`${pattern} `);

        const json = editor.getJSON();
        const hasLinkMark = JSON.stringify(json).includes('"type":"link"');
        expect(hasLinkMark).toBe(false);
      });
    });
  });

  describe('shouldAutoLink utility function', () => {
    it('rejects bare extensions', () => {
      expect(shouldAutoLink('.MD')).toBe(false);
      expect(shouldAutoLink('.md')).toBe(false);
      expect(shouldAutoLink('.txt')).toBe(false);
      expect(shouldAutoLink('.pdf')).toBe(false);
    });

    it('rejects filename patterns without protocol', () => {
      expect(shouldAutoLink('readme.MD')).toBe(false);
      expect(shouldAutoLink('file.md')).toBe(false);
      expect(shouldAutoLink('document.txt')).toBe(false);
      expect(shouldAutoLink('report.pdf')).toBe(false);
    });

    it('allows URLs with protocols', () => {
      expect(shouldAutoLink('https://example.com')).toBe(true);
      expect(shouldAutoLink('http://test.io')).toBe(true);
      expect(shouldAutoLink('https://docs.example.com/file.md')).toBe(true);
    });

    it('allows URLs with paths', () => {
      expect(shouldAutoLink('example.com/page')).toBe(true);
      expect(shouldAutoLink('docs/readme.md')).toBe(true);
    });

    it('allows common domain TLDs without document extensions', () => {
      expect(shouldAutoLink('example.com')).toBe(true);
      expect(shouldAutoLink('test.io')).toBe(true);
      expect(shouldAutoLink('app.dev')).toBe(true);
    });
  });

  describe('real URLs SHOULD become links', () => {
    const realUrls = ['https://example.com', 'http://test.io', 'https://docs.example.com/file.md'];

    realUrls.forEach(url => {
      it(`should auto-link real URL "${url}"`, () => {
        editor = createEditor();
        editor.commands.setContent(`Visit ${url} for info`, { contentType: 'markdown' });

        const json = editor.getJSON();
        const hasLinkMark = JSON.stringify(json).includes('"type":"link"');
        expect(hasLinkMark).toBe(true);
      });
    });
  });

  describe('explicit markdown links should work', () => {
    it('should parse [text](url) as a link', () => {
      editor = createEditor();
      editor.commands.setContent('[Click here](https://example.com)', {
        contentType: 'markdown',
      });

      const json = editor.getJSON();
      const hasLinkMark = JSON.stringify(json).includes('"type":"link"');
      expect(hasLinkMark).toBe(true);
    });

    it('should parse markdown link to .md file', () => {
      editor = createEditor();
      editor.commands.setContent('[README](./README.md)', { contentType: 'markdown' });

      const json = editor.getJSON();
      const hasLinkMark = JSON.stringify(json).includes('"type":"link"');
      expect(hasLinkMark).toBe(true);
    });
  });
});
