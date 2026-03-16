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

  it('keeps the embedded editor open after textarea blur', () => {
    const { view } = createMermaidNodeView();
    document.body.appendChild(view.dom);

    view.dom.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

    const textarea = view.dom.querySelector('.mermaid-textarea') as HTMLTextAreaElement;
    expect(view.dom.classList.contains('is-editing')).toBe(true);

    textarea.dispatchEvent(new FocusEvent('blur', { bubbles: true }));

    expect(view.dom.classList.contains('is-editing')).toBe(true);
  });

  it('does not exit edit mode when the node is deselected', () => {
    const { view } = createMermaidNodeView();
    document.body.appendChild(view.dom);

    view.dom.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(view.dom.classList.contains('is-editing')).toBe(true);

    view.deselectNode();

    expect(view.dom.classList.contains('is-editing')).toBe(true);
  });

  it('renders a close button and only closes when that button is clicked', () => {
    const { view, editor, node } = createMermaidNodeView();
    document.body.appendChild(view.dom);

    view.dom.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

    const textarea = view.dom.querySelector('.mermaid-textarea') as HTMLTextAreaElement;
    textarea.value = 'graph LR\nX-->Y';

    const closeButton = view.dom.querySelector('.mermaid-close-button') as HTMLButtonElement | null;
    expect(closeButton).not.toBeNull();

    textarea.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    expect(view.dom.classList.contains('is-editing')).toBe(true);

    closeButton!.click();

    expect(view.dom.classList.contains('is-editing')).toBe(false);
    expect(node.type.create).toHaveBeenCalled();
    expect(editor.state.tr.replaceWith).toHaveBeenCalled();
    expect(editor.view.dispatch).toHaveBeenCalled();
  });
});