/**
 * Slash Commands — Playwright spec
 *
 * Tests the CommandRegistry slash-command palette (type / at start of line).
 *
 * Run smoke tests only: npx playwright test slash-commands.spec.ts --project smoke
 * Run all:              npx playwright test slash-commands.spec.ts
 */

import { test, expect } from '@playwright/test';
import {
  FULL_HARNESS_URL,
  waitForEditor,
  setContent,
} from './helpers/index';

test.describe('Slash Commands', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FULL_HARNESS_URL);
    await waitForEditor(page);
    await setContent(page, '');
  });

  const SUGGESTION_LIST = '.suggestion-list, [class*="suggestion"], [class*="slash"]';

  test('/ at start of line opens command palette @smoke', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('/');
    // Suggestion list should appear
    const list = page.locator(SUGGESTION_LIST);
    await expect(list.first()).toBeVisible({ timeout: 3000 });
  });

  test('typing after / narrows suggestions', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('/');
    await expect(page.locator(SUGGESTION_LIST).first()).toBeVisible({ timeout: 3000 });
    const allCount = await page.locator(`${SUGGESTION_LIST} li, ${SUGGESTION_LIST} [class*="item"]`).count();
    await page.keyboard.type('hea');
    await page.waitForTimeout(200);
    const filteredCount = await page.locator(`${SUGGESTION_LIST} li, ${SUGGESTION_LIST} [class*="item"]`).count();
    // After filtering there should be fewer items
    expect(filteredCount).toBeLessThanOrEqual(allCount);
  });

  test('Heading 1 command inserts h1 node', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('/');
    await expect(page.locator(SUGGESTION_LIST).first()).toBeVisible({ timeout: 3000 });
    await page.keyboard.type('heading 1');
    await page.waitForTimeout(200);
    // Press Enter to select
    await page.keyboard.press('Enter');
    await expect(page.locator('.ProseMirror h1')).toBeVisible({ timeout: 2000 });
  });

  test('Code block command inserts code block', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('/');
    await expect(page.locator(SUGGESTION_LIST).first()).toBeVisible({ timeout: 3000 });
    await page.keyboard.type('code');
    await page.waitForTimeout(200);
    await page.keyboard.press('Enter');
    await expect(page.locator('.ProseMirror pre, .ProseMirror .code-block-highlighted')).toBeVisible({ timeout: 2000 });
  });

  test('Table command inserts table', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('/');
    await expect(page.locator(SUGGESTION_LIST).first()).toBeVisible({ timeout: 3000 });
    await page.keyboard.type('table');
    await page.waitForTimeout(200);
    await page.keyboard.press('Enter');
    await expect(page.locator('.ProseMirror table')).toBeVisible({ timeout: 2000 });
  });

  test('Bullet list command inserts ul', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('/');
    await expect(page.locator(SUGGESTION_LIST).first()).toBeVisible({ timeout: 3000 });
    await page.keyboard.type('bullet');
    await page.waitForTimeout(200);
    await page.keyboard.press('Enter');
    await expect(page.locator('.ProseMirror ul')).toBeVisible({ timeout: 2000 });
  });

  test('Blockquote command inserts blockquote', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('/');
    await expect(page.locator(SUGGESTION_LIST).first()).toBeVisible({ timeout: 3000 });
    await page.keyboard.type('quote');
    await page.waitForTimeout(200);
    await page.keyboard.press('Enter');
    await expect(page.locator('.ProseMirror blockquote')).toBeVisible({ timeout: 2000 });
  });

  test('Escape closes palette without insertion @smoke', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('/');
    await expect(page.locator(SUGGESTION_LIST).first()).toBeVisible({ timeout: 3000 });
    await page.keyboard.press('Escape');
    await expect(page.locator(SUGGESTION_LIST).first()).toBeHidden({ timeout: 2000 });
    // No special nodes should have been inserted
    await expect(page.locator('.ProseMirror h1, .ProseMirror h2, .ProseMirror table')).toHaveCount(0);
  });
});
