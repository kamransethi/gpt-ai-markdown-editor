/**
 * HTML Comment Preservation Extension
 *
 * Preserves HTML comments (<!-- ... -->) during markdown round-trip.
 * Controlled by the `gptAiMarkdownEditor.preserveHtmlComments` config.
 *
 * Two nodes are exported:
 *  - HtmlCommentInline: captures inline comments within text
 *  - HtmlCommentBlock: captures standalone (block-level) comments
 */

import { Node, type JSONContent } from '@tiptap/core';
import { marked } from 'marked';

// ---------------------------------------------------------------------------
// Module-level flag – toggled by `setPreserveHtmlComments()` from editor.ts
// ---------------------------------------------------------------------------
let preserveComments = false;

/** Allow editor.ts to flip the feature on/off at runtime. */
export function setPreserveHtmlComments(value: boolean) {
  preserveComments = value;
}

// ---------------------------------------------------------------------------
// Marked inline extension – intercepts <!-- ... --> in inline content
// ---------------------------------------------------------------------------
const htmlCommentExtension = {
  name: 'htmlComment',
  level: 'inline' as const,

  start(src: string) {
    if (!preserveComments) return -1;
    return src.indexOf('<!--');
  },

  tokenizer(this: any, src: string) {
    if (!preserveComments) return undefined;
    const match = /^<!--[\s\S]*?-->/.exec(src);
    if (match) {
      return {
        type: 'htmlComment',
        raw: match[0],
        text: match[0],
      };
    }
    return undefined;
  },

  // The renderer is needed for the HTML→DOMParser path (backup).
  renderer(token: any) {
    const encoded = encodeURIComponent(token.text);
    return `<span data-html-comment="${encoded}"></span>`;
  },
};

marked.use({ extensions: [htmlCommentExtension as any] });

// ---------------------------------------------------------------------------
// Inline Comment Node
// ---------------------------------------------------------------------------

/**
 * Inline atom that preserves HTML comments within running text.
 * e.g. `Some text <!-- hidden note --> more text`
 */
export const HtmlCommentInline = Node.create({
  name: 'htmlCommentInline',
  group: 'inline',
  inline: true,
  atom: true,
  priority: 10, // Higher than GenericHTMLInline (1)

  // Registry key must match the marked token type so the token dispatcher
  // in @tiptap/markdown routes htmlComment tokens to this handler.
  markdownTokenName: 'htmlComment',

  addAttributes() {
    return {
      comment: { default: '' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-html-comment]',
        getAttrs: (element: string | HTMLElement) => {
          if (typeof element === 'string') return false;
          const encoded = element.getAttribute('data-html-comment');
          if (!encoded) return false;
          return { comment: decodeURIComponent(encoded) };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      {
        class: 'html-comment-node',
        title: HTMLAttributes.comment,
        'data-html-comment': encodeURIComponent(HTMLAttributes.comment),
      },
      HTMLAttributes.comment,
    ];
  },

  // Called by @tiptap/markdown's token dispatcher for 'htmlComment' tokens.
  parseMarkdown(token: any) {
    const raw = token.raw || token.text || '';
    if (!raw.startsWith('<!--')) return [];
    return {
      type: 'htmlCommentInline' as const,
      attrs: { comment: raw },
    };
  },

  renderMarkdown(node: JSONContent) {
    return node.attrs?.comment || '';
  },
});

// ---------------------------------------------------------------------------
// Block Comment Node
// ---------------------------------------------------------------------------

/**
 * Block atom that preserves standalone HTML comments (own line / block level).
 * e.g. `<!-- TODO: add section -->`
 *
 * Block comments are tokenised by marked's default block-HTML rule as
 * `{type: 'html', block: true}`.  We intercept them through
 * `markdownTokenName: 'html'` and only claim the token when it looks like a
 * comment.  Non-comment HTML tokens fall through to the existing fallback path
 * (`parseHTMLToken` → DOMParser → GenericHTMLBlock / GenericHTMLInline`).
 */
export const HtmlCommentBlock = Node.create({
  name: 'htmlCommentBlock',
  group: 'block',
  atom: true,
  priority: 10, // Higher than GenericHTMLBlock (1)

  markdownTokenName: 'html',

  addAttributes() {
    return {
      comment: { default: '' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-html-comment-block]',
        getAttrs: (element: string | HTMLElement) => {
          if (typeof element === 'string') return false;
          if (!(element instanceof HTMLElement)) return false;
          const encoded = element.getAttribute('data-html-comment-block');
          if (!encoded) return false;
          return { comment: decodeURIComponent(encoded) };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      {
        class: 'html-comment-node html-comment-block',
        title: HTMLAttributes.comment,
        'data-html-comment-block': encodeURIComponent(HTMLAttributes.comment),
      },
      HTMLAttributes.comment,
    ];
  },

  // Only claim the token when it is an HTML comment; return [] otherwise
  // so non-comment HTML falls through to parseFallbackToken → parseHTMLToken.
  parseMarkdown(token: any) {
    if (!preserveComments) return [];
    const raw = (token.raw || token.text || '').trim();
    if (!raw.startsWith('<!--') || !raw.endsWith('-->')) return [];
    return {
      type: 'htmlCommentBlock' as const,
      attrs: { comment: raw },
    };
  },

  renderMarkdown(node: JSONContent) {
    return (node.attrs?.comment || '') + '\n';
  },
});
