/**
 * Frontmatter editor modal.
 * Simple, robust YAML editor using native textarea (no heavy TipTap/extensions).
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
    modal.style.display = 'flex';
    modal.style.flexDirection = 'column';
    modal.style.padding = '0';
    modal.style.backgroundColor = 'var(--md-background)';
    modal.style.border = '1px solid var(--md-border)';
    modal.style.borderRadius = '8px';

    // Header
    const header = document.createElement('div');
    header.className = 'frontmatter-modal-header';
    header.innerHTML = '<h2 class="frontmatter-modal-title">Document Front Matter (YAML)</h2>';

    // Textarea wrapper (grows to fill space)
    const textareaWrapper = document.createElement('div');
    textareaWrapper.style.flex = '1';
    textareaWrapper.style.display = 'flex';
    textareaWrapper.style.flexDirection = 'column';
    textareaWrapper.style.minHeight = '0'; // Needed for flex column to work
    textareaWrapper.style.overflow = 'hidden';

    // Native textarea (SIMPLE!)
    const textarea = document.createElement('textarea');
    textarea.className = 'frontmatter-modal-textarea';
    textarea.value = currentFrontmatter || '';
    textarea.spellcheck = false;
    // Style it to fill the space
    textarea.style.flex = '1';
    textarea.style.minHeight = '0';
    textarea.style.width = '100%';
    textarea.style.padding = '15px';
    textarea.style.fontFamily = 'var(--md-mono-font, monospace)';
    textarea.style.fontSize = '13px';
    textarea.style.lineHeight = '1.5';
    textarea.style.border = 'none';
    textarea.style.outline = 'none';
    textarea.style.backgroundColor = 'var(--md-background)';
    textarea.style.color = 'var(--md-foreground)';
    textarea.style.resize = 'none';

    textareaWrapper.appendChild(textarea);

    // Footer with buttons
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

    // Focus and select text
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

    // Button handlers
    cancelButton.addEventListener('click', handleCancel);
    saveButton.addEventListener('click', handleSave);

    // Keyboard shortcuts
    textarea.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        handleCancel();
      } else if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        handleSave();
      }
    });

    // Click on overlay (outside modal) to cancel
    overlay.addEventListener('click', e => {
      if (e.target === overlay) {
        handleCancel();
      }
    });

    // Prevent modal click from propagating to overlay
    modal.addEventListener('click', e => {
      e.stopPropagation();
    });
  });
}
