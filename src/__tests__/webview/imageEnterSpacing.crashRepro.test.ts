/** @jest-environment jsdom */

import { Schema } from '@tiptap/pm/model';
import { ImageEnterSpacing } from '../../webview/extensions/imageEnterSpacing';

describe('ImageEnterSpacing crash repro (Enter after image line)', () => {
  const createPlugin = (editor: unknown) => {
    type AddProseMirrorPlugins = (this: { editor: unknown }) => unknown[];

    const addProseMirrorPlugins = (
      ImageEnterSpacing as unknown as {
        config: {
          addProseMirrorPlugins?: AddProseMirrorPlugins;
        };
      }
    ).config.addProseMirrorPlugins;

    if (typeof addProseMirrorPlugins !== 'function') {
      throw new Error('ImageEnterSpacing.addProseMirrorPlugins is not available');
    }

    const plugins = addProseMirrorPlugins.call({ editor });
    return plugins[0] as unknown as {
      props?: {
        handleKeyDown?: (view: unknown, event: KeyboardEvent) => boolean;
      };
    };
  };

  const createEnterEvent = () =>
    ({
      key: 'Enter',
      shiftKey: false,
      isComposing: false,
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
      target: null,
    }) as unknown as KeyboardEvent & { preventDefault: jest.Mock; stopPropagation: jest.Mock };

  it('does not intercept Enter when the computed gap-cursor position is not a valid block insertion boundary', () => {
    const fixture = `# Repro — Enter at image gap cursor crash

## Markdown snippet (from crash report)

\`\`\`md
![download](./images/download-1765561673025.jpg)
![generated-image (3)](./images/generated-image-3-1765562200066.png)
![image](./images/1.png)

![image](./images/2.png)

![image](./images/3.png)

![image](./images/4.png)
\`\`\`

## Manual repro steps

1. Open a markdown file that contains the snippet above in DK-AI.
2. Place the caret at the end of the line:
   \`![generated-image (3)](./images/generated-image-3-1765562200066.png)  \`
3. Press \`Enter\`.

## Expected

- No crash.
- Editor remains editable.
- Markdown remains valid.
`;

    const md = fixture.match(/```md\n([\s\S]*?)\n```/m)?.[1] ?? '';
    const imageLines = md.split('\n').filter(line => line.startsWith('!['));
    expect(imageLines.length).toBeGreaterThanOrEqual(2);

    const srcs = imageLines
      .map(line => line.match(/!\[[^\]]*\]\(([^)]+)\)/)?.[1])
      .filter((s): s is string => typeof s === 'string' && s.length > 0);

    expect(srcs.length).toBeGreaterThanOrEqual(2);

    // Inline-image schema (mirrors the shape of markdown "image lines" inside a paragraph).
    // We intentionally put a two-space text node after each image to match the reported
    // invalid-content payload (<image, "  ">) seen in the crash logs.
    const schema = new Schema({
      nodes: {
        doc: { content: 'block+' },
        paragraph: {
          group: 'block',
          content: 'inline*',
          toDOM: () => ['p', 0],
          parseDOM: [{ tag: 'p' }],
        },
        text: { group: 'inline' },
        image: {
          group: 'inline',
          inline: true,
          atom: true,
          draggable: true,
          selectable: true,
          attrs: { src: { default: 'x' }, alt: { default: null } },
          toDOM: node => ['img', { src: node.attrs.src, alt: node.attrs.alt }],
          parseDOM: [
            { tag: 'img', getAttrs: dom => ({ src: (dom as HTMLElement).getAttribute('src') }) },
          ],
        },
      },
    });

    const image1 = schema.nodes.image.create({ src: srcs[0] });
    const image2 = schema.nodes.image.create({ src: srcs[1] });

    const doc = schema.nodes.doc.create(null, [
      schema.nodes.paragraph.create(null, [image1, schema.text('  '), image2, schema.text('  ')]),
    ]);

    // Position right after the second image node (this is where the user pressed Enter)
    let posAfterSecondImage = 0;
    let seen = 0;
    doc.descendants((node, pos) => {
      if (node.type.name === 'image') {
        seen++;
        if (seen === 2) {
          posAfterSecondImage = pos + node.nodeSize;
          return false;
        }
      }
      return true;
    });

    expect(posAfterSecondImage).toBeGreaterThan(0);

    const $from = doc.resolve(posAfterSecondImage);

    // Create a "gapcursor-like" selection object inside the paragraph.
    // In the reported crash, the ImageEnterSpacing handler treated the selection as a gap cursor
    // and attempted to insert a paragraph at an invalid position, corrupting editor state.
    const selection = {
      type: 'gapcursor',
      $from,
      $to: $from,
      head: posAfterSecondImage,
      anchor: posAfterSecondImage,
    };

    const mockTr = {
      insert: jest.fn().mockReturnThis(),
      replace: jest.fn().mockReturnThis(),
      setSelection: jest.fn().mockReturnThis(),
      scrollIntoView: jest.fn().mockReturnThis(),
      doc,
    };

    const state = {
      selection,
      schema,
      doc,
      tr: mockTr,
    };

    const dispatch = jest.fn();
    const plugin = createPlugin({ commands: {} });
    const event = createEnterEvent();

    const handled = plugin.props?.handleKeyDown?.({ state, dispatch }, event);

    expect(handled).toBe(false);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(event.stopPropagation).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });
});
