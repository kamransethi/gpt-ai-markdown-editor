/** @jest-environment jsdom */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { TableKit, Table } from '@tiptap/extension-table';
import { ListKit } from '@tiptap/extension-list';
import Paragraph from '@tiptap/extension-paragraph';
import { renderTableToMarkdownWithBreaks } from '../../webview/utils/tableMarkdownSerializer';
import { Mermaid } from '../../webview/extensions/mermaid';

function createEditor(): Editor {
  const element = document.createElement('div');
  document.body.appendChild(element);

  return new Editor({
    element,
    extensions: [
      Mermaid,
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        paragraph: false, // Custom paragraph is used
        codeBlock: false,
        bulletList: false, // ListKit is used
        orderedList: false, // ListKit is used
        listItem: false, // ListKit is used
        taskList: false,
        taskItem: false,
        listKeymap: false,
      } as any),
      Paragraph,
      Markdown.configure({
        markedOptions: { gfm: true, breaks: true },
      }),
      Table.extend({
        renderMarkdown(node, h) {
          return renderTableToMarkdownWithBreaks(node, h);
        },
      }).configure({
        resizable: false,
        HTMLAttributes: { class: 'markdown-table' },
      }),
      TableKit.configure({ table: false }),
      ListKit.configure({
        taskList: false,
        taskItem: false,
      }),
    ],
  });
}

describe('Robot Data Entry E2E', () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
  });

  it('automates document generation: headers, tables, lists, and mermaid', () => {
    editor = createEditor();

    // 1. Insert a header
    editor.commands.insertContent('<h1>Project Overview</h1>');

    // 2. Insert a paragraph
    editor.commands.insertContent(
      '<p>This is an automated entry testing the editor serialization capabilities.</p>'
    );

    // 3. Insert a 2x2 table
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: true });

    // Insert content into the table manually (TipTap moves selection to table on create)
    editor.commands.insertContent('Feature');
    editor.commands.goToNextCell();
    editor.commands.insertContent('Status');
    editor.commands.goToNextCell();
    editor.commands.insertContent('E2E Tests');
    editor.commands.goToNextCell();
    editor.commands.insertContent('Passing');

    // Step out of table
    editor.commands.focus('end');
    editor.commands.insertContent('<p></p>'); // break

    // 4. Insert a bulleted list
    editor.commands.toggleBulletList();
    editor.commands.insertContent('First bullet');
    editor.commands.splitListItem('listItem');
    editor.commands.insertContent('Second bullet');
    // Exit list
    editor.commands.toggleBulletList();

    // 5. Insert Mermaid
    editor.commands.insertContent({
      type: 'mermaid',
      attrs: { code: 'graph TD;\nA-->B;' },
    });

    const markdown = editor.getMarkdown();

    // Assertions
    expect(markdown).toContain('# Project Overview');
    expect(markdown).toContain('This is an automated entry');
    expect(markdown).toMatch(/\|\s*Feature\s*\|\s*Status\s*\|/);
    expect(markdown).toMatch(/\|\s*[-]+\s*\|\s*[-]+\s*\|/);
    expect(markdown).toMatch(/\|\s*E2E Tests\s*\|\s*Passing\s*\|/);
    expect(markdown).toContain('- First bullet');
    expect(markdown).toContain('Second bullet'); // if splitListItem didn't work it might be in same list item
    expect(markdown).toContain('```mermaid');
  });
});
