import { resolveMarkdownImagePaths, resolveHtmlImagePaths } from '../../features/documentExport';
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
});
