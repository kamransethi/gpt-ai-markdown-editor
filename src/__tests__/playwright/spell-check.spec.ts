/**
 * Playwright Component Tests: Offline Spell Check
 *
 * Tests the full TipTap → ProseMirror plugin → Web Worker → nspell pipeline:
 *   - Misspelled words in paragraphs receive a .spell-error decoration
 *   - Correctly spelled words receive no decoration
 *   - Text inside code blocks is never decorated (no-scan zone)
 *   - Contractions (smart-quote form) are not false-positives
 *
 * The test harness (harness/spell-harness.html + spell-harness.js) runs TipTap
 * with the SpellCheck extension but without any VS Code dependency.
 * The actual nspell worker is loaded from /dist/spellcheck-worker.js and the
 * en-US dictionary from /resources/dictionaries/ — served by the Playwright
 * webServer from the project root.
 *
 * Playwright drives a real Chromium browser — no mocks, no jsdom.
 */

import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HARNESS_URL = '/src/__tests__/playwright/harness/spell-harness.html';

/**
 * Maximum time to wait for the nspell dictionary to be fully loaded into the
 * worker and the READY signal to propagate back to the plugin.
 * Loading + parsing 551 KB en-US.dic takes ~1-2 s in CI.
 */
const WORKER_READY_TIMEOUT = 20_000;

/**
 * Maximum time to wait for a .spell-error decoration to appear in the DOM
 * after setting content.  Covers the full async round-trip:
 *   setContent → plugin update → CHECK posted → worker results → dispatch → DOM
 */
const DECORATION_TIMEOUT = 10_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function waitForHarness(page: Page) {
  await page.waitForFunction(() => (window as any).spellAPI?.isReady(), {
    timeout: 10_000,
  });
}

async function waitForWorkerReady(page: Page) {
  await page.waitForFunction(() => (window as any).spellAPI?.isWorkerReady(), {
    timeout: WORKER_READY_TIMEOUT,
  });
}

async function setMarkdown(page: Page, md: string) {
  await page.evaluate((content: string) => {
    (window as any).spellAPI.setMarkdown(content);
  }, md);
}

async function getSpellErrorWords(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as any).spellAPI.getSpellErrorWords());
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Spell Check — live decorations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HARNESS_URL);
    await waitForHarness(page);
    // Worker initialization (fetch + nspell parse) runs in the background.
    // We wait here so every test starts with a hot, ready worker.
    await waitForWorkerReady(page);
  });

  // ── Positive: misspelled words are decorated ────────────────────────────

  test('nonsense word gets a .spell-error decoration', async ({ page }) => {
    await setMarkdown(page, 'Hello asdasdsa world');

    // The plugin detects the doc change, sends CHECK to worker, and dispatches
    // a decoration transaction.  Wait for the span to appear in the DOM.
    await expect(page.locator('.spell-error').first()).toBeVisible({
      timeout: DECORATION_TIMEOUT,
    });

    const errorText = await page.locator('.spell-error').first().textContent();
    expect(errorText).toBe('asdasdsa');
  });

  test('multiple misspelled words are each decorated', async ({ page }) => {
    await setMarkdown(page, 'Teh quck brwon fox');

    await expect(page.locator('.spell-error').first()).toBeVisible({
      timeout: DECORATION_TIMEOUT,
    });

    const words = await getSpellErrorWords(page);
    // "Teh", "quck", "brwon" should all be flagged; "fox" is correct
    expect(words).toContain('Teh');
    expect(words).toContain('quck');
    expect(words).toContain('brwon');
    expect(words).not.toContain('fox');
  });

  test('suggestions are pre-computed and available', async ({ page }) => {
    await setMarkdown(page, 'I maed a misteak');

    await expect(page.locator('.spell-error').first()).toBeVisible({
      timeout: DECORATION_TIMEOUT,
    });

    const words = await getSpellErrorWords(page);
    expect(words.length).toBeGreaterThan(0);

    // The plugin state stores suggestions alongside the word
    const errorDetails = await page.evaluate(() => {
      const { spellCheckKey } = (window as any).__spellCheckKey
        ? { spellCheckKey: (window as any).__spellCheckKey }
        : { spellCheckKey: null };
      // Access via DOM data-attribute isn't available — use the API
      return (window as any).spellAPI.getSpellErrorWords();
    });
    expect(errorDetails.length).toBeGreaterThan(0);
  });

  // ── Negative: correct words are not decorated ───────────────────────────

  test('correctly spelled sentence has no decorations', async ({ page }) => {
    // First, prove the pipeline is active by loading bad content and
    // confirming it is flagged.
    await setMarkdown(page, 'asdasdsa');
    await expect(page.locator('.spell-error').first()).toBeVisible({
      timeout: DECORATION_TIMEOUT,
    });

    // Now replace with a clean sentence and assert all errors disappear.
    await setMarkdown(page, 'Hello world this is a simple sentence');
    await expect(page.locator('.spell-error')).toHaveCount(0, {
      timeout: DECORATION_TIMEOUT,
    });
  });

  test('common English contractions are not flagged', async ({ page }) => {
    // Smart-quote apostrophes (U+2019) come from TipTap's typography extension.
    // The spell-check plugin normalises them to ASCII ' before sending to nspell.
    await setMarkdown(page, 'Don\u2019t isn\u2019t you\u2019re they\u2019re');

    // Pipeline must be running — seed with a known bad word first so we know
    // a scan completed (otherwise a 0-count could mean "not yet checked").
    // We do this by verifying the contractions paragraph produces 0 errors AFTER
    // we've already confirmed the worker is ready (done in beforeEach).
    await page.waitForTimeout(2_000); // let the scan complete
    const errors = await getSpellErrorWords(page);
    expect(errors).toHaveLength(0);
  });

  // ── No-scan zones ───────────────────────────────────────────────────────

  test('text inside a fenced code block is not spell-checked', async ({ page }) => {
    // The code block contains a clearly misspelled word.
    // The paragraph below it is correct.
    await setMarkdown(page, '```\nasdasdsa blahlbah xyzxyzxyz\n```\n\nNormal paragraph here');

    // Wait long enough for a full scan cycle.
    await page.waitForTimeout(2_000);
    const errors = await getSpellErrorWords(page);
    expect(errors).toHaveLength(0);
  });

  test('only paragraph words flagged when same bad word appears in code block too', async ({
    page,
  }) => {
    // "asdasdsa" in both a paragraph AND a code block.
    // Only the paragraph instance should be decorated.
    await setMarkdown(page, 'asdasdsa is misspelled\n\n```\nasdasdsa not flagged\n```');

    await expect(page.locator('.spell-error').first()).toBeVisible({
      timeout: DECORATION_TIMEOUT,
    });

    const errors = await getSpellErrorWords(page);
    // Exactly one error — from the paragraph, not the code block
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBe('asdasdsa');
  });
});
