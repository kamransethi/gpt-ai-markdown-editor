/**
 * @jest-environment jsdom
 */

import { MarkdownManager } from '@tiptap/markdown';
import { Document } from '@tiptap/extension-document';
import { HardBreak } from '@tiptap/extension-hard-break';
import { Text } from '@tiptap/extension-text';
import { MarkdownParagraph } from '../../webview/extensions/markdownParagraph';
import { GenericHTMLBlock, GenericHTMLInline } from '../../webview/extensions/htmlPreservation';
import {
  HtmlCommentInline,
  HtmlCommentBlock,
  setPreserveHtmlComments,
} from '../../webview/extensions/htmlComment';

function createManager() {
  return new MarkdownManager({
    markedOptions: { gfm: true, breaks: true },
    extensions: [
      Document,
      MarkdownParagraph,
      HardBreak,
      Text,
      // Comment extensions must come before generic HTML extensions
      HtmlCommentInline,
      HtmlCommentBlock,
      GenericHTMLInline,
      GenericHTMLBlock,
    ],
  });
}

// ---------------------------------------------------------------------------
// Block-level comments
// ---------------------------------------------------------------------------

describe('HtmlCommentBlock', () => {
  afterEach(() => setPreserveHtmlComments(false));

  it('preserves a standalone block comment when enabled', () => {
    setPreserveHtmlComments(true);
    const manager = createManager();
    const doc = manager.parse('<!-- TODO: fix this -->\n');

    expect(doc).toEqual({
      type: 'doc',
      content: [
        {
          type: 'htmlCommentBlock',
          attrs: { comment: '<!-- TODO: fix this -->' },
        },
      ],
    });
  });

  it('round-trips a block comment through serialize', () => {
    setPreserveHtmlComments(true);
    const manager = createManager();
    const md = '<!-- TODO: fix this -->\n';
    const doc = manager.parse(md);
    const out = manager.serialize(doc);

    expect(out.trim()).toBe('<!-- TODO: fix this -->');
  });

  it('round-trips a multi-line block comment', () => {
    setPreserveHtmlComments(true);
    const manager = createManager();
    const md = '<!--\nline 1\nline 2\n-->\n';
    const doc = manager.parse(md);
    const out = manager.serialize(doc);

    expect(out.trim()).toBe('<!--\nline 1\nline 2\n-->');
  });

  it('does NOT preserve block comments when disabled', () => {
    setPreserveHtmlComments(false);
    const manager = createManager();
    const doc = manager.parse('<!-- hidden -->\n');

    // When disabled, the comment handler returns null and the fallback parser
    // handles the token.  Block HTML comments produce DOM Comment nodes that
    // ProseMirror's DOMParser ignores, so the document should be effectively
    // empty (no htmlCommentBlock node).
    const hasComment = (doc.content || []).some(
      (n: any) => n.type === 'htmlCommentBlock'
    );
    expect(hasComment).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Inline comments
// ---------------------------------------------------------------------------

describe('HtmlCommentInline', () => {
  afterEach(() => setPreserveHtmlComments(false));

  it('preserves an inline comment within a paragraph', () => {
    setPreserveHtmlComments(true);
    const manager = createManager();
    const doc = manager.parse('hello <!-- note --> world\n');

    // The paragraph should contain: text "hello ", commentNode, text " world"
    const para = doc.content?.[0];
    expect(para?.type).toBe('paragraph');

    const commentNode = para?.content?.find(
      (n: any) => n.type === 'htmlCommentInline'
    );
    expect(commentNode).toBeDefined();
    expect(commentNode?.attrs?.comment).toBe('<!-- note -->');
  });

  it('round-trips inline comment through serialize', () => {
    setPreserveHtmlComments(true);
    const manager = createManager();
    const md = 'hello <!-- note --> world\n';
    const doc = manager.parse(md);
    const out = manager.serialize(doc);

    expect(out.trim()).toBe('hello <!-- note --> world');
  });

  it('comment at line start is block HTML — not captured as inline', () => {
    // When a comment starts at the beginning of a line with trailing text,
    // marked treats the entire line as a block HTML token.  Our block handler
    // rejects it (doesn't end with -->), so the text survives but the comment
    // is lost.  This is an inherent markdown limitation, not a bug.
    setPreserveHtmlComments(true);
    const manager = createManager();
    const doc = manager.parse('<!-- start --> some text\n');

    const para = doc.content?.[0];
    const commentNode = (para?.content || []).find(
      (n: any) => n.type === 'htmlCommentInline'
    );
    // Comment is NOT preserved in this edge case
    expect(commentNode).toBeUndefined();
  });

  it('preserves comment at end of paragraph', () => {
    setPreserveHtmlComments(true);
    const manager = createManager();
    const md = 'some text <!-- end -->\n';
    const doc = manager.parse(md);
    const out = manager.serialize(doc);

    expect(out.trim()).toBe('some text <!-- end -->');
  });

  it('does NOT capture inline comments when disabled', () => {
    setPreserveHtmlComments(false);
    const manager = createManager();
    const doc = manager.parse('text <!-- hidden --> more\n');

    const para = doc.content?.[0];
    const commentNode = para?.content?.find(
      (n: any) => n.type === 'htmlCommentInline'
    );
    expect(commentNode).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// renderMarkdown (serialization)
// ---------------------------------------------------------------------------

describe('renderMarkdown', () => {
  beforeAll(() => setPreserveHtmlComments(true));
  afterAll(() => setPreserveHtmlComments(false));

  it('serialises inline comment node back to raw markdown', () => {
    const manager = createManager();
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'before ' },
            { type: 'htmlCommentInline', attrs: { comment: '<!-- x -->' } },
            { type: 'text', text: ' after' },
          ],
        },
      ],
    };
    const out = manager.serialize(doc);
    expect(out.trim()).toBe('before <!-- x --> after');
  });

  it('serialises block comment node with trailing newline', () => {
    const manager = createManager();
    const doc = {
      type: 'doc',
      content: [
        { type: 'htmlCommentBlock', attrs: { comment: '<!-- block -->' } },
      ],
    };
    const out = manager.serialize(doc);
    expect(out.trim()).toBe('<!-- block -->');
  });
});
