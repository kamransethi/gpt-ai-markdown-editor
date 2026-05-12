/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

/**
 * @file spellchecker.worker.ts
 *
 * Web Worker that owns nspell entirely off the main thread.
 *
 * Inbound messages:
 *   { type: 'INIT', aff: string, dic: string, userWords: string[] }
 *   { type: 'CHECK', id: string, fragments: Array<{ key: string; text: string }> }
 *   { type: 'UPDATE_USER_WORDS', userWords: string[] }
 *
 * Outbound messages:
 *   { type: 'READY' }
 *   { type: 'RESULTS', id: string, results: Array<{ key: string; errors: SpellError[] }> }
 *
 * SpellError: { word: string; from: number; to: number; suggestions: string[] }
 */

// nspell is CommonJS; the worker bundle is built by esbuild which handles the interop.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nspell = require('nspell') as (aff: string, dic: string) => NSpell;

interface NSpell {
  correct: (word: string) => boolean;
  suggest: (word: string) => string[];
  add: (word: string) => void;
}

export interface SpellError {
  word: string;
  from: number;
  to: number;
  suggestions: string[];
}

// ── Word segmenter ────────────────────────────────────────────────────────────

const segmenter = new Intl.Segmenter('en', { granularity: 'word' });

// ── State ─────────────────────────────────────────────────────────────────────

let spell: NSpell | null = null;
let userWords: string[] = [];

// ── Helpers ───────────────────────────────────────────────────────────────────

function applyUserWords(s: NSpell, words: string[]): void {
  for (const w of words) {
    const trimmed = w.trim();
    if (trimmed) s.add(trimmed);
  }
}

function checkText(text: string): SpellError[] {
  if (!spell) return [];
  const errors: SpellError[] = [];
  for (const seg of segmenter.segment(text)) {
    if (!seg.isWordLike) continue;
    const word = seg.segment;
    // Skip pure numbers and single characters
    if (word.length <= 1 || /^\d+$/.test(word)) continue;
    if (spell.correct(word)) continue;
    errors.push({
      word,
      from: seg.index,
      to: seg.index + word.length,
      suggestions: spell.suggest(word).slice(0, 3),
    });
  }
  return errors;
}

// ── Message handler ───────────────────────────────────────────────────────────

self.addEventListener('message', (event: MessageEvent) => {
  const msg = event.data as Record<string, unknown>;

  switch (msg.type) {
    case 'INIT': {
      const aff = msg.aff as string;
      const dic = msg.dic as string;
      userWords = (msg.userWords as string[]) ?? [];
      spell = nspell(aff, dic);
      applyUserWords(spell, userWords);
      self.postMessage({ type: 'READY' });
      break;
    }

    case 'CHECK': {
      const id = msg.id as string;
      const fragments = msg.fragments as Array<{ key: string; text: string }>;
      const results = fragments.map(({ key, text }) => ({
        key,
        errors: checkText(text),
      }));
      self.postMessage({ type: 'RESULTS', id, results });
      break;
    }

    case 'UPDATE_USER_WORDS': {
      userWords = (msg.userWords as string[]) ?? [];
      if (spell) {
        applyUserWords(spell, userWords);
      }
      break;
    }

    default:
      break;
  }
});
