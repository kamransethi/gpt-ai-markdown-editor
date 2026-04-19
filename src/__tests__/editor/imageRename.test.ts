/**
 * Image Rename Tests
 *
 * Tests for image rename + resize filename helpers.
 *
 * Manual rename should respect the user-provided name without auto-adding
 * dimensions or source prefixes.
 *
 * Resize operations should use includeDimensions to control BOTH dimensions
 * and source prefix together.
 */

import {
  parseImageSourcePrefix,
  buildImageFilenameForUserRename,
  updateFilenameDimensions,
} from '../../editor/MarkdownEditorProvider';

describe('parseImageSourcePrefix', () => {
  it('should extract dropped_ prefix from filename', () => {
    expect(parseImageSourcePrefix('dropped_image_800x600px.png')).toBe('dropped_');
  });

  it('should extract pasted_ prefix from filename', () => {
    expect(parseImageSourcePrefix('pasted_screenshot_1920x1080px.png')).toBe('pasted_');
  });

  it('should return null when no source prefix present', () => {
    expect(parseImageSourcePrefix('image_800x600px.png')).toBeNull();
    expect(parseImageSourcePrefix('my-image.png')).toBeNull();
    expect(parseImageSourcePrefix('random-file.jpg')).toBeNull();
  });

  it('should extract prefix from filename without dimensions', () => {
    expect(parseImageSourcePrefix('dropped_image.png')).toBe('dropped_');
    expect(parseImageSourcePrefix('pasted_screenshot.png')).toBe('pasted_');
  });

  it('should extract prefix from old format with timestamp', () => {
    expect(parseImageSourcePrefix('dropped_image_1700000000000_800x600px.png')).toBe('dropped_');
  });

  it('should handle edge cases', () => {
    expect(parseImageSourcePrefix('')).toBeNull();
    expect(parseImageSourcePrefix('dropped_')).toBe('dropped_');
    expect(parseImageSourcePrefix('pasted_')).toBe('pasted_');
  });
});

describe('buildImageFilenameForUserRename', () => {
  it('should use the user-provided name exactly (no auto prefix)', () => {
    const result = buildImageFilenameForUserRename('myimage', 'png');
    expect(result).toBe('myimage.png');
  });

  it('should keep user-provided name even if it looks like a source prefix', () => {
    const result = buildImageFilenameForUserRename('pasted_myimage', 'png');
    expect(result).toBe('pasted_myimage.png');
  });

  it('should handle extension with leading dot', () => {
    const result = buildImageFilenameForUserRename('myimage', '.png');
    expect(result).toBe('myimage.png');
  });
});

describe('updateFilenameDimensions (resize)', () => {
  it('should update dimensions and preserve source prefix when enabled', () => {
    const result = updateFilenameDimensions('dropped_cat_800x600px.png', 400, 300, true);
    expect(result).toBe('dropped_cat_400x300px.png');
  });

  it('should strip BOTH source prefix and dimensions when disabled', () => {
    const result = updateFilenameDimensions('dropped_cat_800x600px.png', 400, 300, false);
    expect(result).toBe('cat.png');
  });

  it('should strip source prefix when disabled (no dimensions present)', () => {
    const result = updateFilenameDimensions('dropped_cat.png', 400, 300, false);
    expect(result).toBe('cat.png');
  });

  it('should strip dimensions when disabled (no source prefix present)', () => {
    const result = updateFilenameDimensions('cat_800x600px.png', 400, 300, false);
    expect(result).toBe('cat.png');
  });

  it('should strip source prefix and old timestamp format when disabled', () => {
    const result = updateFilenameDimensions(
      'pasted_cat_1700000000000_800x600px.png',
      400,
      300,
      false
    );
    expect(result).toBe('cat.png');
  });

  it('should not modify a filename without source prefix or dimensions when disabled', () => {
    const result = updateFilenameDimensions('random-image.jpg', 200, 100, false);
    expect(result).toBe('random-image.jpg');
  });
});
