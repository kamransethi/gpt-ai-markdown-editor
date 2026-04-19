/**
 * Image Drag & Drop Feature Tests
 *
 * Tests the pure utility functions that don't depend on DOM or VS Code APIs.
 * DOM-dependent functions (event handlers, etc.) would need integration tests.
 */

import {
  hasImageFiles,
  getImageFiles,
  isImageFile,
  generateImageName,
  fileToBase64,
  extractImagePathFromDataTransfer,
  resolveImageInsertPosition,
  parseImageFilename,
  type ImageDimensions,
} from '../../webview/features/imageDragDrop';

import { Schema, Fragment, Slice, type Node as ProseMirrorNode } from '@tiptap/pm/model';
import { dropPoint } from '@tiptap/pm/transform';

type MinimalEditorForPosition = {
  state: {
    schema: Schema;
    doc: ProseMirrorNode;
    selection: { from: number };
  };
};

// Mock File class for testing
function createMockFile(name: string, type: string, _size = 1000): File {
  const blob = new Blob(['test content'], { type });
  return new File([blob], name, { type });
}

// Mock DataTransfer for testing
function createMockDataTransfer(files: File[], data: Record<string, string> = {}): DataTransfer {
  const dt = {
    files: files,
    types: [...(files.length > 0 ? ['Files'] : []), ...Object.keys(data)],
    items: files.map(f => ({ type: f.type })),
    getData: (type: string) => data[type] || '',
  } as unknown as DataTransfer;
  return dt;
}

describe('isImageFile', () => {
  describe('supported image types', () => {
    it('should return true for PNG files', () => {
      const file = createMockFile('test.png', 'image/png');
      expect(isImageFile(file)).toBe(true);
    });

    it('should return true for JPEG files', () => {
      const file = createMockFile('test.jpg', 'image/jpeg');
      expect(isImageFile(file)).toBe(true);
    });

    it('should return true for GIF files', () => {
      const file = createMockFile('test.gif', 'image/gif');
      expect(isImageFile(file)).toBe(true);
    });

    it('should return true for WebP files', () => {
      const file = createMockFile('test.webp', 'image/webp');
      expect(isImageFile(file)).toBe(true);
    });

    it('should return true for SVG files', () => {
      const file = createMockFile('test.svg', 'image/svg+xml');
      expect(isImageFile(file)).toBe(true);
    });
  });

  describe('unsupported file types', () => {
    it('should return false for PDF files', () => {
      const file = createMockFile('test.pdf', 'application/pdf');
      expect(isImageFile(file)).toBe(false);
    });

    it('should return false for text files', () => {
      const file = createMockFile('test.txt', 'text/plain');
      expect(isImageFile(file)).toBe(false);
    });

    it('should return false for markdown files', () => {
      const file = createMockFile('test.md', 'text/markdown');
      expect(isImageFile(file)).toBe(false);
    });

    it('should return false for zip files', () => {
      const file = createMockFile('test.zip', 'application/zip');
      expect(isImageFile(file)).toBe(false);
    });

    it('should return false for video files', () => {
      const file = createMockFile('test.mp4', 'video/mp4');
      expect(isImageFile(file)).toBe(false);
    });
  });
});

describe('hasImageFiles', () => {
  it('should return true when DataTransfer contains image files', () => {
    const files = [createMockFile('test.png', 'image/png')];
    const dt = createMockDataTransfer(files);
    expect(hasImageFiles(dt)).toBe(true);
  });

  it('should return true when DataTransfer contains mixed files with images', () => {
    const files = [
      createMockFile('doc.pdf', 'application/pdf'),
      createMockFile('test.png', 'image/png'),
    ];
    const dt = createMockDataTransfer(files);
    expect(hasImageFiles(dt)).toBe(true);
  });

  it('should return false when DataTransfer contains no image files', () => {
    const files = [createMockFile('doc.pdf', 'application/pdf')];
    const dt = createMockDataTransfer(files);
    expect(hasImageFiles(dt)).toBe(false);
  });

  it('should return false when DataTransfer is empty', () => {
    const dt = createMockDataTransfer([]);
    expect(hasImageFiles(dt)).toBe(false);
  });

  it('should return false when DataTransfer is null', () => {
    expect(hasImageFiles(null)).toBe(false);
  });
});

describe('getImageFiles', () => {
  it('should return only image files from DataTransfer', () => {
    const pngFile = createMockFile('test.png', 'image/png');
    const jpgFile = createMockFile('photo.jpg', 'image/jpeg');
    const pdfFile = createMockFile('doc.pdf', 'application/pdf');
    const files = [pngFile, jpgFile, pdfFile];
    const dt = createMockDataTransfer(files);

    const result = getImageFiles(dt);

    expect(result).toHaveLength(2);
    expect(result).toContain(pngFile);
    expect(result).toContain(jpgFile);
    expect(result).not.toContain(pdfFile);
  });

  it('should return empty array when no image files present', () => {
    const files = [createMockFile('doc.pdf', 'application/pdf')];
    const dt = createMockDataTransfer(files);

    const result = getImageFiles(dt);

    expect(result).toHaveLength(0);
  });

  it('should return empty array when DataTransfer is null', () => {
    expect(getImageFiles(null)).toEqual([]);
  });

  it('should return all files when all are images', () => {
    const files = [
      createMockFile('a.png', 'image/png'),
      createMockFile('b.jpg', 'image/jpeg'),
      createMockFile('c.gif', 'image/gif'),
    ];
    const dt = createMockDataTransfer(files);

    const result = getImageFiles(dt);

    expect(result).toHaveLength(3);
  });
});

describe('extractImagePathFromDataTransfer', () => {
  it('returns path from text/uri-list when it is an image', () => {
    const dt = createMockDataTransfer([], { 'text/uri-list': 'file:///path/to/image.png' });
    expect(extractImagePathFromDataTransfer(dt)).toBe('file:///path/to/image.png');
  });

  it('returns path from text/plain when it is an image path', () => {
    const dt = createMockDataTransfer([], { 'text/plain': '/workspace/assets/hero.jpg' });
    expect(extractImagePathFromDataTransfer(dt)).toBe('/workspace/assets/hero.jpg');
  });

  it('prefers first non-empty line', () => {
    const dt = createMockDataTransfer([], { 'text/uri-list': '\n\n/path/to/foo.webp\n/other' });
    expect(extractImagePathFromDataTransfer(dt)).toBe('/path/to/foo.webp');
  });

  it('returns null for non-image text payloads', () => {
    const dt = createMockDataTransfer([], { 'text/plain': '/workspace/docs/readme.md' });
    expect(extractImagePathFromDataTransfer(dt)).toBeNull();
  });

  it('returns null when no data transfer is provided', () => {
    expect(extractImagePathFromDataTransfer(null)).toBeNull();
  });
});

describe('resolveImageInsertPosition', () => {
  it('uses dropPoint to return a schema-valid insertion position for a block image', () => {
    const schema = new Schema({
      nodes: {
        doc: { content: 'block+' },
        paragraph: {
          group: 'block',
          content: 'inline*',
          toDOM: () => ['p', 0],
          parseDOM: [{ tag: 'p' }],
        },
        text: { group: 'inline' },
        image: {
          group: 'block',
          inline: false,
          atom: true,
          draggable: true,
          selectable: true,
          attrs: { src: { default: null }, alt: { default: null } },
          toDOM: node => ['img', { src: node.attrs.src, alt: node.attrs.alt }],
          parseDOM: [{ tag: 'img' }],
        },
      },
    });

    const doc = schema.nodes.doc.create(null, [
      schema.nodes.paragraph.create(null, [schema.text('hello')]),
      schema.nodes.paragraph.create(null, [schema.text('world')]),
    ]);

    const editor = {
      state: {
        schema,
        doc,
        selection: { from: 1 },
      },
    } satisfies MinimalEditorForPosition;

    const requestedPos = 2;
    const imageNode = schema.nodes.image.create({ src: 'x', alt: null });
    const slice = new Slice(Fragment.from(imageNode), 0, 0);
    const expected = dropPoint(doc, requestedPos, slice) ?? editor.state.selection.from;

    expect(resolveImageInsertPosition(editor, requestedPos)).toBe(expected);
  });

  it('falls back to current selection when requested position is outside document bounds', () => {
    const schema = new Schema({
      nodes: {
        doc: { content: 'block+' },
        paragraph: {
          group: 'block',
          content: 'inline*',
          toDOM: () => ['p', 0],
          parseDOM: [{ tag: 'p' }],
        },
        text: { group: 'inline' },
        image: {
          group: 'block',
          inline: false,
          atom: true,
          attrs: { src: { default: null }, alt: { default: null } },
          toDOM: node => ['img', { src: node.attrs.src, alt: node.attrs.alt }],
          parseDOM: [{ tag: 'img' }],
        },
      },
    });

    const doc = schema.nodes.doc.create(null, [
      schema.nodes.paragraph.create(null, [schema.text('x')]),
    ]);

    const editor = {
      state: {
        schema,
        doc,
        selection: { from: 1 },
      },
    } satisfies MinimalEditorForPosition;

    expect(resolveImageInsertPosition(editor, 99999)).toBe(1);
  });
});

describe('generateImageName', () => {
  const defaultDimensions: ImageDimensions = { width: 800, height: 600 };

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps primary filenames clean for non-generic names', () => {
    const result = generateImageName('test.png', 'dropped', defaultDimensions);
    expect(result).toBe('test.png');
  });

  it('adds source + timestamp for generic names (screenshot.png)', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-12-15T12:34:56.000Z'));
    const result = generateImageName('screenshot.png', 'pasted', { width: 1920, height: 1080 });
    expect(result).toBe('pasted_20251215-123456.png');
  });

  it('treats image.png as generic and generates a timestamped name', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-12-15T12:34:56.000Z'));
    const result = generateImageName('image.png', 'pasted', { width: 1920, height: 1080 });
    expect(result).toBe('pasted_20251215-123456.png');
  });

  it('treats clipboard-image.png as generic and generates a timestamped name', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-12-15T12:34:56.000Z'));
    const result = generateImageName('clipboard-image.png', 'pasted', {
      width: 1920,
      height: 1080,
    });
    expect(result).toBe('pasted_20251215-123456.png');
  });

  it('should preserve file extension', () => {
    expect(generateImageName('photo.jpg', 'dropped', defaultDimensions)).toMatch(/\.jpg$/);
    expect(generateImageName('image.gif', 'pasted', defaultDimensions)).toMatch(/\.gif$/);
    expect(generateImageName('graphic.svg', 'dropped', defaultDimensions)).toMatch(/\.svg$/);
  });

  it('should sanitize special characters in filename', () => {
    const result = generateImageName('my image (1).png', 'dropped', defaultDimensions);
    expect(result).not.toContain(' ');
    expect(result).not.toContain('(');
    expect(result).not.toContain(')');
    expect(result).toBe('my-image-1.png');
  });

  it('should handle multiple dots in filename', () => {
    const result = generateImageName('my.file.name.png', 'dropped', defaultDimensions);
    expect(result).toBe('my-file-name.png');
  });

  it('should limit filename length', () => {
    const longName = 'a'.repeat(100) + '.png';
    const result = generateImageName(longName, 'dropped', defaultDimensions);
    // Base name should be limited to 50 chars + extension
    expect(result.length).toBeLessThanOrEqual(60);
  });

  it('should collapse multiple hyphens', () => {
    const result = generateImageName('test---file.png', 'dropped', defaultDimensions);
    expect(result).not.toMatch(/---/);
  });

  it('should handle uppercase extensions', () => {
    const result = generateImageName('Photo.PNG', 'dropped', defaultDimensions);
    expect(result).toMatch(/\.png$/);
  });

  it('should handle files without extension', () => {
    const result = generateImageName('noextension', 'dropped', defaultDimensions);
    expect(result).toBe('noextension.png');
  });
});

describe('parseImageFilename', () => {
  it('should parse new format filename (no timestamp)', () => {
    const parsed = parseImageFilename('dropped_cat-desktop_800x600px.png');
    expect(parsed.source).toBe('dropped');
    expect(parsed.name).toBe('cat-desktop');
    expect(parsed.dimensions).toEqual({ width: 800, height: 600 });
    expect(parsed.extension).toBe('png');
  });

  it('should parse pasted image filename', () => {
    const parsed = parseImageFilename('pasted_screenshot_1920x1080px.png');
    expect(parsed.source).toBe('pasted');
    expect(parsed.name).toBe('screenshot');
    expect(parsed.dimensions).toEqual({ width: 1920, height: 1080 });
  });

  it('should parse old format with timestamp (backward compat)', () => {
    const parsed = parseImageFilename('dropped_cat-desktop_1700000000000_800x600px.png');
    expect(parsed.source).toBe('dropped');
    expect(parsed.name).toBe('cat-desktop');
    expect(parsed.dimensions).toEqual({ width: 800, height: 600 });
    expect(parsed.extension).toBe('png');
  });

  it('should parse legacy format filename', () => {
    const parsed = parseImageFilename('cat-desktop-1700000000000.png');
    expect(parsed.source).toBeNull();
    expect(parsed.name).toBe('cat-desktop');
    expect(parsed.dimensions).toBeNull();
    expect(parsed.extension).toBe('png');
  });

  it('should handle unparseable filename', () => {
    const parsed = parseImageFilename('random-image.jpg');
    expect(parsed.source).toBeNull();
    expect(parsed.name).toBe('random-image');
    expect(parsed.dimensions).toBeNull();
    expect(parsed.extension).toBe('jpg');
  });

  it('should parse clean filenames (no source, no dimensions)', () => {
    const parsed = parseImageFilename('cat.png');
    expect(parsed.source).toBeNull();
    expect(parsed.name).toBe('cat');
    expect(parsed.dimensions).toBeNull();
    expect(parsed.extension).toBe('png');
  });
});

describe('fileToBase64', () => {
  // Note: fileToBase64 uses FileReader which is not available in Node.js
  // These tests would need jsdom environment to run properly

  it.skip('should convert file to base64 data URL (requires browser environment)', async () => {
    const file = createMockFile('test.png', 'image/png');
    const result = await fileToBase64(file);
    expect(result).toMatch(/^data:image\/png;base64,/);
  });

  it.skip('should convert JPEG file to base64 (requires browser environment)', async () => {
    const file = createMockFile('test.jpg', 'image/jpeg');
    const result = await fileToBase64(file);
    expect(result).toMatch(/^data:image\/jpeg;base64,/);
  });

  it.skip('should convert GIF file to base64 (requires browser environment)', async () => {
    const file = createMockFile('test.gif', 'image/gif');
    const result = await fileToBase64(file);
    expect(result).toMatch(/^data:image\/gif;base64,/);
  });
});

describe('edge cases', () => {
  const defaultDimensions: ImageDimensions = { width: 100, height: 100 };

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should handle files with unicode names', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-12-15T12:34:56.000Z'));
    const result = generateImageName('图片.png', 'dropped', defaultDimensions);
    expect(result).toBe('dropped_20251215-123456.png');
  });

  it('should handle files with emoji names', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-12-15T12:34:56.000Z'));
    const result = generateImageName('screenshot 📸.png', 'pasted', defaultDimensions);
    expect(result).toBe('pasted_20251215-123456.png');
  });

  it('should handle empty filename', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-12-15T12:34:56.000Z'));
    const result = generateImageName('.png', 'dropped', defaultDimensions);
    expect(result).toBe('dropped_20251215-123456.png');
  });

  it('should handle very short filenames', () => {
    const result = generateImageName('a.png', 'dropped', defaultDimensions);
    expect(result).toBe('a.png');
  });
});
