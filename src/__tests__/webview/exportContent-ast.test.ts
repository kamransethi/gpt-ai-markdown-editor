/**
 * @jest-environment jsdom
 *
 * FR-003: AST-Based Export Serialization
 *
 * Validates that docSerializer.ts produces correct HTML using doc.descendants(),
 * and that collectExportContent no longer calls cloneNode.
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEditor(content: string): Editor {
  const editor = new Editor({
    extensions: [StarterKit],
    content,
  });
  return editor;
}

// ---------------------------------------------------------------------------
// serializeDocToHtml
// ---------------------------------------------------------------------------

describe('FR-003: serializeDocToHtml', () => {
  it('produces HTML from a simple doc with text and headings', async () => {
    const { serializeDocToHtml } = await import('../../webview/utils/docSerializer');
    const editor = makeEditor('<h1>Hello</h1><p>World</p>');
    const result = serializeDocToHtml(editor);
    expect(result.html).toContain('Hello');
    expect(result.html).toContain('World');
    editor.destroy();
  });

  it('returns mermaidIds as empty array when no mermaid nodes present', async () => {
    const { serializeDocToHtml } = await import('../../webview/utils/docSerializer');
    const editor = makeEditor('<p>No diagrams here</p>');
    const result = serializeDocToHtml(editor);
    expect(result.mermaidIds).toEqual([]);
    editor.destroy();
  });

  it('getMermaidPositions returns empty array when no mermaid nodes', async () => {
    const { getMermaidPositions } = await import('../../webview/utils/docSerializer');
    const editor = makeEditor('<p>Plain text</p>');
    const positions = getMermaidPositions(editor);
    expect(positions).toEqual([]);
    editor.destroy();
  });

  it('returns an html string (not undefined)', async () => {
    const { serializeDocToHtml } = await import('../../webview/utils/docSerializer');
    const editor = makeEditor('<p>Test content</p>');
    const result = serializeDocToHtml(editor);
    expect(typeof result.html).toBe('string');
    expect(result.html.length).toBeGreaterThan(0);
    editor.destroy();
  });
});

// ---------------------------------------------------------------------------
// collectExportContent — never calls cloneNode
// ---------------------------------------------------------------------------

describe('FR-003: collectExportContent does not call cloneNode', () => {
  it('never calls Element.prototype.cloneNode during export', async () => {
    const { collectExportContent } = await import('../../webview/utils/exportContent');

    // Spy on cloneNode at the prototype level — catches all DOM clone calls
    const cloneNodeSpy = jest.spyOn(Element.prototype, 'cloneNode');
    // Also spy on Node.prototype.cloneNode (the base method)
    const nodeCloneSpy = jest.spyOn(Node.prototype, 'cloneNode');

    // Minimal editor mock — no mermaid, no raw html
    const mockEditor = {
      state: {
        doc: {
          descendants: (_fn: (node: unknown, pos: number) => boolean) => {
            // No special nodes
          },
          content: { size: 0 },
        },
        schema: {
          nodes: {},
          marks: {},
        },
      },
      view: {
        dom: document.createElement('div'),
        nodeDOM: () => null,
      },
      getHTML: () => '<p>Mock content</p>',
    } as unknown as Editor;

    await collectExportContent(mockEditor);

    expect(cloneNodeSpy).not.toHaveBeenCalled();
    expect(nodeCloneSpy).not.toHaveBeenCalled();

    cloneNodeSpy.mockRestore();
    nodeCloneSpy.mockRestore();
  });

  it('returns html and mermaidImages keys', async () => {
    const { collectExportContent } = await import('../../webview/utils/exportContent');

    const mockEditor = {
      state: {
        doc: {
          descendants: () => {},
          content: { size: 0 },
        },
        schema: { nodes: {}, marks: {} },
      },
      view: {
        dom: document.createElement('div'),
        nodeDOM: () => null,
      },
      getHTML: () => '<p>Hello export</p>',
    } as unknown as Editor;

    const result = await collectExportContent(mockEditor);
    expect(result).toHaveProperty('html');
    expect(result).toHaveProperty('mermaidImages');
    expect(Array.isArray(result.mermaidImages)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Raw HTML from attrs.rawHtml (not data-raw DOM attribute reads)
// ---------------------------------------------------------------------------

describe('FR-003: raw HTML nodes read from attrs.rawHtml', () => {
  it('docSerializer reads rawHtml from node.attrs, not data-raw DOM attr', async () => {
    const { serializeDocToHtml } = await import('../../webview/utils/docSerializer');

    // Track if anyone reads data-raw attribute from the DOM
    const getAttributeSpy = jest.spyOn(Element.prototype, 'getAttribute');

    const editor = makeEditor('<p>No raw HTML</p>');
    serializeDocToHtml(editor);

    // data-raw attribute should never be read (if it is, we have a DOM dependency)
    const rawAttrReads = getAttributeSpy.mock.calls.filter(args => args[0] === 'data-raw');
    expect(rawAttrReads).toHaveLength(0);

    getAttributeSpy.mockRestore();
    editor.destroy();
  });
});
