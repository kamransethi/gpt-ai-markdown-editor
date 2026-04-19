/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

/**
 * @file linkDialog.ts - Link insertion/editing dialog UI
 * @description Modal dialog for inserting and editing hyperlinks.
 * Autocomplete logic is delegated to linkAutocomplete.ts.
 */
import { getMarkRange, Editor } from '@tiptap/core';
import { MessageType } from '../../shared/messageTypes';
import { TextSelection } from 'prosemirror-state';
import { formatFileLinkLabel } from '../utils/fileLinks';
import { devLog } from '../utils/devLog';
import {
  type LinkMode,
  type FileSearchResult,
  type HeadingResult,
  closeAutocomplete,
  createAutocompleteDropdown,
  updateAutocompleteDropdown,
  handleAutocompleteKeyboard,
  handleFileSearch,
  handleHeadingExtraction,
  requestFileHeadings,
  getAutocompleteDropdown,
  getFileSearchRequestId,
  getPendingFileHeadingsRequestId,
  getActualLinkPath,
  setActualLinkPath,
  setSelectedFilePath,
  getSelectedFilePath,
  resetAutocompleteState,
  escapeHtml,
} from './linkAutocomplete';

// ── Dialog state ────────────────────────────────────────────────────

type Range = { from: number; to: number };
type ParentContext = { parentStart: number; parentText: string };

let linkDialogElement: HTMLElement | null = null;
let isVisible = false;
let currentEditor: Editor | null = null;
let workingRange: Range | null = null;
let initialLinkRange: Range | null = null;
let previousSelection: Range | null = null;
let shouldRestoreSelectionOnHide = true;
let currentMode: LinkMode = 'url';

// ── Link range helpers ──────────────────────────────────────────────

const getParentContext = (
  range: Range | null,
  doc: { resolve: (pos: number) => any }
): ParentContext | null => {
  if (!range) return null;
  if (typeof doc?.resolve !== 'function') return null;
  const $from = doc.resolve(range.from);
  const $to = doc.resolve(Math.max(range.to - 1, range.from));
  if ($from.depth !== $to.depth || $from.parent !== $to.parent) return null;
  const parentStart = $from.start($from.depth);
  const parentText = $from.parent.textContent;
  return { parentStart, parentText };
};

const findNearestTextRange = (
  text: string,
  range: Range,
  doc: { resolve: (pos: number) => any }
): Range | null => {
  if (!text) return null;
  const context = getParentContext(range, doc);
  if (!context) return null;

  const { parentStart, parentText } = context;
  const matches: Range[] = [];
  let index = parentText.indexOf(text);

  while (index !== -1) {
    matches.push({ from: parentStart + index, to: parentStart + index + text.length });
    index = parentText.indexOf(text, index + text.length);
  }

  if (!matches.length) return null;

  const distance = (candidate: Range) =>
    Math.abs(candidate.from - range.from) + Math.abs(candidate.to - range.to);

  return matches.sort((a, b) => distance(a) - distance(b))[0] || null;
};

const applyLinkAtRange = (url: string, text: string) => {
  if (!currentEditor) return;

  const { state } = currentEditor;
  const { doc, schema } = state;
  const linkType = schema.marks.link;
  if (!linkType) return;

  const baseRange: Range = workingRange || { from: state.selection.from, to: state.selection.to };
  const trimmedText = text.trim();
  const hasText = Boolean(trimmedText);

  let targetRange: Range = baseRange;
  let shouldReplaceText = false;

  if (hasText) {
    const nearest = findNearestTextRange(trimmedText, baseRange, doc);
    if (nearest) {
      targetRange = nearest;
    } else {
      shouldReplaceText = true;
    }
  }

  if (targetRange.from === targetRange.to && !hasText) {
    return;
  }

  const tr = state.tr;

  const clearFrom = initialLinkRange
    ? Math.min(initialLinkRange.from, targetRange.from)
    : targetRange.from;
  const clearTo = initialLinkRange ? Math.max(initialLinkRange.to, targetRange.to) : targetRange.to;

  tr.removeMark(clearFrom, clearTo, linkType);

  let finalTo = targetRange.to;
  if (hasText && shouldReplaceText) {
    tr.insertText(trimmedText, targetRange.from, targetRange.to);
    finalTo = targetRange.from + trimmedText.length;
  } else if (hasText) {
    finalTo = targetRange.to;
  }

  tr.addMark(targetRange.from, finalTo, linkType.create({ href: url }));
  tr.setSelection(TextSelection.create(tr.doc, targetRange.from, finalTo));

  workingRange = { from: targetRange.from, to: finalTo };

  currentEditor.view.dispatch(tr);
  currentEditor.view.focus();
};

const clearWorkingRanges = () => {
  workingRange = null;
  initialLinkRange = null;
  previousSelection = null;
  shouldRestoreSelectionOnHide = true;
};

function focusEditor(editor: Editor | null) {
  try {
    const chain = editor?.chain?.();
    const maybeFocused = typeof chain?.focus === 'function' ? chain.focus() : chain;
    if (typeof maybeFocused?.run === 'function') {
      maybeFocused.run();
    }
  } catch (error) {
    console.warn('[DK-AI] Failed to restore focus to editor after link dialog', error);
  }
}

const setSelectionHighlight = (range: Range | null) => {
  if (!currentEditor || !range) return;
  try {
    currentEditor.commands.setTextSelection({ from: range.from, to: range.to });
  } catch (error) {
    console.warn('[DK-AI] Failed to set selection highlight for link dialog', error);
  }
};

const centerModal = (panel: HTMLElement) => {
  panel.style.position = 'fixed';
  panel.style.top = '50%';
  panel.style.left = '50%';
  panel.style.transform = 'translate(-50%, -50%)';
  panel.style.margin = '0';
};

// ── Mode management ─────────────────────────────────────────────────

function updateMode(mode: LinkMode, urlInput: HTMLInputElement): void {
  currentMode = mode;

  const urlLabelText = linkDialogElement?.querySelector(
    '#link-url-label-text'
  ) as HTMLElement | null;

  switch (mode) {
    case 'url':
      urlInput.placeholder = 'https://example.com';
      if (urlLabelText) urlLabelText.textContent = 'URL';
      break;
    case 'file':
      urlInput.placeholder = 'Start typing to search files...';
      if (urlLabelText) urlLabelText.textContent = 'File';
      break;
    case 'headings':
      urlInput.placeholder = 'Select a heading from the list below';
      if (urlLabelText) urlLabelText.textContent = 'Heading';
      break;
  }

  const browseBtn = linkDialogElement?.querySelector(
    '#link-browse-local-btn'
  ) as HTMLElement | null;
  if (browseBtn) {
    browseBtn.style.display = mode === 'file' ? 'block' : 'none';
  }

  urlInput.value = '';
  setActualLinkPath(null);
  setSelectedFilePath(null);
  closeAutocomplete();
}

// ── Dialog creation ─────────────────────────────────────────────────

export function createLinkDialog(): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'link-dialog-popover';
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.pointerEvents = 'none';
  overlay.style.zIndex = '5000';
  overlay.style.display = 'none';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Insert/Edit Link');
  overlay.setAttribute('aria-modal', 'true');

  const panel = document.createElement('div');
  panel.className = 'export-settings-overlay-panel';
  panel.style.maxWidth = '520px';
  panel.style.pointerEvents = 'auto';
  panel.style.position = 'absolute';
  panel.style.boxShadow = '0 12px 32px rgba(0,0,0,0.24)';

  const header = document.createElement('div');
  header.className = 'export-settings-overlay-header';
  header.innerHTML = `
    <h2 class="export-settings-overlay-title" id="link-dialog-title">Insert Link</h2>
    <button class="export-settings-overlay-close" aria-label="Close dialog" title="Close (Esc)">×</button>
  `;

  const closeBtn = header.querySelector('.export-settings-overlay-close') as HTMLElement;
  closeBtn.onclick = () => hideLinkDialog();

  const content = document.createElement('div');
  content.className = 'export-settings-content';
  content.innerHTML = `
    <div class="export-settings-section" style="margin-bottom: 16px;">
      <label class="export-settings-label">Type</label>
      <div class="link-dialog-mode-group">
        <label class="link-dialog-mode-option">
          <input type="radio" name="link-mode" value="headings" id="link-mode-headings" checked />
          <span>Heading</span>
        </label>
        <label class="link-dialog-mode-option">
          <input type="radio" name="link-mode" value="file" id="link-mode-file" />
          <span>File</span>
        </label>
        <label class="link-dialog-mode-option">
          <input type="radio" name="link-mode" value="url" id="link-mode-url" />
          <span>URL</span>
        </label>
      </div>
    </div>
    <div class="export-settings-section" style="margin-bottom: 16px; position: relative;">
      <label class="export-settings-label" for="link-url-input" id="link-url-label">
        <span id="link-url-label-text">URL</span>
      </label>
      <div style="display: flex; gap: 4px; align-items: center;">
        <input
          type="text"
          id="link-url-input"
          class="export-settings-select"
          style="padding: 8px 12px; flex: 1;"
          placeholder="https://example.com"
        />
        <button
          id="link-browse-local-btn"
          class="export-settings-select"
          style="width: 34px; height: 34px; padding: 0; display: none; background: var(--md-button-secondary-bg); color: var(--md-button-secondary-fg); border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0;"
          title="Browse for a local file..."
        >
          <span class="codicon codicon-folder"></span>
        </button>
      </div>
      <p class="export-settings-hint" id="link-url-hint">The web address or file path</p>
    </div>
    <div class="export-settings-section" style="margin-bottom: 8px;">
      <label class="export-settings-label" for="link-text-input">Link Text</label>
      <input
        type="text"
        id="link-text-input"
        class="export-settings-select"
        style="padding: 8px 12px;"
        placeholder="Text to display"
      />
    </div>
    <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; border-top: 1px solid var(--md-border); padding-top: 16px;">
      <button
        id="link-remove-btn"
        class="export-settings-select"
        style="width: auto; padding: 6px 16px; background: var(--md-button-secondary-bg); color: var(--md-button-secondary-fg); border: none; cursor: pointer; border-radius: 4px; margin-right: auto;"
      >
        Remove Link
      </button>
      <button
        id="link-cancel-btn"
        class="export-settings-select"
        style="width: auto; padding: 6px 20px; background: var(--md-button-secondary-bg); color: var(--md-button-secondary-fg); border: none; cursor: pointer; border-radius: 4px;"
      >
        Cancel
      </button>
      <button
        id="link-ok-btn"
        class="export-settings-select"
        style="width: auto; padding: 6px 20px; background: var(--md-button-bg); color: var(--md-button-fg); border: none; cursor: pointer; border-radius: 4px;"
      >
        OK
      </button>
    </div>
  `;

  const okBtn = content.querySelector('#link-ok-btn') as HTMLButtonElement;
  const cancelBtn = content.querySelector('#link-cancel-btn') as HTMLButtonElement;
  const removeBtn = content.querySelector('#link-remove-btn') as HTMLButtonElement;
  const textInput = content.querySelector('#link-text-input') as HTMLInputElement;
  const urlInput = content.querySelector('#link-url-input') as HTMLInputElement;

  // Autocomplete
  if (urlInput) {
    const dropdown = createAutocompleteDropdown(urlInput);
    content.appendChild(dropdown);
  }

  // Mode radio buttons
  const modeUrl = content.querySelector('#link-mode-url') as HTMLInputElement;
  const modeFile = content.querySelector('#link-mode-file') as HTMLInputElement;
  const modeHeadings = content.querySelector('#link-mode-headings') as HTMLInputElement;

  modeUrl.addEventListener('change', () => {
    if (modeUrl.checked) updateMode('url', urlInput);
  });
  modeFile.addEventListener('change', () => {
    if (modeFile.checked) updateMode('file', urlInput);
  });
  modeHeadings.addEventListener('change', () => {
    if (modeHeadings.checked) updateMode('headings', urlInput);
  });

  // URL input handlers
  urlInput.addEventListener('focus', () => {
    if (currentMode === 'headings' && currentEditor) {
      handleHeadingExtraction(currentEditor, urlInput.value.trim(), urlInput, currentMode);
    } else if (currentMode === 'file') {
      const dropdown = getAutocompleteDropdown();
      if (dropdown && !urlInput.value.trim()) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'link-dialog-autocomplete-empty';
        emptyMsg.textContent = 'Start typing to search files...';
        dropdown.innerHTML = '';
        dropdown.appendChild(emptyMsg);
        dropdown.style.display = 'block';
      }
    }
  });

  // Local file browse button
  const browseLocalBtn = content.querySelector(
    '#link-browse-local-btn'
  ) as HTMLButtonElement | null;
  if (browseLocalBtn) {
    browseLocalBtn.addEventListener('click', () => {
      const vscode = (window as Window & { vscode: { postMessage: (msg: any) => void } }).vscode;
      if (vscode && typeof vscode.postMessage === 'function') {
        vscode.postMessage({ type: MessageType.BROWSE_LOCAL_FILE });
      }
    });
  }

  // Message listener for local file selection
  const messageListener = (event: MessageEvent) => {
    const message = event.data;
    if (message.type === MessageType.LOCAL_FILE_SELECTED && isVisible && currentMode === 'file') {
      let normalizedPath = message.path.replace(/\\/g, '/');
      if (
        !normalizedPath.startsWith('./') &&
        !normalizedPath.startsWith('../') &&
        !normalizedPath.startsWith('/') &&
        !normalizedPath.match(/^[A-Za-z]:/)
      ) {
        normalizedPath = './' + normalizedPath;
      }

      setActualLinkPath(normalizedPath);
      setSelectedFilePath(normalizedPath);
      urlInput.value = message.filename;
      const textInput = document.querySelector('#link-text-input') as HTMLInputElement | null;
      if (textInput) {
        textInput.value = message.suggestedText || formatFileLinkLabel(message.filename);
      }

      if (message.filename.toLowerCase().endsWith('.md')) {
        requestFileHeadings(message.path);
      } else {
        urlInput.focus();
      }
    }
  };
  window.addEventListener('message', messageListener);
  (overlay as unknown as { _messageListener: (e: MessageEvent) => void })._messageListener =
    messageListener;

  urlInput.addEventListener('input', () => {
    if (currentMode === 'file') {
      const query = urlInput.value.trim();
      if (query.length >= 1) {
        handleFileSearch(query);
      } else {
        const dropdown = getAutocompleteDropdown();
        if (dropdown) {
          const emptyMsg = document.createElement('div');
          emptyMsg.className = 'link-dialog-autocomplete-empty';
          emptyMsg.textContent = 'Start typing to search files...';
          dropdown.innerHTML = '';
          dropdown.appendChild(emptyMsg);
          dropdown.style.display = 'block';
        }
      }
    } else if (currentMode === 'headings' && currentEditor) {
      handleHeadingExtraction(currentEditor, urlInput.value.trim(), urlInput, currentMode);
    } else {
      closeAutocomplete();
    }
  });

  urlInput.addEventListener('keydown', e => {
    const dropdown = getAutocompleteDropdown();
    if (dropdown && handleAutocompleteKeyboard(e, dropdown, urlInput)) {
      return;
    }
  });

  document.addEventListener('click', e => {
    const dropdown = getAutocompleteDropdown();
    if (dropdown && !dropdown.contains(e.target as Node) && urlInput !== e.target) {
      closeAutocomplete();
    }
  });

  okBtn.onclick = () => {
    const url = getActualLinkPath() || urlInput.value.trim();
    const text =
      textInput.value ||
      (currentMode === 'file' && urlInput.value ? formatFileLinkLabel(urlInput.value) : '');

    if (!url) {
      urlInput.focus();
      return;
    }

    shouldRestoreSelectionOnHide = false;
    applyLinkAtRange(url, text);
    hideLinkDialog();
  };

  cancelBtn.onclick = () => hideLinkDialog();

  removeBtn.onclick = () => {
    if (currentEditor) {
      const { state } = currentEditor;
      const linkType = state.schema.marks.link;
      if (linkType) {
        const baseRange = workingRange ||
          initialLinkRange || { from: state.selection.from, to: state.selection.to };
        const clearFrom = initialLinkRange
          ? Math.min(initialLinkRange.from, baseRange.from)
          : baseRange.from;
        const clearTo = initialLinkRange
          ? Math.max(initialLinkRange.to, baseRange.to)
          : baseRange.to;
        const tr = state.tr.removeMark(clearFrom, clearTo, linkType);
        currentEditor.view.dispatch(tr);
      }
    }
    shouldRestoreSelectionOnHide = false;
    hideLinkDialog();
  };

  overlay.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      hideLinkDialog();
    } else if (e.key === 'Enter' && (e.target === textInput || e.target === urlInput)) {
      e.preventDefault();
      okBtn.click();
    }
  });

  panel.appendChild(header);
  panel.appendChild(content);
  overlay.appendChild(panel);

  document.body.appendChild(overlay);
  linkDialogElement = overlay;

  return overlay;
}

// ── Show / hide ─────────────────────────────────────────────────────

export function showLinkDialog(editor: Editor): void {
  currentEditor = editor;
  shouldRestoreSelectionOnHide = true;

  if (!linkDialogElement) {
    createLinkDialog();
  }

  if (!linkDialogElement) return;

  const { state } = editor;
  const { selection, doc, schema } = state;
  previousSelection = { from: selection.from, to: selection.to };
  const linkType = schema.marks.link;
  const linkMark = editor.getAttributes('link');
  const currentUrl = linkMark.href || '';

  const linkRange = getMarkRange(selection.$from, linkType, linkMark);
  const selectionRange: Range = linkRange
    ? { from: linkRange.from, to: linkRange.to }
    : { from: selection.from, to: selection.to };
  workingRange = selectionRange;
  initialLinkRange = linkRange ? { from: linkRange.from, to: linkRange.to } : null;
  const selectedText = doc.textBetween(selectionRange.from, selectionRange.to, ' ');
  setSelectionHighlight(workingRange);

  const title = linkDialogElement.querySelector('#link-dialog-title') as HTMLElement;
  const removeBtn = linkDialogElement.querySelector('#link-remove-btn') as HTMLButtonElement;
  const textInput = linkDialogElement.querySelector('#link-text-input') as HTMLInputElement;
  const urlInput = linkDialogElement.querySelector('#link-url-input') as HTMLInputElement;

  if (currentUrl) {
    title.textContent = 'Edit Link';
    removeBtn.style.display = 'block';
  } else {
    title.textContent = 'Insert Link';
    removeBtn.style.display = 'none';
  }

  textInput.value = selectedText || '';
  urlInput.value = currentUrl || '';
  setActualLinkPath(currentUrl || null);

  currentMode = 'url';
  const modeUrl = linkDialogElement.querySelector('#link-mode-url') as HTMLInputElement;
  const modeFile = linkDialogElement.querySelector('#link-mode-file') as HTMLInputElement;
  const modeHeadings = linkDialogElement.querySelector('#link-mode-headings') as HTMLInputElement;

  if (modeUrl) modeUrl.checked = true;
  if (modeFile) modeFile.checked = false;
  if (modeHeadings) modeHeadings.checked = false;

  updateMode('url', urlInput);

  if (currentUrl) {
    urlInput.value = currentUrl;
    setActualLinkPath(currentUrl);
  }

  closeAutocomplete();

  editor.setEditable(false);

  linkDialogElement.classList.add('visible');
  linkDialogElement.style.display = 'block';
  isVisible = true;
  const panelElement = linkDialogElement.querySelector(
    '.export-settings-overlay-panel'
  ) as HTMLElement | null;

  requestAnimationFrame(() => {
    if (!currentUrl && !selectedText) {
      textInput.focus();
    } else {
      urlInput.select();
      urlInput.focus();
    }

    if (panelElement) {
      centerModal(panelElement);
    }
  });
}

export function hideLinkDialog(): void {
  const editorRef = currentEditor;
  const restoreSelection = shouldRestoreSelectionOnHide;
  const originalSelection = previousSelection;

  if (!linkDialogElement) return;

  resetAutocompleteState();
  currentMode = 'url';

  linkDialogElement.classList.remove('visible');
  linkDialogElement.style.display = 'none';
  isVisible = false;

  if (editorRef) {
    editorRef.setEditable(true);
  }

  if (restoreSelection && editorRef && originalSelection) {
    try {
      editorRef.commands.setTextSelection({
        from: originalSelection.from,
        to: originalSelection.to,
      });
    } catch (error) {
      console.warn('[DK-AI] Failed to restore selection after link dialog', error);
    }
  }

  currentEditor = null;
  clearWorkingRanges();

  if (editorRef) {
    focusEditor(editorRef);
  }
}

export function isLinkDialogVisible(): boolean {
  return isVisible;
}

// ── External result handlers ────────────────────────────────────────

export function handleFileSearchResults(results: FileSearchResult[], requestId: number): void {
  devLog('[DK-AI] Received file search results:', {
    resultsCount: results.length,
    requestId,
    currentRequestId: getFileSearchRequestId(),
  });

  if (requestId !== getFileSearchRequestId()) {
    devLog('[DK-AI] Ignoring outdated search results (requestId mismatch)');
    return;
  }

  const dropdown = getAutocompleteDropdown();
  if (!dropdown || !linkDialogElement) {
    console.warn('[DK-AI] Autocomplete dropdown or dialog element not available');
    return;
  }

  const urlInput = linkDialogElement.querySelector('#link-url-input') as HTMLInputElement;
  if (!urlInput) {
    console.warn('[DK-AI] URL input not found');
    return;
  }

  devLog('[DK-AI] Updating autocomplete dropdown with', results.length, 'results');
  updateAutocompleteDropdown(dropdown, results, urlInput, currentMode);
}

export function handleFileHeadingsResult(headings: HeadingResult[], requestId: number): void {
  if (requestId !== getPendingFileHeadingsRequestId()) {
    return;
  }

  const dropdown = getAutocompleteDropdown();
  if (!dropdown || !linkDialogElement) {
    return;
  }

  const urlInput = linkDialogElement.querySelector('#link-url-input') as HTMLInputElement;
  if (!urlInput) {
    return;
  }

  if (headings.length === 0) {
    closeAutocomplete();
    urlInput.focus();
    return;
  }

  dropdown.innerHTML = '';

  const skipItem = document.createElement('div');
  skipItem.className = 'link-dialog-autocomplete-item link-dialog-autocomplete-item-file';
  skipItem.setAttribute('role', 'option');
  skipItem.setAttribute('data-index', '0');
  skipItem.innerHTML = `
    <div class="link-dialog-autocomplete-content">
      <div class="link-dialog-autocomplete-filename" style="opacity: 0.7;">Link to file only (no heading)</div>
    </div>
  `;
  skipItem.onclick = () => {
    closeAutocomplete();
    urlInput.focus();
  };
  dropdown.appendChild(skipItem);

  headings.forEach((heading, index) => {
    const item = document.createElement('div');
    item.className = 'link-dialog-autocomplete-item link-dialog-autocomplete-item-heading';
    item.setAttribute('role', 'option');
    item.setAttribute('data-index', (index + 1).toString());

    const maxLen = 60;
    const displayText =
      heading.text.length > maxLen ? heading.text.substring(0, maxLen) + '...' : heading.text;

    item.innerHTML = `
      <div class="link-dialog-autocomplete-content">
        <div class="link-dialog-autocomplete-filename" title="${escapeHtml(heading.text)}">
          ${escapeHtml(displayText)}<span class="link-dialog-autocomplete-level"> : H${heading.level}</span>
        </div>
      </div>
    `;

    item.onclick = () => {
      const filePath = getSelectedFilePath();
      if (filePath) {
        setActualLinkPath(`${filePath}#${heading.slug}`);
      }
      const textInput = document.querySelector('#link-text-input') as HTMLInputElement | null;
      if (textInput && textInput.value === formatFileLinkLabel(urlInput.value)) {
        textInput.value = heading.text;
      }
      closeAutocomplete();
      urlInput.focus();
    };

    dropdown.appendChild(item);
  });

  dropdown.style.display = 'block';
  if ((dropdown as HTMLElement & { _updatePosition?: () => void })._updatePosition) {
    (dropdown as HTMLElement & { _updatePosition: () => void })._updatePosition();
  }
}
