/**
 * Copyright (c) 2025-2026 GPT-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 *
 * @fileoverview Toolbar and menu components for the WYSIWYG markdown editor.
 * Provides:
 * - Compact formatting toolbar with Codicon icons
 * - Table context menu for row/column operations
 * - Dropdown menus for headings, code blocks, and diagrams
 *
 * @module BubbleMenuView
 */

import { MERMAID_TEMPLATES } from './mermaidTemplates';
import { showTableInsertDialog } from './features/tableInsert';
import { showLinkDialog } from './features/linkDialog';
import { showImageInsertDialog } from './features/imageInsertDialog';
import type { Editor } from '@tiptap/core';
import { getSelectedTableLines } from './utils/tableSelectionUtils';
import { moveSelectedTableColumn, moveSelectedTableRow } from './utils/tableOperationActions';
import { modLabel as modKeyLabel } from './utils/platform';

// Store reference to refresh function so it can be called externally
let toolbarRefreshFunction: (() => void) | null = null;

/**
 * Normalize selection and create a code block
 *
 * Strips all formatting (marks) from the selection, extracts plain text,
 * and replaces it with a single code block node.
 *
 * @param editor - TipTap editor instance
 * @param language - Programming language for syntax highlighting
 */
function setCodeBlockNormalized(editor: Editor, language: string): void {
  const { state } = editor;
  const { from, to, empty } = state.selection;

  // If already in a code block, just update the language
  if (editor.isActive('codeBlock')) {
    editor.chain().focus().updateAttributes('codeBlock', { language }).run();
    return;
  }

  // For empty selection, insert an empty code block and position cursor inside it
  if (empty) {
    // Use setCodeBlock which properly creates a code block and positions cursor inside
    // This ensures editor.isActive('codeBlock') returns true immediately after
    editor.chain().focus().setCodeBlock({ language }).run();
    return;
  }

  // Extract plain text from selection (strips all marks)
  // Use empty string as block separator to keep content on same line within selection
  const plainText = state.doc.textBetween(from, to, '\n');

  // Replace selection with a single code block containing the plain text
  editor
    .chain()
    .focus()
    .deleteRange({ from, to })
    .insertContent({
      type: 'codeBlock',
      attrs: { language },
      content: plainText
        ? [
            {
              type: 'text',
              text: plainText,
            },
          ]
        : undefined,
    })
    .run();
}

// Track editor focus state
let isEditorFocused = false;
let focusChangeListener: ((e: Event) => void) | null = null;

type ToolbarIcon = {
  name?: string;
  fallback: string;
  badge?: string;
};

type ToolbarActionButton = {
  type: 'button';
  label: string;
  title?: string;
  action: () => void;
  isActive?: () => boolean;
  isEnabled?: () => boolean;
  className?: string;
  icon: ToolbarIcon;
  requiresFocus?: boolean; // Whether this button requires editor focus to be enabled
};

type ToolbarDropdownItem = {
  label: string;
  action: () => void;
  icon?: ToolbarIcon;
  isEnabled?: () => boolean; // Function to check if item should be enabled
  isActive?: () => boolean; // Function to check if item is currently active
};

type ToolbarDropdown = {
  type: 'dropdown';
  label: string;
  title?: string;
  className?: string;
  icon: ToolbarIcon;
  items: ToolbarDropdownItem[];
  requiresFocus?: boolean; // Whether this dropdown requires editor focus to be enabled
  isActive?: () => boolean; // Function to determine if dropdown should appear active
  isEnabled?: () => boolean;
};

type ToolbarColorPicker = {
  type: 'colorPicker';
  label: string;
  title?: string;
  icon: ToolbarIcon;
  requiresFocus?: boolean;
  isEnabled?: () => boolean;
};

type ToolbarSeparator = { type: 'separator' };

type ToolbarItem = ToolbarActionButton | ToolbarDropdown | ToolbarColorPicker | ToolbarSeparator;

type TextColorOption = {
  label: string;
  value: string;
};

const FLOATING_COLOR_STORAGE_KEY = 'gptai-floating-font-color';
const DEFAULT_FLOATING_TEXT_COLOR = '#0078d4';
const TEXT_COLOR_OPTIONS: TextColorOption[] = [
  { label: 'Default', value: '' },
  { label: 'Red', value: '#e81123' },
  { label: 'Orange', value: '#ea5a00' },
  { label: 'Yellow', value: '#fce100' },
  { label: 'Green', value: '#107c10' },
  { label: 'Blue', value: '#0078d4' },
  { label: 'Purple', value: '#8e562e' },
  { label: 'Pink', value: '#c239b3' },
];

function normalizeColor(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase();
}

function getPreferredTextColor(): string {
  const stored = localStorage.getItem(FLOATING_COLOR_STORAGE_KEY);
  const normalizedStored = normalizeColor(stored);
  const isKnown = TEXT_COLOR_OPTIONS.some(
    option => normalizeColor(option.value) === normalizedStored
  );
  return isKnown && stored ? stored : DEFAULT_FLOATING_TEXT_COLOR;
}

function setPreferredTextColor(value: string): void {
  if (value) {
    localStorage.setItem(FLOATING_COLOR_STORAGE_KEY, value);
  }
}

function getEditorTextColor(editor: Editor): string {
  const attrs = editor.getAttributes('textStyle') as { color?: string };
  return attrs?.color || '';
}

function applyTextColor(editor: Editor, value: string): void {
  if (!value) {
    editor.chain().focus().unsetColor().run();
    return;
  }
  editor.chain().focus().setColor(value).run();
}

let codiconCheckScheduled = false;

function ensureCodiconFont() {
  if (codiconCheckScheduled) return;
  codiconCheckScheduled = true;

  if (!('fonts' in document) || typeof document.fonts?.load !== 'function') {
    document.documentElement.classList.add('codicon-fallback');
    return;
  }

  document.fonts
    .load('16px "codicon"')
    .then(() => {
      const available = document.fonts.check('16px "codicon"');
      if (!available) {
        document.documentElement.classList.add('codicon-fallback');
      } else {
        document.documentElement.classList.remove('codicon-fallback');
      }
    })
    .catch(() => {
      document.documentElement.classList.add('codicon-fallback');
    });
}

function createIconElement(icon: ToolbarIcon | undefined, baseClass: string): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = baseClass;
  span.setAttribute('aria-hidden', 'true');

  if (!icon) return span;

  if (icon.name) {
    span.classList.add('codicon', `codicon-${icon.name}`, 'uses-codicon');
  } else if (icon.fallback) {
    span.textContent = icon.fallback;
  }

  if (icon.fallback) {
    span.setAttribute('data-fallback', icon.fallback);
    if (!icon.name) {
      span.textContent = icon.fallback;
    }
  }

  if (icon.badge) {
    span.classList.add('heading-icon');
    span.setAttribute('data-badge', icon.badge);
  }

  return span;
}

function closeAllDropdowns() {
  document.querySelectorAll('.toolbar-dropdown-menu').forEach(menu => {
    (menu as HTMLElement).style.display = 'none';
  });

  document.querySelectorAll('.toolbar-color-menu').forEach(menu => {
    (menu as HTMLElement).style.display = 'none';
  });

  document.querySelectorAll('.toolbar-dropdown button[aria-expanded="true"]').forEach(btn => {
    (btn as HTMLElement).setAttribute('aria-expanded', 'false');
  });
}

/**
 * Update toolbar active states (can be called from outside)
 */
export function updateToolbarStates() {
  if (toolbarRefreshFunction) {
    toolbarRefreshFunction();
  }
}

/**
 * Create compact floating formatting bar used by TipTap BubbleMenu.
 */
export function createFloatingFormattingBar(getEditor: () => Editor | null): {
  element: HTMLElement;
  refresh: () => void;
  destroy: () => void;
} {
  ensureCodiconFont();

  let preservedSelection: { from: number; to: number } | null = null;

  const rememberSelection = () => {
    const activeEditor = getEditor();
    if (!activeEditor) return;
    const { from, to, empty } = activeEditor.state.selection;
    if (!empty) {
      preservedSelection = { from, to };
    }
  };

  const buildSelectionChain = (activeEditor: Editor) => {
    const { empty } = activeEditor.state.selection;
    let chain = activeEditor.chain();
    if (empty && preservedSelection) {
      chain = chain.setTextSelection(preservedSelection);
    }
    return chain.focus();
  };

  const container = document.createElement('div');
  container.className = 'floating-formatting-bar';
  container.setAttribute('role', 'toolbar');
  container.setAttribute('aria-label', 'Selection formatting');

  const createDivider = () => {
    const divider = document.createElement('div');
    divider.className = 'floating-toolbar-separator';
    return divider;
  };

  const createButton = (options: {
    className: string;
    title: string;
    icon: ToolbarIcon;
    action: () => void;
    isActive?: () => boolean;
  }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `floating-toolbar-button ${options.className}`;
    button.title = options.title;
    button.setAttribute('aria-label', options.title);
    button.append(createIconElement(options.icon, 'toolbar-icon'));

    button.onmousedown = e => {
      // Keep selection stable while formatting from bubble UI.
      rememberSelection();
      e.preventDefault();
    };

    button.onclick = e => {
      e.preventDefault();
      e.stopPropagation();
      options.action();
      refresh();
    };

    return {
      element: button,
      isActive: options.isActive,
    };
  };

  const headingMenu = document.createElement('div');
  headingMenu.className = 'floating-toolbar-menu';

  const colorMenu = document.createElement('div');
  colorMenu.className = 'floating-toolbar-color-menu';
  const colorSwatches: Array<{ value: string; element: HTMLButtonElement }> = [];

  const getStoredColor = () => getPreferredTextColor();

  const getSelectionColor = () => {
    const activeEditor = getEditor();
    if (!activeEditor) return '';
    return getEditorTextColor(activeEditor);
  };

  const applyFontColor = (value: string) => {
    const activeEditor = getEditor();
    if (!activeEditor) return;

    rememberSelection();

    setPreferredTextColor(value);

    const chain = buildSelectionChain(activeEditor);
    if (!value) {
      chain.unsetColor().run();
      return;
    }
    chain.setColor(value).run();
  };

  const colorGroup = document.createElement('div');
  colorGroup.className = 'floating-toolbar-color-group';

  const colorPrimary = document.createElement('button');
  colorPrimary.type = 'button';
  colorPrimary.className = 'floating-toolbar-button color-primary';
  colorPrimary.title = 'Toggle font color';
  colorPrimary.setAttribute('aria-label', 'Toggle font color');
  const colorPrimaryIcon = createIconElement(
    { name: 'symbol-color', fallback: 'A' },
    'toolbar-icon'
  );
  const colorPrimaryUnderline = document.createElement('span');
  colorPrimaryUnderline.className = 'floating-color-underline';
  colorPrimary.append(colorPrimaryIcon, colorPrimaryUnderline);

  colorPrimary.onmousedown = e => {
    rememberSelection();
    e.preventDefault();
  };
  colorPrimary.onclick = e => {
    e.preventDefault();
    e.stopPropagation();

    const activeEditor = getEditor();
    if (!activeEditor) return;

    rememberSelection();
    const currentColor = normalizeColor(getSelectionColor());
    const selectedColor = normalizeColor(getStoredColor());
    if (currentColor && currentColor === selectedColor) {
      buildSelectionChain(activeEditor).unsetColor().run();
    } else {
      applyFontColor(selectedColor);
    }
    refresh();
  };

  const colorToggle = document.createElement('button');
  colorToggle.type = 'button';
  colorToggle.className = 'floating-toolbar-button color-toggle';
  colorToggle.title = 'Font color options';
  colorToggle.setAttribute('aria-label', 'Font color options');
  colorToggle.append(
    createIconElement({ name: 'chevron-down', fallback: 'v' }, 'toolbar-icon menu-caret')
  );
  colorToggle.onmousedown = e => {
    rememberSelection();
    e.preventDefault();
  };
  colorToggle.onclick = e => {
    e.preventDefault();
    e.stopPropagation();
    const open = colorMenu.style.display === 'flex';
    headingMenu.style.display = 'none';
    colorMenu.style.display = open ? 'none' : 'flex';
  };

  TEXT_COLOR_OPTIONS.forEach(option => {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'floating-color-swatch';
    swatch.title = option.label;
    swatch.setAttribute('aria-label', option.label);
    swatch.onmousedown = e => {
      rememberSelection();
      e.preventDefault();
    };

    if (option.value) {
      swatch.style.backgroundColor = option.value;
    } else {
      swatch.classList.add('default-swatch');
      swatch.textContent = 'A';
    }

    swatch.onclick = e => {
      e.preventDefault();
      e.stopPropagation();
      applyFontColor(option.value);
      colorMenu.style.display = 'none';
      refresh();
    };

    colorMenu.appendChild(swatch);
    colorSwatches.push({ value: option.value, element: swatch });
  });

  colorGroup.append(colorPrimary, colorToggle, colorMenu);

  const styleButton = document.createElement('button');
  styleButton.type = 'button';
  styleButton.className = 'floating-toolbar-button style-button';
  styleButton.title = 'Text style';
  styleButton.setAttribute('aria-label', 'Text style');
  styleButton.append(
    createIconElement({ name: 'text-size', fallback: 'A' }, 'toolbar-icon'),
    createIconElement({ name: 'chevron-down', fallback: 'v' }, 'toolbar-icon menu-caret')
  );

  const setHeading = (level: 1 | 2 | 3 | 4 | 5 | 6) => {
    const activeEditor = getEditor();
    if (!activeEditor) return;
    activeEditor.chain().focus().setHeading({ level }).run();
  };

  const setParagraph = () => {
    const activeEditor = getEditor();
    if (!activeEditor) return;
    activeEditor.chain().focus().setParagraph().run();
  };

  const styleItems = [
    {
      label: 'Paragraph',
      action: () => setParagraph(),
      isActive: () => !getEditor()?.isActive('heading'),
    },
    {
      label: 'Heading 1',
      action: () => setHeading(1),
      isActive: () => Boolean(getEditor()?.isActive('heading', { level: 1 })),
    },
    {
      label: 'Heading 2',
      action: () => setHeading(2),
      isActive: () => Boolean(getEditor()?.isActive('heading', { level: 2 })),
    },
    {
      label: 'Heading 3',
      action: () => setHeading(3),
      isActive: () => Boolean(getEditor()?.isActive('heading', { level: 3 })),
    },
  ];

  const styleItemButtons: Array<{ button: HTMLButtonElement; isActive: () => boolean }> = [];

  styleItems.forEach(item => {
    const itemButton = document.createElement('button');
    itemButton.type = 'button';
    itemButton.className = 'floating-toolbar-menu-item';
    itemButton.textContent = item.label;
    itemButton.title = item.label;
    itemButton.onmousedown = e => {
      rememberSelection();
      e.preventDefault();
    };
    itemButton.onclick = e => {
      e.preventDefault();
      e.stopPropagation();
      item.action();
      headingMenu.style.display = 'none';
      refresh();
    };
    headingMenu.appendChild(itemButton);
    styleItemButtons.push({ button: itemButton, isActive: item.isActive });
  });

  styleButton.onmousedown = e => {
    rememberSelection();
    e.preventDefault();
  };
  styleButton.onclick = e => {
    e.preventDefault();
    e.stopPropagation();
    const open = headingMenu.style.display === 'block';
    colorMenu.style.display = 'none';
    headingMenu.style.display = open ? 'none' : 'block';
  };

  const styleWrapper = document.createElement('div');
  styleWrapper.className = 'floating-toolbar-dropdown';
  styleWrapper.append(styleButton, headingMenu);

  const boldButton = createButton({
    className: 'bold',
    title: 'Bold',
    icon: { name: 'bold', fallback: 'B' },
    action: () => getEditor()?.chain().focus().toggleBold().run(),
    isActive: () => Boolean(getEditor()?.isActive('bold')),
  });

  const italicButton = createButton({
    className: 'italic',
    title: 'Italic',
    icon: { name: 'italic', fallback: 'I' },
    action: () => getEditor()?.chain().focus().toggleItalic().run(),
    isActive: () => Boolean(getEditor()?.isActive('italic')),
  });

  const highlightButton = createButton({
    className: 'highlight',
    title: 'Toggle highlight',
    icon: { name: 'paintcan', fallback: 'Hl' },
    action: () => getEditor()?.chain().focus().toggleHighlight().run(),
    isActive: () => Boolean(getEditor()?.isActive('highlight')),
  });

  const strikeButton = createButton({
    className: 'strike',
    title: 'Strikethrough',
    icon: { name: 'strikethrough', fallback: 'S' },
    action: () => getEditor()?.chain().focus().toggleStrike().run(),
    isActive: () => Boolean(getEditor()?.isActive('strike')),
  });

  const underlineButton = createButton({
    className: 'underline',
    title: 'Underline',
    icon: { name: 'underline', fallback: 'U' },
    action: () => getEditor()?.chain().focus().toggleUnderline().run(),
    isActive: () => Boolean(getEditor()?.isActive('underline')),
  });

  const inlineCodeButton = createButton({
    className: 'inline-code',
    title: 'Inline code',
    icon: { name: 'code', fallback: '<>' },
    action: () => getEditor()?.chain().focus().toggleCode().run(),
    isActive: () => Boolean(getEditor()?.isActive('code')),
  });

  const linkButton = createButton({
    className: 'link',
    title: 'Insert link',
    icon: { name: 'link', fallback: 'Link' },
    action: () => {
      const activeEditor = getEditor();
      if (!activeEditor) return;
      showLinkDialog(activeEditor);
    },
    isActive: () => Boolean(getEditor()?.isActive('link')),
  });

  const clearFormattingButton = createButton({
    className: 'clear-formatting',
    title: 'Clear formatting',
    icon: { name: 'clear-all', fallback: 'Clr' },
    action: () => {
      const activeEditor = getEditor();
      if (!activeEditor) return;
      activeEditor.chain().focus().unsetAllMarks().run();
    },
  });

  // Keep shared control order aligned with the header toolbar:
  // Bold -> Italic -> Highlight -> Text Color -> Strike -> Underline -> Inline Code -> Headings
  container.appendChild(boldButton.element);
  container.appendChild(italicButton.element);
  container.appendChild(highlightButton.element);
  container.appendChild(colorGroup);
  container.appendChild(strikeButton.element);
  container.appendChild(underlineButton.element);
  container.appendChild(inlineCodeButton.element);
  container.appendChild(styleWrapper);
  container.appendChild(createDivider());
  container.appendChild(linkButton.element);
  container.appendChild(clearFormattingButton.element);

  const buttons = [
    boldButton,
    italicButton,
    highlightButton,
    strikeButton,
    underlineButton,
    inlineCodeButton,
    linkButton,
    clearFormattingButton,
  ];

  const closeMenuOnOutsideClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    if (!target || !container.contains(target)) {
      headingMenu.style.display = 'none';
      colorMenu.style.display = 'none';
    }
  };
  document.addEventListener('click', closeMenuOnOutsideClick);

  const refresh = () => {
    const currentColor = normalizeColor(getSelectionColor());
    const selectedColor = getStoredColor();
    colorPrimaryUnderline.style.backgroundColor = currentColor || selectedColor;
    colorPrimary.classList.toggle('active', Boolean(currentColor));

    colorSwatches.forEach(({ value, element }) => {
      const normalized = normalizeColor(value);
      const isSelected = (currentColor || normalizeColor(selectedColor)) === normalized;
      element.classList.toggle('active', isSelected);
    });

    buttons.forEach(({ element, isActive }) => {
      if (!isActive) {
        element.classList.remove('active');
        return;
      }
      element.classList.toggle('active', Boolean(isActive()));
    });

    styleItemButtons.forEach(({ button, isActive }) => {
      button.classList.toggle('active', isActive());
    });
  };

  return {
    element: container,
    refresh,
    destroy: () => {
      document.removeEventListener('click', closeMenuOnOutsideClick);
    },
  };
}

/**
 * Custom table bullet toggler that adds "- " after every hardBreak in the cell.
 */
function toggleTableBullet(editor: Editor) {
  const { state, dispatch } = editor.view;
  const result = getSelectedTableLines(state, state.selection);
  if (!result) return;
  const { selectedLines, tr } = result;

  const lineStarts = selectedLines.map(l => l.start);

  let allHaveBullet = true;
  for (const pos of lineStarts) {
    const nextNode = tr.doc.nodeAt(pos);
    if (nextNode && nextNode.isText) {
      if (!nextNode.text?.startsWith('- ')) {
        allHaveBullet = false;
        break;
      }
    } else {
      allHaveBullet = false;
      break;
    }
  }

  if (lineStarts.length === 1) {
    const nextNode = tr.doc.nodeAt(lineStarts[0]);
    if (!nextNode) {
      allHaveBullet = false;
    }
  }

  const originalFrom = state.selection.from;
  const originalTo = state.selection.to;
  const isEmpty = state.selection.empty;

  for (let i = lineStarts.length - 1; i >= 0; i--) {
    const pos = lineStarts[i];
    if (allHaveBullet) {
      const nextNode = tr.doc.nodeAt(pos);
      if (nextNode && nextNode.isText && nextNode.text?.startsWith('- ')) {
        tr.delete(pos, pos + 2);
      }
    } else {
      const nextNode = tr.doc.nodeAt(pos);
      if (!nextNode || (nextNode.isText && !nextNode.text?.startsWith('- '))) {
        tr.insertText('- ', pos);
      } else if (nextNode && !nextNode.isText) {
        tr.insertText('- ', pos);
      }
    }
  }

  dispatch(tr);

  // Remap original selection to keep exactly what the user selected, shifted by the bullet insertions
  if (!isEmpty) {
    const newFrom = tr.mapping.map(originalFrom, -1);
    const newTo = tr.mapping.map(originalTo, 1);

    // Check if newTo is valid
    if (newTo > newFrom) {
      editor.chain().setTextSelection({ from: newFrom, to: newTo }).focus().run();
    } else {
      editor.chain().focus().run();
    }
  } else {
    editor.chain().focus().run();
  }
}

function isTableBulletActive(editor: Editor): boolean {
  if (!editor.isActive('table')) return false;

  const { state } = editor;
  const result = getSelectedTableLines(state, state.selection);
  if (!result) return false;
  const { selectedLines, tr } = result;

  const lineStarts = selectedLines.map(l => l.start);

  if (lineStarts.length === 1 && !tr.doc.nodeAt(lineStarts[0])) {
    return false; // Empty cell
  }

  for (const pos of lineStarts) {
    const nextNode = tr.doc.nodeAt(pos);
    if (!nextNode || !nextNode.isText || !nextNode.text?.startsWith('- ')) {
      return false;
    }
  }

  return true;
}

/**
 * Create compact formatting toolbar with clean, minimal design.
 *
 * @param editor - TipTap editor instance
 * @returns HTMLElement containing the toolbar
 */
/** Current editor zoom level */
let editorZoomLevel = 1;

function setEditorZoom(level: number) {
  editorZoomLevel = level;
  const editorEl = document.querySelector('.markdown-editor') as HTMLElement;
  if (editorEl) {
    editorEl.style.zoom = String(level);
  }
}

function getEditorZoom(): number {
  return editorZoomLevel;
}

export function createFormattingToolbar(editor: Editor): HTMLElement {
  ensureCodiconFont();

  const toolbar = document.createElement('div');
  toolbar.className = 'formatting-toolbar';

  const buttons: ToolbarItem[] = [
    {
      type: 'button',
      label: 'Save',
      title: `Save document ${modKeyLabel}+S`,
      icon: { name: 'save', fallback: 'Save' },
      action: () => {
        if ((window as any).saveDocument) {
          (window as any).saveDocument();
        }
      },
      isActive: () => false,
      isEnabled: () => !!(window as any).__docDirty,
      className: 'save-button',
      requiresFocus: false,
    },
    {
      type: 'button',
      label: 'Undo',
      title: `Undo ${modKeyLabel}+Z`,
      icon: { name: 'discard', fallback: '↩' },
      action: () => editor.chain().focus().undo().run(),
      isActive: () => false,
      isEnabled: () => editor.can().undo(),
      requiresFocus: true,
    },
    {
      type: 'button',
      label: 'Redo',
      title: `Redo ${modKeyLabel}+Shift+Z`,
      icon: { name: 'redo', fallback: '↪' },
      action: () => editor.chain().focus().redo().run(),
      isActive: () => false,
      isEnabled: () => editor.can().redo(),
      requiresFocus: true,
    },
    {
      type: 'dropdown',
      label: 'Zoom',
      title: 'Zoom level',
      icon: { name: 'zoom-in', fallback: '100%' },
      requiresFocus: false,
      items: [
        {
          label: '75%',
          action: () => setEditorZoom(0.75),
          isActive: () => getEditorZoom() === 0.75,
        },
        {
          label: '100%',
          action: () => setEditorZoom(1),
          isActive: () => getEditorZoom() === 1,
        },
        {
          label: '125%',
          action: () => setEditorZoom(1.25),
          isActive: () => getEditorZoom() === 1.25,
        },
        {
          label: '150%',
          action: () => setEditorZoom(1.5),
          isActive: () => getEditorZoom() === 1.5,
        },
      ],
    },
    { type: 'separator' },
    {
      type: 'button',
      label: 'Bold',
      title: `Bold ${modKeyLabel}+B`,
      icon: { name: 'bold', fallback: 'B' },
      action: () => editor.chain().focus().toggleBold().run(),
      isActive: () => editor.isActive('bold'),
      requiresFocus: true,
      className: 'bold',
    },
    {
      type: 'button',
      label: 'Italic',
      title: `Italic ${modKeyLabel}+I`,
      icon: { name: 'italic', fallback: 'I' },
      action: () => editor.chain().focus().toggleItalic().run(),
      isActive: () => editor.isActive('italic'),
      requiresFocus: true,
      className: 'italic',
    },
    {
      type: 'button',
      label: 'Underline',
      title: `Underline ${modKeyLabel}+U`,
      icon: { name: 'underline', fallback: 'U' },
      action: () => editor.chain().focus().toggleUnderline().run(),
      isActive: () => editor.isActive('underline'),
      requiresFocus: true,
      className: 'underline',
    },
    {
      type: 'button',
      label: 'Highlight',
      title: 'Highlight',
      icon: { name: 'paintcan', fallback: 'Hl' },
      action: () => editor.chain().focus().toggleHighlight().run(),
      isActive: () => editor.isActive('highlight'),
      requiresFocus: true,
      className: 'highlight',
    },
    {
      type: 'dropdown',
      label: 'More',
      title: 'More formatting',
      icon: { name: 'ellipsis', fallback: '…' },
      requiresFocus: true,
      isActive: () => editor.isActive('strike') || editor.isActive('code'),
      items: [
        {
          label: 'Strikethrough',
          icon: { name: 'strikethrough', fallback: 'S' },
          action: () => editor.chain().focus().toggleStrike().run(),
          isActive: () => editor.isActive('strike'),
        },
        {
          label: 'Inline code',
          icon: { name: 'code', fallback: '<>' },
          action: () => editor.chain().focus().toggleCode().run(),
          isActive: () => editor.isActive('code'),
        },
      ],
    },
    {
      type: 'colorPicker',
      label: 'Text Color',
      title: 'Choose text color',
      icon: { name: 'symbol-color', fallback: 'A' },
      requiresFocus: true,
      isEnabled: () => true,
    },
    {
      type: 'dropdown',
      label: 'Headings',
      title: 'Heading levels',
      icon: { name: 'text-size', fallback: 'H' },
      requiresFocus: true,
      isActive: () => editor.isActive('heading'),
      isEnabled: () => !editor.isActive('table'),
      items: [
        {
          label: 'Heading 1',
          action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
          isActive: () => editor.isActive('heading', { level: 1 }),
        },
        {
          label: 'Heading 2',
          action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
          isActive: () => editor.isActive('heading', { level: 2 }),
        },
        {
          label: 'Heading 3',
          action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
          isActive: () => editor.isActive('heading', { level: 3 }),
        },
        {
          label: 'Heading 4',
          action: () => editor.chain().focus().toggleHeading({ level: 4 }).run(),
          isActive: () => editor.isActive('heading', { level: 4 }),
        },
        {
          label: 'Heading 5',
          action: () => editor.chain().focus().toggleHeading({ level: 5 }).run(),
          isActive: () => editor.isActive('heading', { level: 5 }),
        },
        {
          label: 'Heading 6',
          action: () => editor.chain().focus().toggleHeading({ level: 6 }).run(),
          isActive: () => editor.isActive('heading', { level: 6 }),
        },
      ],
    },
    { type: 'separator' },
    {
      type: 'dropdown',
      label: 'Lists',
      title: 'Lists and checklists',
      icon: { name: 'list-unordered', fallback: 'L' },
      requiresFocus: true,
      isActive: () =>
        editor.isActive('bulletList') ||
        editor.isActive('orderedList') ||
        editor.isActive('taskList') ||
        isTableBulletActive(editor),
      items: [
        {
          label: 'Bullet list',
          icon: { name: 'list-unordered', fallback: '•' },
          action: () => editor.chain().focus().toggleBulletList().run(),
          isEnabled: () => !editor.isActive('table'),
          isActive: () => editor.isActive('bulletList'),
        },
        {
          label: 'Numbered list',
          icon: { name: 'list-ordered', fallback: '1.' },
          action: () => editor.chain().focus().toggleOrderedList().run(),
          isEnabled: () => !editor.isActive('table'),
          isActive: () => editor.isActive('orderedList'),
        },
        {
          label: 'Task list',
          icon: { name: 'tasklist', fallback: '☐' },
          action: () => editor.chain().focus().toggleTaskList().run(),
          isEnabled: () => !editor.isActive('table'),
          isActive: () => editor.isActive('taskList'),
        },
        {
          label: 'Table bullet',
          icon: { name: 'list-unordered', fallback: '•' },
          action: () => toggleTableBullet(editor),
          isEnabled: () => editor.isActive('table'),
          isActive: () => isTableBulletActive(editor),
        },
      ],
    },
    {
      type: 'dropdown',
      label: 'Blocks',
      title: 'Block formatting',
      icon: { name: 'quote', fallback: '"' },
      requiresFocus: true,
      isActive: () => editor.isActive('blockquote') || editor.isActive('githubAlert'),
      isEnabled: () => !editor.isActive('table'),
      items: [
        {
          label: 'Block quote',
          icon: { name: 'quote', fallback: '"' },
          action: () => editor.chain().focus().toggleBlockquote().run(),
          isActive: () => editor.isActive('blockquote'),
        },
        {
          label: 'Note alert',
          icon: { name: 'info', fallback: 'ℹ' },
          action: () => {
            editor.chain().focus().toggleAlert('NOTE').run();
          },
          isActive: () => editor.isActive('githubAlert', { alertType: 'NOTE' }),
        },
        {
          label: 'Tip alert',
          icon: { name: 'lightbulb', fallback: '💡' },
          action: () => {
            editor.chain().focus().toggleAlert('TIP').run();
          },
          isActive: () => editor.isActive('githubAlert', { alertType: 'TIP' }),
        },
        {
          label: 'Important alert',
          icon: { name: 'megaphone', fallback: '📢' },
          action: () => {
            editor.chain().focus().toggleAlert('IMPORTANT').run();
          },
          isActive: () => editor.isActive('githubAlert', { alertType: 'IMPORTANT' }),
        },
        {
          label: 'Warning alert',
          icon: { name: 'warning', fallback: '⚠' },
          action: () => {
            editor.chain().focus().toggleAlert('WARNING').run();
          },
          isActive: () => editor.isActive('githubAlert', { alertType: 'WARNING' }),
        },
        {
          label: 'Caution alert',
          icon: { name: 'error', fallback: '🛑' },
          action: () => {
            editor.chain().focus().toggleAlert('CAUTION').run();
          },
          isActive: () => editor.isActive('githubAlert', { alertType: 'CAUTION' }),
        },
        {
          label: 'Remove alert',
          icon: { name: 'close', fallback: '×' },
          action: () => {
            editor.chain().focus().lift('githubAlert').run();
          },
        },
      ],
    },
    {
      type: 'dropdown',
      label: 'Insert',
      title: 'Links, images, diagrams, and code blocks',
      icon: { name: 'add', fallback: '+' },
      requiresFocus: true,
      isEnabled: () => true,
      items: [
        {
          label: `Insert/edit link (${modKeyLabel}+K)`,
          icon: { name: 'link', fallback: '🔗' },
          action: () => showLinkDialog(editor),
        },
        {
          label: 'Insert image',
          icon: { name: 'file-media', fallback: '📷' },
          action: () => {
            const vscodeApi = window.vscode;
            if (vscodeApi && editor) {
              showImageInsertDialog(editor, vscodeApi).catch(error => {
                console.error('[GPT-AI] Failed to show image insert dialog:', error);
              });
            } else {
              console.warn(
                '[GPT-AI] Cannot show image insert dialog: vscode API or editor not available'
              );
            }
          },
          isEnabled: () => true,
        },
        {
          label: 'Code block: Plain text',
          icon: { name: 'code', fallback: '{}' },
          action: () => setCodeBlockNormalized(editor, 'plaintext'),
          isEnabled: () => !editor.isActive('table'),
        },
        {
          label: 'Code block: TypeScript',
          icon: { name: 'code', fallback: '{}' },
          action: () => setCodeBlockNormalized(editor, 'typescript'),
          isEnabled: () => !editor.isActive('table'),
        },
        {
          label: 'Code block: Python',
          icon: { name: 'code', fallback: '{}' },
          action: () => setCodeBlockNormalized(editor, 'python'),
          isEnabled: () => !editor.isActive('table'),
        },
        {
          label: 'Code block: JSON',
          icon: { name: 'code', fallback: '{}' },
          action: () => setCodeBlockNormalized(editor, 'json'),
          isEnabled: () => !editor.isActive('table'),
        },
        {
          label: 'Code block: Mermaid',
          icon: { name: 'pie-chart', fallback: 'Mer' },
          action: () => setCodeBlockNormalized(editor, 'mermaid'),
          isEnabled: () => !editor.isActive('table'),
        },
        {
          label: 'Mermaid: Flowchart',
          icon: { name: 'pie-chart', fallback: 'Mer' },
          action: () => {
            editor
              .chain()
              .focus()
              .insertContent(
                `\`\`\`mermaid\n${MERMAID_TEMPLATES[0]?.diagram ?? 'graph TD\nA-->B'}\n\`\`\``,
                {
                  contentType: 'markdown',
                }
              )
              .run();
          },
          isEnabled: () => !editor.isActive('table'),
        },
      ],
    },
    {
      type: 'dropdown',
      label: 'Table',
      title: 'Insert and edit table',
      icon: { name: 'table', fallback: 'Tbl' },
      requiresFocus: true,
      isActive: () => editor.isActive('table'),
      items: [
        {
          label: 'Insert table',
          icon: { name: 'add', fallback: '+' },
          action: () => showTableInsertDialog(editor),
          isEnabled: () => !editor.isActive('table'),
        },
        {
          label: 'Add row before',
          icon: { name: 'arrow-up', fallback: '↑' },
          action: () => editor.chain().focus().addRowBefore().run(),
          isEnabled: () => editor.isActive('table'),
        },
        {
          label: 'Add row after',
          icon: { name: 'arrow-down', fallback: '↓' },
          action: () => editor.chain().focus().addRowAfter().run(),
          isEnabled: () => editor.isActive('table'),
        },
        {
          label: 'Delete row',
          icon: { name: 'trash', fallback: '–' },
          action: () => editor.chain().focus().deleteRow().run(),
          isEnabled: () => editor.isActive('table'),
        },
        {
          label: 'Move row up',
          icon: { name: 'arrow-up', fallback: '↑' },
          action: () => moveSelectedTableRow(editor, 'up'),
          isEnabled: () => editor.isActive('table'),
        },
        {
          label: 'Move row down',
          icon: { name: 'arrow-down', fallback: '↓' },
          action: () => moveSelectedTableRow(editor, 'down'),
          isEnabled: () => editor.isActive('table'),
        },
        {
          label: 'Add column before',
          icon: { name: 'arrow-left', fallback: '←' },
          action: () => editor.chain().focus().addColumnBefore().run(),
          isEnabled: () => editor.isActive('table'),
        },
        {
          label: 'Add column after',
          icon: { name: 'arrow-right', fallback: '→' },
          action: () => editor.chain().focus().addColumnAfter().run(),
          isEnabled: () => editor.isActive('table'),
        },
        {
          label: 'Delete column',
          icon: { name: 'remove', fallback: '×' },
          action: () => editor.chain().focus().deleteColumn().run(),
          isEnabled: () => editor.isActive('table'),
        },
        {
          label: 'Move column left',
          icon: { name: 'arrow-left', fallback: '←' },
          action: () => moveSelectedTableColumn(editor, 'left'),
          isEnabled: () => editor.isActive('table'),
        },
        {
          label: 'Move column right',
          icon: { name: 'arrow-right', fallback: '→' },
          action: () => moveSelectedTableColumn(editor, 'right'),
          isEnabled: () => editor.isActive('table'),
        },
        {
          label: 'Export table as CSV',
          icon: { name: 'export', fallback: 'CSV' },
          action: () => window.dispatchEvent(new CustomEvent('exportTableCsv')),
          isEnabled: () => editor.isActive('table'),
        },
        {
          label: 'Delete table',
          icon: { name: 'trash', fallback: '✕' },
          action: () => editor.chain().focus().deleteTable().run(),
          isEnabled: () => editor.isActive('table'),
        },
      ],
    },
    { type: 'separator' },
    {
      type: 'dropdown',
      label: 'View',
      title: 'Outline, source, and settings',
      icon: { name: 'layout-sidebar-right', fallback: 'View' },
      items: [
        {
          label: 'Toggle outline pane',
          action: () => {
            window.dispatchEvent(new CustomEvent('toggleTocPane'));
          },
        },
        {
          label: 'Open source view',
          action: () => {
            window.dispatchEvent(new CustomEvent('openSourceView'));
          },
        },
        {
          label: 'Copy selection as Markdown',
          action: () => {
            window.dispatchEvent(new CustomEvent('copyAsMarkdown'));
          },
        },
        {
          label: 'Configuration',
          action: () => {
            window.dispatchEvent(new CustomEvent('openExtensionSettings'));
          },
        },
      ],
    },
    {
      type: 'dropdown',
      label: 'Export',
      title: 'Export and settings',
      icon: { name: 'export', fallback: 'Export' },
      items: [
        {
          label: 'Export as PDF',
          action: () => {
            window.dispatchEvent(new CustomEvent('exportDocument', { detail: { format: 'pdf' } }));
          },
        },
        {
          label: 'Export as Word',
          action: () => {
            window.dispatchEvent(new CustomEvent('exportDocument', { detail: { format: 'docx' } }));
          },
        },
      ],
    },
  ];

  const actionButtons: Array<{ config: ToolbarActionButton; element: HTMLButtonElement }> = [];
  const dropdownButtons: Array<{ config: ToolbarDropdown; element: HTMLButtonElement }> = [];
  const dropdownItems: Array<{ config: ToolbarDropdownItem; element: HTMLButtonElement }> = [];
  const colorPickers: Array<{
    config: ToolbarColorPicker;
    root: HTMLDivElement;
    primary: HTMLButtonElement;
    toggle: HTMLButtonElement;
    underline: HTMLSpanElement;
    swatches: Array<{ value: string; element: HTMLButtonElement }>;
  }> = [];

  let currentGroup = document.createElement('div');
  currentGroup.className = 'toolbar-group';
  toolbar.appendChild(currentGroup);

  const refreshActiveStates = () => {
    // Update action buttons active and enabled states
    actionButtons.forEach(({ config, element }) => {
      const active = config.isActive ? config.isActive() : false;
      element.classList.toggle('active', Boolean(active));
      element.setAttribute('aria-pressed', String(Boolean(active)));

      // Check if button requires focus
      let enabled = config.requiresFocus ? isEditorFocused : true;
      if (enabled && config.isEnabled) {
        enabled = config.isEnabled();
      }
      element.disabled = !enabled;
      element.classList.toggle('disabled', !enabled);
      element.setAttribute('aria-disabled', String(!enabled));

      // Update title to explain why disabled
      if (!enabled && config.requiresFocus && !isEditorFocused) {
        element.title = 'Focus editor first';
      } else if (!enabled) {
        element.title = 'Not available here';
      } else {
        element.title = config.title || config.label;
      }
    });

    // Update dropdown buttons enabled states
    dropdownButtons.forEach(({ config, element }) => {
      const active = config.isActive ? config.isActive() : false;
      element.classList.toggle('active', Boolean(active));
      element.setAttribute('aria-pressed', String(Boolean(active)));

      let enabled = config.requiresFocus ? isEditorFocused : true;
      if (enabled && config.isEnabled) {
        enabled = config.isEnabled();
      }
      element.disabled = !enabled;
      element.classList.toggle('disabled', !enabled);
      element.setAttribute('aria-disabled', String(!enabled));

      // Update title to explain why disabled
      if (!enabled && config.requiresFocus && !isEditorFocused) {
        element.title = 'Focus editor first';
      } else if (!enabled) {
        element.title = 'Not available here';
      } else {
        element.title = config.title || config.label;
      }
    });

    // Update dropdown item disabled/active states
    dropdownItems.forEach(({ config, element }) => {
      const enabled = config.isEnabled ? config.isEnabled() : true;
      element.disabled = !enabled;
      element.classList.toggle('disabled', !enabled);
      element.setAttribute('aria-disabled', String(!enabled));

      const active = config.isActive ? config.isActive() : false;
      element.classList.toggle('active', Boolean(active));
      element.setAttribute('aria-pressed', String(Boolean(active)));
    });

    // Update color pickers
    colorPickers.forEach(({ config, root, primary, toggle, underline, swatches }) => {
      let enabled = config.requiresFocus ? isEditorFocused : true;
      if (enabled && config.isEnabled) {
        enabled = config.isEnabled();
      }

      root.classList.toggle('disabled', !enabled);
      primary.disabled = !enabled;
      toggle.disabled = !enabled;
      primary.classList.toggle('disabled', !enabled);
      toggle.classList.toggle('disabled', !enabled);

      const currentColor = normalizeColor(getEditorTextColor(editor));
      const preferredColor = getPreferredTextColor();
      underline.style.backgroundColor = currentColor || preferredColor;
      primary.classList.toggle('active', Boolean(currentColor));

      swatches.forEach(({ value, element }) => {
        const normalized = normalizeColor(value);
        const isSelected = (currentColor || normalizeColor(preferredColor)) === normalized;
        element.classList.toggle('active', isSelected);
      });
    });
  };

  buttons.forEach(btn => {
    if (btn.type === 'separator') {
      if (currentGroup.childElementCount === 0) {
        return;
      }

      currentGroup = document.createElement('div');
      currentGroup.className = 'toolbar-group';
      toolbar.appendChild(currentGroup);
      return;
    }

    if (btn.type === 'dropdown') {
      const container = document.createElement('div');
      container.className = 'toolbar-dropdown';

      const button = document.createElement('button');
      button.type = 'button';
      button.className =
        'toolbar-button toolbar-dropdown-trigger' + (btn.className ? ` ${btn.className}` : '');
      button.title = btn.title || btn.label;
      button.setAttribute('aria-label', btn.title || btn.label);
      button.setAttribute('aria-haspopup', 'true');
      button.setAttribute('aria-expanded', 'false');
      button.onmousedown = e => {
        // Keep editor selection when using toolbar controls.
        e.preventDefault();
      };

      const icon = createIconElement(btn.icon, 'toolbar-icon');
      const label = document.createElement('span');
      label.className = 'toolbar-button-label';
      label.textContent = btn.label;
      const caret = createIconElement(
        { name: 'chevron-down', fallback: 'v' },
        'toolbar-icon menu-caret'
      );

      const menu = document.createElement('div');
      menu.className = 'toolbar-dropdown-menu';

      btn.items.forEach(item => {
        const menuItem = document.createElement('button');
        menuItem.type = 'button';
        menuItem.className = 'toolbar-dropdown-item';
        menuItem.title = item.label;
        menuItem.setAttribute('aria-label', item.label);
        menuItem.onmousedown = e => {
          // Prevent focus from leaving editor before action runs.
          e.preventDefault();
        };

        const text = document.createElement('span');
        text.textContent = item.label;

        if (item.icon) {
          const menuIcon = createIconElement(item.icon, 'toolbar-dropdown-icon');
          menuItem.append(menuIcon, text);
        } else {
          menuItem.append(text);
        }

        menuItem.onclick = e => {
          e.preventDefault();
          e.stopPropagation();

          // Don't execute action if disabled
          if (menuItem.disabled) {
            return;
          }

          item.action();
          menu.style.display = 'none';
          button.setAttribute('aria-expanded', 'false');
          refreshActiveStates();
        };

        // Store reference to dropdown item for state updates
        dropdownItems.push({ config: item, element: menuItem });

        menu.appendChild(menuItem);
      });

      button.onclick = e => {
        e.preventDefault();
        e.stopPropagation();

        // Don't open dropdown if button is disabled
        if (button.disabled) {
          return;
        }

        const isVisible = menu.style.display === 'block';
        closeAllDropdowns();

        if (!isVisible) {
          // Refresh enabled states before showing menu
          refreshActiveStates();
        }

        menu.style.display = isVisible ? 'none' : 'block';
        button.setAttribute('aria-expanded', isVisible ? 'false' : 'true');
      };

      button.append(icon, label, caret);
      container.append(button, menu);

      // Store dropdown button for state updates
      dropdownButtons.push({ config: btn, element: button });

      currentGroup.appendChild(container);
      return;
    }

    if (btn.type === 'colorPicker') {
      const root = document.createElement('div');
      root.className = 'toolbar-color-group';

      const primary = document.createElement('button');
      primary.type = 'button';
      primary.className = 'toolbar-button toolbar-color-primary';
      primary.title = btn.title || btn.label;
      primary.setAttribute('aria-label', btn.title || btn.label);
      primary.onmousedown = e => {
        e.preventDefault();
      };

      const underline = document.createElement('span');
      underline.className = 'toolbar-color-underline';
      primary.append(createIconElement(btn.icon, 'toolbar-icon'), underline);

      const menu = document.createElement('div');
      menu.className = 'toolbar-color-menu';

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'toolbar-button toolbar-color-toggle';
      toggle.title = 'Font color options';
      toggle.setAttribute('aria-label', 'Font color options');
      toggle.onmousedown = e => {
        e.preventDefault();
      };
      toggle.append(
        createIconElement({ name: 'chevron-down', fallback: 'v' }, 'toolbar-icon menu-caret')
      );

      const swatches: Array<{ value: string; element: HTMLButtonElement }> = [];
      TEXT_COLOR_OPTIONS.forEach(option => {
        const swatch = document.createElement('button');
        swatch.type = 'button';
        swatch.className = 'toolbar-color-swatch';
        swatch.title = option.label;
        swatch.setAttribute('aria-label', option.label);
        swatch.onmousedown = e => {
          e.preventDefault();
        };

        if (option.value) {
          swatch.style.backgroundColor = option.value;
        } else {
          swatch.classList.add('default-swatch');
          swatch.textContent = 'A';
        }

        swatch.onclick = e => {
          e.preventDefault();
          e.stopPropagation();
          applyTextColor(editor, option.value);
          setPreferredTextColor(option.value);
          menu.style.display = 'none';
          refreshActiveStates();
        };

        menu.appendChild(swatch);
        swatches.push({ value: option.value, element: swatch });
      });

      primary.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        if (primary.disabled) {
          return;
        }
        const currentColor = normalizeColor(getEditorTextColor(editor));
        const preferredColor = normalizeColor(getPreferredTextColor());
        if (currentColor && currentColor === preferredColor) {
          applyTextColor(editor, '');
        } else {
          applyTextColor(editor, preferredColor);
          setPreferredTextColor(preferredColor);
        }
        refreshActiveStates();
      };

      toggle.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        if (toggle.disabled) {
          return;
        }
        const isVisible = menu.style.display === 'flex';
        closeAllDropdowns();
        menu.style.display = isVisible ? 'none' : 'flex';
      };

      root.append(primary, toggle, menu);
      colorPickers.push({ config: btn, root, primary, toggle, underline, swatches });
      currentGroup.appendChild(root);
      return;
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'toolbar-button' + (btn.className ? ` ${btn.className}` : '');
    button.title = btn.title || btn.label;
    button.setAttribute('aria-label', btn.title || btn.label);
    button.onmousedown = e => {
      // Prevent focus steal to preserve current text selection.
      e.preventDefault();
    };

    const icon = createIconElement(btn.icon, 'toolbar-icon');
    const shouldShowLabel = btn.className === 'save-button';

    if (shouldShowLabel) {
      const label = document.createElement('span');
      label.className = 'toolbar-button-label';
      label.textContent = btn.label;
      button.classList.add('toolbar-button-with-label');
      button.append(icon, label);
    } else {
      button.append(icon);
    }

    button.onclick = e => {
      e.preventDefault();

      btn.action();
      refreshActiveStates();
    };

    actionButtons.push({ config: btn, element: button });
    currentGroup.appendChild(button);
  });

  toolbarRefreshFunction = refreshActiveStates;

  editor.on('selectionUpdate', refreshActiveStates);

  // Listen for editor focus changes
  const handleEditorFocusChange = (e: Event) => {
    const customEvent = e as CustomEvent<{ focused: boolean }>;
    isEditorFocused = customEvent.detail.focused;
    refreshActiveStates();
  };

  // Ensure we don't accumulate multiple listeners if toolbar is recreated
  if (focusChangeListener) {
    window.removeEventListener('editorFocusChange', focusChangeListener);
  }
  focusChangeListener = handleEditorFocusChange;
  window.addEventListener('editorFocusChange', handleEditorFocusChange);

  // Clean up listeners when editor is destroyed
  editor.on('destroy', () => {
    if (focusChangeListener) {
      window.removeEventListener('editorFocusChange', focusChangeListener);
      focusChangeListener = null;
    }

    if (typeof editor.off === 'function') {
      editor.off('selectionUpdate', refreshActiveStates);
    }
  });

  refreshActiveStates();

  document.addEventListener('click', () => {
    closeAllDropdowns();
  });

  return toolbar;
}

/**
 * Position bubble menu near selection
 */
export function positionBubbleMenu(menu: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    menu.style.display = 'none';
    return;
  }

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  if (rect.width === 0 && rect.height === 0) {
    menu.style.display = 'none';
    return;
  }

  menu.style.display = 'flex';
  menu.style.position = 'fixed'; // Use fixed instead of absolute
  menu.style.left = `${rect.left + rect.width / 2}px`;
  menu.style.top = `${rect.top - 45}px`; // Position above selection
  menu.style.transform = 'translateX(-50%)'; // Center horizontally
}

/**
 * Create table context menu for row/column operations.
 *
 * @param editor - TipTap editor instance
 * @returns HTMLElement containing the context menu
 */
export function createTableMenu(editor: Editor): HTMLElement {
  const menu = document.createElement('div');
  menu.className = 'table-menu';
  menu.style.display = 'none';

  const restoreContextSelection = () => {
    const rawPos = menu.dataset.contextPos;
    if (!rawPos) {
      return;
    }

    const pos = Number.parseInt(rawPos, 10);
    if (!Number.isFinite(pos)) {
      return;
    }

    const chain = editor.chain().focus();
    if (
      typeof (chain as { setTextSelection?: (position: number) => unknown }).setTextSelection ===
      'function'
    ) {
      (chain as { setTextSelection: (position: number) => { run: () => boolean } })
        .setTextSelection(pos)
        .run();
      return;
    }

    chain.run();
  };

  menu.onmousedown = event => {
    event.preventDefault();
    event.stopPropagation();
  };

  const items: Array<
    | { separator: true }
    | {
        label: string;
        action: () => void;
      }
  > = [
    {
      label: 'Add Row Before',
      action: () => editor.chain().focus().addRowBefore().run(),
    },
    {
      label: 'Add Row After',
      action: () => editor.chain().focus().addRowAfter().run(),
    },
    {
      label: 'Delete Row',
      action: () => editor.chain().focus().deleteRow().run(),
    },
    {
      label: 'Move Row Up',
      action: () => {
        editor.chain().focus().run();
        moveSelectedTableRow(editor, 'up');
      },
    },
    {
      label: 'Move Row Down',
      action: () => {
        editor.chain().focus().run();
        moveSelectedTableRow(editor, 'down');
      },
    },
    { separator: true },
    {
      label: 'Add Column Before',
      action: () => editor.chain().focus().addColumnBefore().run(),
    },
    {
      label: 'Add Column After',
      action: () => editor.chain().focus().addColumnAfter().run(),
    },
    {
      label: 'Delete Column',
      action: () => editor.chain().focus().deleteColumn().run(),
    },
    {
      label: 'Move Column Left',
      action: () => {
        editor.chain().focus().run();
        moveSelectedTableColumn(editor, 'left');
      },
    },
    {
      label: 'Move Column Right',
      action: () => {
        editor.chain().focus().run();
        moveSelectedTableColumn(editor, 'right');
      },
    },
    { separator: true },
    {
      label: 'Export Table as CSV',
      action: () => window.dispatchEvent(new CustomEvent('exportTableCsv')),
    },
    { separator: true },
    {
      label: 'Delete Table',
      action: () => editor.chain().focus().deleteTable().run(),
    },
  ];

  items.forEach(item => {
    if ('separator' in item) {
      const separator = document.createElement('div');
      separator.className = 'table-menu-separator';
      menu.appendChild(separator);
    } else {
      const menuItem = document.createElement('div');
      menuItem.className = 'table-menu-item';
      menuItem.textContent = item.label;
      menuItem.title = item.label;
      menuItem.setAttribute('aria-label', item.label);
      menuItem.onclick = () => {
        restoreContextSelection();
        item.action();
        menu.style.display = 'none';
      };
      menu.appendChild(menuItem);
    }
  });

  document.body.appendChild(menu);
  return menu;
}
