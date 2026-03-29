/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 *
 * Search & Replace TipTap extension.
 * Based on tiptap-search-and-replace by Jeet Mandaliya (MIT).
 * Provides decorations, commands, and a built-in overlay UI.
 *
 * @module searchAndReplace
 */

import { Extension, type Range } from '@tiptap/core';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { EditorState, Transaction } from '@tiptap/pm/state';

type PMDispatch = ((tr: Transaction) => void) | undefined;

declare module '@tiptap/core' {
  interface Storage {
    searchAndReplace: SearchAndReplaceStorage;
  }

  interface Commands<ReturnType> {
    searchAndReplace: {
      setSearchTerm: (searchTerm: string) => ReturnType;
      setReplaceTerm: (replaceTerm: string) => ReturnType;
      setCaseSensitive: (caseSensitive: boolean) => ReturnType;
      resetIndex: () => ReturnType;
      nextSearchResult: () => ReturnType;
      previousSearchResult: () => ReturnType;
      replaceCurrentResult: () => ReturnType;
      replaceAllResults: () => ReturnType;
      openSearchAndReplace: () => ReturnType;
      closeSearchAndReplace: () => ReturnType;
    };
  }
}

interface TextNodesWithPosition {
  text: string;
  pos: number;
}

const searchPluginKey = new PluginKey('searchAndReplace');

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function processSearches(
  doc: PMNode,
  searchTerm: string,
  caseSensitive: boolean,
  searchResultClass: string,
  resultIndex: number
): { decorations: DecorationSet; results: Range[] } {
  const decorations: Decoration[] = [];
  const results: Range[] = [];

  if (!searchTerm) {
    return { decorations: DecorationSet.empty, results: [] };
  }

  let regex: RegExp;
  try {
    regex = new RegExp(escapeRegex(searchTerm), caseSensitive ? 'gu' : 'gui');
  } catch {
    return { decorations: DecorationSet.empty, results: [] };
  }

  const textNodes: TextNodesWithPosition[] = [];
  let index = 0;

  doc.descendants((node, pos) => {
    if (node.isText) {
      if (textNodes[index]) {
        textNodes[index] = {
          text: textNodes[index].text + node.text,
          pos: textNodes[index].pos,
        };
      } else {
        textNodes[index] = { text: `${node.text}`, pos };
      }
    } else {
      index += 1;
    }
  });

  for (const entry of textNodes.filter(Boolean)) {
    const { text, pos } = entry;
    const matches = Array.from(text.matchAll(regex)).filter(([m]) => m.trim());

    for (const m of matches) {
      if (m[0] === '' || m.index === undefined) break;
      results.push({ from: pos + m.index, to: pos + m.index + m[0].length });
    }
  }

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const className =
      i === resultIndex ? `${searchResultClass} ${searchResultClass}-current` : searchResultClass;
    decorations.push(Decoration.inline(r.from, r.to, { class: className }));
  }

  return {
    decorations: DecorationSet.create(doc, decorations),
    results,
  };
}

function doReplace(
  replaceTerm: string,
  results: Range[],
  { state, dispatch }: { state: EditorState; dispatch: PMDispatch }
) {
  const first = results[0];
  if (!first) return;
  if (dispatch) dispatch(state.tr.insertText(replaceTerm, first.from, first.to));
}

function doReplaceAll(
  replaceTerm: string,
  results: Range[],
  { tr, dispatch }: { tr: Transaction; dispatch: PMDispatch }
) {
  const copy = results.slice();
  if (!copy.length) return;

  for (let i = 0; i < copy.length; i++) {
    const { from, to } = copy[i];
    tr.insertText(replaceTerm, from, to);
    const sizeDiff = to - from - replaceTerm.length;

    for (let j = i + 1; j < copy.length; j++) {
      copy[j] = { from: copy[j].from - sizeDiff, to: copy[j].to - sizeDiff };
    }
  }
  if (dispatch) {
    dispatch(tr);
  }
}

export interface SearchAndReplaceStorage {
  searchTerm: string;
  replaceTerm: string;
  results: Range[];
  caseSensitive: boolean;
  resultIndex: number;
  lastSearchTerm: string;
  lastCaseSensitive: boolean;
  lastResultIndex: number;
  overlayVisible: boolean;
}

export const SearchAndReplace = Extension.create<
  { searchResultClass: string },
  SearchAndReplaceStorage
>({
  name: 'searchAndReplace',

  addOptions() {
    return { searchResultClass: 'search-result' };
  },

  addStorage() {
    return {
      searchTerm: '',
      replaceTerm: '',
      results: [],
      caseSensitive: false,
      resultIndex: 0,
      lastSearchTerm: '',
      lastCaseSensitive: false,
      lastResultIndex: 0,
      overlayVisible: false,
    };
  },

  addCommands() {
    return {
      setSearchTerm:
        (searchTerm: string) =>
        ({ editor }) => {
          editor.storage.searchAndReplace.searchTerm = searchTerm;
          return false;
        },
      setReplaceTerm:
        (replaceTerm: string) =>
        ({ editor }) => {
          editor.storage.searchAndReplace.replaceTerm = replaceTerm;
          return false;
        },
      setCaseSensitive:
        (caseSensitive: boolean) =>
        ({ editor }) => {
          editor.storage.searchAndReplace.caseSensitive = caseSensitive;
          return false;
        },
      resetIndex:
        () =>
        ({ editor }) => {
          editor.storage.searchAndReplace.resultIndex = 0;
          return false;
        },
      nextSearchResult:
        () =>
        ({ editor }) => {
          const { results, resultIndex } = editor.storage.searchAndReplace;
          editor.storage.searchAndReplace.resultIndex = results.length
            ? (resultIndex + 1) % results.length
            : 0;
          return false;
        },
      previousSearchResult:
        () =>
        ({ editor }) => {
          const { results, resultIndex } = editor.storage.searchAndReplace;
          editor.storage.searchAndReplace.resultIndex = results.length
            ? (resultIndex - 1 + results.length) % results.length
            : 0;
          return false;
        },
      replaceCurrentResult:
        () =>
        ({ editor, state, dispatch }) => {
          const { replaceTerm, results, resultIndex } = editor.storage.searchAndReplace;
          const target = results[resultIndex];
          if (!target) return false;
          doReplace(replaceTerm, [target], { state, dispatch });
          return false;
        },
      replaceAllResults:
        () =>
        ({ editor, tr, dispatch }) => {
          const { replaceTerm, results } = editor.storage.searchAndReplace;
          doReplaceAll(replaceTerm, results, { tr, dispatch });
          return false;
        },
      openSearchAndReplace:
        () =>
        ({ editor }) => {
          editor.storage.searchAndReplace.overlayVisible = true;
          showOverlay(editor);
          return true;
        },
      closeSearchAndReplace:
        () =>
        ({ editor }) => {
          editor.storage.searchAndReplace.overlayVisible = false;
          editor.storage.searchAndReplace.searchTerm = '';
          editor.storage.searchAndReplace.replaceTerm = '';
          editor.storage.searchAndReplace.results = [];
          editor.storage.searchAndReplace.resultIndex = 0;
          hideOverlay();
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-f': () => {
        this.editor.commands.openSearchAndReplace();
        return true;
      },
      'Mod-h': () => {
        this.editor.commands.openSearchAndReplace();
        // Focus replace input after opening
        setTimeout(() => {
          const replaceInput = document.querySelector(
            '.search-replace-overlay input[data-role="replace"]'
          ) as HTMLInputElement | null;
          replaceInput?.focus();
        }, 50);
        return true;
      },
      Escape: () => {
        if (this.editor.storage.searchAndReplace.overlayVisible) {
          this.editor.commands.closeSearchAndReplace();
          return true;
        }
        return false;
      },
    };
  },

  addProseMirrorPlugins() {
    const editor = this.editor;
    const { searchResultClass } = this.options;

    return [
      new Plugin({
        key: searchPluginKey,
        state: {
          init: () => DecorationSet.empty,
          apply(_tr, oldState) {
            const storage = editor.storage.searchAndReplace;
            const {
              searchTerm,
              lastSearchTerm,
              caseSensitive,
              lastCaseSensitive,
              resultIndex,
              lastResultIndex,
            } = storage;

            if (
              lastSearchTerm === searchTerm &&
              lastCaseSensitive === caseSensitive &&
              lastResultIndex === resultIndex &&
              !_tr.docChanged
            ) {
              return oldState;
            }

            storage.lastSearchTerm = searchTerm;
            storage.lastCaseSensitive = caseSensitive;
            storage.lastResultIndex = resultIndex;

            if (!searchTerm) {
              storage.results = [];
              return DecorationSet.empty;
            }

            const { decorations, results } = processSearches(
              _tr.doc,
              searchTerm,
              caseSensitive,
              searchResultClass,
              resultIndex
            );
            storage.results = results;
            updateOverlayCounter(results.length, resultIndex);
            scrollToResult(editor, results, resultIndex);
            return decorations;
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});

// ── Overlay UI ──────────────────────────────────────────

let overlayEl: HTMLElement | null = null;

function scrollToResult(editor: any, results: Range[], index: number) {
  const r = results[index];
  if (!r) return;
  try {
    const view = editor.view;
    const coords = view.coordsAtPos(r.from);
    const top = coords.top + window.scrollY - 120;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  } catch {
    /* ignore if position invalid */
  }
}

function updateOverlayCounter(total: number, index: number) {
  const counter = overlayEl?.querySelector('.search-replace-counter');
  if (counter) {
    counter.textContent = total > 0 ? `${index + 1} of ${total}` : 'No results';
  }
}

function showOverlay(editor: any) {
  if (overlayEl) {
    overlayEl.style.display = 'flex';
    const searchInput = overlayEl.querySelector(
      'input[data-role="search"]'
    ) as HTMLInputElement | null;
    searchInput?.focus();

    // Pre-fill with selection
    const { from, to, empty } = editor.state.selection;
    if (!empty) {
      const selectedText = editor.state.doc.textBetween(from, to, ' ');
      if (selectedText && searchInput) {
        searchInput.value = selectedText;
        editor.commands.setSearchTerm(selectedText);
      }
    }
    return;
  }

  overlayEl = document.createElement('div');
  overlayEl.className = 'search-replace-overlay';

  overlayEl.innerHTML = `
    <div class="search-replace-row">
      <input type="text" data-role="search" placeholder="Search..." spellcheck="false" autocomplete="off" />
      <span class="search-replace-counter">No results</span>
      <button type="button" data-action="prev" title="Previous (Shift+Enter)">&#x2191;</button>
      <button type="button" data-action="next" title="Next (Enter)">&#x2193;</button>
      <button type="button" data-action="case" title="Match case" class="search-replace-case">Aa</button>
      <button type="button" data-action="close" title="Close (Escape)">&times;</button>
    </div>
    <div class="search-replace-row">
      <input type="text" data-role="replace" placeholder="Replace..." spellcheck="false" autocomplete="off" />
      <button type="button" data-action="replace" title="Replace">Replace</button>
      <button type="button" data-action="replaceAll" title="Replace All">All</button>
    </div>
  `;

  document.body.appendChild(overlayEl);

  const searchInput = overlayEl.querySelector('input[data-role="search"]') as HTMLInputElement;
  const replaceInput = overlayEl.querySelector('input[data-role="replace"]') as HTMLInputElement;
  const caseBtn = overlayEl.querySelector('[data-action="case"]') as HTMLButtonElement;

  // Pre-fill with selection
  const { from, to, empty: isEmpty } = editor.state.selection;
  if (!isEmpty) {
    const selectedText = editor.state.doc.textBetween(from, to, ' ');
    if (selectedText) {
      searchInput.value = selectedText;
      editor.commands.setSearchTerm(selectedText);
    }
  }

  searchInput.addEventListener('input', () => {
    editor.commands.resetIndex();
    editor.commands.setSearchTerm(searchInput.value);
  });

  replaceInput.addEventListener('input', () => {
    editor.commands.setReplaceTerm(replaceInput.value);
  });

  searchInput.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        editor.commands.previousSearchResult();
      } else {
        editor.commands.nextSearchResult();
      }
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      editor.commands.closeSearchAndReplace();
    }
  });

  replaceInput.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      editor.commands.closeSearchAndReplace();
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      editor.commands.replaceCurrentResult();
    }
  });

  overlayEl.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const action = target.closest('[data-action]')?.getAttribute('data-action');
    if (!action) return;

    switch (action) {
      case 'prev':
        editor.commands.previousSearchResult();
        break;
      case 'next':
        editor.commands.nextSearchResult();
        break;
      case 'case':
        editor.storage.searchAndReplace.caseSensitive =
          !editor.storage.searchAndReplace.caseSensitive;
        caseBtn.classList.toggle('active', editor.storage.searchAndReplace.caseSensitive);
        editor.commands.resetIndex();
        editor.commands.setSearchTerm(searchInput.value); // re-trigger search
        break;
      case 'replace':
        editor.commands.replaceCurrentResult();
        break;
      case 'replaceAll':
        editor.commands.replaceAllResults();
        break;
      case 'close':
        editor.commands.closeSearchAndReplace();
        break;
    }
  });

  // Prevent toolbar focus stealing
  overlayEl.addEventListener('mousedown', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest('input')) {
      e.preventDefault();
    }
  });

  searchInput.focus();
}

function hideOverlay() {
  if (overlayEl) {
    overlayEl.style.display = 'none';
  }
}

export default SearchAndReplace;
