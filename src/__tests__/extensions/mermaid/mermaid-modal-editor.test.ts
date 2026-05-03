/**
 * @jest-environment jsdom
 *
 * Tests for mermaid modal editor and content updates
 */

import { showMermaidEditor } from '../../../webview/features/mermaidEditor';

describe('Mermaid Modal Editor', () => {
  it('should return edited code when saved', async () => {
    const initialCode = 'graph TD\nA-->B';

    // Simulate user clicking Save button quickly
    setTimeout(() => {
      const saveBtn = document.querySelector('#save-btn') as HTMLButtonElement;
      if (saveBtn) saveBtn.click();
    }, 10);

    const result = await showMermaidEditor(initialCode);

    expect(result.wasSaved).toBe(true);
    expect(result.code).toBe(initialCode);
  });

  it('should return edited code with changes when saved', async () => {
    const initialCode = 'graph TD\nA-->B';
    const newCode = 'graph LR\nX-->Y';

    // Simulate user editing and saving
    setTimeout(() => {
      const textarea = document.querySelector('.mermaid-editor-textarea') as HTMLTextAreaElement;
      const saveBtn = document.querySelector('#save-btn') as HTMLButtonElement;

      if (textarea) textarea.value = newCode;
      if (saveBtn) saveBtn.click();
    }, 10);

    const result = await showMermaidEditor(initialCode);

    expect(result.wasSaved).toBe(true);
    expect(result.code).toBe(newCode);
  });

  it('should return original code when cancelled', async () => {
    const initialCode = 'graph TD\nA-->B';

    // Simulate user clicking Cancel
    setTimeout(() => {
      const cancelBtn = document.querySelector('#cancel-btn') as HTMLButtonElement;
      if (cancelBtn) cancelBtn.click();
    }, 10);

    const result = await showMermaidEditor(initialCode);

    expect(result.wasSaved).toBe(false);
    expect(result.code).toBe(initialCode);
  });

  it('should close on Escape key', async () => {
    const initialCode = 'graph TD\nA-->B';

    // Simulate user pressing Escape
    setTimeout(() => {
      const overlay = document.querySelector('.mermaid-editor-overlay') as HTMLElement;
      if (overlay) {
        const event = new KeyboardEvent('keydown', { key: 'Escape' });
        overlay.dispatchEvent(event);
      }
    }, 10);

    const result = await showMermaidEditor(initialCode);

    expect(result.wasSaved).toBe(false);
  });
});
