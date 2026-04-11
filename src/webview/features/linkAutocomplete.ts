/**
 * Autocomplete dropdown for the link dialog.
 *
 * Contains all DOM creation, keyboard navigation, positioning,
 * and search dispatching for file / heading autocomplete.
 *
 * @module linkAutocomplete
 */

import { MessageType } from '../../shared/messageTypes';
import { buildOutlineFromEditor } from '../utils/outline';
import { formatFileLinkLabel } from '../utils/fileLinks';
import { devLog } from '../utils/devLog';
import type { Editor } from '@tiptap/core';

// ── Types ───────────────────────────────────────────────────────────

export type LinkMode = 'url' | 'file' | 'headings';

export interface FileSearchResult {
  filename: string;
  path: string;
}

export interface HeadingResult {
  text: string;
  level: number;
  slug: string;
}

// ── State (module-scoped) ───────────────────────────────────────────

let autocompleteDropdown: HTMLElement | null = null;
let selectedAutocompleteIndex: number | null = null;
let fileSearchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let fileSearchRequestId = 0;
let pendingFileHeadingsRequestId = 0;

/** Actual resolved path stored internally (slug, file path, etc). */
let actualLinkPath: string | null = null;
/** The base file path before heading append. */
let selectedFilePath: string | null = null;

// ── Accessors ───────────────────────────────────────────────────────

export function getAutocompleteDropdown(): HTMLElement | null {
  return autocompleteDropdown;
}

export function getFileSearchRequestId(): number {
  return fileSearchRequestId;
}

export function getPendingFileHeadingsRequestId(): number {
  return pendingFileHeadingsRequestId;
}

export function getActualLinkPath(): string | null {
  return actualLinkPath;
}

export function setActualLinkPath(value: string | null): void {
  actualLinkPath = value;
}

export function setSelectedFilePath(value: string | null): void {
  selectedFilePath = value;
}

export function getSelectedFilePath(): string | null {
  return selectedFilePath;
}

// ── Helpers ─────────────────────────────────────────────────────────

export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function generateHeadingSlug(text: string, existingSlugs: Set<string>): string {
  const slug = text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  let finalSlug = slug;
  let counter = 1;
  while (existingSlugs.has(finalSlug)) {
    finalSlug = `${slug}-${counter}`;
    counter++;
  }

  existingSlugs.add(finalSlug);
  return finalSlug;
}

// ── Dropdown lifecycle ──────────────────────────────────────────────

export function closeAutocomplete(): void {
  if (autocompleteDropdown) {
    autocompleteDropdown.style.display = 'none';
    selectedAutocompleteIndex = null;
  }
}

export function createAutocompleteDropdown(urlInput: HTMLInputElement): HTMLElement {
  const dropdown = document.createElement('div');
  dropdown.className = 'link-dialog-autocomplete';
  dropdown.style.display = 'none';
  dropdown.setAttribute('role', 'listbox');

  const updatePosition = () => {
    if (!urlInput || !dropdown) return;
    const inputRect = urlInput.getBoundingClientRect();
    const dialogPanel = urlInput.closest('.export-settings-overlay-panel') as HTMLElement;

    if (dialogPanel) {
      const panelRect = dialogPanel.getBoundingClientRect();
      const relativeTop = inputRect.bottom - panelRect.top + 4;
      const relativeLeft = inputRect.left - panelRect.left;

      const availableHeight = panelRect.bottom - inputRect.bottom - 8;
      const maxDropdownHeight = Math.min(300, Math.max(150, availableHeight));

      dropdown.style.position = 'absolute';
      dropdown.style.top = `${relativeTop}px`;
      dropdown.style.left = `${relativeLeft}px`;
      dropdown.style.maxHeight = `${maxDropdownHeight}px`;

      const maxWidth = Math.min(520, inputRect.width, panelRect.width - relativeLeft - 8);
      dropdown.style.width = `${maxWidth}px`;
      dropdown.style.maxWidth = `${maxWidth}px`;
    } else {
      dropdown.style.position = 'fixed';
      dropdown.style.top = `${inputRect.bottom + 4}px`;
      dropdown.style.left = `${inputRect.left}px`;
      dropdown.style.width = `${Math.min(520, inputRect.width)}px`;
      dropdown.style.maxHeight = '300px';
    }
  };

  urlInput.addEventListener('focus', updatePosition);
  window.addEventListener('resize', updatePosition);
  window.addEventListener('scroll', updatePosition, true);

  (dropdown as unknown as { _updatePosition: () => void })._updatePosition = updatePosition;
  autocompleteDropdown = dropdown;
  return dropdown;
}

// ── Dropdown rendering ──────────────────────────────────────────────

function updateAutocompleteHighlight(dropdown: HTMLElement): void {
  const items = dropdown.querySelectorAll('.link-dialog-autocomplete-item');
  items.forEach((item, index) => {
    if (index === selectedAutocompleteIndex) {
      item.classList.add('link-dialog-autocomplete-item-highlighted');
      item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } else {
      item.classList.remove('link-dialog-autocomplete-item-highlighted');
    }
  });
}

export function updateAutocompleteDropdown(
  dropdown: HTMLElement,
  results: (FileSearchResult | HeadingResult)[],
  urlInput: HTMLInputElement,
  currentMode: LinkMode
): void {
  dropdown.innerHTML = '';
  selectedAutocompleteIndex = null;

  if (results.length === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.className = 'link-dialog-autocomplete-empty';
    emptyMsg.textContent =
      currentMode === 'file' ? 'No files found' : 'No headings in this document';
    dropdown.appendChild(emptyMsg);
    dropdown.style.display = 'block';
    return;
  }

  results.forEach((result, index) => {
    const item = document.createElement('div');
    item.className = 'link-dialog-autocomplete-item';
    item.setAttribute('role', 'option');
    item.setAttribute('data-index', index.toString());

    if (currentMode === 'file') {
      const fileResult = result as FileSearchResult;
      item.className = 'link-dialog-autocomplete-item link-dialog-autocomplete-item-file';
      item.innerHTML = `
        <div class="link-dialog-autocomplete-content">
          <div class="link-dialog-autocomplete-filename">${escapeHtml(fileResult.filename)}</div>
          <div class="link-dialog-autocomplete-item-path" title="${escapeHtml(fileResult.path)}">${escapeHtml(fileResult.path)}</div>
        </div>
      `;
      item.onclick = () => {
        let normalizedPath = fileResult.path.replace(/\\/g, '/');
        if (
          !normalizedPath.startsWith('./') &&
          !normalizedPath.startsWith('../') &&
          !normalizedPath.startsWith('/') &&
          !normalizedPath.match(/^[A-Za-z]:/)
        ) {
          normalizedPath = './' + normalizedPath;
        }

        actualLinkPath = normalizedPath;
        selectedFilePath = normalizedPath;
        urlInput.value = fileResult.filename;
        const textInput = document.querySelector('#link-text-input') as HTMLInputElement | null;
        if (textInput && !textInput.value.trim()) {
          textInput.value = formatFileLinkLabel(fileResult.filename);
        }

        if (fileResult.filename.toLowerCase().endsWith('.md')) {
          requestFileHeadings(fileResult.path);
        } else {
          closeAutocomplete();
          urlInput.focus();
        }
      };
    } else {
      const headingResult = result as HeadingResult;
      const maxHeadingLength = 60;
      const displayText =
        headingResult.text.length > maxHeadingLength
          ? headingResult.text.substring(0, maxHeadingLength) + '...'
          : headingResult.text;

      item.className = 'link-dialog-autocomplete-item link-dialog-autocomplete-item-heading';
      item.innerHTML = `
        <div class="link-dialog-autocomplete-content">
          <div class="link-dialog-autocomplete-filename" title="${escapeHtml(headingResult.text)}">
            ${escapeHtml(displayText)}<span class="link-dialog-autocomplete-level"> : H${headingResult.level}</span>
          </div>
        </div>
      `;
      item.onclick = () => {
        actualLinkPath = `#${headingResult.slug}`;
        const display =
          headingResult.text.length > 50
            ? headingResult.text.substring(0, 50) + '...'
            : headingResult.text;
        urlInput.value = display;
        const textInput = document.querySelector('#link-text-input') as HTMLInputElement | null;
        if (textInput && !textInput.value) {
          textInput.value = headingResult.text;
        }
        closeAutocomplete();
        urlInput.focus();
      };
    }

    item.onmouseenter = () => {
      selectedAutocompleteIndex = index;
      updateAutocompleteHighlight(dropdown);
    };

    dropdown.appendChild(item);
  });

  dropdown.style.display = 'block';

  if ((dropdown as HTMLElement & { _updatePosition?: () => void })._updatePosition) {
    (dropdown as HTMLElement & { _updatePosition: () => void })._updatePosition();
  }

  updateAutocompleteHighlight(dropdown);
}

// ── Keyboard navigation ─────────────────────────────────────────────

export function handleAutocompleteKeyboard(
  e: KeyboardEvent,
  dropdown: HTMLElement,
  urlInput: HTMLInputElement
): boolean {
  if (!dropdown || dropdown.style.display === 'none') return false;

  const items = dropdown.querySelectorAll('.link-dialog-autocomplete-item');
  if (items.length === 0) return false;

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      selectedAutocompleteIndex =
        selectedAutocompleteIndex === null ? 0 : (selectedAutocompleteIndex + 1) % items.length;
      updateAutocompleteHighlight(dropdown);
      return true;

    case 'ArrowUp':
      e.preventDefault();
      selectedAutocompleteIndex =
        selectedAutocompleteIndex === null || selectedAutocompleteIndex === 0
          ? items.length - 1
          : selectedAutocompleteIndex - 1;
      updateAutocompleteHighlight(dropdown);
      return true;

    case 'Enter':
      if (selectedAutocompleteIndex !== null && selectedAutocompleteIndex < items.length) {
        e.preventDefault();
        (items[selectedAutocompleteIndex] as HTMLElement).click();
        return true;
      }
      return false;

    case 'Escape':
      e.preventDefault();
      closeAutocomplete();
      urlInput.focus();
      return true;

    default:
      return false;
  }
}

// ── Search dispatching ──────────────────────────────────────────────

export function handleFileSearch(query: string): void {
  if (fileSearchDebounceTimer) {
    clearTimeout(fileSearchDebounceTimer);
  }

  const trimmedQuery = query.trim();

  if (trimmedQuery.length < 1) {
    if (autocompleteDropdown) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'link-dialog-autocomplete-empty';
      emptyMsg.textContent = 'Start typing to search files...';
      autocompleteDropdown.innerHTML = '';
      autocompleteDropdown.appendChild(emptyMsg);
      autocompleteDropdown.style.display = 'block';
    }
    return;
  }

  fileSearchDebounceTimer = setTimeout(() => {
    const requestId = ++fileSearchRequestId;
    const vscode = (window as any).vscode;
    if (vscode && typeof vscode.postMessage === 'function') {
      devLog('[DK-AI] Sending file search request:', {
        query: trimmedQuery,
        requestId,
      });
      vscode.postMessage({
        type: MessageType.SEARCH_FILES,
        query: trimmedQuery,
        requestId,
      });
    } else {
      console.warn('[DK-AI] vscode API not available for file search');
    }
  }, 300);
}

export function handleHeadingExtraction(
  editor: Editor,
  query: string,
  urlInput: HTMLInputElement,
  currentMode: LinkMode
): void {
  try {
    const outline = buildOutlineFromEditor(editor);
    const existingSlugs = new Set<string>();
    const headingResults: HeadingResult[] = outline.map(entry => ({
      text: entry.text,
      level: entry.level,
      slug: generateHeadingSlug(entry.text, existingSlugs),
    }));

    const filtered = query.trim()
      ? headingResults.filter(
          h =>
            h.text.toLowerCase().includes(query.toLowerCase()) ||
            h.slug.toLowerCase().includes(query.toLowerCase())
        )
      : headingResults;

    const limited = filtered.slice(0, 20);

    if (autocompleteDropdown) {
      updateAutocompleteDropdown(autocompleteDropdown, limited, urlInput, currentMode);
    }
  } catch (error) {
    console.error('[DK-AI] Failed to extract headings', error);
    closeAutocomplete();
  }
}

export function requestFileHeadings(filePath: string): void {
  const requestId = ++pendingFileHeadingsRequestId;
  const vscode = (window as any).vscode;
  if (vscode && typeof vscode.postMessage === 'function') {
    if (autocompleteDropdown) {
      autocompleteDropdown.innerHTML = '';
      const loadingMsg = document.createElement('div');
      loadingMsg.className = 'link-dialog-autocomplete-empty';
      loadingMsg.textContent = 'Loading headings...';
      autocompleteDropdown.appendChild(loadingMsg);
      autocompleteDropdown.style.display = 'block';
    }
    vscode.postMessage({ type: MessageType.GET_FILE_HEADINGS, filePath, requestId });
  }
}

// ── Cleanup ─────────────────────────────────────────────────────────

export function clearFileSearchTimer(): void {
  if (fileSearchDebounceTimer) {
    clearTimeout(fileSearchDebounceTimer);
    fileSearchDebounceTimer = null;
  }
}

export function resetAutocompleteState(): void {
  clearFileSearchTimer();
  closeAutocomplete();
  actualLinkPath = null;
  selectedFilePath = null;
}
