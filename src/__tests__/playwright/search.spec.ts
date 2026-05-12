/**
 * Search & Replace — Playwright spec
 *
 * Tests the SearchAndReplace extension's built-in overlay UI.
 * The extension creates a .search-replace-overlay div on first use.
 *
 * Run smoke tests only: npx playwright test search.spec.ts --project smoke
 * Run all:              npx playwright test search.spec.ts
 */

import { test, expect } from '@playwright/test';
import {
  FULL_HARNESS_URL,
  waitForEditor,
  setContent,
  runEditorCommand,
} from './helpers/index';

const SAMPLE_MD = `Hello world. Hello again. Say hello.\n\nAnother paragraph here.\n`;

test.describe('Search & Replace', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FULL_HARNESS_URL);
    await waitForEditor(page);
    await setContent(page, SAMPLE_MD);
  });

  // Overlay selectors (built by SearchAndReplace extension)
  const OVERLAY = '.search-replace-overlay';
  const SEARCH_INPUT = '.search-replace-overlay input[data-role="search"]';
  const REPLACE_INPUT = '.search-replace-overlay input[data-role="replace"]';
  const BTN_PREV = '.search-replace-overlay [data-action="prev"]';
  const BTN_NEXT = '.search-replace-overlay [data-action="next"]';
  const BTN_CASE = '.search-replace-overlay [data-action="case"]';
  const BTN_REPLACE = '.search-replace-overlay [data-action="replace"]';
  const BTN_REPLACE_ALL = '.search-replace-overlay [data-action="replaceAll"]';
  const BTN_CLOSE = '.search-replace-overlay [data-action="close"]';
  const COUNTER = '.search-replace-overlay .search-replace-counter';

  // ---------------------------------------------------------------------------
  // Open / close
  // ---------------------------------------------------------------------------

  test('search overlay opens via Ctrl+F @smoke', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.press('Control+f');
    await expect(page.locator(OVERLAY)).toBeVisible({ timeout: 3000 });
  });

  test('search overlay opens via toolbar search button', async ({ page }) => {
    await runEditorCommand(page, 'openSearchAndReplace');
    await expect(page.locator(OVERLAY)).toBeVisible({ timeout: 3000 });
  });

  test('Escape closes search overlay', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.press('Control+f');
    await expect(page.locator(OVERLAY)).toBeVisible({ timeout: 3000 });
    await page.keyboard.press('Escape');
    await expect(page.locator(OVERLAY)).toBeHidden({ timeout: 2000 });
  });

  test('close button hides overlay', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.press('Control+f');
    await expect(page.locator(OVERLAY)).toBeVisible({ timeout: 3000 });
    await page.locator(BTN_CLOSE).click();
    await expect(page.locator(OVERLAY)).toBeHidden({ timeout: 2000 });
  });

  // ---------------------------------------------------------------------------
  // Search highlighting
  // ---------------------------------------------------------------------------

  test('query highlights all instances in DOM @smoke', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.press('Control+f');
    await page.locator(SEARCH_INPUT).fill('hello');
    await page.waitForTimeout(200); // Let the plugin update decorations
    // All three "hello" occurrences should be decorated
    const highlights = page.locator('.ProseMirror .search-result');
    await expect(highlights).toHaveCount(3);
  });

  test('match counter shows correct number', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.press('Control+f');
    await page.locator(SEARCH_INPUT).fill('hello');
    await page.waitForTimeout(200);
    const counterText = await page.locator(COUNTER).textContent();
    expect(counterText).toContain('3');
  });

  test('next button moves current match highlight', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.press('Control+f');
    await page.locator(SEARCH_INPUT).fill('hello');
    await page.waitForTimeout(150);
    // Get initial current index
    const before = await page.locator(COUNTER).textContent();
    await page.locator(BTN_NEXT).click();
    await page.waitForTimeout(100);
    const after = await page.locator(COUNTER).textContent();
    expect(after).not.toBe(before);
  });

  test('previous button cycles backward', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.press('Control+f');
    await page.locator(SEARCH_INPUT).fill('hello');
    await page.waitForTimeout(150);
    await page.locator(BTN_NEXT).click();
    await page.waitForTimeout(100);
    const after = await page.locator(COUNTER).textContent();
    await page.locator(BTN_PREV).click();
    await page.waitForTimeout(100);
    const prev = await page.locator(COUNTER).textContent();
    expect(prev).not.toBe(after);
  });

  // ---------------------------------------------------------------------------
  // Replace operations
  // ---------------------------------------------------------------------------

  test('replace single — one instance replaced', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.press('Control+f');
    await page.locator(SEARCH_INPUT).fill('hello');
    await page.locator(REPLACE_INPUT).fill('hi');
    await page.waitForTimeout(150);
    await page.locator(BTN_REPLACE).click();
    await page.waitForTimeout(200);
    // Remaining matches should be 2
    const highlights = page.locator('.ProseMirror .search-result');
    // After replace, one fewer result
    const count = await highlights.count();
    expect(count).toBeLessThanOrEqual(2);
  });

  test('replace all — all instances replaced @smoke', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.press('Control+f');
    await page.locator(SEARCH_INPUT).fill('hello');
    await page.locator(REPLACE_INPUT).fill('hey');
    await page.waitForTimeout(150);
    await page.locator(BTN_REPLACE_ALL).click();
    await page.waitForTimeout(200);
    // No highlights should remain
    const highlights = page.locator('.ProseMirror .search-result');
    await expect(highlights).toHaveCount(0);
  });

  // ---------------------------------------------------------------------------
  // Case sensitivity
  // ---------------------------------------------------------------------------

  test('case-insensitive (default) — matches both cases', async ({ page }) => {
    await setContent(page, 'Hello HELLO hello');
    await page.locator('.ProseMirror').click();
    await page.keyboard.press('Control+f');
    await page.locator(SEARCH_INPUT).fill('hello');
    await page.waitForTimeout(200);
    const count = await page.locator('.ProseMirror .search-result').count();
    expect(count).toBe(3);
  });

  test('case-sensitive toggle — only matches exact case', async ({ page }) => {
    await setContent(page, 'Hello HELLO hello');
    await page.locator('.ProseMirror').click();
    await page.keyboard.press('Control+f');
    await page.locator(BTN_CASE).click(); // Enable case-sensitive
    await page.locator(SEARCH_INPUT).fill('hello');
    await page.waitForTimeout(200);
    const count = await page.locator('.ProseMirror .search-result').count();
    expect(count).toBe(1); // Only lowercase "hello"
  });

  // ---------------------------------------------------------------------------
  // Empty query
  // ---------------------------------------------------------------------------

  test('empty query — no highlights, no errors', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.press('Control+f');
    await page.locator(SEARCH_INPUT).fill('');
    await page.waitForTimeout(150);
    const highlights = page.locator('.ProseMirror .search-result');
    await expect(highlights).toHaveCount(0);
    // No console errors
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    expect(errors.length).toBe(0);
  });
});
