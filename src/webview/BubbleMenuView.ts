/**
 * Copyright (c) 2025-2026 DK-AI
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
import { showImagePicker } from './features/imagePicker';
import { showEmojiPicker } from './features/emojiPicker';
import type { Editor } from '@tiptap/core';
import { modLabel as modKeyLabel } from './utils/platform';
import { TIPTAP_ICONS, createSvgIcon } from './icons/tiptapIcons';
import { buildSharedTableOps } from './utils/sharedTableOps';
import { ToolbarStateHandler } from './handlers/ToolbarStateHandler';
import { ToolbarAuxControlsFactory } from './factories/ToolbarAuxControlsFactory';
import { MessageType } from '../shared/messageTypes';

// Store reference to refresh functions so they can be called externally
const toolbarRefreshFunctions: Array<() => void> = [];

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

function isDocumentDirty(): boolean {
  return Boolean((window as any).__docDirty);
}

type ToolbarIcon = {
  name?: string; // Codicon name (legacy) or SVG icon key
  svgName?: string; // Explicit SVG icon key from TIPTAP_ICONS
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

type ToolbarDropdownIconButton = {
  icon: ToolbarIcon;
  title: string;
  action: () => void;
  isActive?: () => boolean;
  isEnabled?: () => boolean;
};

type ToolbarDropdownItem = {
  label: string;
  action: () => void;
  icon?: ToolbarIcon;
  className?: string; // Extra CSS class(es) on the item (e.g. 'danger')
  isEnabled?: () => boolean; // Function to check if item should be enabled
  isActive?: () => boolean; // Function to check if item is currently active
  isSeparator?: boolean; // If true, renders as a visual separator instead of a clickable item
  isSectionLabel?: boolean; // If true, renders as a non-interactive section header
  isButtonRow?: boolean; // If true, renders as a horizontal row of icon buttons
  buttons?: ToolbarDropdownIconButton[]; // Buttons for button row items
  isCustomWidget?: boolean; // If true, renders via customRender instead of standard item
  customRender?: (refreshFn: () => void) => HTMLElement; // Custom DOM render function
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

type ToolbarSplitButton = {
  type: 'splitButton';
  label: string;
  title?: string;
  icon: ToolbarIcon;
  className?: string;
  requiresFocus?: boolean;
  isEnabled?: () => boolean;
  isActive?: () => boolean;
  action: () => void;
  dropdownItems: ToolbarDropdownItem[];
  _dynamicDropdown?: boolean; // Internal flag to mark dynamic dropdown (e.g., markdown file list)
};

type ToolbarSeparator = { type: 'separator' };

type ToolbarItem =
  | ToolbarActionButton
  | ToolbarDropdown
  | ToolbarColorPicker
  | ToolbarSplitButton
  | ToolbarSeparator;

type TextColorOption = {
  label: string;
  value: string;
};

const FLOATING_COLOR_STORAGE_KEY = 'gptai-floating-font-color';
const DEFAULT_FLOATING_TEXT_COLOR = '#0078d4';
const TEXT_COLOR_OPTIONS: TextColorOption[] = [
  { label: 'Default', value: '' },
  { label: 'Red (Pastel)', value: '#EF9A9A' },
  { label: 'Pink (Pastel)', value: '#F48FB1' },
  { label: 'Purple (Pastel)', value: '#CE93D8' },
  { label: 'Blue (Pastel)', value: '#90CAF9' },
  { label: 'Teal (Pastel)', value: '#80CBC4' },
  { label: 'Green (Pastel)', value: '#A5D6A7' },
  { label: 'Yellow (Pastel)', value: '#FFF59D' },
  { label: 'Orange (Pastel)', value: '#FFCC80' },
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

/** Map codicon names to SVG icon keys from TIPTAP_ICONS */
const CODICON_TO_SVG: Record<string, string> = {
  bold: 'bold',
  italic: 'italic',
  underline: 'underline',
  strikethrough: 'strikethrough',
  code: 'inline-code',
  paintcan: 'highlight',
  'symbol-color': 'text-color',
  link: 'link',
  'text-size': 'heading',
  quote: 'blockquote',
  'list-unordered': 'list-unordered',
  'list-ordered': 'list-ordered',
  tasklist: 'list-task',
  discard: 'undo',
  save: 'save',
  'file-media': 'image-plus',
  'pie-chart': 'diagram',
  add: 'image-plus',
  table: 'table',
  'arrow-up': 'arrow-up',
  'arrow-down': 'arrow-down',
  'arrow-left': 'arrow-left',
  'arrow-right': 'arrow-right',
  trash: 'trash',
  close: 'close',
  export: 'export',
  'layout-sidebar-right': 'view',
  'panel-left': 'panel-left',
  'file-code': 'file-code',
  'zoom-in': 'zoom-in',
  'zoom-out': 'zoom-out',
  sparkle: 'sparkle',
  'settings-gear': 'settings-gear',
  'sidebar-list': 'panel-left',
  'chevron-down': 'chevron-down',
  ellipsis: 'ellipsis',
  'clear-all': 'clear-formatting',
  remove: 'close',
  smiley: 'emoji',
};

function createIconElement(icon: ToolbarIcon | undefined, baseClass: string): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = baseClass;
  span.setAttribute('aria-hidden', 'true');

  if (!icon) return span;

  // Try SVG icon first: explicit svgName, or mapped from codicon name
  const svgKey = icon.svgName || (icon.name ? CODICON_TO_SVG[icon.name] : undefined);
  if (svgKey && TIPTAP_ICONS[svgKey]) {
    const svg = createSvgIcon(svgKey, 'toolbar-svg-icon');
    span.appendChild(svg);
    span.classList.add('has-svg');
  } else if (icon.name) {
    // Fall back to codicon font
    span.classList.add('codicon', `codicon-${icon.name}`, 'uses-codicon');
  } else if (icon.fallback) {
    span.textContent = icon.fallback;
  }

  if (icon.fallback) {
    span.setAttribute('data-fallback', icon.fallback);
    if (!icon.name && !svgKey) {
      span.textContent = icon.fallback;
    }
  }

  if (icon.badge) {
    span.classList.add('heading-icon');
    span.setAttribute('data-badge', icon.badge);
  }

  return span;
}

function closeAllDropdowns(options?: { keepOverflow?: boolean }) {
  document.querySelectorAll('.toolbar-dropdown-menu').forEach(menu => {
    (menu as HTMLElement).style.display = 'none';
  });

  document.querySelectorAll('.toolbar-split-menu').forEach(menu => {
    (menu as HTMLElement).style.display = 'none';
  });

  document.querySelectorAll('.toolbar-color-menu').forEach(menu => {
    (menu as HTMLElement).style.display = 'none';
  });

  if (!options?.keepOverflow) {
    document.querySelectorAll('.toolbar-overflow-menu').forEach(menu => {
      (menu as HTMLElement).style.display = 'none';
    });

    document.querySelectorAll('.toolbar-overflow-trigger[aria-expanded="true"]').forEach(btn => {
      (btn as HTMLElement).setAttribute('aria-expanded', 'false');
    });
  }

  document.querySelectorAll('.toolbar-dropdown button[aria-expanded="true"]').forEach(btn => {
    (btn as HTMLElement).setAttribute('aria-expanded', 'false');
  });
}

/**
 * Export closeAllDropdowns for external use (e.g., from message handlers)
 */
export { closeAllDropdowns };

/**
 * Update toolbar active states (can be called from outside)
 */
export function updateToolbarStates() {
  toolbarRefreshFunctions.forEach(fn => fn());
}

/**
 * Create compact floating formatting bar used by TipTap BubbleMenu.
 * Minimal: Bold, Italic, Highlight, Link only.
 */
export function getSharedFormattingControls(editor: Editor): ToolbarItem[] {
  return [
    {
      type: 'dropdown',
      label: 'Paragraph',
      title: 'Text style',
      className: 'heading-level-dropdown',
      icon: { name: 'text-size', fallback: '' },
      requiresFocus: true,
      isActive: () => editor.isActive('heading'),
      items: [
        {
          label: 'Paragraph',
          action: () => editor.chain().focus().setParagraph().run(),
          className: 'heading-preview heading-preview-p',
          isActive: () => !editor.isActive('heading') && !editor.isActive('codeBlock'),
        },
        {
          label: 'Heading 1',
          action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
          className: 'heading-preview heading-preview-1',
          isActive: () => editor.isActive('heading', { level: 1 }),
        },
        {
          label: 'Heading 2',
          action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
          className: 'heading-preview heading-preview-2',
          isActive: () => editor.isActive('heading', { level: 2 }),
        },
        {
          label: 'Heading 3',
          action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
          className: 'heading-preview heading-preview-3',
          isActive: () => editor.isActive('heading', { level: 3 }),
        },
        {
          label: 'Heading 4',
          action: () => editor.chain().focus().toggleHeading({ level: 4 }).run(),
          className: 'heading-preview heading-preview-4',
          isActive: () => editor.isActive('heading', { level: 4 }),
        },
        {
          label: 'Heading 5',
          action: () => editor.chain().focus().toggleHeading({ level: 5 }).run(),
          className: 'heading-preview heading-preview-5',
          isActive: () => editor.isActive('heading', { level: 5 }),
        },
      ],
    },
    { type: 'separator' as any },
    {
      type: 'button',
      label: '',
      title: `Bold ${modKeyLabel}+B`,
      icon: { name: 'bold', fallback: '' },
      action: () => editor.chain().focus().toggleBold().run(),
      isActive: () => editor.isActive('bold'),
      requiresFocus: true,
      className: 'bold',
    },
    {
      type: 'button',
      label: '',
      title: `Italic ${modKeyLabel}+I`,
      icon: { name: 'italic', fallback: '' },
      action: () => editor.chain().focus().toggleItalic().run(),
      isActive: () => editor.isActive('italic'),
      requiresFocus: true,
      className: 'italic',
    },
    {
      type: 'button',
      label: '',
      title: `Underline ${modKeyLabel}+U`,
      icon: { name: 'underline', fallback: '' },
      action: () => editor.chain().focus().toggleUnderline().run(),
      isActive: () => editor.isActive('underline'),
      requiresFocus: true,
      className: 'underline',
    },
    {
      type: 'button',
      label: '',
      title: 'Toggle highlight',
      icon: { name: 'paintcan', fallback: 'Hl' },
      action: () => editor.chain().focus().toggleHighlight().run(),
      isActive: () => editor.isActive('highlight'),
      requiresFocus: true,
      className: 'highlight',
    },
    {
      type: 'colorPicker',
      label: '',
      title: 'Choose text color',
      icon: { svgName: 'text-color-letter', fallback: 'A' },
      requiresFocus: true,
      isEnabled: () => true,
    },
    {
      type: 'button',
      label: '',
      title: 'Strikethrough',
      icon: { name: 'strikethrough', fallback: '' },
      action: () => editor.chain().focus().toggleStrike().run(),
      isActive: () => editor.isActive('strike'),
      requiresFocus: true,
      className: 'strikethrough',
    },
    {
      type: 'button',
      label: '',
      title: 'Inline code',
      icon: { name: 'code', fallback: '' },
      action: () => editor.chain().focus().toggleCode().run(),
      isActive: () => editor.isActive('code'),
      requiresFocus: true,
      className: 'inline-code',
    },
  ];
}

export function createFloatingFormattingBar(getEditor: () => Editor | null): {
  element: HTMLElement;
  refresh: () => void;
  destroy: () => void;
} {
  ensureCodiconFont();
  const editor = getEditor();
  if (!editor) {
    const fallback = document.createElement('div');
    return { element: fallback, refresh: () => {}, destroy: () => {} };
  }

  const toolbar = createFormattingToolbar(editor, 'floating');
  toolbar.className = 'floating-formatting-bar';
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', 'Selection formatting');

  return {
    element: toolbar,
    refresh: () => updateToolbarStates(),
    destroy: () => {},
  };
}

/**
 * Create compact formatting toolbar with clean, minimal design.
 *
 * @param editor - TipTap editor instance
 * @returns HTMLElement containing the toolbar
 */
/** Current editor zoom level (default 0.9 = 90% for comfortable reading baseline) */
let editorZoomLevel = 0.9;

const ZOOM_MIN = 0.7;
const ZOOM_MAX = 1.5;

export function setEditorZoom(level: number, persist = true) {
  // Clamp and round to avoid floating point drift
  const clamped = Math.round(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, level)) * 100) / 100;
  editorZoomLevel = clamped;
  const editorEl = document.querySelector('.markdown-editor') as HTMLElement;
  if (editorEl) {
    editorEl.style.zoom = String(clamped);
  }
  // Update any visible zoom section label
  document.querySelectorAll('.zoom-level-display').forEach(el => {
    el.textContent = `Zoom (${Math.round(clamped * 100)}%)`;
  });
  if (persist) {
    window.dispatchEvent(
      new CustomEvent('updateSetting', {
        detail: { key: 'gptAiMarkdownEditor.editorZoomLevel', value: clamped },
      })
    );
  }
}

export function getEditorZoom(): number {
  return editorZoomLevel;
}

// getSharedTableOperations removed — table ops now use buildSharedTableOps
// from utils/sharedTableOps.ts for identical rendering in toolbar + context menu.

export function createFormattingToolbar(
  editor: Editor,
  mode: 'main' | 'floating' = 'main'
): HTMLElement {
  ensureCodiconFont();

  const toolbar = document.createElement('div');
  toolbar.className = 'formatting-toolbar';

  // Prevent clicks on toolbar background (gaps between buttons) from stealing editor focus
  toolbar.addEventListener('mousedown', e => {
    // Only prevent default on the toolbar itself, not on child interactive elements
    if (e.target === toolbar || (e.target as HTMLElement)?.classList?.contains('toolbar-group')) {
      e.preventDefault();
    }
  });

  const sharedControls = getSharedFormattingControls(editor);

  let buttons: ToolbarItem[];

  if (mode === 'floating') {
    buttons = [
      ...sharedControls,
      {
        type: 'button',
        label: '',
        title: `Insert/edit link (${modKeyLabel}+K)`,
        icon: { name: 'link', fallback: '🔗' },
        action: () => showLinkDialog(editor),
        isActive: () => editor.isActive('link'),
        requiresFocus: true,
        className: 'link',
      },
    ];
  } else {
    buttons = [
      // --- Save Button (split button with export dropdown) ---
      {
        type: 'splitButton',
        label: '',
        title: 'Save file',
        icon: { name: 'save', fallback: 'Save' },
        className: 'save-button',
        requiresFocus: false,
        isActive: () => false,
        isEnabled: () => isDocumentDirty(),
        action: () => {
          const vscodeApi = window.vscode;
          if (vscodeApi) {
            vscodeApi.postMessage({ type: 'save' });
          }
        },
        dropdownItems: [
          { label: 'Export', action: () => {}, isSectionLabel: true },
          {
            label: 'Microsoft Word',
            icon: { svgName: 'export', fallback: 'W' },
            action: () =>
              window.dispatchEvent(
                new CustomEvent('exportDocument', { detail: { format: 'docx' } })
              ),
          },
          {
            label: 'PDF',
            icon: { svgName: 'export', fallback: 'PDF' },
            action: () =>
              window.dispatchEvent(
                new CustomEvent('exportDocument', { detail: { format: 'pdf' } })
              ),
          },
          { label: '', action: () => {}, isSeparator: true },
          { label: 'Save and Open', action: () => {}, isSectionLabel: true },
        ],
        _dynamicDropdown: true, // Mark this button for dynamic markdown file loading
      },
      { type: 'separator' },
      ...sharedControls,
      { type: 'separator' },
      // --- Lists (flat buttons) ---
      {
        type: 'button',
        label: '',
        title: 'Bullet list',
        icon: { name: 'list-unordered', fallback: '•' },
        action: () => editor.chain().focus().toggleBulletList().run(),
        isActive: () => editor.isActive('bulletList'),
        requiresFocus: true,
      },
      {
        type: 'button',
        label: '',
        title: 'Numbered list',
        icon: { name: 'list-ordered', fallback: '1.' },
        action: () => editor.chain().focus().toggleOrderedList().run(),
        isActive: () => editor.isActive('orderedList'),
        requiresFocus: true,
      },
      {
        type: 'button',
        label: '',
        title: 'Task list',
        icon: { name: 'tasklist', fallback: '☐' },
        action: () => editor.chain().focus().toggleTaskList().run(),
        isActive: () => editor.isActive('taskList'),
        requiresFocus: true,
      },
      { type: 'separator' },
      // --- Insert ---
      {
        type: 'button',
        label: '',
        title: 'Insert image',
        icon: { name: 'file-media', fallback: '📷' },
        action: () => {
          const vscodeApi = window.vscode;
          if (vscodeApi && editor) {
            showImagePicker(editor, vscodeApi).catch(error => {
              console.error('[DK-AI] Failed to show image picker:', error);
            });
          }
        },
        requiresFocus: true,
      },
      {
        type: 'button',
        label: '',
        title: `Insert/edit link (${modKeyLabel}+K)`,
        icon: { name: 'link', fallback: '🔗' },
        action: () => showLinkDialog(editor),
        requiresFocus: true,
      },
      {
        type: 'button',
        label: '',
        title: 'Insert emoji',
        icon: { name: 'smiley', fallback: '😀' },
        className: 'emoji-button',
        action: () => {
          const emojiBtn = toolbar.querySelector('.toolbar-button.emoji-button') as HTMLElement;
          showEmojiPicker(editor, emojiBtn || undefined);
        },
        requiresFocus: true,
      },
      {
        type: 'dropdown',
        label: '',
        title: 'Insert and edit table',
        icon: { name: 'table', fallback: 'Tbl' },
        requiresFocus: true,
        isActive: () => editor.isActive('table'),
        items: [
          { label: 'Table', action: () => {}, isSectionLabel: true },
          {
            label: 'Insert table',
            icon: { name: 'add', fallback: '+' },
            action: () => showTableInsertDialog(editor),
            isEnabled: () => !editor.isActive('table'),
          },
          { label: '', action: () => {}, isSeparator: true },
          {
            label: 'Table operations',
            action: () => {},
            isEnabled: () => editor.isActive('table'),
            isCustomWidget: true,
            customRender: (refreshFn: () => void) => {
              const wrapper = document.createElement('div');
              wrapper.className = 'table-ops-widget';
              buildSharedTableOps(wrapper, editor, {
                onItemClick: () => {
                  closeAllDropdowns();
                  refreshFn();
                },
              });
              return wrapper;
            },
          },
        ],
      },
      // --- Blocks and Alerts (merged dropdown) ---
      {
        type: 'dropdown',
        label: '',
        title: 'Blocks and alerts',
        icon: { name: 'quote', fallback: '"' },
        requiresFocus: true,
        isActive: () =>
          editor.isActive('blockquote') ||
          editor.isActive('githubAlert') ||
          editor.isActive('codeBlock'),
        isEnabled: () => !editor.isActive('table'),
        items: [
          {
            label: 'Block quote',
            icon: { name: 'quote', fallback: '"' },
            action: () => editor.chain().focus().toggleBlockquote().run(),
            isActive: () => editor.isActive('blockquote'),
          },
          { label: '', action: () => {}, isSeparator: true },
          { label: 'Alerts', action: () => {}, isSectionLabel: true },
          {
            label: '',
            action: () => {},
            isButtonRow: true,
            buttons: [
              {
                icon: { name: 'info', fallback: 'ℹ' },
                title: 'Note alert',
                action: () =>
                  editor
                    .chain()
                    .focus()
                    .toggleAlert('NOTE' as any)
                    .run(),
                isActive: () => editor.isActive('githubAlert', { alertType: 'NOTE' }),
              },
              {
                icon: { name: 'lightbulb', fallback: '💡' },
                title: 'Tip alert',
                action: () =>
                  editor
                    .chain()
                    .focus()
                    .toggleAlert('TIP' as any)
                    .run(),
                isActive: () => editor.isActive('githubAlert', { alertType: 'TIP' }),
              },
              {
                icon: { name: 'megaphone', fallback: '📢' },
                title: 'Important alert',
                action: () =>
                  editor
                    .chain()
                    .focus()
                    .toggleAlert('IMPORTANT' as any)
                    .run(),
                isActive: () => editor.isActive('githubAlert', { alertType: 'IMPORTANT' }),
              },
              {
                icon: { name: 'warning', fallback: '⚠' },
                title: 'Warning alert',
                action: () =>
                  editor
                    .chain()
                    .focus()
                    .toggleAlert('WARNING' as any)
                    .run(),
                isActive: () => editor.isActive('githubAlert', { alertType: 'WARNING' }),
              },
              {
                icon: { name: 'error', fallback: '🛑' },
                title: 'Caution alert',
                action: () =>
                  editor
                    .chain()
                    .focus()
                    .toggleAlert('CAUTION' as any)
                    .run(),
                isActive: () => editor.isActive('githubAlert', { alertType: 'CAUTION' }),
              },
            ],
          },
          {
            label: 'Remove alert',
            icon: { name: 'close', fallback: '×' },
            action: () => {
              editor.chain().focus().lift('githubAlert').run();
            },
            isEnabled: () => editor.isActive('githubAlert'),
            className: 'danger',
          },
          { label: '', action: () => {}, isSeparator: true },
          { label: 'Code Blocks', action: () => {}, isSectionLabel: true },
          {
            label: 'Plain text',
            icon: { name: 'code', fallback: '{}' },
            action: () => setCodeBlockNormalized(editor, 'plaintext'),
            isEnabled: () => !editor.isActive('table'),
          },
          {
            label: 'TypeScript',
            icon: { name: 'code', fallback: '{}' },
            action: () => setCodeBlockNormalized(editor, 'typescript'),
            isEnabled: () => !editor.isActive('table'),
          },
          {
            label: 'Python',
            icon: { name: 'code', fallback: '{}' },
            action: () => setCodeBlockNormalized(editor, 'python'),
            isEnabled: () => !editor.isActive('table'),
          },
          {
            label: 'JSON',
            icon: { name: 'code', fallback: '{}' },
            action: () => setCodeBlockNormalized(editor, 'json'),
            isEnabled: () => !editor.isActive('table'),
          },
          { label: '', action: () => {}, isSeparator: true },
          { label: 'Diagrams', action: () => {}, isSectionLabel: true },
          {
            label: 'Mermaid (empty)',
            icon: { name: 'pie-chart', fallback: 'Mer' },
            action: () => setCodeBlockNormalized(editor, 'mermaid'),
            isEnabled: () => !editor.isActive('table'),
          },
          {
            label: 'Mermaid flowchart',
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
      // --- Separator before AI and View menu ---
      { type: 'separator' },
      // --- AI Explain Document button ---
      {
        type: 'button',
        label: '',
        title: 'AI Summary — Analyze and summarize this document',
        icon: { name: 'sparkle', fallback: '✨' },
        requiresFocus: false,
        isActive: () => false,
        isEnabled: () => true,
        action: () => {
          editor.commands.explainDocument();
        },
      },
      // --- View Menu Dropdown ---
      {
        type: 'dropdown',
        label: '',
        title: 'View',
        icon: { name: 'panel-left', fallback: '☰' },
        requiresFocus: false,
        isActive: () => false,
        isEnabled: () => true,
        items: [
          { label: 'Display', action: () => {}, isSectionLabel: true },
          {
            label: 'Source view',
            icon: { name: 'file-code', fallback: '</>' },
            action: () => window.dispatchEvent(new CustomEvent('openSourceView')),
          },
          {
            label: 'Navigation pane',
            icon: { name: 'panel-left', fallback: '☰' },
            action: () => window.dispatchEvent(new CustomEvent('toggleTocPane')),
          },
          {
            label: 'Frontmatter',
            icon: { name: 'file-code', fallback: '≡' },
            action: () => {
              // Delegate to editor.ts — it knows about currentFrontmatter and
              // the frontmatterBlock node type.
              (window as any).toggleFrontmatterBlock?.();
            },
          },
          { label: '', action: () => {}, isSeparator: true },
          {
            label: `Zoom (${Math.round(getEditorZoom() * 100)}%)`,
            action: () => {},
            isSectionLabel: true,
            className: 'zoom-level-display',
          },
          {
            label: 'Zoom in',
            icon: { name: 'zoom-in', fallback: '+' },
            action: () => setEditorZoom(getEditorZoom() + 0.1),
            isEnabled: () => getEditorZoom() < ZOOM_MAX,
          },
          {
            label: 'Zoom out',
            icon: { name: 'zoom-out', fallback: '-' },
            action: () => setEditorZoom(getEditorZoom() - 0.1),
            isEnabled: () => getEditorZoom() > ZOOM_MIN,
          },
          {
            label: 'Reset zoom',
            icon: { name: 'view', fallback: '100%' },
            action: () => setEditorZoom(1),
            isEnabled: () => Math.abs(getEditorZoom() - 1) > 0.001,
          },
          { label: '', action: () => {}, isSeparator: true },
          { label: 'Preferences', action: () => {}, isSectionLabel: true },
          {
            label: 'Configuration',
            icon: { name: 'settings-gear', fallback: '⚙' },
            action: () => window.dispatchEvent(new CustomEvent('openExtensionSettings')),
          },
        ],
      },
    ]; // end of else (main toolbar)
  }

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

  // Initialised after buttons are rendered (refreshActiveStates captures it via closure)
  let stateHandler: ToolbarStateHandler | null = null;

  let currentGroup = document.createElement('div');
  currentGroup.className = 'toolbar-group';
  toolbar.appendChild(currentGroup);

  const refreshActiveStates = () => {
    stateHandler?.refresh();
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
      button.setAttribute('data-tooltip', btn.title || btn.label);
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
        // Render separator items
        if (item.isSeparator) {
          const sep = document.createElement('div');
          sep.className = 'toolbar-dropdown-separator';
          sep.setAttribute('role', 'separator');
          menu.appendChild(sep);
          return;
        }

        // Render section labels (non-interactive headers)
        if (item.isSectionLabel) {
          const label = document.createElement('div');
          label.className =
            'toolbar-dropdown-section-label' + (item.className ? ` ${item.className}` : '');
          label.textContent = item.label;
          menu.appendChild(label);
          return;
        }

        // Render button row (horizontal icon buttons — like context menu button rows)
        if (item.isButtonRow && item.buttons) {
          const row = document.createElement('div');
          row.className = 'toolbar-dropdown-button-row';
          item.buttons.forEach(b => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'toolbar-dropdown-icon-btn';
            btn.title = b.title;
            btn.setAttribute('aria-label', b.title);
            const ic = createIconElement(b.icon, 'toolbar-dropdown-icon');
            btn.appendChild(ic);
            btn.onmousedown = e => e.preventDefault();
            btn.onclick = e => {
              e.preventDefault();
              e.stopPropagation();
              if (btn.disabled) return;
              b.action();
              closeAllDropdowns();
              refreshActiveStates();
            };
            row.appendChild(btn);
          });
          // Track button row items for state updates
          item.buttons.forEach((b, idx) => {
            if (b.isActive || b.isEnabled) {
              const btnEl = row.children[idx] as HTMLButtonElement;
              dropdownItems.push({
                config: {
                  label: b.title,
                  action: b.action,
                  isActive: b.isActive,
                  isEnabled: b.isEnabled,
                },
                element: btnEl,
              });
            }
          });
          menu.appendChild(row);
          return;
        }

        // Render custom widget items (e.g. Chrome-style zoom control)
        if (item.isCustomWidget && item.customRender) {
          const widget = item.customRender(refreshActiveStates);
          menu.appendChild(widget);
          // Track buttons inside custom widget for enable/disable states
          if (item.isEnabled) {
            widget.querySelectorAll('button').forEach(btn => {
              dropdownItems.push({
                config: {
                  label: btn.title || btn.getAttribute('aria-label') || '',
                  action: () => {},
                  isEnabled: item.isEnabled,
                },
                element: btn as HTMLButtonElement,
              });
            });
          }
          return;
        }

        const menuItem = document.createElement('button');
        menuItem.type = 'button';
        menuItem.className = 'toolbar-dropdown-item' + (item.className ? ` ${item.className}` : '');
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
          closeAllDropdowns();
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
        closeAllDropdowns({ keepOverflow: true });

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

    if (btn.type === 'splitButton') {
      const splitRoot = document.createElement('div');
      splitRoot.className = 'toolbar-split-group' + (btn.className ? ` ${btn.className}` : '');

      const splitPrimary = document.createElement('button');
      splitPrimary.type = 'button';
      splitPrimary.className = 'toolbar-button toolbar-split-primary';
      splitPrimary.setAttribute('data-tooltip', btn.title || btn.label);
      splitPrimary.setAttribute('aria-label', btn.title || btn.label);
      splitPrimary.onmousedown = e => {
        e.preventDefault();
      };
      splitPrimary.append(createIconElement(btn.icon, 'toolbar-icon'));

      const splitMenu = document.createElement('div');
      splitMenu.className = 'toolbar-split-menu';

      const splitToggle = document.createElement('button');
      splitToggle.type = 'button';
      splitToggle.className = 'toolbar-button toolbar-split-toggle';
      splitToggle.setAttribute('data-tooltip', 'Export options');
      splitToggle.setAttribute('aria-label', 'Export options');
      splitToggle.setAttribute('aria-haspopup', 'true');
      splitToggle.setAttribute('aria-expanded', 'false');
      splitToggle.onmousedown = e => {
        e.preventDefault();
      };
      splitToggle.append(
        createIconElement({ name: 'chevron-down', fallback: 'v' }, 'toolbar-icon menu-caret')
      );

      btn.dropdownItems.forEach(item => {
        if (item.isSeparator) {
          const sep = document.createElement('div');
          sep.className = 'toolbar-dropdown-separator';
          sep.setAttribute('role', 'separator');
          splitMenu.appendChild(sep);
          return;
        }
        if (item.isSectionLabel) {
          const lbl = document.createElement('div');
          lbl.className = 'toolbar-dropdown-section-label';
          lbl.textContent = item.label;
          splitMenu.appendChild(lbl);
          return;
        }
        const menuItem = document.createElement('button');
        menuItem.type = 'button';
        menuItem.className = 'toolbar-dropdown-item' + (item.className ? ` ${item.className}` : '');
        menuItem.title = item.label;
        menuItem.setAttribute('aria-label', item.label);
        menuItem.onmousedown = e => {
          e.preventDefault();
        };
        if (item.icon) {
          const ic = createIconElement(item.icon, 'toolbar-dropdown-icon');
          const txt = document.createElement('span');
          txt.className = 'toolbar-dropdown-label';
          txt.textContent = item.label;
          menuItem.append(ic, txt);
        } else {
          menuItem.textContent = item.label;
        }
        menuItem.onclick = e => {
          e.preventDefault();
          e.stopPropagation();
          if ((menuItem as HTMLButtonElement).disabled) return;
          item.action();
          closeAllDropdowns();
        };
        splitMenu.appendChild(menuItem);
      });

      splitPrimary.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        if (splitPrimary.disabled) return;
        btn.action();
        refreshActiveStates();
      };

      splitToggle.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        if (splitToggle.disabled) return;
        const isMenuVisible = splitMenu.style.display === 'block';
        closeAllDropdowns({ keepOverflow: true });

        // If opening the menu and this is a dynamic dropdown, fetch markdown files
        if (!isMenuVisible && btn._dynamicDropdown) {
          const vscodeApi = window.vscode;
          if (vscodeApi) {
            vscodeApi.postMessage({ type: MessageType.GET_MARKDOWN_FILES });
          }
          // Store reference to menu for later population
          (window as any).__saveDropdownMenu = splitMenu;
          (window as any).__saveButton = btn;
        }

        splitMenu.style.display = isMenuVisible ? 'none' : 'block';
        splitToggle.setAttribute('aria-expanded', isMenuVisible ? 'false' : 'true');
      };

      splitRoot.append(splitPrimary, splitToggle, splitMenu);

      // Track primary for enabled/active state
      actionButtons.push({
        config: {
          type: 'button',
          label: btn.label,
          title: btn.title,
          icon: btn.icon,
          action: btn.action,
          isActive: btn.isActive,
          isEnabled: btn.isEnabled,
          requiresFocus: btn.requiresFocus,
          className: btn.className,
        },
        element: splitPrimary,
      });

      currentGroup.appendChild(splitRoot);
      return;
    }

    if (btn.type === 'colorPicker') {
      const root = document.createElement('div');
      root.className = 'toolbar-color-group';

      const primary = document.createElement('button');
      primary.type = 'button';
      primary.className = 'toolbar-button toolbar-color-primary';
      primary.setAttribute('data-tooltip', btn.title || btn.label);
      primary.setAttribute('aria-label', btn.title || btn.label);
      primary.onmousedown = e => {
        e.preventDefault();
      };

      const underline = document.createElement('span');
      underline.className = 'toolbar-color-underline';
      primary.append(createIconElement(btn.icon, 'toolbar-icon'), underline);

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'toolbar-button toolbar-color-toggle';
      toggle.setAttribute('data-tooltip', 'Font color options');
      toggle.setAttribute('aria-label', 'Font color options');
      toggle.onmousedown = e => {
        e.preventDefault();
      };
      toggle.append(
        createIconElement({ name: 'chevron-down', fallback: 'v' }, 'toolbar-icon menu-caret')
      );

      const popup = document.createElement('div');
      popup.className = 'toolbar-color-menu';
      popup.style.display = 'none';
      popup.style.position = 'absolute';
      popup.style.top = '100%';
      popup.style.left = '0';
      popup.style.zIndex = '100';
      popup.style.background = 'var(--md-background)';
      popup.style.border = '1px solid var(--md-border)';
      popup.style.borderRadius = '6px';
      popup.style.padding = '8px';
      popup.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
      popup.style.width = '140px';
      popup.style.display = 'grid';
      popup.style.gridTemplateColumns = 'repeat(5, 1fr)';
      popup.style.gap = '6px';

      // Hide initially since grid overrides the initial 'none' above for layout
      popup.style.display = 'none';

      // Create swatches
      const swatches: Array<{ value: string; element: HTMLButtonElement }> = [];
      TEXT_COLOR_OPTIONS.forEach(option => {
        const swatch = document.createElement('button');
        swatch.className = 'color-swatch-button';
        swatch.type = 'button';
        swatch.title = option.label;
        swatch.style.width = '20px';
        swatch.style.height = '20px';
        swatch.style.borderRadius = '4px';
        swatch.style.border = '1px solid var(--md-border)';
        swatch.style.cursor = 'pointer';
        swatch.style.padding = '0';
        swatch.style.display = 'flex';
        swatch.style.alignItems = 'center';
        swatch.style.justifyContent = 'center';

        if (option.value === '') {
          swatch.style.background = 'transparent';
          swatch.innerHTML =
            '<svg width="14" height="14" viewBox="0 0 24 24"><line x1="2" y1="2" x2="22" y2="22" stroke="var(--md-error-fg)" stroke-width="2"/></svg>';
        } else {
          swatch.style.background = option.value;
        }

        swatch.onclick = e => {
          e.preventDefault();
          e.stopPropagation();
          applyTextColor(editor, option.value);
          setPreferredTextColor(option.value);
          refreshActiveStates();
          closeAllDropdowns();
        };

        swatches.push({ value: option.value, element: swatch });
        popup.appendChild(swatch);
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
        if (toggle.disabled) return;

        const isMenuVisible = popup.style.display === 'grid';
        closeAllDropdowns({ keepOverflow: true });

        popup.style.display = isMenuVisible ? 'none' : 'grid';
        toggle.setAttribute('aria-expanded', isMenuVisible ? 'false' : 'true');

        if (!isMenuVisible) {
          // Highlight current selected color if we wanted to
        }
      };

      // Wrap in a relative container so popup absolute positioning works correctly
      root.style.position = 'relative';
      root.append(primary, toggle, popup);
      colorPickers.push({ config: btn, root, primary, toggle, underline, swatches });
      currentGroup.appendChild(root);
      return;
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'toolbar-button' + (btn.className ? ` ${btn.className}` : '');
    button.setAttribute('data-tooltip', btn.title || btn.label);
    button.setAttribute('aria-label', btn.title || btn.label);
    button.onmousedown = e => {
      // Prevent focus steal to preserve current text selection.
      e.preventDefault();
    };

    const icon = createIconElement(btn.icon, 'toolbar-icon');
    button.append(icon);

    button.onclick = e => {
      e.preventDefault();

      btn.action();
      refreshActiveStates();
    };

    actionButtons.push({ config: btn, element: button });
    currentGroup.appendChild(button);
  });

  stateHandler = new ToolbarStateHandler({
    editor,
    actionButtons,
    dropdownButtons,
    dropdownItems,
    colorPickers,
    getEditorTextColor,
    getPreferredTextColor,
    normalizeColor,
  });
  stateHandler.attach();
  toolbarRefreshFunctions.push(refreshActiveStates);

  refreshActiveStates();

  document.addEventListener('click', () => {
    closeAllDropdowns();
  });

  // --- Toolbar overflow: move items that don't fit into a '...' overflow menu ---
  const overflowContainer = document.createElement('div');
  overflowContainer.className = 'toolbar-overflow';

  const overflowBtn = document.createElement('button');
  overflowBtn.type = 'button';
  overflowBtn.className = 'toolbar-button toolbar-overflow-trigger';
  overflowBtn.setAttribute('data-tooltip', 'More toolbar items');
  overflowBtn.setAttribute('aria-label', 'More toolbar items');
  overflowBtn.setAttribute('aria-haspopup', 'true');
  overflowBtn.setAttribute('aria-expanded', 'false');
  overflowBtn.onmousedown = e => e.preventDefault();
  const overflowIcon = createIconElement({ name: 'ellipsis', fallback: '…' }, 'toolbar-icon');
  overflowBtn.appendChild(overflowIcon);

  const overflowMenu = document.createElement('div');
  overflowMenu.className = 'toolbar-overflow-menu';

  overflowBtn.onclick = e => {
    e.preventDefault();
    e.stopPropagation();
    const isVisible = overflowMenu.style.display === 'flex';
    closeAllDropdowns();
    overflowMenu.style.display = isVisible ? 'none' : 'flex';
    overflowBtn.setAttribute('aria-expanded', isVisible ? 'false' : 'true');
  };

  overflowContainer.append(overflowBtn, overflowMenu);
  overflowContainer.style.display = 'none';
  toolbar.appendChild(overflowContainer);

  /** Redistribute toolbar groups between main bar and overflow menu */
  function updateOverflow() {
    // Move everything back to the toolbar first (before overflow container)
    const groups = Array.from(overflowMenu.children) as HTMLElement[];
    groups.forEach(g => toolbar.insertBefore(g, overflowContainer));

    // Hide overflow initially
    overflowContainer.style.display = 'none';
    overflowMenu.style.display = 'none';

    // Get all toolbar-group children (not the overflow container or pinned groups)
    const allGroups = Array.from(
      toolbar.querySelectorAll(':scope > .toolbar-group:not(.toolbar-no-overflow)')
    ) as HTMLElement[];
    if (allGroups.length === 0) return;

    const toolbarRect = toolbar.getBoundingClientRect();
    // Reserve space for the overflow button (~40px)
    const maxRight = toolbarRect.right - 40;

    let overflowing = false;
    for (const group of allGroups) {
      const groupRect = group.getBoundingClientRect();
      if (groupRect.right > maxRight) {
        overflowing = true;
      }
      if (overflowing) {
        overflowMenu.appendChild(group);
      }
    }

    if (overflowMenu.children.length > 0) {
      overflowContainer.style.display = 'inline-flex';
    }
  }

  // Run overflow check on resize and initially after layout
  const resizeObserver = new ResizeObserver(() => {
    updateOverflow();
  });
  resizeObserver.observe(toolbar);

  editor.on('destroy', () => {
    resizeObserver.disconnect();
  });

  // Initial layout after first paint
  requestAnimationFrame(() => updateOverflow());

  ToolbarAuxControlsFactory.appendTo(toolbar, editor);

  return toolbar;
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

    // If editor is focused and selection is already in a table, skip restoration
    if (editor.view.hasFocus()) {
      const { $from } = editor.state.selection;
      for (let d = $from.depth; d > 0; d--) {
        if ($from.node(d).type.name === 'table') {
          return;
        }
      }
    }

    try {
      const maxPos = editor.state.doc.content.size;
      const safePos = Math.min(pos, maxPos);
      editor.chain().focus().setTextSelection(safePos).run();
    } catch {
      try {
        editor.view.focus();
      } catch {
        // ignore
      }
    }
  };

  menu.onmousedown = event => {
    event.preventDefault();
    event.stopPropagation();
  };

  // Reuse shared table operations — identical rendering as toolbar dropdown
  buildSharedTableOps(menu, editor, {
    onItemClick: () => {
      menu.style.display = 'none';
    },
    beforeAction: restoreContextSelection,
  });

  document.body.appendChild(menu);
  return menu;
}
