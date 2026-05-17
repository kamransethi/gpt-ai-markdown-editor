/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

/**
 * @file spellCheck.ts
 *
 * TipTap extension + ProseMirror plugin for offline spell checking.
 *
 * Architecture:
 * - A Web Worker (spellchecker.worker.ts) runs nspell off the main thread.
 * - This plugin manages a Decoration set of inline .spell-error spans.
 * - On SPELL_INIT the host provides affUrl/dicUrl/userWords → worker INIT'd → READY.
 * - After READY a full-document chunked scan runs (50 paragraphs / batch).
 * - On each editor update we re-check the changed paragraph(s).
 * - Suggestions are pre-computed in the worker and stored in decoration metadata.
 *
 * No-scan zones (text is skipped):
 *   codeBlock, code (inline), image, hardBreak, horizontalRule,
 *   frontmatterBlock, mermaidBlock
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Node as PmNode } from '@tiptap/pm/model';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SpellError {
  word: string;
  from: number;
  to: number;
  suggestions: string[];
}

interface WorkerResult {
  key: string;
  errors: SpellError[];
}

interface WorkerResultsMessage {
  type: 'RESULTS';
  id: string;
  results: WorkerResult[];
}

type WorkerMessage = { type: 'READY' } | WorkerResultsMessage;

// ── Constants ─────────────────────────────────────────────────────────────────

/** Node types whose text content must never be spell-checked. */
const NO_SCAN_TYPES = new Set([
  'codeBlock',
  'code',
  'image',
  'hardBreak',
  'horizontalRule',
  // Frontmatter / Mermaid node types used in this editor
  'frontmatterBlock',
  'mermaidBlock',
  'drawioBlock',
]);

/** Chunk size for the initial full-document scan. */
const INITIAL_SCAN_CHUNK = 50;

// ── Smart-quote normalisation ─────────────────────────────────────────────────

/**
 * Replace curly apostrophes / right single quotes with straight ASCII apostrophe.
 * This prevents "don\u2019t" from being flagged as two tokens ("don" + "t").
 * Exported for unit testing.
 */
export function normaliseQuotes(text: string): string {
  return text.replace(/[\u2018\u2019]/g, "'");
}

/**
 * Mask URLs and bare email addresses with equal-length whitespace so that the
 * word segmenter sees them as whitespace gaps, not individual words.
 *
 * We use a simple regex rather than a URL parser so we stay dependency-free here.
 * Exported for unit testing.
 */
export function maskUrls(text: string): string {
  // Match http(s)/ftp URLs and bare www.* patterns
  return text.replace(/https?:\/\/\S+|ftp:\/\/\S+|www\.\S+|\S+@\S+\.\S+/gi, m =>
    ' '.repeat(m.length)
  );
}

/** Exported for unit testing. */
export function prepareText(raw: string): string {
  return maskUrls(normaliseQuotes(raw));
}

// ── Fragment helpers ──────────────────────────────────────────────────────────

interface Fragment {
  /** Unique key identifying the paragraph/leaf node position. */
  key: string;
  /** The prepared text to send to the worker. */
  text: string;
  /** Absolute document position of the start of the text (for decoration mapping). */
  docFrom: number;
}

/** Exported for unit testing. */
export function isNoScanNode(node: PmNode): boolean {
  return NO_SCAN_TYPES.has(node.type.name);
}

/**
 * Walk all text-bearing leaf descendants of `doc`, skipping no-scan zones,
 * and collect fragments for the worker.
 *
 * We use the node's absolute position as the unique key so we can map errors
 * back to document positions without any secondary lookup.
 */
function collectFragments(doc: PmNode, fromPos = 0, toPos = doc.content.size): Fragment[] {
  const frags: Fragment[] = [];

  doc.nodesBetween(fromPos, toPos, (node, pos) => {
    // Skip subtrees for no-scan node types
    if (isNoScanNode(node)) return false;

    if (node.isText) {
      // Skip text nodes that have an inline-code mark applied
      if (node.marks.some(m => m.type.name === 'code')) return;
      const text = node.text ?? '';
      frags.push({
        key: String(pos),
        text: prepareText(text),
        docFrom: pos,
      });
    }

    // Continue traversal into children
    return true;
  });

  return frags;
}

// ── Plugin state ──────────────────────────────────────────────────────────────

interface PluginStateData {
  decorations: DecorationSet;
  /** Whether the worker is ready to accept CHECK messages. */
  workerReady: boolean;
}

// ── Plugin key (exported so context menu can access state) ────────────────────

export const spellCheckKey = new PluginKey<PluginStateData>('spellCheck');

// ── Singleton worker ──────────────────────────────────────────────────────────

let worker: Worker | null = null;
const pendingCallbacks = new Map<string, (results: WorkerResult[]) => void>();
let reqIdCounter = 0;
let editorViewRef: import('@tiptap/pm/view').EditorView | null = null;

async function getOrCreateWorker(): Promise<Worker | null> {
  if (worker) return worker;

  const workerUrl = (window as any).SPELLCHECK_WORKER_URL as string | undefined;
  if (!workerUrl) {
    console.warn('[SpellCheck] SPELLCHECK_WORKER_URL not set — spell check disabled');
    return null;
  }

  try {
    // Try direct Worker creation first (works in standalone browser)
    worker = new Worker(workerUrl, { type: 'module' });
  } catch {
    try {
      // Fallback: fetch script as blob and create Worker from blob URL
      // This bypasses CORS issues in VS Code webviews
      const response = await fetch(workerUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      worker = new Worker(blobUrl);
    } catch (e2) {
      console.error('[SpellCheck] Failed to create worker (tried direct and blob):', e2);
      return null;
    }
  }

  worker.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
    const msg = event.data;

    if (msg.type === 'READY') {
      // Mark plugin as ready and kick off initial full-document scan
      if (editorViewRef) {
        const { state } = editorViewRef;
        const tr = state.tr.setMeta(spellCheckKey, { workerReady: true });
        editorViewRef.dispatch(tr);
        scheduleInitialScan(editorViewRef);
      }
      return;
    }

    if (msg.type === 'RESULTS') {
      const cb = pendingCallbacks.get(msg.id);
      if (cb) {
        pendingCallbacks.delete(msg.id);
        cb(msg.results);
      }
    }
  });

  worker.addEventListener('error', err => {
    console.error('[SpellCheck] Worker error:', err);
  });

  return worker;
}

function postToWorker(message: unknown): void {
  // Use a fire-and-forget approach for async worker creation
  void getOrCreateWorker().then(w => {
    if (w) w.postMessage(message);
  });
}

// ── Initial scan (chunked) ────────────────────────────────────────────────────

function scheduleInitialScan(view: import('@tiptap/pm/view').EditorView): void {
  const { doc } = view.state;
  const frags = collectFragments(doc);
  let offset = 0;

  function processChunk(): void {
    if (offset >= frags.length) return;
    const chunk = frags.slice(offset, offset + INITIAL_SCAN_CHUNK);
    offset += INITIAL_SCAN_CHUNK;
    checkFragments(view, chunk);
    if (offset < frags.length) {
      setTimeout(processChunk, 0);
    }
  }

  setTimeout(processChunk, 0);
}

// ── Check helpers ─────────────────────────────────────────────────────────────

function checkFragments(_view: import('@tiptap/pm/view').EditorView, frags: Fragment[]): void {
  if (frags.length === 0) return;

  const id = String(++reqIdCounter);
  const payload = frags.map(f => ({ key: f.key, text: f.text }));

  pendingCallbacks.set(id, (results: WorkerResult[]) => {
    if (!editorViewRef) return;

    const newDecorations: Decoration[] = [];

    for (const { key, errors } of results) {
      const frag = frags.find(f => f.key === key);
      if (!frag) continue;

      for (const err of errors) {
        const from = frag.docFrom + err.from;
        const to = frag.docFrom + err.to;
        // Skip if the positions are out of bounds (doc may have changed)
        if (from < 0 || to > (editorViewRef?.state.doc.content.size ?? 0)) continue;
        newDecorations.push(
          Decoration.inline(
            from,
            to,
            { class: 'spell-error' },
            { word: err.word, suggestions: err.suggestions }
          )
        );
      }
    }

    if (!editorViewRef) return;
    const { state } = editorViewRef;
    const current = spellCheckKey.getState(state);
    if (!current) return;

    // Keep decorations that are NOT in the checked position ranges, add fresh ones
    const checkedRanges = frags.map(f => ({
      start: f.docFrom,
      end: f.docFrom + f.text.length + 50,
    }));
    const surviving = current.decorations.find().filter(d => {
      return !checkedRanges.some(r => d.from >= r.start && d.to <= r.end);
    });

    const nextSet = DecorationSet.create(state.doc, [...surviving, ...newDecorations]);
    const tr = state.tr.setMeta(spellCheckKey, { decorations: nextSet });
    editorViewRef.dispatch(tr);
  });

  postToWorker({ type: 'CHECK', id, fragments: payload });
}

// ── Get suggestions at a position (for context menu) ─────────────────────────

export function getSuggestionsAtPos(
  state: EditorState,
  pos: number
): { word: string; suggestions: string[] } | null {
  const pluginState = spellCheckKey.getState(state);
  if (!pluginState) return null;

  const decos = pluginState.decorations.find(pos, pos);
  if (decos.length === 0) return null;

  const spec = decos[0].spec as { word?: string; suggestions?: string[] } | undefined;
  if (!spec?.word) return null;

  return { word: spec.word, suggestions: spec.suggestions ?? [] };
}

// ── ProseMirror plugin ────────────────────────────────────────────────────────

function createSpellCheckPlugin(): Plugin<PluginStateData> {
  return new Plugin<PluginStateData>({
    key: spellCheckKey,

    state: {
      init(): PluginStateData {
        return { decorations: DecorationSet.empty, workerReady: false };
      },

      apply(
        tr: Transaction,
        value: PluginStateData,
        _old: EditorState,
        newState: EditorState
      ): PluginStateData {
        const meta = tr.getMeta(spellCheckKey) as Partial<PluginStateData> | undefined;

        if (meta?.decorations) {
          return { decorations: meta.decorations, workerReady: value.workerReady };
        }

        if (meta?.workerReady) {
          return {
            decorations: value.decorations.map(tr.mapping, newState.doc),
            workerReady: true,
          };
        }

        // Map existing decorations through document changes
        const mapped = value.decorations.map(tr.mapping, newState.doc);
        return { decorations: mapped, workerReady: value.workerReady };
      },
    },

    props: {
      decorations(state: EditorState) {
        return spellCheckKey.getState(state)?.decorations ?? DecorationSet.empty;
      },
    },

    view(view) {
      editorViewRef = view;
      return {
        update(updatedView, prevState) {
          editorViewRef = updatedView;

          const pluginState = spellCheckKey.getState(updatedView.state);
          if (!pluginState?.workerReady) return;
          if (!updatedView.state.doc.eq(prevState.doc)) {
            // Doc changed — re-check the paragraph around the cursor only.
            // For broad changes (paste, etc.) we fall back to full scan via scheduleInitialScan.
            const { from } = updatedView.state.selection;
            const $from = updatedView.state.doc.resolve(from);
            // Find the containing block
            const blockStart = from - $from.parentOffset;
            const blockEnd = blockStart + $from.parent.content.size;
            const changedFrags = collectFragments(
              updatedView.state.doc,
              Math.max(0, blockStart),
              Math.min(updatedView.state.doc.content.size, blockEnd)
            );
            if (changedFrags.length > 0) {
              checkFragments(updatedView, changedFrags);
            } else {
              // Fallback: full re-scan (e.g. after paste of multiple paragraphs)
              scheduleInitialScan(updatedView);
            }
          }
        },
        destroy() {
          editorViewRef = null;
        },
      };
    },
  });
}

// ── Public API — called from editor.ts message handler ───────────────────────

/**
 * Initialize the spell check worker.
 * Called when the webview receives SPELL_INIT from the host.
 */
export async function initSpellCheck(payload: {
  affUrl: string;
  dicUrl: string;
  userWords: string[];
}): Promise<void> {
  const w = await getOrCreateWorker();
  if (!w) return;
  if (!w) return;

  const [affRes, dicRes] = await Promise.all([fetch(payload.affUrl), fetch(payload.dicUrl)]);

  if (!affRes.ok || !dicRes.ok) {
    console.error('[SpellCheck] Failed to fetch dictionary files');
    return;
  }

  const [aff, dic] = await Promise.all([affRes.text(), dicRes.text()]);

  w.postMessage({
    type: 'INIT',
    aff,
    dic,
    userWords: payload.userWords,
  });
}

/**
 * Reload user words after user_dictionary.dic was modified externally.
 * Called when the webview receives SPELL_RELOAD from the host.
 */
export function reloadUserWords(userWords: string[]): void {
  postToWorker({ type: 'UPDATE_USER_WORDS', userWords });
  // Force a re-scan of the full document
  if (editorViewRef) {
    scheduleInitialScan(editorViewRef);
  }
}

// ── TipTap Extension ──────────────────────────────────────────────────────────

export const SpellCheck = Extension.create({
  name: 'spellCheck',

  addProseMirrorPlugins() {
    return [createSpellCheckPlugin()];
  },
});
