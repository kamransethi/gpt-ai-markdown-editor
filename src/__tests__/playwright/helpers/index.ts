/**
 * Shared Playwright test helpers for the full-editor harness.
 *
 * All spec files that use full-editor.html should import from here.
 */

import type { Page } from '@playwright/test';

/** URL of the full-featured test harness (all production extensions). */
export const FULL_HARNESS_URL =
  '/src/__tests__/playwright/harness/full-editor.html';

/** URL of the minimal table/list harness (legacy — used by table-bullets.spec.ts). */
export const TABLE_HARNESS_URL =
  '/src/__tests__/playwright/harness/index.html';

/** URL of the spell-check harness (used by spell-check.spec.ts). */
export const SPELL_HARNESS_URL =
  '/src/__tests__/playwright/harness/spell-harness.html';

// ---------------------------------------------------------------------------
// Editor lifecycle
// ---------------------------------------------------------------------------

/**
 * Wait for the full-editor harness to signal readiness.
 *
 * Polls `window.editorAPI.isReady()` with a configurable timeout.
 * Throws if the editor does not become ready within the timeout.
 */
export async function waitForEditor(page: Page, timeout = 15_000): Promise<void> {
  await page.waitForFunction(
    () =>
      typeof (window as any).editorAPI?.isReady === 'function' &&
      (window as any).editorAPI.isReady(),
    { timeout }
  );
}

/**
 * Set the editor content to the given markdown string and wait for
 * the DOM to update.
 */
export async function setContent(page: Page, md: string): Promise<void> {
  await page.evaluate((markdown: string) => {
    (window as any).editorAPI.setMarkdown(markdown);
  }, md);
  // Give ProseMirror one render tick to update the DOM
  await page.waitForTimeout(50);
}

/**
 * Return the current editor content as a markdown string.
 */
export async function getContent(page: Page): Promise<string> {
  return page.evaluate(() => (window as any).editorAPI.getMarkdown() as string);
}

// ---------------------------------------------------------------------------
// Mark / state queries
// ---------------------------------------------------------------------------

/**
 * Return the list of active mark/node names at the current cursor position.
 * Example: ['bold', 'italic', 'heading1']
 */
export async function getActiveMarks(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as any).editorAPI.getActiveMarks() as string[]);
}

// ---------------------------------------------------------------------------
// Command execution
// ---------------------------------------------------------------------------

/**
 * Execute a TipTap command by name with optional arguments.
 * Equivalent to `editor.commands[name](...args)`.
 */
export async function runEditorCommand(
  page: Page,
  name: string,
  ...args: unknown[]
): Promise<boolean> {
  return page.evaluate(
    ([cmdName, cmdArgs]: [string, unknown[]]) =>
      (window as any).editorAPI.runCommand(cmdName, ...cmdArgs) as boolean,
    [name, args] as [string, unknown[]]
  );
}

// ---------------------------------------------------------------------------
// Context-menu helpers
// ---------------------------------------------------------------------------

/**
 * Wait for a custom context menu to appear in the DOM.
 * The menu element should have the CSS class `.context-menu` or `.table-context-menu`.
 */
export async function waitForContextMenu(
  page: Page,
  selector = '.context-menu, .table-context-menu, .search-replace-overlay',
  timeout = 5_000
): Promise<void> {
  await page.waitForSelector(selector, { state: 'visible', timeout });
}

/**
 * Click a context-menu item by its visible label text.
 *
 * @param page - Playwright page
 * @param label - Exact or partial text of the menu item
 * @param menuSelector - CSS selector for the menu container
 */
export async function clickContextMenuItem(
  page: Page,
  label: string,
  menuSelector = '.context-menu, .table-context-menu'
): Promise<void> {
  await page.locator(`${menuSelector} li, ${menuSelector} [role=menuitem]`).filter({ hasText: label }).first().click();
}
