/** @jest-environment jsdom */

/**
 * Tests for CodeBlockWithUi — the lowlight-based code block extension with
 * language dropdown, copy button, and inherited markdown serialization.
 *
 * CodeBlockLowlight inherits parseMarkdown/renderMarkdown from
 * @tiptap/extension-code-block — serialization is NOT our responsibility.
 *
 * Covers:
 *  1. NodeView — language dropdown and copy button are present
 *  2. Language change — dropdown dispatches a setNodeMarkup transaction
 *  3. Copy button — copies code text to clipboard
 *  4. update() — reflects language changes in the DOM
 */

jest.mock('@tiptap/extension-code-block-lowlight', () => ({
  __esModule: true,
  CodeBlockLowlight: {
    extend(config: Record<string, unknown>) {
      const extObj = {
        name: 'codeBlock',
        config,
        configure: () => ({ name: 'codeBlock', config }),
        addNodeView: config.addNodeView
          ? () => (config.addNodeView as unknown as (this: unknown) => unknown).call(extObj)
          : undefined,
      };
      return extObj;
    },
  },
}));

import { CodeBlockWithUi } from '../../../webview/extensions/codeBlockShikiWithUi';

type NodeViewFactory = (args: { node: any; getPos: () => number | undefined; editor: any }) => {
  dom: HTMLElement;
  contentDOM?: HTMLElement;
  update?: (updatedNode: any) => boolean;
  stopEvent?: (event: Event) => boolean;
};

function getNodeViewFactory(): NodeViewFactory {
  const ext = CodeBlockWithUi as any;
  const factory = ext.addNodeView ?? ext.config?.addNodeView;
  if (!factory) throw new Error('addNodeView is missing from CodeBlockWithUi');
  return factory();
}

// ------------------------------------------------------------------
// 2 & 3. NodeView — UI elements and language-change transaction
// ------------------------------------------------------------------
describe('CodeBlockWithUi node view', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    });
  });

  function createView(
    overrides: Partial<{
      language: string;
      textContent: string;
      getPos: () => number | undefined;
    }> = {}
  ) {
    const nodeViewFactory = getNodeViewFactory();

    const dispatch = jest.fn();
    const setNodeMarkup = jest.fn(() => ({ step: 'setNodeMarkup' }));

    return nodeViewFactory({
      node: {
        type: { name: 'codeBlock' },
        attrs: { language: overrides.language ?? 'typescript' },
        textContent: overrides.textContent ?? 'const x = 1;',
      },
      getPos: overrides.getPos ?? (() => 5),
      editor: {
        state: { tr: { setNodeMarkup } },
        view: { dispatch },
      },
    });
  }

  it('renders a language dropdown pre-set to the current language', () => {
    const view = createView({ language: 'python' });
    const select = view.dom.querySelector('.code-block-ui-language') as HTMLSelectElement | null;
    expect(select).not.toBeNull();
    expect(select!.value).toBe('python');
  });

  it('renders a copy button', () => {
    const view = createView();
    const btn = view.dom.querySelector('.code-block-ui-copy') as HTMLButtonElement | null;
    expect(btn).not.toBeNull();
    expect(btn!.textContent).toBe('Copy');
  });

  it('exposes a contentDOM for ProseMirror to mount code content', () => {
    const view = createView();
    expect(view.contentDOM).toBeInstanceOf(HTMLElement);
    expect((view.contentDOM as HTMLElement).tagName).toBe('CODE');
  });

  it('dispatches setNodeMarkup when the language dropdown changes', () => {
    const dispatch = jest.fn();
    const setNodeMarkup = jest.fn(() => ({ step: 'mock-tr' }));
    const nodeViewFactory = getNodeViewFactory();

    const view = nodeViewFactory({
      node: {
        type: { name: 'codeBlock' },
        attrs: { language: 'typescript' },
        textContent: 'const x = 1;',
      },
      getPos: () => 10,
      editor: {
        state: { tr: { setNodeMarkup } },
        view: { dispatch },
      },
    });

    const select = view.dom.querySelector('.code-block-ui-language') as HTMLSelectElement;
    select.value = 'python';
    select.dispatchEvent(new Event('change', { bubbles: true }));

    expect(setNodeMarkup).toHaveBeenCalledWith(10, undefined, { language: 'python' });
    expect(dispatch).toHaveBeenCalled();
  });

  it('skips the transaction when getPos returns undefined', () => {
    const dispatch = jest.fn();
    const setNodeMarkup = jest.fn();
    const nodeViewFactory = getNodeViewFactory();

    const view = nodeViewFactory({
      node: {
        type: { name: 'codeBlock' },
        attrs: { language: 'typescript' },
        textContent: '',
      },
      getPos: () => undefined,
      editor: {
        state: { tr: { setNodeMarkup } },
        view: { dispatch },
      },
    });

    const select = view.dom.querySelector('.code-block-ui-language') as HTMLSelectElement;
    select.value = 'python';
    select.dispatchEvent(new Event('change', { bubbles: true }));

    expect(setNodeMarkup).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('copies text to clipboard when the copy button is clicked', async () => {
    const view = createView({ textContent: 'print("hello")' });
    const btn = view.dom.querySelector('.code-block-ui-copy') as HTMLButtonElement;
    btn.click();
    await Promise.resolve();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('print("hello")');
  });

  it('update() reflects a new language on the dropdown and code element', () => {
    const view = createView({ language: 'typescript' });
    const select = view.dom.querySelector('.code-block-ui-language') as HTMLSelectElement;
    const code = view.contentDOM as HTMLElement;

    const accepted = view.update!({
      type: { name: 'codeBlock' },
      attrs: { language: 'python' },
      textContent: 'x = 1',
    });

    expect(accepted).toBe(true);
    expect(select.value).toBe('python');
    expect(code.className).toBe('language-python');
  });

  it('update() rejects nodes of a different type', () => {
    const view = createView();
    const accepted = view.update!({
      type: { name: 'paragraph' },
      attrs: {},
      textContent: '',
    });
    expect(accepted).toBe(false);
  });
});
