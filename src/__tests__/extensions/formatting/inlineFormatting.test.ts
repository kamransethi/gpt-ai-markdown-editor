/** @jest-environment jsdom */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { ListKit } from '@tiptap/extension-list';
import Paragraph from '@tiptap/extension-paragraph';

function createEditor(): Editor {
  const element = document.createElement('div');
  document.body.appendChild(element);

  return new Editor({
    element,
    extensions: [
      StarterKit.configure({
        paragraph: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
      } as any),
      Paragraph,
      ListKit.configure({
        taskList: false,
        taskItem: false,
      }),
      Markdown.configure({
        markedOptions: { gfm: true, breaks: true },
      }),
    ],
  });
}

describe('Inline Formatting', () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
  });

  it('highlights a section of text and applies bold', () => {
    editor = createEditor();
    
    // Insert initial text
    editor.commands.setContent('<p>This is a test paragraph.</p>');
    
    // Select "test" (starts at pos 11, length 4)
    // In TipTap, position 1 is inside the paragraph. 
    // "This is a test paragraph."
    // 12345678901234
    // "test" is at pos 11 to 15
    editor.commands.setTextSelection({ from: 11, to: 15 });
    
    // Apply bold
    editor.commands.toggleBold();
    
    const markdown = editor.getMarkdown();
    expect(markdown).toContain('This is a **test** paragraph.');
  });

  it('applies bold to text inside a bullet list', () => {
    editor = createEditor();
    
    // Insert a bullet list
    editor.commands.setContent('<ul><li>List item one</li></ul>');
    
    // Select "item" (starts around pos 8)
    editor.commands.setTextSelection({ from: 8, to: 12 });
    editor.commands.toggleBold();
    
    const markdown = editor.getMarkdown();
    expect(markdown).toContain('- List **item** one');
  });

  it('preserves bolding across a table cell', () => {
    editor = createEditor();
    editor.commands.setContent('<p>Another test where **bold** exists</p>');
    const markdown = editor.getMarkdown();
    expect(markdown).toContain('Another test where **bold** exists');
  });
});
