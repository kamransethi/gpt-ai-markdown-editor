import {
  resolveMarkdownImagePaths,
  resolveHtmlImagePaths,
  convertHtmlImagesToMarkdown,
} from '../../features/documentExport';
import * as path from 'path';

describe('Document Export Image Path Resolution', () => {
  const baseDir = '/workspace/project';

  describe('resolveMarkdownImagePaths', () => {
    it('should resolve relative paths to absolute paths', () => {
      const markdown = '![alt](images/pic.png)';
      const result = resolveMarkdownImagePaths(markdown, baseDir);

      // Expected uses path.join which on windows could be different, assuming posix or letting path module handle
      expect(result).toBe(`![alt](${path.join(baseDir, 'images/pic.png')})`);
    });

    it('should resolve encoded relative paths', () => {
      const markdown = '![alt](my%20images/pic.png)';
      const result = resolveMarkdownImagePaths(markdown, baseDir);
      expect(result).toBe(`![alt](${path.join(baseDir, 'my images/pic.png')})`);
    });

    it('should resolve relative paths starting with ./', () => {
      const markdown = '![alt](./assets/pic.png)';
      const result = resolveMarkdownImagePaths(markdown, baseDir);
      expect(result).toBe(`![alt](${path.join(baseDir, 'assets/pic.png')})`);
    });

    it('should not modify absolute paths', () => {
      const markdown = '![alt](/usr/local/pic.png)';
      const result = resolveMarkdownImagePaths(markdown, baseDir);
      // Wait, on windows absolute starts with C:\, let's keep it simple for mac
      expect(result).toBe('![alt](/usr/local/pic.png)');
    });

    it('should not modify remote URIs', () => {
      const markdown = '![alt](https://example.com/pic.png)';
      const result = resolveMarkdownImagePaths(markdown, baseDir);
      expect(result).toBe('![alt](https://example.com/pic.png)');
    });

    it('should handle markdown image with title attributes', () => {
      const markdown = '![alt](images/pic.png "My Title")';
      const result = resolveMarkdownImagePaths(markdown, baseDir);
      expect(result).toBe(`![alt](${path.join(baseDir, 'images/pic.png')} "My Title")`);
    });
  });

  describe('resolveHtmlImagePaths', () => {
    it('should resolve relative paths in src attributes', () => {
      const html = '<img src="images/pic.png" alt="alt" />';
      const result = resolveHtmlImagePaths(html, baseDir);
      expect(result).toBe(`<img src="${path.join(baseDir, 'images/pic.png')}" alt="alt" />`);
    });

    it('should handle single quotes', () => {
      const html = "<img src='images/pic.png' alt='alt' />";
      const result = resolveHtmlImagePaths(html, baseDir);
      expect(result).toBe(`<img src='${path.join(baseDir, 'images/pic.png')}' alt='alt' />`);
    });

    it('should not modify absolute paths', () => {
      // Actually in HTML, base href might be better, but converting is safer
      const html = '<img src="/usr/local/pic.png" alt="alt" />';
      const result = resolveHtmlImagePaths(html, baseDir);
      expect(result).toBe('<img src="/usr/local/pic.png" alt="alt" />');
    });

    it('should not modify remote URIs', () => {
      const html = '<img src="https://example.com/pic.png" alt="alt" />';
      const result = resolveHtmlImagePaths(html, baseDir);
      expect(result).toBe('<img src="https://example.com/pic.png" alt="alt" />');
    });
  });

  describe('convertHtmlImagesToMarkdown', () => {
    it('converts <img> tag to markdown image syntax with absolute path', () => {
      const md = '<img src="./images/pic.png" alt="My Image" />';
      const result = convertHtmlImagesToMarkdown(md, baseDir);
      expect(result).toBe(`![My Image](${path.join(baseDir, 'images/pic.png')})`);
    });

    it('preserves width and height as Pandoc attributes', () => {
      const md = '<img src="./photo.png" alt="Photo" width="463" height="463" />';
      const result = convertHtmlImagesToMarkdown(md, baseDir);
      expect(result).toBe(
        `![Photo](${path.join(baseDir, 'photo.png')}){ width=463px height=463px }`
      );
    });

    it('handles width-only attribute', () => {
      const md = '<img src="./pic.png" alt="alt" width="200" />';
      const result = convertHtmlImagesToMarkdown(md, baseDir);
      expect(result).toBe(`![alt](${path.join(baseDir, 'pic.png')}){ width=200px }`);
    });

    it('uses empty alt text when alt attribute is missing', () => {
      const md = '<img src="./pic.png" />';
      const result = convertHtmlImagesToMarkdown(md, baseDir);
      expect(result).toBe(`![](${path.join(baseDir, 'pic.png')})`);
    });

    it('does not modify remote URLs', () => {
      const md = '<img src="https://example.com/pic.png" alt="Remote" />';
      const result = convertHtmlImagesToMarkdown(md, baseDir);
      expect(result).toBe('![Remote](https://example.com/pic.png)');
    });

    it('does not modify absolute paths', () => {
      const md = '<img src="/usr/local/pic.png" alt="Abs" />';
      const result = convertHtmlImagesToMarkdown(md, baseDir);
      expect(result).toBe('![Abs](/usr/local/pic.png)');
    });

    it('handles URL-encoded relative paths', () => {
      const md = '<img src="./my%20images/pic.png" alt="Encoded" />';
      const result = convertHtmlImagesToMarkdown(md, baseDir);
      expect(result).toBe(`![Encoded](${path.join(baseDir, 'my images/pic.png')})`);
    });

    it('handles tags without self-closing slash', () => {
      const md = '<img src="./pic.png" alt="No slash">';
      const result = convertHtmlImagesToMarkdown(md, baseDir);
      expect(result).toBe(`![No slash](${path.join(baseDir, 'pic.png')})`);
    });

    it('leaves non-img HTML untouched', () => {
      const md = '<div class="wrapper"><p>Hello</p></div>';
      const result = convertHtmlImagesToMarkdown(md, baseDir);
      expect(result).toBe(md);
    });

    it('converts multiple img tags in the same document', () => {
      const md =
        '# Title\n\n<img src="./a.png" alt="A" />\n\nSome text\n\n<img src="./b.png" alt="B" width="100" />';
      const result = convertHtmlImagesToMarkdown(md, baseDir);
      expect(result).toContain(`![A](${path.join(baseDir, 'a.png')})`);
      expect(result).toContain(`![B](${path.join(baseDir, 'b.png')}){ width=100px }`);
    });
  });
});
