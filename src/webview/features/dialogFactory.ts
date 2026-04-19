/**
 * Shared dialog/overlay factory — eliminates inline-style duplication across 8+ dialog files.
 *
 * Usage:
 *   const { overlay, dialog, remove } = createModalOverlay({ onClose: () => remove() });
 *   dialog.appendChild(myContent);
 */

export interface ModalOverlayOptions {
  /** Called when user clicks backdrop or presses Escape. */
  onClose: () => void;
  minWidth?: string;
  maxWidth?: string;
  borderRadius?: string;
  /** Extra dialog CSS (appended after base styles). */
  extraDialogCss?: string;
}

/**
 * Create a fixed-position modal overlay with a centred dialog container.
 * Wires up backdrop-click and Escape-key dismiss.
 * Returns { overlay, dialog, remove }.
 */
export function createModalOverlay(options: ModalOverlayOptions) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;

  const dialog = document.createElement('div');
  dialog.style.cssText = `
    background: var(--md-background);
    border: 1px solid var(--md-border);
    border-radius: ${options.borderRadius ?? '6px'};
    padding: 20px;
    min-width: ${options.minWidth ?? '400px'};
    max-width: ${options.maxWidth ?? '500px'};
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    ${options.extraDialogCss ?? ''}
  `;
  dialog.setAttribute('tabindex', '-1');

  overlay.appendChild(dialog);

  // Backdrop click to dismiss
  overlay.addEventListener('click', e => {
    if (e.target === overlay) options.onClose();
  });

  // Escape key to dismiss
  overlay.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      e.preventDefault();
      options.onClose();
    }
  });

  const remove = () => {
    overlay.remove();
  };

  document.body.appendChild(overlay);
  dialog.focus();

  return { overlay, dialog, remove };
}

/** Standard inline style for primary action buttons. */
export const PRIMARY_BUTTON_STYLE = `
  padding: 6px 14px;
  background: var(--md-button-bg);
  color: var(--md-button-fg);
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-family: var(--md-font-family);
  font-weight: 500;
`;

/** Standard inline style for secondary/cancel buttons. */
export const SECONDARY_BUTTON_STYLE = `
  padding: 6px 14px;
  background: var(--md-button-secondary-bg);
  color: var(--md-button-secondary-fg);
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-family: var(--md-font-family);
`;
