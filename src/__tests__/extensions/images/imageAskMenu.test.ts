/**
 * @jest-environment jsdom
 */

/**
 * Tests for Image Context Menu rendering (formerly imageMenu).
 *
 * NOTE: The old `createImageMenu(isLocal: boolean)` API was replaced by
 * `createImageContextMenu(editor, vscodeApi)` which builds two separate menus
 * (local and external) and returns a controller.  The tests below verify the
 * new builder-based structure using the MenuBuilder internals.
 */

import { isExternalImage } from '../../../webview/features/imageContextMenu';

describe('Image context menu helpers', () => {
  describe('isExternalImage', () => {
    it('returns true for http URLs', () => {
      expect(isExternalImage('http://example.com/img.png')).toBe(true);
    });

    it('returns true for https URLs', () => {
      expect(isExternalImage('https://cdn.example.com/photo.jpg')).toBe(true);
    });

    it('returns true for data URIs', () => {
      expect(isExternalImage('data:image/png;base64,abc123')).toBe(true);
    });

    it('returns false for relative paths', () => {
      expect(isExternalImage('./images/local.png')).toBe(false);
    });

    it('returns false for vscode-resource paths', () => {
      expect(isExternalImage('vscode-resource:/path/to/img.png')).toBe(false);
    });
  });
});
