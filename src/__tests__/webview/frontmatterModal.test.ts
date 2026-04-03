/** @jest-environment jsdom */
/**
 * Tests for the frontmatter editor modal UI.
 */

describe('frontmatter modal', () => {
  it('renders a modal overlay and textarea when shown', async () => {
    // Dynamically import to avoid circular dependency issues
    const { showFrontmatterModal } = await import('../../webview/features/frontmatterModal');

    // Show the modal with some initial text
    const promise = showFrontmatterModal('title: Test\nauthor: Jane', () => {
      // onSave callback (empty for this test)
    });

    // Check that overlay exists
    const overlay = document.querySelector('.frontmatter-modal-overlay');
    expect(overlay).toBeTruthy();

    // Check that modal exists
    const modal = document.querySelector('.frontmatter-modal');
    expect(modal).toBeTruthy();

    // Check that textarea exists and has correct value
    const textarea = document.querySelector('.frontmatter-modal-textarea') as HTMLTextAreaElement;
    expect(textarea).toBeTruthy();
    expect(textarea.value).toBe('title: Test\nauthor: Jane');

    // Check that buttons exist
    const saveButton = document.querySelector('.frontmatter-modal-button-save');
    const cancelButton = document.querySelector('.frontmatter-modal-button-cancel');
    expect(saveButton).toBeTruthy();
    expect(cancelButton).toBeTruthy();

    // Close by clicking cancel
    (cancelButton as HTMLButtonElement).click();

    // Wait for modal to close
    await promise;

    // Check that overlay is removed
    expect(document.querySelector('.frontmatter-modal-overlay')).toBeNull();
  });

  it('calls onSave callback with textarea content when Save is clicked', async () => {
    const { showFrontmatterModal } = await import('../../webview/features/frontmatterModal');

    const onSaveFn = jest.fn();

    const promise = showFrontmatterModal('original: value', onSaveFn);

    const textarea = document.querySelector('.frontmatter-modal-textarea') as HTMLTextAreaElement;
    const saveButton = document.querySelector(
      '.frontmatter-modal-button-save'
    ) as HTMLButtonElement;

    // Modify the textarea
    textarea.value = 'modified: content';

    // Click save
    saveButton.click();

    // Wait for modal to close
    await promise;

    // Verify callback was called with new value
    expect(onSaveFn).toHaveBeenCalledWith('modified: content');

    // Verify modal is closed
    expect(document.querySelector('.frontmatter-modal-overlay')).toBeNull();
  });

  it('trims whitespace from saved content', async () => {
    const { showFrontmatterModal } = await import('../../webview/features/frontmatterModal');

    const onSaveFn = jest.fn();

    const promise = showFrontmatterModal('', onSaveFn);

    const textarea = document.querySelector('.frontmatter-modal-textarea') as HTMLTextAreaElement;
    const saveButton = document.querySelector(
      '.frontmatter-modal-button-save'
    ) as HTMLButtonElement;

    // Add text with leading/trailing whitespace
    textarea.value = '  \n  title: Test  \n  ';

    saveButton.click();

    await promise;

    // Should be trimmed
    expect(onSaveFn).toHaveBeenCalledWith('title: Test');
  });

  it('closes modal when Escape key is pressed', async () => {
    const { showFrontmatterModal } = await import('../../webview/features/frontmatterModal');

    const onSaveFn = jest.fn();

    const promise = showFrontmatterModal('test: data', onSaveFn);

    const textarea = document.querySelector('.frontmatter-modal-textarea') as HTMLTextAreaElement;

    // Simulate Escape key
    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
    textarea.dispatchEvent(escapeEvent);

    await promise;

    // onSave should NOT have been called
    expect(onSaveFn).not.toHaveBeenCalled();

    // Modal should be closed
    expect(document.querySelector('.frontmatter-modal-overlay')).toBeNull();
  });

  it('saves when Cmd/Ctrl+Enter is pressed', async () => {
    const { showFrontmatterModal } = await import('../../webview/features/frontmatterModal');

    const onSaveFn = jest.fn();

    const promise = showFrontmatterModal('', onSaveFn);

    const textarea = document.querySelector('.frontmatter-modal-textarea') as HTMLTextAreaElement;

    textarea.value = 'quick: save';

    // Simulate Ctrl+Enter
    const ctrlEnterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      ctrlKey: true,
    });
    textarea.dispatchEvent(ctrlEnterEvent);

    await promise;

    // onSave should have been called
    expect(onSaveFn).toHaveBeenCalledWith('quick: save');

    // Modal should be closed
    expect(document.querySelector('.frontmatter-modal-overlay')).toBeNull();
  });

  it('closes when overlay (outside modal) is clicked', async () => {
    const { showFrontmatterModal } = await import('../../webview/features/frontmatterModal');

    const onSaveFn = jest.fn();

    const promise = showFrontmatterModal('keep: this', onSaveFn);

    const overlay = document.querySelector('.frontmatter-modal-overlay') as HTMLElement;

    // Click on overlay (not on modal)
    overlay.click();

    await promise;

    // onSave should NOT have been called
    expect(onSaveFn).not.toHaveBeenCalled();

    // Modal should be closed
    expect(document.querySelector('.frontmatter-modal-overlay')).toBeNull();
  });

  it('initializes with null frontmatter (empty textarea)', async () => {
    const { showFrontmatterModal } = await import('../../webview/features/frontmatterModal');

    const promise = showFrontmatterModal(null, () => {});

    const textarea = document.querySelector('.frontmatter-modal-textarea') as HTMLTextAreaElement;

    expect(textarea.value).toBe('');

    const cancelButton = document.querySelector(
      '.frontmatter-modal-button-cancel'
    ) as HTMLButtonElement;
    cancelButton.click();

    await promise;
  });
});
