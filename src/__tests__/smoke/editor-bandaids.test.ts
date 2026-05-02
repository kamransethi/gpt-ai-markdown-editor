/** @jest-environment jsdom */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { ImageBoundaryNav } from '../../webview/extensions/imageBoundaryNav';
import { CustomImage } from '../../webview/extensions/customImage';

describe('Editor Bandaids Removal Tests', () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
  });

  describe('US1: Native Image Navigation & Boundaries', () => {
    it('creates an empty paragraph when Enter is pressed at the start of a paragraph next to an image', () => {
      editor = new Editor({
        extensions: [StarterKit, CustomImage, ImageBoundaryNav],
        content: '<p><img src="test.jpg">Text</p>',
      });

      // Position cursor right before the image (offset 1 in the doc, offset 0 in paragraph)
      editor.commands.setTextSelection(1);

      // Trigger Enter
      const handled = editor.view.someProp('handleKeyDown', f => f(editor.view, new KeyboardEvent('keydown', { key: 'Enter' })));
      expect(handled).toBe(true);

      // Should have inserted a paragraph before
      expect(editor.getHTML()).toContain('<p></p><p><img src="test.jpg">Text</p>');
    });

    it('creates an empty paragraph when Enter is pressed at the end of a paragraph next to an image', () => {
      editor = new Editor({
        extensions: [StarterKit, CustomImage, ImageBoundaryNav],
        content: '<p>Text<img src="test.jpg"></p>',
      });

      // Position cursor right after the image
      const textNodeSize = 4; // 'Text'
      const imgNodeSize = 1;
      const endPos = 1 + textNodeSize + imgNodeSize;
      editor.commands.setTextSelection(endPos);

      // Trigger Enter
      const handled = editor.view.someProp('handleKeyDown', f => f(editor.view, new KeyboardEvent('keydown', { key: 'Enter' })));
      expect(handled).toBe(true);

      // Should have inserted a paragraph after
      expect(editor.getHTML()).toContain('<p>Text<img src="test.jpg"></p><p></p>');
    });
  });

  describe('US2: Fix Greedy Selection in Tables', () => {
    it('does not exclude tables from drag handle to prevent selection trapping', async () => {
      // Dynamic import to avoid test initialization issues if not used yet
      const { DraggableBlocks } = await import('../../webview/extensions/draggableBlocks');
      const excludedTags = DraggableBlocks.options.excludedTagList || [];
      expect(excludedTags).not.toContain('table');
      expect(excludedTags).not.toContain('td');
      expect(excludedTags).not.toContain('th');
      expect(excludedTags).not.toContain('tr');
    });
  });

  describe('US6: Standardize Bullet Lists in Tables', () => {
    it('allows native bullet lists to be created inside table cells', async () => {
      // Need TableKit and ListKit to test this properly
      const { TableKit, TableCell } = await import('@tiptap/extension-table');
      const { BulletList, ListItem } = await import('@tiptap/extension-list');
      
      const TestTableCell = TableCell.extend({
        content: 'block+',
      });

      editor = new Editor({
        extensions: [
          StarterKit,
          TableKit.configure({ tableCell: false }),
          TestTableCell,
          BulletList,
          ListItem
        ],
        content: `
          <table>
            <tbody>
              <tr>
                <td><p>Cell 1</p></td>
              </tr>
            </tbody>
          </table>
        `,
      });

      // Find the cell position
      let cellPos = 0;
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'tableCell') {
          cellPos = pos;
        }
      });

      // Select inside the cell
      editor.commands.setTextSelection(cellPos + 2); // Inside the paragraph
      
      // Toggle bullet list
      editor.commands.toggleBulletList();
      
      // Verify bullet list was created inside the cell
      const html = editor.getHTML();
      expect(html).toContain('<ul>');
      expect(html).toContain('<li><p>Cell 1</p></li>');
    });
  });

  describe('US3: Fix Link Absorption', () => {
    it('does not absorb typing immediately after a link', async () => {
      const { Link } = await import('@tiptap/extension-link');
      
      editor = new Editor({
        extensions: [
          StarterKit,
          Link.configure({ openOnClick: false })
        ],
        content: '<p><a href="https://example.com">Link</a></p>',
      });

      // Position cursor at the very end of the link
      editor.commands.setTextSelection(5);
      
      // Type something
      editor.commands.insertContent('x');

      const html = editor.getHTML();
      // The 'x' should be outside the link tag
      expect(html).toContain('<a target="_blank" rel="noopener noreferrer nofollow" href="https://example.com">Link</a>x');
    });
  });

  describe('US4: Deprecate Blank Line Hack', () => {
    it('preserves empty paragraphs natively without using data-blank-line hacks', async () => {
      // Need Markdown extension to test this properly
      const { Markdown } = await import('@tiptap/markdown');
      
      editor = new Editor({
        extensions: [
          StarterKit.configure({ paragraph: false }),
          Markdown
        ],
        content: '<p>Line 1</p><p></p><p>Line 3</p>',
      });

      // The middle paragraph should just be a normal empty paragraph, not dropped.
      const html = editor.getHTML();
      expect(html).toContain('<p>Line 1</p><p></p><p>Line 3</p>');
    });
  });
});
