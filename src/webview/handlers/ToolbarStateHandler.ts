import type { Editor } from '@tiptap/core';

type ToolbarActionConfig = {
  label: string;
  title?: string;
  isActive?: () => boolean;
  isEnabled?: () => boolean;
  requiresFocus?: boolean;
};

type ToolbarDropdownConfig = {
  label: string;
  title?: string;
  className?: string;
  isActive?: () => boolean;
  isEnabled?: () => boolean;
  requiresFocus?: boolean;
};

type ToolbarDropdownItemConfig = {
  isActive?: () => boolean;
  isEnabled?: () => boolean;
};

type ToolbarColorPickerConfig = {
  isEnabled?: () => boolean;
  requiresFocus?: boolean;
};

type ActionEntry = { config: ToolbarActionConfig; element: HTMLButtonElement };
type DropdownEntry = { config: ToolbarDropdownConfig; element: HTMLButtonElement };
type DropdownItemEntry = { config: ToolbarDropdownItemConfig; element: HTMLButtonElement };

type ColorPickerEntry = {
  config: ToolbarColorPickerConfig;
  root: HTMLDivElement;
  primary: HTMLButtonElement;
  toggle: HTMLButtonElement;
  underline: HTMLSpanElement;
  swatches: Array<{ value: string; element: HTMLButtonElement }>;
};

type ToolbarStateHandlerDeps = {
  editor: Editor;
  actionButtons: ActionEntry[];
  dropdownButtons: DropdownEntry[];
  dropdownItems: DropdownItemEntry[];
  colorPickers: ColorPickerEntry[];
  getEditorTextColor: (editor: Editor) => string;
  getPreferredTextColor: () => string;
  normalizeColor: (value: string | null | undefined) => string;
};

/**
 * Centralizes toolbar state updates and listener lifecycle.
 * Keeps BubbleMenuView focused on structure/rendering instead of state plumbing.
 */
export class ToolbarStateHandler {
  private static activeFocusListener: ((e: Event) => void) | null = null;
  private static activeDirtyListener: ((e: Event) => void) | null = null;

  private readonly editor: Editor;
  private readonly actionButtons: ActionEntry[];
  private readonly dropdownButtons: DropdownEntry[];
  private readonly dropdownItems: DropdownItemEntry[];
  private readonly colorPickers: ColorPickerEntry[];
  private readonly getEditorTextColor: (editor: Editor) => string;
  private readonly getPreferredTextColor: () => string;
  private readonly normalizeColor: (value: string | null | undefined) => string;

  private isEditorFocused = false;

  constructor(deps: ToolbarStateHandlerDeps) {
    this.editor = deps.editor;
    this.actionButtons = deps.actionButtons;
    this.dropdownButtons = deps.dropdownButtons;
    this.dropdownItems = deps.dropdownItems;
    this.colorPickers = deps.colorPickers;
    this.getEditorTextColor = deps.getEditorTextColor;
    this.getPreferredTextColor = deps.getPreferredTextColor;
    this.normalizeColor = deps.normalizeColor;
  }

  attach(): void {
    const selectionListener = () => this.refresh();
    this.editor.on('selectionUpdate', selectionListener);

    const focusListener = (e: Event) => {
      const customEvent = e as CustomEvent<{ focused: boolean }>;
      this.isEditorFocused = customEvent.detail.focused;
      this.refresh();
    };

    if (ToolbarStateHandler.activeFocusListener) {
      window.removeEventListener('editorFocusChange', ToolbarStateHandler.activeFocusListener);
    }
    ToolbarStateHandler.activeFocusListener = focusListener;
    window.addEventListener('editorFocusChange', focusListener);

    const dirtyListener = () => this.refresh();
    if (ToolbarStateHandler.activeDirtyListener) {
      window.removeEventListener('documentDirtyChange', ToolbarStateHandler.activeDirtyListener);
    }
    ToolbarStateHandler.activeDirtyListener = dirtyListener;
    window.addEventListener('documentDirtyChange', dirtyListener);

    this.editor.on('destroy', () => {
      if (ToolbarStateHandler.activeFocusListener) {
        window.removeEventListener('editorFocusChange', ToolbarStateHandler.activeFocusListener);
        ToolbarStateHandler.activeFocusListener = null;
      }

      if (ToolbarStateHandler.activeDirtyListener) {
        window.removeEventListener('documentDirtyChange', ToolbarStateHandler.activeDirtyListener);
        ToolbarStateHandler.activeDirtyListener = null;
      }

      if (typeof this.editor.off === 'function') {
        this.editor.off('selectionUpdate', selectionListener);
      }
    });
  }

  refresh(): void {
    this.actionButtons.forEach(({ config, element }) => {
      const active = config.isActive ? config.isActive() : false;
      element.classList.toggle('active', Boolean(active));
      element.setAttribute('aria-pressed', String(Boolean(active)));

      let enabled = config.requiresFocus ? this.isEditorFocused : true;
      if (enabled && config.isEnabled) {
        enabled = config.isEnabled();
      }
      element.disabled = !enabled;
      element.classList.toggle('disabled', !enabled);
      element.setAttribute('aria-disabled', String(!enabled));

      if (!enabled && config.requiresFocus && !this.isEditorFocused) {
        element.title = 'Focus editor first';
      } else if (!enabled) {
        element.title = 'Not available here';
      } else {
        element.title = config.title || config.label;
      }
    });

    this.dropdownButtons.forEach(({ config, element }) => {
      const active = config.isActive ? config.isActive() : false;
      element.classList.toggle('active', Boolean(active));
      element.setAttribute('aria-pressed', String(Boolean(active)));

      let enabled = config.requiresFocus ? this.isEditorFocused : true;
      if (enabled && config.isEnabled) {
        enabled = config.isEnabled();
      }
      element.disabled = !enabled;
      element.classList.toggle('disabled', !enabled);
      element.setAttribute('aria-disabled', String(!enabled));

      if (!enabled && config.requiresFocus && !this.isEditorFocused) {
        element.title = 'Focus editor first';
      } else if (!enabled) {
        element.title = 'Not available here';
      } else {
        element.title = config.title || config.label;
      }
    });

    this.dropdownItems.forEach(({ config, element }) => {
      const enabled = config.isEnabled ? config.isEnabled() : true;
      element.disabled = !enabled;
      element.classList.toggle('disabled', !enabled);
      element.setAttribute('aria-disabled', String(!enabled));

      const active = config.isActive ? config.isActive() : false;
      element.classList.toggle('active', Boolean(active));
      element.setAttribute('aria-pressed', String(Boolean(active)));
    });

    this.colorPickers.forEach(({ config, root, primary, toggle, underline, swatches }) => {
      let enabled = config.requiresFocus ? this.isEditorFocused : true;
      if (enabled && config.isEnabled) {
        enabled = config.isEnabled();
      }

      root.classList.toggle('disabled', !enabled);
      primary.disabled = !enabled;
      toggle.disabled = !enabled;
      primary.classList.toggle('disabled', !enabled);
      toggle.classList.toggle('disabled', !enabled);

      const currentColor = this.normalizeColor(this.getEditorTextColor(this.editor));
      const preferredColor = this.getPreferredTextColor();
      underline.style.backgroundColor = currentColor || preferredColor;
      primary.classList.toggle('active', Boolean(currentColor));

      swatches.forEach(({ value, element }) => {
        const normalized = this.normalizeColor(value);
        const isSelected = (currentColor || this.normalizeColor(preferredColor)) === normalized;
        element.classList.toggle('active', isSelected);
      });
    });

    this.dropdownButtons.forEach(({ config, element }) => {
      if (config.className?.includes('heading-level-dropdown')) {
        const labelEl = element.querySelector('.toolbar-button-label');
        if (labelEl) {
          let text = 'Paragraph';
          for (let lvl = 1; lvl <= 5; lvl++) {
            if (this.editor.isActive('heading', { level: lvl })) {
              text = `Heading ${lvl}`;
              break;
            }
          }
          labelEl.textContent = text;
        }
      }
    });
  }
}
