import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { marked } from 'marked';
import { Mark } from '@tiptap/core';

// marked.js extension to parse <span style="color: ..."> inline HTML
const colorSpanExtension = {
  name: 'colorSpan',
  level: 'inline',
  start(src: string) {
    return src.match(/<span\s+style="color:/i)?.index;
  },
  tokenizer(this: any, src: string, _tokens: any) {
    // Match <span style="color: value">content</span>
    const rule = /^<span\s+style="color:\s*([^;">]+)[^>]*>(.*?)<\/span>/i;
    const match = rule.exec(src);
    if (match) {
      return {
        type: 'colorSpan',
        raw: match[0],
        color: match[1].trim(),
        // tokenize the inner content so nested markdown works
        tokens: this.lexer.inlineTokens(match[2]),
      };
    }
    return undefined;
  },
  renderer(this: any, token: any) {
    return `<span style="color: ${token.color}">${this.parser.parseInline(token.tokens)}</span>`;
  },
};

// Register the extension with marked globally
marked.use({ extensions: [colorSpanExtension as any] });

// Extend TextStyle so that it serializes and deserializes the color as a span for markdown export
const extensionConfig = {
  // Tell @tiptap/markdown to look up this handler under the 'colorSpan' token
  // type (produced by the colorSpanExtension registered with marked above).
  // Without this the registry defaults to the extension's own name ('textStyle')
  // and getHandlerForToken('colorSpan') never finds this handler.
  markdownTokenName: 'colorSpan',
  parseMarkdown(token: any, helpers: any) {
    // @tiptap/markdown 3.x API: return { mark, attrs, content } directly.
    return {
      mark: 'textStyle',
      attrs: { color: token.color },
      content: helpers.parseInline(token.tokens || []),
    };
  },
  /**
   * Serialize textStyle mark to markdown as an inline HTML span.
   * The TipTap Markdown extension calls this for both opening and closing:
   * it renders a synthetic node, finds the placeholder, and splits around it.
   */
  renderMarkdown(node: any, helpers: any) {
    const color = node.attrs?.color;
    if (color) {
      return `<span style="color: ${color}">${helpers.renderChildren()}</span>`;
    }
    return helpers.renderChildren();
  },
};

// Note: Jest's jest-runtime strips the prototype (including the .extend method)
// from the TextStyle Mark when translating between ESM/CJS for Tiptap packages.
// This runtime fallback correctly instantiates the custom Mark in both prod and test environments.
export const CustomTextStyle = TextStyle.extend
  ? TextStyle.extend(extensionConfig)
  : Mark.create({ ...TextStyle, ...extensionConfig });

// Export the native color extension too so the editor can register it cleanly
export { Color as TextColorMark };
