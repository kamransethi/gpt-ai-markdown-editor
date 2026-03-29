import { extractPathFromDataTransfer } from '../../webview/features/fileLinkDrop';

function createMockDataTransfer(
  files: File[] = [],
  data: Record<string, string> = {}
): DataTransfer {
  return {
    files,
    getData: (type: string) => data[type] || '',
  } as unknown as DataTransfer;
}

describe('extractPathFromDataTransfer', () => {
  it('extracts a file URI from text/uri-list', () => {
    const dt = createMockDataTransfer([], {
      'text/uri-list': 'file:///Users/test/docs/notes.pdf',
    });

    expect(extractPathFromDataTransfer(dt)).toEqual({
      sourcePath: '/Users/test/docs/notes.pdf',
      fileName: 'notes.pdf',
    });
  });

  it('extracts an absolute filesystem path from text/plain', () => {
    const dt = createMockDataTransfer([], {
      'text/plain': '/Users/test/docs/notes.md',
    });

    expect(extractPathFromDataTransfer(dt)).toEqual({
      sourcePath: '/Users/test/docs/notes.md',
      fileName: 'notes.md',
    });
  });

  it('returns null for internal editor drag text (mermaid content)', () => {
    const dt = createMockDataTransfer([], {
      'text/plain': 'flowchart TD\nA[Start] --> B[End]',
    });

    expect(extractPathFromDataTransfer(dt)).toBeNull();
  });

  it('returns null for non-path plain text', () => {
    const dt = createMockDataTransfer([], {
      'text/plain': 'just regular dragged text',
    });

    expect(extractPathFromDataTransfer(dt)).toBeNull();
  });
});
