import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TableKit, Table, TableCell } from '@tiptap/extension-table';

describe('US5: Paste Handling & Nested Tables', () => {
  let editor: Editor;

  beforeEach(() => {
    // Reset global vscode mock
    (global as any).window = {
      vscode: {
        postMessage: jest.fn(),
      },
    };

    const TestTableCell = TableCell.extend({
      content: 'block+',
    });

    editor = new Editor({
      extensions: [
        StarterKit,
        TableKit.configure({ tableCell: false }),
        TestTableCell,
        Table.extend({
          parseHTML() {
            return [
              {
                tag: 'table',
                contentElement(node: HTMLElement) {
                  node.querySelectorAll(':scope > colgroup').forEach(el => el.remove());
                  const sections = node.querySelectorAll(':scope > thead, :scope > tbody, :scope > tfoot');
                  for (const section of Array.from(sections)) {
                    while (section.firstChild) {
                      node.insertBefore(section.firstChild, section);
                    }
                    section.remove();
                  }
                  return node;
                },
              },
            ];
          },
        }),
      ],
      content: '',
    });
  });

  afterEach(() => {
    if (editor) {
      editor.destroy();
    }
  });

  it('strips tbody via parseHTML rule when pasting HTML table', () => {
    editor.commands.setContent(`
      <table>
        <tbody>
          <tr>
            <td><p>Cell</p></td>
          </tr>
        </tbody>
      </table>
    `);
    
    // Tiptap's schema should parse the table and strip the tbody.
    // The serialized HTML via getHTML() doesn't include tbody for standard TipTap tables.
    const html = editor.getHTML();
    expect(html).toContain('<table>');
    expect(html).toContain('<tr>');
    expect(html).not.toContain('<tbody>');
  });
});
