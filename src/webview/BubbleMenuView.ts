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
import { MessageType } from '../shared/messageTypes';
import { showTableInsertDialog } from './features/tableInsert';
import { showLinkDialog } from './features/linkDialog';
import { showImageInsertDialog } from './features/imageInsertDialog';
import { showEmojiPicker } from './features/emojiPicker';
import type { Editor } from '@tiptap/core';
import { modLabel as modKeyLabel } from './utils/platform';
import { TIPTAP_ICONS, createSvgIcon } from './icons/tiptapIcons';
import { buildSharedTableOps } from './utils/sharedTableOps';

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
 * Update toolbar active states (can be called from outside)
 */
export function updateToolbarStates() {
  if (toolbarRefreshFunction) {
    toolbarRefreshFunction();
  }
}

/**
 * Create compact floating formatting bar used by TipTap BubbleMenu.
 * Minimal: Bold, Italic, Highlight, Link only.
 */
export function createFloatingFormattingBar(getEditor: () => Editor | null): {
  element: HTMLElement;
  refresh: () => void;
  destroy: () => void;
} {
  ensureCodiconFont();

  const container = document.createElement('div');
  container.className = 'floating-formatting-bar';
  container.setAttribute('role', 'toolbar');
  container.setAttribute('aria-label', 'Selection formatting');

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

  container.appendChild(boldButton.element);
  container.appendChild(italicButton.element);
  container.appendChild(highlightButton.element);
  container.appendChild(linkButton.element);

  const buttons = [boldButton, italicButton, highlightButton, linkButton];

  const refresh = () => {
    buttons.forEach(({ element, isActive }) => {
      if (!isActive) {
        element.classList.remove('active');
        return;
      }
      element.classList.toggle('active', Boolean(isActive()));
    });
  };

  return {
    element: container,
    refresh,
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

export function createFormattingToolbar(editor: Editor): HTMLElement {
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

  const buttons: ToolbarItem[] = [
    // --- Save Button (first in toolbar) ---
    {
      type: 'button',
      label: '',
      title: 'Save file',
      icon: { name: 'save', fallback: 'Save' },
      className: 'save-button',
      requiresFocus: false,
      isActive: () => false,
      isEnabled: () => true,
      action: () => {
        const vscodeApi = window.vscode;
        if (vscodeApi) {
          vscodeApi.postMessage({ type: 'save' });
        }
      },
    },
    { type: 'separator' },
    // --- Heading Level Dropdown (shows current style) ---
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
    { type: 'separator' },
    // --- Text Formatting ---
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
      type: 'colorPicker',
      label: '',
      title: 'Choose text color',
      icon: { name: 'symbol-color', fallback: '' },
      requiresFocus: true,
      isEnabled: () => true,
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
          showImageInsertDialog(editor, vscodeApi).catch(error => {
            console.error('[DK-AI] Failed to show image insert dialog:', error);
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
    // --- Separator before AI Explain and View menu ---
    { type: 'separator' },
    // --- AI Explain Button ---
    {
      type: 'button',
      label: '',
      title: 'AI Explain Document',
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

    // Update heading level dropdown label dynamically
    dropdownButtons.forEach(({ config, element }) => {
      if (config.className?.includes('heading-level-dropdown')) {
        const labelEl = element.querySelector('.toolbar-button-label');
        if (labelEl) {
          let text = 'Paragraph';
          for (let lvl = 1; lvl <= 5; lvl++) {
            if (editor.isActive('heading', { level: lvl })) {
              text = `Heading ${lvl}`;
              break;
            }
          }
          labelEl.textContent = text;
        }
      }
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

      const menu = document.createElement('div');
      menu.className = 'toolbar-color-menu';

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
        closeAllDropdowns({ keepOverflow: true });
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

  // --- Theme toggle button (sun/moon) at the far right ---
  const themeToggleGroup = document.createElement('div');
  themeToggleGroup.className = 'toolbar-group toolbar-theme-toggle-group toolbar-no-overflow';
  themeToggleGroup.style.marginLeft = 'auto';

  const themeToggleBtn = document.createElement('button');
  themeToggleBtn.type = 'button';
  themeToggleBtn.className = 'toolbar-button theme-toggle';
  themeToggleBtn.setAttribute('data-tooltip', 'Toggle light/dark theme');
  themeToggleBtn.setAttribute('aria-label', 'Toggle light/dark theme');
  themeToggleBtn.onmousedown = e => e.preventDefault();

  function isCurrentThemeDark(): boolean {
    const override = (window as any).gptAiCurrentThemeOverride;
    if (override) return override === 'dark';
    return (
      document.body.getAttribute('data-theme') === 'dark' ||
      document.body.classList.contains('vscode-dark')
    );
  }

  function updateThemeIcon() {
    themeToggleBtn.innerHTML = '';
    const icon = document.createElement('span');
    icon.className = 'toolbar-icon';
    const dark = isCurrentThemeDark();
    icon.innerHTML = dark
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/></svg>'
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    themeToggleBtn.appendChild(icon);
  }
  updateThemeIcon();

  themeToggleBtn.onclick = e => {
    e.preventDefault();
    e.stopPropagation();
    const newTheme = isCurrentThemeDark() ? 'light' : 'dark';
    // Apply theme via the global helper (sets data-theme attribute + fires event)
    if (typeof (window as any).gptAiApplyTheme === 'function') {
      (window as any).gptAiApplyTheme(newTheme);
    }
    // Persist to VS Code settings
    const vscodeApi = (window as any).vscode;
    if (vscodeApi && typeof vscodeApi.postMessage === 'function') {
      vscodeApi.postMessage({ type: MessageType.UPDATE_THEME_OVERRIDE, theme: newTheme });
    }
    updateThemeIcon();
  };

  // Keep icon in sync when theme is changed externally
  window.addEventListener('gptAiThemeChanged', () => updateThemeIcon());

  // --- Help / About button (?) to the left of the theme toggle ---
  const helpBtn = document.createElement('button');
  helpBtn.type = 'button';
  helpBtn.className = 'toolbar-button help-about-button';
  helpBtn.setAttribute('data-tooltip', 'About this editor');
  helpBtn.setAttribute('aria-label', 'About this editor');
  helpBtn.onmousedown = e => e.preventDefault();
  const helpIcon = document.createElement('span');
  helpIcon.className = 'toolbar-icon';
  helpIcon.innerHTML =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
  helpBtn.appendChild(helpIcon);
  helpBtn.onclick = e => {
    e.preventDefault();
    e.stopPropagation();
    showAboutModal();
  };

  themeToggleGroup.appendChild(helpBtn);
  themeToggleGroup.appendChild(themeToggleBtn);
  toolbar.appendChild(themeToggleGroup);

  return toolbar;
}

const REPO_URL = 'https://github.com/kamransethi/gpt-ai-markdown-editor';

/**
 * Show the About modal with version info and helpful links.
 */
function showAboutModal(): void {
  // Remove existing modal if any
  document.querySelector('.about-modal-overlay')?.remove();

  const version = document.body.getAttribute('data-extension-version') || 'unknown';

  const overlay = document.createElement('div');
  overlay.className = 'about-modal-overlay';

  const dialog = document.createElement('div');
  dialog.className = 'about-modal';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-label', 'About Visual AI Markdown Editor');

  dialog.innerHTML = `
    <div class="about-modal-header">
      <h2 class="about-modal-title">Visual AI Markdown Editor</h2>
      <button class="about-modal-close" aria-label="Close" type="button">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="about-modal-body">
      <div class="about-modal-version">
        <span class="about-modal-label">Version</span>
        <span class="about-modal-value">${version}</span>
      </div>
      <div class="about-modal-version">
        <span class="about-modal-label">Publisher</span>
        <span class="about-modal-value">DK-AI</span>
      </div>
      <div class="about-modal-version">
        <span class="about-modal-label">License</span>
        <span class="about-modal-value">MIT</span>
      </div>
      <div class="about-modal-divider"></div>
      <div class="about-modal-links">
        <a class="about-modal-link" data-url="${REPO_URL}#readme">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          Documentation
        </a>
        <a class="about-modal-link" data-url="${REPO_URL}/blob/main/CHANGELOG.md">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          Changelog
        </a>
        <a class="about-modal-link" data-url="${REPO_URL}/blob/main/FEATURES.md">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          Features
        </a>
        <a class="about-modal-link" data-url="${REPO_URL}/issues">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Report an Issue
        </a>
        <a class="about-modal-link" data-url="${REPO_URL}/discussions">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          Community Discussions
        </a>
      </div>
    </div>
  `;

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  // Wire up link clicks to open externally via VS Code
  dialog.querySelectorAll('.about-modal-link[data-url]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const url = (link as HTMLElement).getAttribute('data-url');
      if (url) {
        const vscodeApi = (window as any).vscode;
        if (vscodeApi && typeof vscodeApi.postMessage === 'function') {
          vscodeApi.postMessage({ type: MessageType.OPEN_EXTERNAL_LINK, url });
        }
      }
    });
  });

  // Close handlers
  const close = () => overlay.remove();
  overlay.querySelector('.about-modal-close')!.addEventListener('click', close);
  overlay.addEventListener('click', e => {
    if (e.target === overlay) close();
  });
  const handleEsc = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', handleEsc);
    }
  };
  document.addEventListener('keydown', handleEsc);
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
