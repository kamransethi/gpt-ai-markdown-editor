import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TableKit, Table, TableCell } from '@tiptap/extension-table';
import { hasOnlyImageContent, processPasteContent } from '../../webview/utils/pasteHandler';

// ---------------------------------------------------------------------------
// Helper: build a minimal DataTransfer-like object for unit tests
// ---------------------------------------------------------------------------
function makeClipboard(
  items: Array<{ type: string; asString?: string }>,
  data: Record<string, string> = {}
): DataTransfer {
  return {
    items: items as unknown as DataTransferItemList,
    getData: (type: string) => data[type] ?? '',
  } as unknown as DataTransfer;
}

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
                  const sections = node.querySelectorAll(
                    ':scope > thead, :scope > tbody, :scope > tfoot'
                  );
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

// ---------------------------------------------------------------------------
// FR-006: Web-paste regression — mixed text/html + image/* clipboard
// ---------------------------------------------------------------------------
describe('FR-006: hasOnlyImageContent', () => {
  it('returns false when clipboard has both text/html and image/png', () => {
    const clipboard = makeClipboard([{ type: 'text/html' }, { type: 'image/png' }], {
      'text/html': '<p>Hello <img src="https://example.com/x.png"></p>',
    });
    expect(hasOnlyImageContent(clipboard)).toBe(false);
  });

  it('returns true when clipboard has only image/png (no text/html)', () => {
    const clipboard = makeClipboard([{ type: 'image/png' }]);
    expect(hasOnlyImageContent(clipboard)).toBe(true);
  });

  it('returns false when clipboard has no image items at all', () => {
    const clipboard = makeClipboard([{ type: 'text/plain' }], { 'text/plain': 'hello' });
    expect(hasOnlyImageContent(clipboard)).toBe(false);
  });

  it('processPasteContent does NOT short-circuit when both text/html and image/* present', () => {
    const htmlContent = '<p>Hello from webpage</p>';
    const clipboard = makeClipboard([{ type: 'text/html' }, { type: 'image/png' }], {
      'text/html': htmlContent,
      'text/plain': 'Hello from webpage',
    });
    const result = processPasteContent(clipboard);
    // Should NOT return isImage:true — should process the HTML instead
    expect(result.isImage).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// FR-004: Unified event pipeline — editorProps handler contracts
// ---------------------------------------------------------------------------
describe('FR-004: imagePasteHandler / imageDragDropHandler contracts', () => {
  it('imageDragDropHandler returns false when no files or image paths in dataTransfer', () => {
    // Import the exported handler — it relies on _moduleEditor/_moduleVscodeApi being null
    // at this point so it should return false
    const { imageDragDropHandler } = require('../../webview/features/imageDragDrop');
    const mockDt = { files: [], getData: () => '' } as unknown as DataTransfer;
    const mockEvent = { dataTransfer: mockDt } as unknown as DragEvent;
    const result = imageDragDropHandler(null, mockEvent, null, false);
    // Module refs not set up → returns false (graceful no-op)
    expect(result).toBe(false);
  });

  it('imagePasteHandler returns false when clipboard has no image content', () => {
    const { imagePasteHandler } = require('../../webview/features/imageDragDrop');
    const mockClipboard = makeClipboard([{ type: 'text/plain' }], { 'text/plain': 'just text' });
    const mockEvent = { clipboardData: mockClipboard } as unknown as ClipboardEvent;
    const result = imagePasteHandler(null, mockEvent, null);
    // No image items → returns false, letting clipboardHandling.ts process it
    expect(result).toBe(false);
  });
});
