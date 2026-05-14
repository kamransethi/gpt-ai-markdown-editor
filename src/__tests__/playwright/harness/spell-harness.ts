/**
 * Spell Check Test Harness for Playwright Component Tests
 *
 * Initializes a TipTap editor with the SpellCheck extension and exposes
 * a minimal API on `window.spellAPI` for Playwright to drive without any
 * VS Code dependency.
 *
 * The harness HTML sets:
 *   window.SPELLCHECK_WORKER_URL  — served from /dist/spellcheck-worker.js
 *   window.SPELL_AFF_URL          — /resources/dictionaries/en-US.aff
 *   window.SPELL_DIC_URL          — /resources/dictionaries/en-US.dic
 *
 * Exposed API:
 *   window.spellAPI.isReady(): boolean             — editor initialised
 *   window.spellAPI.isWorkerReady(): boolean       — nspell dictionary loaded
 *   window.spellAPI.setMarkdown(md: string): void  — replace editor content
 *   window.spellAPI.insertText(text: string): void — insert at cursor
 *   window.spellAPI.getSpellErrorWords(): string[] — words with decorations
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { SpellCheck, initSpellCheck, spellCheckKey } from '../../../webview/extensions/spellCheck';

// ── Editor ────────────────────────────────────────────────────────────────────

const mountEl = document.getElementById('editor')!;

const editor = new Editor({
  element: mountEl,
  extensions: [
    StarterKit,
    Markdown.configure({ markedOptions: { gfm: true, breaks: true } }),
    SpellCheck,
  ],
  content: '',
});

// ── Kick off spell check initialisation ──────────────────────────────────────

const affUrl = (window as any).SPELL_AFF_URL as string;
const dicUrl = (window as any).SPELL_DIC_URL as string;

// initSpellCheck fetches aff/dic then posts INIT to the worker.
// The worker replies READY, which sets workerReady=true in plugin state
// and triggers the initial chunked document scan.
void initSpellCheck({ affUrl, dicUrl, userWords: [] });

// ── Public API ────────────────────────────────────────────────────────────────

(window as any).spellAPI = {
  /** True once the TipTap editor has been created. */
  isReady(): boolean {
    return !editor.isDestroyed;
  },

  /**
   * True once the worker has loaded the dictionary and replied READY.
   * After this point any doc change triggers a spell-check round-trip.
   */
  isWorkerReady(): boolean {
    const state = spellCheckKey.getState(editor.state);
    return state?.workerReady ?? false;
  },

  /** Replace the entire editor content with the supplied markdown. */
  setMarkdown(md: string): void {
    editor.commands.setContent(md, { contentType: 'markdown' } as any);
  },

  /** Insert text at the current cursor position. */
  insertText(text: string): void {
    editor.commands.insertContent(text);
  },

  /**
   * Return the word strings currently decorated as spell errors.
   * Reads directly from the ProseMirror plugin state — no DOM scraping.
   */
  getSpellErrorWords(): string[] {
    const state = spellCheckKey.getState(editor.state);
    if (!state) return [];
    return state.decorations
      .find()
      .map(d => (d.spec as { word?: string }).word ?? '')
      .filter(Boolean);
  },
};

// Signal to the page shell that the harness is ready
document.dispatchEvent(new CustomEvent('spell-harness-ready'));
