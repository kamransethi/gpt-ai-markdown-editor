/** @jest-environment jsdom */

const anyGlobal = global as any;
anyGlobal.acquireVsCodeApi = jest.fn(() => ({ postMessage: jest.fn() }));

import { pages, renderSelect } from '../../../webview/settings/settingsPanel';

describe('settingsPanel', () => {
  it('includes COMPRESSION group with granular toggles', () => {
    const editorPage = pages.find(page => page.id === 'editor');
    expect(editorPage).toBeDefined();

    const compressionGroup = editorPage!.groups.find(group => group.title === 'COMPRESSION');
    expect(compressionGroup).toBeDefined();

    const compressTables = compressionGroup!.items.find(item => item.key === 'compressTables');
    expect(compressTables).toEqual(
      expect.objectContaining({
        label: 'Compress Tables',
        type: 'toggle',
        default: false,
      })
    );

    const trimBlankLines = compressionGroup!.items.find(item => item.key === 'trimBlankLines');
    expect(trimBlankLines).toEqual(
      expect.objectContaining({
        label: 'Trim Blank Lines',
        type: 'toggle',
        default: false,
      })
    );
  });

  it('renders unknown embedding model values as a selected fallback option', () => {
    const select = renderSelect(
      {
        key: 'knowledgeGraph.embeddingModel',
        label: 'Embedding Model',
        description: 'Model used for vector embeddings. Must be installed on your local AI server.',
        type: 'select',
        options: [
          { value: 'Disabled', label: 'Disabled' },
          { value: 'nomic-embed-text', label: 'nomic-embed-text' },
        ],
        default: 'nomic-embed-text',
      },
      'other-embed-model:latest'
    ) as HTMLSelectElement;

    expect(select.querySelectorAll('option').length).toBe(3);
    expect(select.value).toBe('other-embed-model:latest');
    const selectedOption = select.querySelector('option:checked') as HTMLOptionElement | null;
    expect(selectedOption?.value).toBe('other-embed-model:latest');
  });
});
