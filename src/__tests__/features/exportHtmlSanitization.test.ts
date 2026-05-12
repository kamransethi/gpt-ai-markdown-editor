/**
 * PDF/HTML Export Sanitization Tests
 *
 * The PDF export pipeline takes the editor's HTML and renders it via Chrome.
 * Combined with `--allow-file-access-from-files` (now removed) and the lack
 * of a CSP on the exported page, ANY active content (script, on* handler,
 * javascript: URI, foreign iframe/object/embed) in attacker-supplied
 * markdown was a vector to exfiltrate local files into the user's PDF.
 *
 * See SECURITY review §H3.
 *
 * Contract:
 *   sanitizeExportHtml(html: string): string
 *     - removes <script>, <iframe>, <object>, <embed>, <link>, <meta>
 *     - removes every on* event handler attribute
 *     - rewrites href / src / xlink:href / data attributes whose value is a
 *       javascript: or data:text/html: scheme to an empty string
 *     - preserves benign markup: paragraphs, lists, tables, code blocks,
 *       images, anchors, span/div with class/style/data-* attrs
 */

import { sanitizeExportHtml } from '../../features/documentExport';

describe('sanitizeExportHtml', () => {
  describe('strips active content', () => {
    it('removes <script> tags entirely (including contents)', () => {
      const out = sanitizeExportHtml(
        '<p>before</p><script>fetch("file:///etc/passwd")</script><p>after</p>'
      );
      expect(out).not.toMatch(/<script/i);
      expect(out).not.toMatch(/file:\/\/\/etc\/passwd/);
      expect(out).toContain('before');
      expect(out).toContain('after');
    });

    it('removes <iframe>', () => {
      const out = sanitizeExportHtml('<p>hi</p><iframe src="file:///etc/passwd"></iframe>');
      expect(out).not.toMatch(/<iframe/i);
    });

    it('removes <object> and <embed>', () => {
      const out = sanitizeExportHtml(
        '<object data="file:///etc/passwd"></object><embed src="file:///etc/passwd">'
      );
      expect(out).not.toMatch(/<object/i);
      expect(out).not.toMatch(/<embed/i);
    });

    it('removes <link> and <meta> (could redirect or refresh)', () => {
      const out = sanitizeExportHtml(
        '<meta http-equiv="refresh" content="0;url=file:///etc/passwd"><link rel="import" href="file:///etc/passwd">'
      );
      expect(out).not.toMatch(/<meta/i);
      expect(out).not.toMatch(/<link/i);
    });
  });

  describe('strips inline event handlers', () => {
    it('removes onerror on <img>', () => {
      const out = sanitizeExportHtml(
        '<img src="x" onerror="fetch(\'file:///etc/passwd\').then(r=>r.text()).then(t=>document.title=t)">'
      );
      expect(out).not.toMatch(/onerror/i);
      expect(out).not.toMatch(/file:\/\/\/etc\/passwd/);
      // benign attributes remain
      expect(out).toMatch(/<img\s/i);
      expect(out).toMatch(/src="x"/);
    });

    it('removes onload on <body> / <svg>', () => {
      const out = sanitizeExportHtml('<svg onload="alert(1)"><circle r="10"/></svg>');
      expect(out).not.toMatch(/onload/i);
    });

    it('removes onclick on <a>', () => {
      const out = sanitizeExportHtml('<a href="#" onclick="evil()">click</a>');
      expect(out).not.toMatch(/onclick/i);
    });

    it('strips uppercase / mixed-case ON* handlers (HTML attrs are case-insensitive)', () => {
      const out = sanitizeExportHtml('<img src="x" OnError="alert(1)">');
      expect(out).not.toMatch(/onerror/i);
    });
  });

  describe('strips dangerous URI schemes', () => {
    it('strips javascript: from <a href>', () => {
      const out = sanitizeExportHtml('<a href="javascript:alert(1)">x</a>');
      expect(out).not.toMatch(/javascript:/i);
    });

    it('strips javascript: from <img src>', () => {
      const out = sanitizeExportHtml('<img src="javascript:alert(1)">');
      expect(out).not.toMatch(/javascript:/i);
    });

    it('strips file: from <a href>', () => {
      const out = sanitizeExportHtml('<a href="file:///etc/passwd">click</a>');
      expect(out).not.toMatch(/file:\/\/\//i);
    });

    it('preserves https: and mailto: URIs', () => {
      const out = sanitizeExportHtml(
        '<a href="https://example.com">x</a><a href="mailto:a@b.c">y</a>'
      );
      expect(out).toContain('https://example.com');
      expect(out).toContain('mailto:a@b.c');
    });

    it('preserves data: image URIs (used for inlined PNGs)', () => {
      const out = sanitizeExportHtml('<img src="data:image/png;base64,iVBORw0KGgo=">');
      expect(out).toContain('data:image/png;base64,iVBORw0KGgo=');
    });

    it('strips data:text/javascript from <img src>', () => {
      const out = sanitizeExportHtml('<img src="data:text/javascript,alert(1)">');
      expect(out).not.toMatch(/data:text\/javascript/i);
    });

    it('strips data:application/javascript from <a href>', () => {
      const out = sanitizeExportHtml('<a href="data:application/javascript,alert(1)">x</a>');
      expect(out).not.toMatch(/data:application\/javascript/i);
    });

    it('strips data:text/html (active content disguised as data URI)', () => {
      const out = sanitizeExportHtml(
        '<iframe src="data:text/html,<script>alert(1)</script>"></iframe>'
      );
      expect(out).not.toMatch(/<iframe/i);
      // Even if the iframe-strip didn't catch it, the data:text/html scheme
      // must not survive on any element.
      expect(out).not.toMatch(/data:text\/html/i);
    });
  });

  describe('preserves benign markup', () => {
    it('keeps headings, paragraphs, code, tables, lists', () => {
      const html = `
        <h1>Title</h1>
        <p>Body with <strong>bold</strong> and <em>italic</em>.</p>
        <pre><code class="language-ts">const x = 1;</code></pre>
        <table><thead><tr><th>A</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>
        <ul><li>one</li><li>two</li></ul>
      `;
      const out = sanitizeExportHtml(html);
      expect(out).toContain('<h1>');
      expect(out).toContain('<strong>');
      expect(out).toContain('<em>');
      expect(out).toContain('language-ts');
      expect(out).toContain('<table>');
      expect(out).toContain('<th>');
      expect(out).toContain('<td>');
      expect(out).toContain('<li>');
    });

    it('keeps relative image paths and alt text', () => {
      const out = sanitizeExportHtml('<img src="./images/cat.png" alt="A cat">');
      expect(out).toContain('./images/cat.png');
      expect(out).toContain('A cat');
    });

    it('keeps class and style attributes (used by themes / Mermaid SVG)', () => {
      const out = sanitizeExportHtml('<div class="mermaid" style="color:red">x</div>');
      expect(out).toContain('class="mermaid"');
      expect(out).toContain('style="color:red"');
    });
  });

  describe('robustness', () => {
    it('returns empty string for empty input', () => {
      expect(sanitizeExportHtml('')).toBe('');
    });

    it('does not throw on malformed HTML', () => {
      expect(() =>
        sanitizeExportHtml('<p>unclosed <strong>nested <a href="x">stuff')
      ).not.toThrow();
    });
  });
});
