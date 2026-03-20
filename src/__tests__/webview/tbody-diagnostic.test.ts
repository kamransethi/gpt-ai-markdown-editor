/** @jest-environment jsdom */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Table, TableKit } from '@tiptap/extension-table';
import { markdownToHtml } from '../../webview/utils/pasteHandler';
import { parseHtmlTable, renderTableMatrixAsHtml } from '../../webview/utils/tableClipboard';

/**
 * Regression tests for the <tbody> bug.
 *
 * Browsers auto-insert <tbody> when parsing <table> HTML via innerHTML.
 * ProseMirror's DOMParser had no rule for these wrappers, so they leaked
 * as literal text inside cells.
 *
 * The fix is at the schema level: our Table extension overrides parseHTML
 * with a contentElement hook that unwraps <thead>/<tbody>/<tfoot> in the
 * DOM before ProseMirror reads the table's children.
 *
 * These tests verify:
 *  1. renderTableMatrixAsHtml never emits section wrappers
 *  2. parseHtmlTable correctly extracts data from HTML with section wrappers
 *  3. TipTap insertContent handles tables with <tbody> properly (end-to-end)
 */

/**
 * Create the same Table extension override used in editor.ts.
 * This teaches ProseMirror's DOMParser to unwrap <thead>/<tbody>/<tfoot>.
 */
function createTableExtension() {
  return Table.extend({
    parseHTML() {
      return [
        {
          tag: 'table',
          contentElement(node: HTMLElement) {
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
  }).configure({
    resizable: false,
  });
}

describe('tbody regression — no section wrappers leak into tables', () => {
  // ── Layer 1: renderTableMatrixAsHtml ─────────────────────────────
  describe('renderTableMatrixAsHtml output', () => {
    it('never contains <tbody>, <thead>, or <tfoot>', () => {
      const html = renderTableMatrixAsHtml([
        ['H1', 'H2', 'H3'],
        ['A', 'B', 'C'],
        ['D', 'E', 'F'],
      ]);
      expect(html).not.toMatch(/<\/?tbody/i);
      expect(html).not.toMatch(/<\/?thead/i);
      expect(html).not.toMatch(/<\/?tfoot/i);
    });
  });

  // ── Layer 2: markdownToHtml ──────────────────────────────────────
  describe('markdownToHtml output', () => {
    it('produces valid table HTML with standard markdown-it output', () => {
      const html = markdownToHtml('| A | B |\n| --- | --- |\n| 1 | 2 |');
      expect(html).toContain('<table>');
      expect(html).toContain('<tr>');
      expect(html).toContain('<th>');
      expect(html).toContain('<td>');
    });
  });

  // ── Layer 3: parseHtmlTable ──────────────────────────────────────
  describe('parseHtmlTable extracts data through wrappers', () => {
    it('parses through <tbody>', () => {
      const matrix = parseHtmlTable('<table><tbody><tr><td>A</td><td>B</td></tr></tbody></table>');
      expect(matrix).toEqual([['A', 'B']]);
    });

    it('parses through <thead> + <tbody>', () => {
      const matrix = parseHtmlTable(
        '<table><thead><tr><th>H1</th><th>H2</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>'
      );
      expect(matrix).toEqual([
        ['H1', 'H2'],
        ['1', '2'],
      ]);
    });

    it('parses through <tfoot>', () => {
      const matrix = parseHtmlTable(
        '<table><tbody><tr><td>A</td><td>B</td></tr></tbody><tfoot><tr><td>Total</td><td>100</td></tr></tfoot></table>'
      );
      expect(matrix).toEqual([
        ['A', 'B'],
        ['Total', '100'],
      ]);
    });
  });

  // ── Layer 4: TipTap insertContent end-to-end (schema-level fix) ──
  describe('TipTap insertContent with contentElement fix (end-to-end)', () => {
    let editor: Editor;

    beforeEach(() => {
      editor = new Editor({
        extensions: [StarterKit, createTableExtension(), TableKit.configure({ table: false })],
        content: '<p>Start</p>',
      });
    });

    afterEach(() => {
      editor?.destroy();
    });

    function insertAndCheck(html: string) {
      editor.commands.setTextSelection(editor.state.doc.content.size - 1);
      editor.commands.insertContent(html);
      const output = editor.getHTML();
      // The output should contain a proper table, never tbody/thead as text
      expect(output).toContain('<table');
      expect(output).toContain('<tr');
      expect(output).not.toContain('&lt;tbody');
      expect(output).not.toContain('&lt;thead');
      expect(output).not.toContain('&lt;tfoot');
      return output;
    }

    it('inserts clean table correctly', () => {
      insertAndCheck('<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>');
    });

    it('inserts table with <tbody> without leaking text', () => {
      insertAndCheck(
        '<table><tbody><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></tbody></table>'
      );
    });

    it('inserts table with <thead>+<tbody> without leaking text', () => {
      insertAndCheck(
        '<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>'
      );
    });

    it('inserts markdown-it table output without leaking text', () => {
      const mdHtml = markdownToHtml('| A | B |\n| --- | --- |\n| 1 | 2 |');
      insertAndCheck(mdHtml);
    });

    it('inserts ProseMirror clipboard HTML without leaking text', () => {
      insertAndCheck(
        '<meta charset="utf-8"><table data-pm-slice="1 1 []"><tbody><tr><th colspan="1" rowspan="1"><p>Col A</p></th><th colspan="1" rowspan="1"><p>Col B</p></th></tr><tr><td colspan="1" rowspan="1"><p>A1</p></td><td colspan="1" rowspan="1"><p>B1</p></td></tr></tbody></table>'
      );
    });

    it('inserts Google Docs table HTML without leaking text', () => {
      const googleHtml =
        '<table style="border:none;border-collapse:collapse;table-layout:fixed;width:468pt"><colgroup><col /><col /></colgroup><tbody><tr style="height:0pt"><td><p><span>Name</span></p></td><td><p><span>Value</span></p></td></tr><tr style="height:0pt"><td><p><span>Test</span></p></td><td><p><span>123</span></p></td></tr></tbody></table>';
      insertAndCheck(googleHtml);
    });

    it('round-trips a table through renderTableMatrixAsHtml', () => {
      const matrix = [
        ['Header A', 'Header B'],
        ['Data 1', 'Data 2'],
      ];
      const html = renderTableMatrixAsHtml(matrix);
      insertAndCheck(html);
    });

    it('round-trips a table through parseHtmlTable + renderTableMatrixAsHtml', () => {
      const sourceHtml =
        '<table><thead><tr><th>Key</th><th>Val</th></tr></thead><tbody><tr><td>a</td><td>1</td></tr></tbody></table>';
      const matrix = parseHtmlTable(sourceHtml);
      expect(matrix).not.toBeNull();
      const cleanHtml = renderTableMatrixAsHtml(matrix!);
      insertAndCheck(cleanHtml);
    });
  });
});
