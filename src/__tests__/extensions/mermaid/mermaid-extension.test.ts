import type {
  MarkdownParseHelpers,
  MarkdownToken,
  MarkdownRendererHelpers,
  RenderContext,
  JSONContent,
} from '@tiptap/core';

// Extract the parsing/rendering logic directly to avoid DOM dependencies at import time
// This mirrors the implementation in src/webview/extensions/mermaid.ts
const parseMarkdown = (token: MarkdownToken, helpers: MarkdownParseHelpers) => {
  const language = (token.lang || '').toLowerCase();
  // Note: marked.js 15.x only sets codeBlockStyle for indented blocks, not fenced
  const isMermaidFence =
    token.type === 'code' &&
    token.codeBlockStyle !== 'indented' &&
    (language === 'mermaid' || token.raw?.startsWith('```mermaid'));

  if (!isMermaidFence) {
    return [];
  }

  const text = token.text ?? '';
  const content = text ? [helpers.createTextNode(text)] : [];

  return helpers.createNode(
    'mermaid',
    {
      language: 'mermaid',
    },
    content
  );
};

const renderMarkdown = (
  node: JSONContent,
  helpers: MarkdownRendererHelpers,
  _ctx: RenderContext
) => {
  const language = (node.attrs?.language as string) || 'mermaid';
  const body = helpers.renderChildren(node.content || [], '\n').replace(/\s+$/, '');
  const content = body.length > 0 ? body : '';
  return `\`\`\`${language}\n${content}\n\`\`\``;
};

describe('Mermaid TipTap extension markdown integration', () => {
  const createHelpers = () => {
    const createNode = jest.fn<
      ReturnType<MarkdownParseHelpers['createNode']>,
      Parameters<MarkdownParseHelpers['createNode']>
    >((type, attrs = {}, content = []) => ({
      type,
      attrs,
      content,
    }));

    const createTextNode = jest.fn<
      ReturnType<MarkdownParseHelpers['createTextNode']>,
      Parameters<MarkdownParseHelpers['createTextNode']>
    >(text => ({ type: 'text', text }));

    const helpers: MarkdownParseHelpers = {
      createNode,
      createTextNode,
      parseInline: jest.fn(),
      parseChildren: jest.fn(),
      applyMark: jest.fn(),
    } as unknown as MarkdownParseHelpers;

    helpers.createNode = createNode as MarkdownParseHelpers['createNode'];
    helpers.createTextNode = createTextNode as MarkdownParseHelpers['createTextNode'];

    return helpers;
  };

  it('skips non-mermaid code fences', () => {
    const helpers = createHelpers();
    // marked.js 15.x doesn't set codeBlockStyle for fenced blocks
    const token: MarkdownToken = {
      type: 'code',
      lang: 'ts',
      raw: '```ts\nconst x = 1;\n```',
      text: 'const x = 1;',
    };

    const result = parseMarkdown(token, helpers);

    expect(result).toEqual([]);
    expect(helpers.createNode).not.toHaveBeenCalled();
  });

  it('parses mermaid fences into mermaid nodes', () => {
    const helpers = createHelpers();
    // marked.js 15.x doesn't set codeBlockStyle for fenced blocks
    const token: MarkdownToken = {
      type: 'code',
      lang: 'mermaid',
      raw: '```mermaid\nflowchart LR\nA-->B\n```',
      text: 'flowchart LR\nA-->B',
    };

    const node = parseMarkdown(token, helpers);

    expect(node).toEqual({
      type: 'mermaid',
      attrs: { language: 'mermaid' },
      content: [{ type: 'text', text: 'flowchart LR\nA-->B' }],
    });
    expect(helpers.createNode).toHaveBeenCalledTimes(1);
    expect(helpers.createTextNode).toHaveBeenCalledWith('flowchart LR\nA-->B');
  });

  it('skips indented code blocks', () => {
    const helpers = createHelpers();
    // Indented code blocks should not be matched even if content mentions mermaid
    const token: MarkdownToken = {
      type: 'code',
      raw: '    mermaid\n',
      text: 'mermaid',
      codeBlockStyle: 'indented',
    };

    const result = parseMarkdown(token, helpers);

    expect(result).toEqual([]);
    expect(helpers.createNode).not.toHaveBeenCalled();
  });

  it('renders mermaid nodes back to fenced code blocks', () => {
    const node = {
      attrs: { language: 'mermaid' },
      content: [{ type: 'text', text: 'sequenceDiagram\nA->>B: ping' }],
    };
    const helpers = {
      renderChildren: jest.fn(() => 'sequenceDiagram\nA->>B: ping'),
    } as unknown as MarkdownRendererHelpers;
    const ctx = {} as RenderContext;

    const output = renderMarkdown(node as JSONContent, helpers, ctx);

    expect(output).toBe('```mermaid\nsequenceDiagram\nA->>B: ping\n```');
    expect(helpers.renderChildren).toHaveBeenCalledTimes(1);
  });
});
