/** @jest-environment jsdom */

jest.mock('mermaid', () => ({
  __esModule: true,
  default: {
    initialize: jest.fn(),
    parse: jest.fn().mockResolvedValue(true),
    render: jest.fn().mockResolvedValue({ svg: '<svg></svg>', bindFunctions: undefined }),
  },
}));

import { Mermaid } from '../../webview/extensions/mermaid';

type MermaidNodeView = {
  dom: HTMLElement;
  update: (node: unknown) => boolean;
  selectNode: () => void;
  deselectNode: () => void;
  destroy: () => void;
};

function createMermaidNodeView(initialText = 'graph TD\nA-->B') {
  const extension = Mermaid;
  const nodeViewFactory = (
    extension as unknown as {
      config?: {
        addNodeView?: () => (args: {
          node: any;
          getPos: () => number;
          editor: any;
        }) => MermaidNodeView;
      };
    }
  ).config?.addNodeView?.();

  if (!nodeViewFactory) {
    throw new Error('Mermaid node view factory is unavailable');
  }

  const dispatch = jest.fn();
  const schema = {
    text: jest.fn((text: string) => ({ type: 'text', text })),
  };
  const editor = {
    schema,
    state: {
      tr: {
        replaceWith: jest.fn(),
      },
    },
    view: {
      dispatch,
    },
    commands: {
      setNodeSelection: jest.fn(),
    },
  };

  const node = {
    textContent: initialText,
    attrs: { language: 'mermaid' },
    nodeSize: initialText.length + 2,
    type: {
      name: 'mermaid',
      create: jest.fn((attrs: unknown, content: unknown) => ({ attrs, content })),
    },
  };

  const view = nodeViewFactory({
    node,
    getPos: () => 5,
    editor,
  });

  return { view, editor, node };
}

describe('Mermaid node view editing', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders a compact header with Edit button', () => {
    const { view } = createMermaidNodeView();
    document.body.appendChild(view.dom);

    const header = view.dom.querySelector('.mermaid-code-header');
    expect(header).not.toBeNull();

    const title = view.dom.querySelector('.mermaid-code-title');
    expect(title?.textContent).toBe('Mermaid');

    const editButton = view.dom.querySelector('.mermaid-edit-button') as HTMLButtonElement | null;
    expect(editButton).not.toBeNull();
    expect(editButton!.textContent).toBe('Edit');
  });

  it('sends editMermaidSource message when Edit is clicked', () => {
    const { view } = createMermaidNodeView();
    document.body.appendChild(view.dom);

    const postMessage = jest.fn();
    (window as any).vscode = { postMessage };

    const editButton = view.dom.querySelector('.mermaid-edit-button') as HTMLButtonElement;
    editButton.click();

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'editMermaidSource',
        code: 'graph TD\nA-->B',
      })
    );

    delete (window as any).vscode;
  });

  it('sends editMermaidSource message on double-click', () => {
    const { view } = createMermaidNodeView();
    document.body.appendChild(view.dom);

    const postMessage = jest.fn();
    (window as any).vscode = { postMessage };

    view.dom.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'editMermaidSource',
      })
    );

    delete (window as any).vscode;
  });
});
