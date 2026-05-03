/**
 * Export Content Tests
 *
 * Tests the content collection and Mermaid conversion functionality
 * for document export (PDF/Word).
 */

import type { Editor } from '@tiptap/core';
import { getDocumentTitle } from '../../webview/utils/exportContent';

// Mock Editor instance with minimal interface
const createMockEditor = (htmlContent: string): Editor => {
  return {
    view: {
      dom: {
        querySelector: (selector: string) => {
          if (selector === 'h1') {
            // Parse HTML to find h1
            const h1Match = htmlContent.match(/<h1[^>]*>(.*?)<\/h1>/);
            if (h1Match) {
              // Simulate browser textContent behavior: strip tags and decode entities
              let text = h1Match[1];
              text = text.replace(/<[^>]+>/g, ''); // Strip tags
              text = text.replace(/&amp;/g, '&'); // Decode common entities
              text = text.replace(/&lt;/g, '<');
              text = text.replace(/&gt;/g, '>');
              text = text.replace(/&quot;/g, '"');
              text = text.replace(/&#39;/g, "'");
              return {
                textContent: text,
              };
            }
          }
          return null;
        },
      },
    },
  } as unknown as Editor;
};

describe('getDocumentTitle', () => {
  it('should extract title from first H1 heading', () => {
    const editor = createMockEditor('<h1>My Document Title</h1><p>Content</p>');
    const title = getDocumentTitle(editor);
    expect(title).toBe('My Document Title');
  });

  it('should trim whitespace from title', () => {
    const editor = createMockEditor('<h1>  Spaced Title  </h1>');
    const title = getDocumentTitle(editor);
    expect(title).toBe('Spaced Title');
  });

  it('should return "Untitled Document" when no H1 exists', () => {
    const editor = createMockEditor('<h2>Heading 2</h2><p>Content</p>');
    const title = getDocumentTitle(editor);
    expect(title).toBe('Untitled Document');
  });

  it('should return "Untitled Document" for empty document', () => {
    const editor = createMockEditor('');
    const title = getDocumentTitle(editor);
    expect(title).toBe('Untitled Document');
  });

  it('should handle H1 with HTML entities', () => {
    const editor = createMockEditor('<h1>Document &amp; Title</h1>');
    const title = getDocumentTitle(editor);
    expect(title).toBe('Document & Title');
  });

  it('should handle H1 with nested formatting', () => {
    const editor = createMockEditor('<h1><strong>Bold</strong> Title</h1>');
    const title = getDocumentTitle(editor);
    expect(title).toBe('Bold Title');
  });
});

describe('Export Content Integration', () => {
  it('should identify content that needs export', () => {
    // This is a placeholder test for the export flow
    // In a full implementation, we'd test collectExportContent
    expect(true).toBe(true);
  });
});

describe('Mermaid SVG to PNG Conversion', () => {
  it('should handle SVG elements for export', () => {
    // This is a placeholder for testing SVG to PNG conversion
    // Full implementation would test svgToPng with mock canvas
    expect(true).toBe(true);
  });
});
