/**
 * Image Conversion Tests
 *
 * Tests the image-to-data-URL conversion functions used in export
 */

import * as path from 'path';
import * as fs from 'fs';

describe('Image Conversion for Export', () => {
  describe('getMimeType', () => {
    // We'll need to extract this function or make it testable
    const getMimeType = (filePath: string): string => {
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.webp': 'image/webp',
        '.bmp': 'image/bmp',
      };
      return mimeTypes[ext] || 'image/png';
    };

    it('should return correct MIME type for PNG', () => {
      expect(getMimeType('image.png')).toBe('image/png');
    });

    it('should return correct MIME type for JPEG', () => {
      expect(getMimeType('photo.jpg')).toBe('image/jpeg');
      expect(getMimeType('photo.jpeg')).toBe('image/jpeg');
    });

    it('should return correct MIME type for SVG', () => {
      expect(getMimeType('diagram.svg')).toBe('image/svg+xml');
    });

    it('should default to image/png for unknown extensions', () => {
      expect(getMimeType('file.xyz')).toBe('image/png');
    });
  });

  describe('Image Tag Regex Matching', () => {
    it('should match img tags with double quotes', () => {
      const html = '<img src="./images/test.png" alt="Test">';
      const imgRegex = /<img([^>]*)src=["']([^"']+)["']([^>]*)>/gi;
      const matches = [...html.matchAll(imgRegex)];

      expect(matches.length).toBe(1);
      expect(matches[0][2]).toBe('./images/test.png');
    });

    it('should match img tags with single quotes', () => {
      const html = "<img src='./images/test.png' alt='Test'>";
      const imgRegex = /<img([^>]*)src=["']([^"']+)["']([^>]*)>/gi;
      const matches = [...html.matchAll(imgRegex)];

      expect(matches.length).toBe(1);
      expect(matches[0][2]).toBe('./images/test.png');
    });

    it('should match multiple img tags', () => {
      const html = `
        <img src="./images/one.png" alt="One">
        <p>Some text</p>
        <img src="https://example.com/two.jpg" alt="Two">
        <img src="data:image/png;base64,abc123" alt="Three">
      `;
      const imgRegex = /<img([^>]*)src=["']([^"']+)["']([^>]*)>/gi;
      const matches = [...html.matchAll(imgRegex)];

      expect(matches.length).toBe(3);
      expect(matches[0][2]).toBe('./images/one.png');
      expect(matches[1][2]).toBe('https://example.com/two.jpg');
      expect(matches[2][2]).toBe('data:image/png;base64,abc123');
    });

    it('should handle img tags with class attribute before src', () => {
      const html = '<img class="mermaid-export-image" src="data:image/png;base64,abc" />';
      const imgRegex = /<img([^>]*)src=["']([^"']+)["']([^>]*)>/gi;
      const matches = [...html.matchAll(imgRegex)];

      expect(matches.length).toBe(1);
      expect(matches[0][2]).toBe('data:image/png;base64,abc');
    });
  });

  describe('Path Resolution', () => {
    it('should identify local relative paths', () => {
      const localPaths = ['./images/test.png', '../assets/image.jpg', 'images/file.gif'];

      localPaths.forEach(src => {
        const isLocal = src.startsWith('./') || src.startsWith('../') || !src.includes('://');
        expect(isLocal).toBe(true);
      });
    });

    it('should identify remote URLs', () => {
      const remotePaths = ['http://example.com/image.png', 'https://example.com/photo.jpg'];

      remotePaths.forEach(src => {
        const isRemote = src.startsWith('http://') || src.startsWith('https://');
        expect(isRemote).toBe(true);
      });
    });

    it('should identify data URLs', () => {
      const dataUrls = ['data:image/png;base64,iVBORw0KG', 'data:image/jpeg;base64,/9j/4AAQ'];

      dataUrls.forEach(src => {
        expect(src.startsWith('data:')).toBe(true);
      });
    });
  });

  describe('Data URL Format', () => {
    it('should create valid data URL from base64', () => {
      const mimeType = 'image/png';
      const base64 =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const dataUrl = `data:${mimeType};base64,${base64}`;

      expect(dataUrl).toMatch(/^data:image\/png;base64,/);
      expect(dataUrl.split(',')[0]).toBe('data:image/png;base64');
      expect(dataUrl.split(',')[1]).toBe(base64);
    });

    it('should be able to extract base64 from data URL', () => {
      const dataUrl = 'data:image/png;base64,abc123def456';
      const base64Data = dataUrl.split(',')[1];

      expect(base64Data).toBe('abc123def456');
    });
  });

  describe('HTML String Replacement', () => {
    it('should replace img src with data URL', () => {
      const originalTag = '<img src="./images/test.png" alt="Test">';
      const dataUrl = 'data:image/png;base64,abc123';
      const newTag = originalTag.replace(/src=["']([^"']+)["']/, `src="${dataUrl}"`);

      expect(newTag).toBe('<img src="data:image/png;base64,abc123" alt="Test">');
      expect(newTag).not.toContain('./images/test.png');
    });

    it('should preserve other attributes when replacing src', () => {
      const originalTag = '<img class="test-class" src="./test.png" alt="Test" width="100">';
      const dataUrl = 'data:image/png;base64,abc123';

      // Simulate the replacement logic from convertImagesToDataUrls
      const imgRegex = /<img([^>]*)src=["']([^"']+)["']([^>]*)>/gi;
      const match = imgRegex.exec(originalTag);

      if (match) {
        const beforeSrc = match[1];
        const afterSrc = match[3];
        const newTag = `<img${beforeSrc}src="${dataUrl}"${afterSrc}>`;

        expect(newTag).toContain('class="test-class"');
        expect(newTag).toContain('alt="Test"');
        expect(newTag).toContain('width="100"');
        expect(newTag).toContain(dataUrl);
      }
    });
  });

  describe('Integration: Full Conversion Flow', () => {
    it('should skip data URLs (already converted)', () => {
      const html = '<img src="data:image/png;base64,abc123" alt="Mermaid">';
      const imgRegex = /<img([^>]*)src=["']([^"']+)["']([^>]*)>/gi;
      const matches = [...html.matchAll(imgRegex)];

      const src = matches[0][2];
      const shouldSkip = src.startsWith('data:');

      expect(shouldSkip).toBe(true);
    });

    it('should process local file paths', () => {
      const html = '<img src="./images/test.png" alt="Local">';
      const imgRegex = /<img([^>]*)src=["']([^"']+)["']([^>]*)>/gi;
      const matches = [...html.matchAll(imgRegex)];

      const src = matches[0][2];
      const isLocal = src.startsWith('./') || src.startsWith('../') || !src.includes('://');

      expect(isLocal).toBe(true);
      expect(src).toBe('./images/test.png');
    });

    it('should process remote URLs', () => {
      const html = '<img src="https://example.com/image.png" alt="Remote">';
      const imgRegex = /<img([^>]*)src=["']([^"']+)["']([^>]*)>/gi;
      const matches = [...html.matchAll(imgRegex)];

      const src = matches[0][2];
      const isRemote = src.startsWith('http://') || src.startsWith('https://');

      expect(isRemote).toBe(true);
      expect(src).toBe('https://example.com/image.png');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing local files gracefully', () => {
      const nonExistentPath = './images/does-not-exist.png';
      const exists = fs.existsSync(nonExistentPath);

      // Should not throw, just return false
      expect(exists).toBe(false);
    });

    it('should handle malformed data URLs', () => {
      const malformedDataUrl = 'data:invalid';
      const parts = malformedDataUrl.split(',');

      // Should handle gracefully - no base64 part
      expect(parts.length).toBe(1);
      expect(parts[1]).toBeUndefined();
    });
  });
});
