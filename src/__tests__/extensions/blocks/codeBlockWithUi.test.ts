/** @jest-environment jsdom */

jest.mock('@tiptap/extension-code-block-lowlight', () => ({
  CodeBlockLowlight: {
    extend: (config: unknown) => ({
      config,
      configure: () => ({ config }),
    }),
  },
}));

import { CodeBlockWithUi } from '../../../webview/extensions/codeBlockWithUi';

describe('CodeBlockWithUi node view', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('renders a language dropdown and copy button', () => {
    const extension = CodeBlockWithUi;
    const nodeViewFactory = (
      extension as unknown as {
        config?: {
          addNodeView?: () => (args: { node: any; getPos: () => number; editor: any }) => {
            dom: HTMLElement;
          };
        };
      }
    ).config?.addNodeView?.();

    if (!nodeViewFactory) {
      throw new Error('CodeBlockWithUi node view factory missing');
    }

    const dispatch = jest.fn();
    const view = nodeViewFactory({
      node: {
        type: { name: 'codeBlock' },
        attrs: { language: 'typescript' },
        textContent: 'const value = 1;',
      },
      getPos: () => 10,
      editor: {
        state: { tr: { setNodeMarkup: jest.fn(() => ({ step: 'setNodeMarkup' })) } },
        view: { dispatch },
      },
    });

    expect(view.dom.querySelector('.code-block-ui-language')).not.toBeNull();
    expect(view.dom.querySelector('.code-block-ui-copy')).not.toBeNull();
  });

  it('updates the code block language from the dropdown', () => {
    const extension = CodeBlockWithUi;
    const nodeViewFactory = (
      extension as unknown as {
        config?: {
          addNodeView?: () => (args: { node: any; getPos: () => number; editor: any }) => {
            dom: HTMLElement;
          };
        };
      }
    ).config?.addNodeView?.();

    if (!nodeViewFactory) {
      throw new Error('CodeBlockWithUi node view factory missing');
    }

    const setNodeMarkup = jest.fn(() => ({ step: 'setNodeMarkup' }));
    const dispatch = jest.fn();
    const view = nodeViewFactory({
      node: {
        type: { name: 'codeBlock' },
        attrs: { language: 'typescript' },
        textContent: 'const value = 1;',
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

  it('copies the code block contents', async () => {
    const extension = CodeBlockWithUi;
    const nodeViewFactory = (
      extension as unknown as {
        config?: {
          addNodeView?: () => (args: { node: any; getPos: () => number; editor: any }) => {
            dom: HTMLElement;
          };
        };
      }
    ).config?.addNodeView?.();

    if (!nodeViewFactory) {
      throw new Error('CodeBlockWithUi node view factory missing');
    }

    const view = nodeViewFactory({
      node: {
        type: { name: 'codeBlock' },
        attrs: { language: 'typescript' },
        textContent: 'const value = 1;',
      },
      getPos: () => 10,
      editor: {
        state: { tr: { setNodeMarkup: jest.fn(() => ({ step: 'setNodeMarkup' })) } },
        view: { dispatch: jest.fn() },
      },
    });

    const copyButton = view.dom.querySelector('.code-block-ui-copy') as HTMLButtonElement;
    copyButton.click();

    await Promise.resolve();

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('const value = 1;');
  });
});
