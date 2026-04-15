/** @jest-environment jsdom */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import { HtmlPreservingTable } from '../../webview/extensions/htmlPreservingTable';

function createTableEditor(): Editor {
  const element = document.createElement('div');
  document.body.appendChild(element);

  return new Editor({
    element,
    extensions: [
      StarterKit.configure({
        heading: false,
      }),
      Markdown.configure({
        markedOptions: {
          gfm: true,
          breaks: true,
        },
      }),
      HtmlPreservingTable,
      TableRow,
      TableHeader,
      TableCell,
    ],
  });
}

describe('HTML table markdown serialization', () => {
  it('preserves HTML tables with class attributes on save', () => {
    const editor = createTableEditor();

    const htmlTableMarkdown = [
      '<table class="sq-table">',
      '  <tr><th>Column A</th><th>Column B</th></tr>',
      '  <tr><td>Value 1</td><td>Value 2</td></tr>',
      '</table>',
    ].join('\n');

    try {
      editor.commands.setContent(htmlTableMarkdown, { contentType: 'markdown' });

      const serialized = editor.getMarkdown();
      expect(serialized).toContain('<table class="sq-table">');
      expect(serialized).toContain('<th>Column A</th>');
      expect(serialized).toContain('<td>Value 1</td>');
      expect(serialized).not.toContain('| Column A |');
    } finally {
      editor.destroy();
    }
  });
});
