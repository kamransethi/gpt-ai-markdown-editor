import type {
  MarkdownParseHelpers,
  MarkdownToken,
  MarkdownRendererHelpers,
  RenderContext,
  JSONContent,
} from '@tiptap/core';

// Extract the parsing/rendering logic directly to avoid DOM dependencies at import time
// This mirrors the implementation in src/webview/extensions/githubAlerts.ts
const parseMarkdown = (token: MarkdownToken, helpers: MarkdownParseHelpers) => {
  if (token.type !== 'blockquote') {
    return [];
  }

  // Check if first line contains [!TYPE] pattern
  const text = token.text ?? '';
  const lines = text.split('\n');
  const firstLine = lines[0]?.trim() || '';

  // Match [!TYPE] pattern (case insensitive)
  const alertMatch = firstLine.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]$/i);
  if (!alertMatch) {
    return []; // Not an alert, let default blockquote handle it
  }

  const alertType = alertMatch[1].toUpperCase();
  const validTypes = ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION'];
  if (!validTypes.includes(alertType)) {
    return [];
  }

  // Remove the alert marker from first line, keep rest of content
  const contentLines = lines.slice(1);
  const content = contentLines.length > 0 ? contentLines.join('\n').trim() : '';

  const childTokens = Array.isArray((token as unknown as { tokens?: unknown[] }).tokens)
    ? JSON.parse(JSON.stringify((token as unknown as { tokens: unknown[] }).tokens))
    : [];

  // Remove the alert marker from the first paragraph if present
  if (
    childTokens.length > 0 &&
    (childTokens[0] as { type?: string }).type === 'paragraph' &&
    Array.isArray((childTokens[0] as unknown as { tokens?: unknown[] }).tokens)
  ) {
    const paragraphTokens = ((childTokens[0] as unknown as { tokens: unknown[] }).tokens ||
      []) as Array<{ type?: string; text?: string }>;
    const firstInline = paragraphTokens[0];
    if (firstInline && firstInline.type === 'text') {
      const trimmed = (firstInline.text ?? '').trim();
      const markerMatch = trimmed.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i);
      if (markerMatch) {
        // Remove the marker from the text
        const remainingText = trimmed.replace(/^\[![^\]]+\]\s*/, '').trim();
        if (remainingText) {
          paragraphTokens[0] = { ...firstInline, text: remainingText };
        } else {
          // Remove the text node if empty after marker removal
          paragraphTokens.shift();
          // Clean up leading newline if present
          if (paragraphTokens[0]?.type === 'text' && typeof paragraphTokens[0].text === 'string') {
            paragraphTokens[0].text = paragraphTokens[0].text.replace(/^\n/, '');
          }
        }
      }
    }
  }

  const parsedChildren =
    typeof helpers.parseChildren === 'function' ? helpers.parseChildren(childTokens) : [];

  const contentNodes = parsedChildren
    .map(child => {
      if (child.type !== 'paragraph' || !Array.isArray(child.content)) {
        return child;
      }

      const trimmedContent = [...child.content];
      while (trimmedContent.length > 0) {
        const first = trimmedContent[0];
        const isHardBreak = first.type === 'hardBreak' || first.type === 'hard_break';
        const isEmptyText =
          first.type === 'text' && typeof first.text === 'string' && first.text.trim() === '';
        if (isHardBreak || isEmptyText) {
          trimmedContent.shift();
          continue;
        }
        break;
      }

      return {
        ...child,
        content: trimmedContent,
      };
    })
    .filter(child => {
      if (child.type !== 'paragraph') {
        return true;
      }
      const hasMeaningfulText =
        Array.isArray(child.content) &&
        child.content.some(
          n => n.type !== 'text' || (typeof n.text === 'string' && n.text.trim() !== '')
        );
      return hasMeaningfulText;
    });

  const children =
    contentNodes.length > 0
      ? contentNodes
      : [helpers.createNode('paragraph', {}, content ? [helpers.createTextNode(content)] : [])];

  return helpers.createNode(
    'githubAlert',
    {
      alertType,
    },
    children
  );
};

const renderMarkdown = (
  node: JSONContent,
  helpers: MarkdownRendererHelpers,
  _ctx: RenderContext
) => {
  // Handle regular blockquotes: serialize as plain `>` (prefix each line with `>`)
  if (node.type === 'blockquote') {
    const body = helpers.renderChildren(node.content || [], '\n').trim();
    if (body) {
      const lines = body.split('\n');
      const formattedLines = lines.map(line => `> ${line}`).join('\n');
      return formattedLines;
    }
    return '> ';
  }

  // Handle GitHub alert nodes: serialize as `> [!TYPE]\n> content`
  if (node.type === 'githubAlert') {
    const alertType = (node.attrs?.alertType as string) || 'NOTE';
    const body = helpers.renderChildren(node.content || [], '\n').trim();

    // Format as GitHub alert: > [!TYPE]\n> content
    if (body) {
      const lines = body.split('\n');
      const formattedLines = lines.map(line => `> ${line}`).join('\n');
      return `> [!${alertType}]\n${formattedLines}`;
    }

    return `> [!${alertType}]\n> `;
  }

  // Fallback: should not reach here, but return null for any other node type
  return null;
};

describe('GitHub Alerts TipTap extension markdown integration', () => {
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
      parseInline: jest.fn(() => []),
      parseChildren: jest.fn(() => []),
      applyMark: jest.fn(),
    } as unknown as MarkdownParseHelpers;

    helpers.createNode = createNode as MarkdownParseHelpers['createNode'];
    helpers.createTextNode = createTextNode as MarkdownParseHelpers['createTextNode'];

    return helpers;
  };

  it('skips non-alert blockquotes', () => {
    const helpers = createHelpers();
    const token: MarkdownToken = {
      type: 'blockquote',
      raw: '> Regular quote text',
      text: 'Regular quote text',
    };

    const result = parseMarkdown(token, helpers);

    expect(result).toEqual([]);
    expect(helpers.createNode).not.toHaveBeenCalled();
  });

  it('parses NOTE alert into alert node', () => {
    const helpers = createHelpers();
    helpers.parseChildren = jest.fn(() => [
      {
        type: 'paragraph',
        attrs: {},
        content: [{ type: 'text', text: 'This is a note' }],
      },
    ]);
    const token: MarkdownToken = {
      type: 'blockquote',
      raw: '> [!NOTE]\n> This is a note',
      text: '[!NOTE]\nThis is a note',
    };

    const node = parseMarkdown(token, helpers);

    expect(node).toEqual({
      type: 'githubAlert',
      attrs: { alertType: 'NOTE' },
      content: [
        {
          type: 'paragraph',
          attrs: {},
          content: [{ type: 'text', text: 'This is a note' }],
        },
      ],
    });
    expect(helpers.createNode).toHaveBeenCalledTimes(1);
    expect(helpers.parseChildren).toHaveBeenCalled();
  });

  it('parses WARNING alert (case insensitive)', () => {
    const helpers = createHelpers();
    helpers.parseChildren = jest.fn(() => [
      {
        type: 'paragraph',
        attrs: {},
        content: [{ type: 'text', text: 'Be careful' }],
      },
    ]);
    const token: MarkdownToken = {
      type: 'blockquote',
      raw: '> [!warning]\n> Be careful',
      text: '[!warning]\nBe careful',
    };

    const node = parseMarkdown(token, helpers);

    expect(node).toEqual({
      type: 'githubAlert',
      attrs: { alertType: 'WARNING' },
      content: [
        {
          type: 'paragraph',
          attrs: {},
          content: [{ type: 'text', text: 'Be careful' }],
        },
      ],
    });
  });

  it('parses TIP alert', () => {
    const helpers = createHelpers();
    helpers.parseChildren = jest.fn(() => [
      {
        type: 'paragraph',
        attrs: {},
        content: [{ type: 'text', text: 'Pro tip here' }],
      },
    ]);
    const token: MarkdownToken = {
      type: 'blockquote',
      raw: '> [!TIP]\n> Pro tip here',
      text: '[!TIP]\nPro tip here',
    };

    const node = parseMarkdown(token, helpers);

    expect(node).toEqual({
      type: 'githubAlert',
      attrs: { alertType: 'TIP' },
      content: [
        {
          type: 'paragraph',
          attrs: {},
          content: [{ type: 'text', text: 'Pro tip here' }],
        },
      ],
    });
  });

  it('parses IMPORTANT alert', () => {
    const helpers = createHelpers();
    helpers.parseChildren = jest.fn(() => [
      {
        type: 'paragraph',
        attrs: {},
        content: [{ type: 'text', text: 'Key information' }],
      },
    ]);
    const token: MarkdownToken = {
      type: 'blockquote',
      raw: '> [!IMPORTANT]\n> Key information',
      text: '[!IMPORTANT]\nKey information',
    };

    const node = parseMarkdown(token, helpers);

    expect(node).toEqual({
      type: 'githubAlert',
      attrs: { alertType: 'IMPORTANT' },
      content: [
        {
          type: 'paragraph',
          attrs: {},
          content: [{ type: 'text', text: 'Key information' }],
        },
      ],
    });
  });

  it('parses CAUTION alert', () => {
    const helpers = createHelpers();
    helpers.parseChildren = jest.fn(() => [
      {
        type: 'paragraph',
        attrs: {},
        content: [{ type: 'text', text: 'Danger ahead' }],
      },
    ]);
    const token: MarkdownToken = {
      type: 'blockquote',
      raw: '> [!CAUTION]\n> Danger ahead',
      text: '[!CAUTION]\nDanger ahead',
    };

    const node = parseMarkdown(token, helpers);

    expect(node).toEqual({
      type: 'githubAlert',
      attrs: { alertType: 'CAUTION' },
      content: [
        {
          type: 'paragraph',
          attrs: {},
          content: [{ type: 'text', text: 'Danger ahead' }],
        },
      ],
    });
  });

  it('skips invalid alert types', () => {
    const helpers = createHelpers();
    const token: MarkdownToken = {
      type: 'blockquote',
      raw: '> [!CUSTOM]\n> Custom alert',
      text: '[!CUSTOM]\nCustom alert',
    };

    const result = parseMarkdown(token, helpers);

    expect(result).toEqual([]);
    expect(helpers.createNode).not.toHaveBeenCalled();
  });

  it('handles multi-line alert content', () => {
    const helpers = createHelpers();
    helpers.parseChildren = jest.fn(() => [
      {
        type: 'paragraph',
        attrs: {},
        content: [{ type: 'text', text: 'Line one\nLine two\nLine three' }],
      },
    ]);
    const token: MarkdownToken = {
      type: 'blockquote',
      raw: '> [!NOTE]\n> Line one\n> Line two\n> Line three',
      text: '[!NOTE]\nLine one\nLine two\nLine three',
    };

    const node = parseMarkdown(token, helpers);

    expect(node).toEqual({
      type: 'githubAlert',
      attrs: { alertType: 'NOTE' },
      content: [
        {
          type: 'paragraph',
          attrs: {},
          content: [{ type: 'text', text: 'Line one\nLine two\nLine three' }],
        },
      ],
    });
  });

  it('drops empty paragraphs produced by blank line after marker', () => {
    const helpers = createHelpers();
    helpers.parseChildren = jest.fn(() => [
      {
        type: 'paragraph',
        attrs: {},
        content: [{ type: 'text', text: '' }],
      },
      {
        type: 'paragraph',
        attrs: {},
        content: [{ type: 'text', text: 'Content after blank line' }],
      },
    ]);

    const token: MarkdownToken = {
      type: 'blockquote',
      raw: '> [!NOTE]\n>\n> Content after blank line',
      text: '[!NOTE]\n\nContent after blank line',
      tokens: [
        {
          type: 'paragraph',
          tokens: [{ type: 'text', text: '[!NOTE]' }],
        } as unknown as MarkdownToken,
        {
          type: 'paragraph',
          tokens: [{ type: 'text', text: 'Content after blank line' }],
        } as unknown as MarkdownToken,
      ],
    };

    const node = parseMarkdown(token, helpers);

    expect(node).toEqual({
      type: 'githubAlert',
      attrs: { alertType: 'NOTE' },
      content: [
        {
          type: 'paragraph',
          attrs: {},
          content: [{ type: 'text', text: 'Content after blank line' }],
        },
      ],
    });
  });

  it('removes leading hard breaks inside first paragraph', () => {
    const helpers = createHelpers();
    helpers.parseChildren = jest.fn(() => [
      {
        type: 'paragraph',
        attrs: {},
        content: [{ type: 'hardBreak' }, { type: 'text', text: 'Starts after break' }],
      },
    ]);

    const token: MarkdownToken = {
      type: 'blockquote',
      raw: '> [!IMPORTANT]\n> \\nStarts after break',
      text: '[!IMPORTANT]\n\nStarts after break',
      tokens: [
        {
          type: 'paragraph',
          tokens: [
            { type: 'text', text: '[!IMPORTANT]' },
            { type: 'text', text: '\nStarts after break' },
          ],
        } as unknown as MarkdownToken,
      ],
    };

    const node = parseMarkdown(token, helpers);

    expect(node).toEqual({
      type: 'githubAlert',
      attrs: { alertType: 'IMPORTANT' },
      content: [
        {
          type: 'paragraph',
          attrs: {},
          content: [{ type: 'text', text: 'Starts after break' }],
        },
      ],
    });
  });

  it('preserves multiple child blocks from parseChildren', () => {
    const helpers = createHelpers();
    const childBlocks = [
      {
        type: 'paragraph',
        attrs: {},
        content: [{ type: 'text', text: 'First paragraph' }],
      },
      {
        type: 'paragraph',
        attrs: {},
        content: [{ type: 'text', text: 'Second paragraph' }],
      },
    ];
    helpers.parseChildren = jest.fn(() => childBlocks);

    const token: MarkdownToken = {
      type: 'blockquote',
      raw: '> [!NOTE]\n> First paragraph\n>\n> Second paragraph',
      text: '[!NOTE]\nFirst paragraph\n\nSecond paragraph',
      tokens: [
        {
          type: 'paragraph',
          tokens: [
            { type: 'text', text: '[!NOTE]' },
            { type: 'text', text: '\nFirst paragraph' },
          ],
        } as unknown as MarkdownToken,
        {
          type: 'paragraph',
          tokens: [{ type: 'text', text: 'Second paragraph' }],
        } as unknown as MarkdownToken,
      ],
    };

    const node = parseMarkdown(token, helpers);

    expect(node).toEqual({
      type: 'githubAlert',
      attrs: { alertType: 'NOTE' },
      content: childBlocks,
    });
    expect(helpers.parseChildren).toHaveBeenCalled();
  });

  it('parses inline formatting inside alert content', () => {
    const helpers = createHelpers();
    const inlineNodes = [
      { type: 'text', text: 'Narrative', marks: [{ type: 'bold' }] },
      { type: 'text', text: ': Want clarity' },
    ];
    helpers.parseChildren = jest.fn(() => [
      {
        type: 'paragraph',
        attrs: {},
        content: inlineNodes,
      },
    ]);
    const token: MarkdownToken = {
      type: 'blockquote',
      raw: '> [!NOTE]\n> **Narrative**: Want clarity',
      text: '[!NOTE]\n**Narrative**: Want clarity',
    };

    const node = parseMarkdown(token, helpers);

    expect(node).toEqual({
      type: 'githubAlert',
      attrs: { alertType: 'NOTE' },
      content: [
        {
          type: 'paragraph',
          attrs: {},
          content: inlineNodes,
        },
      ],
    });
    expect(helpers.parseChildren).toHaveBeenCalled();
  });

  it('handles empty alert content', () => {
    const helpers = createHelpers();
    const token: MarkdownToken = {
      type: 'blockquote',
      raw: '> [!NOTE]',
      text: '[!NOTE]',
    };

    const node = parseMarkdown(token, helpers);

    expect(node).toEqual({
      type: 'githubAlert',
      attrs: { alertType: 'NOTE' },
      content: [
        {
          type: 'paragraph',
          attrs: {},
          content: [],
        },
      ],
    });
  });

  it('renders NOTE alert back to markdown', () => {
    const node = {
      type: 'githubAlert',
      attrs: { alertType: 'NOTE' },
      content: [{ type: 'text', text: 'This is a note' }],
    };
    const helpers = {
      renderChildren: jest.fn(() => 'This is a note'),
    };
    const ctx = {} as RenderContext;

    const output = renderMarkdown(
      node as JSONContent,
      helpers as unknown as MarkdownRendererHelpers,
      ctx
    );

    expect(output).toBe('> [!NOTE]\n> This is a note');
    expect(helpers.renderChildren).toHaveBeenCalledTimes(1);
  });

  it('renders WARNING alert back to markdown', () => {
    const node = {
      type: 'githubAlert',
      attrs: { alertType: 'WARNING' },
      content: [{ type: 'text', text: 'Be careful' }],
    };
    const helpers = {
      renderChildren: jest.fn(() => 'Be careful'),
    };
    const ctx = {} as RenderContext;

    const output = renderMarkdown(
      node as JSONContent,
      helpers as unknown as MarkdownRendererHelpers,
      ctx
    );

    expect(output).toBe('> [!WARNING]\n> Be careful');
  });

  it('renders multi-line alert back to markdown', () => {
    const node = {
      type: 'githubAlert',
      attrs: { alertType: 'TIP' },
      content: [{ type: 'text', text: 'Line one\nLine two' }],
    };
    const helpers = {
      renderChildren: jest.fn(() => 'Line one\nLine two'),
    };
    const ctx = {} as RenderContext;

    const output = renderMarkdown(
      node as JSONContent,
      helpers as unknown as MarkdownRendererHelpers,
      ctx
    );

    expect(output).toBe('> [!TIP]\n> Line one\n> Line two');
  });

  it('renders empty alert back to markdown', () => {
    const node = {
      type: 'githubAlert',
      attrs: { alertType: 'NOTE' },
      content: [],
    };
    const helpers = {
      renderChildren: jest.fn(() => ''),
    };
    const ctx = {} as RenderContext;

    const output = renderMarkdown(
      node as JSONContent,
      helpers as unknown as MarkdownRendererHelpers,
      ctx
    );

    expect(output).toBe('> [!NOTE]\n> ');
  });

  it('serializes regular blockquote nodes as plain blockquote markdown', () => {
    const node = {
      type: 'blockquote', // Regular blockquote, not githubAlert
      attrs: {},
      content: [{ type: 'text', text: 'Regular quote text' }],
    };
    const helpers = {
      renderChildren: jest.fn(() => 'Regular quote text'),
    };
    const ctx = {} as RenderContext;

    const output = renderMarkdown(
      node as JSONContent,
      helpers as unknown as MarkdownRendererHelpers,
      ctx
    );

    // Should serialize as plain blockquote: > Regular quote text
    expect(output).toBe('> Regular quote text');
    expect(helpers.renderChildren).toHaveBeenCalledTimes(1);
  });

  it('serializes empty regular blockquote as > ', () => {
    const node = {
      type: 'blockquote',
      attrs: {},
      content: [],
    };
    const helpers = {
      renderChildren: jest.fn(() => ''),
    };
    const ctx = {} as RenderContext;

    const output = renderMarkdown(
      node as JSONContent,
      helpers as unknown as MarkdownRendererHelpers,
      ctx
    );

    // Should serialize as empty blockquote: >
    expect(output).toBe('> ');
    expect(helpers.renderChildren).toHaveBeenCalledTimes(1);
  });

  it('serializes multi-line regular blockquote correctly', () => {
    const node = {
      type: 'blockquote',
      attrs: {},
      content: [{ type: 'text', text: 'Line one\nLine two' }],
    };
    const helpers = {
      renderChildren: jest.fn(() => 'Line one\nLine two'),
    };
    const ctx = {} as RenderContext;

    const output = renderMarkdown(
      node as JSONContent,
      helpers as unknown as MarkdownRendererHelpers,
      ctx
    );

    // Should serialize as multi-line blockquote: > Line one\n> Line two
    expect(output).toBe('> Line one\n> Line two');
    expect(helpers.renderChildren).toHaveBeenCalledTimes(1);
  });

  it('round-trips NOTE alert (parse then render)', () => {
    const helpers = createHelpers();
    const token: MarkdownToken = {
      type: 'blockquote',
      raw: '> [!NOTE]\n> Test content',
      text: '[!NOTE]\nTest content',
    };

    const parsed = parseMarkdown(token, helpers);

    const renderHelpers = {
      renderChildren: jest.fn(() => 'Test content'),
    };
    const rendered = renderMarkdown(
      parsed as JSONContent,
      renderHelpers as unknown as MarkdownRendererHelpers,
      {} as RenderContext
    );

    // Should match original format (allowing for whitespace differences)
    expect(rendered).toContain('[!NOTE]');
    expect(rendered).toContain('Test content');
  });
});
