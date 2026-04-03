/**
 * Frontmatter editor modal.
 *
 * Provides a user-friendly interface for editing YAML frontmatter in the document.
 * Handles extraction, editing, validation, and restoration of frontmatter.
 */

/**
 * Show a modal dialog to edit frontmatter.
 *
 * @param currentFrontmatter - Current frontmatter text (without delimiters)
 * @param onSave - Callback when user clicks Save
 * @returns Promise that resolves when modal is closed
 */
export async function showFrontmatterModal(
  currentFrontmatter: string | null,
  onSave: (frontmatter: string) => void
): Promise<void> {
  return new Promise(resolve => {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'frontmatter-modal-overlay';

    // Create modal container
    const modal = document.createElement('div');
    modal.className = 'frontmatter-modal';

    // Create header
    const header = document.createElement('div');
    header.className = 'frontmatter-modal-header';
    header.innerHTML = '<h2 class="frontmatter-modal-title">Edit Document Metadata</h2>';

    // Create textarea wrapper
    const textareaWrapper = document.createElement('div');
    textareaWrapper.className = 'frontmatter-modal-textarea-wrapper';

    // Create textarea for YAML editing
    const textarea = document.createElement('textarea');
    textarea.className = 'frontmatter-modal-textarea';
    textarea.placeholder =
      'title: My Document\nauthor: John Doe\ndate: 2026-04-02\n\n# Add your YAML frontmatter here';
    textarea.value = currentFrontmatter || '';
    textarea.spellcheck = false;

    textareaWrapper.appendChild(textarea);

    // Create footer with buttons
    const footer = document.createElement('div');
    footer.className = 'frontmatter-modal-footer';

    const cancelButton = document.createElement('button');
    cancelButton.className = 'frontmatter-modal-button frontmatter-modal-button-cancel';
    cancelButton.textContent = 'Cancel';
    cancelButton.type = 'button';

    const saveButton = document.createElement('button');
    saveButton.className = 'frontmatter-modal-button frontmatter-modal-button-save';
    saveButton.textContent = 'Save';
    saveButton.type = 'button';

    footer.appendChild(cancelButton);
    footer.appendChild(saveButton);

    // Assemble modal
    modal.appendChild(header);
    modal.appendChild(textareaWrapper);
    modal.appendChild(footer);

    // Assemble page
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Focus textarea
    setTimeout(() => {
      textarea.focus();
      textarea.select();
    }, 100);

    // Event handlers
    const cleanup = () => {
      document.body.removeChild(overlay);
      resolve();
    };

    const handleCancel = () => {
      cleanup();
    };

    const handleSave = () => {
      const yamlContent = textarea.value.trim();
      onSave(yamlContent);
      cleanup();
    };

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        handleCancel();
      } else if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        handleSave();
      }
    };

    // Prevent overlay click from closing (only button clicks close)
    overlay.addEventListener('click', e => {
      if (e.target === overlay) {
        handleCancel();
      }
    });

    cancelButton.addEventListener('click', handleCancel);
    saveButton.addEventListener('click', handleSave);
    textarea.addEventListener('keydown', handleKeydown);

    // Prevent outside interaction
    overlay.addEventListener('mousedown', e => {
      if (e.target === overlay) {
        e.preventDefault();
      }
    });
  });
}
