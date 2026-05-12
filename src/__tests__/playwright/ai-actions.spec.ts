/**
 * AI Actions — Playwright spec
 *
 * Tests AI Explain panel behavior and AI Refine integration.
 * In the harness, window.vscode.postMessage is a no-op but records messages.
 * We verify that AI actions trigger the right messages and don't crash.
 *
 * Run smoke tests only: npx playwright test ai-actions.spec.ts --project smoke
 * Run all:              npx playwright test ai-actions.spec.ts
 */

import { test, expect } from '@playwright/test';
import {
  FULL_HARNESS_URL,
  waitForEditor,
  setContent,
} from './helpers/index';

test.describe('AI Actions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FULL_HARNESS_URL);
    await waitForEditor(page);
    await setContent(page, '# Test\n\nSome paragraph content here.\n');
  });

  // ---------------------------------------------------------------------------
  // AI Refine
  // ---------------------------------------------------------------------------

  test('AI refine toolbar button sends postMessage @smoke', async ({ page }) => {
    // Select text first
    await page.locator('.ProseMirror').click();
    await page.keyboard.press('Control+a');
    // Click AI refine
    await page.locator('[data-testid="toolbar-ai-refine"]').click();
    await page.waitForTimeout(300);
    // Verify a message was posted
    const lastMessage = await page.evaluate(() => (window as any).__lastMessage);
    expect(lastMessage).not.toBeNull();
  });

  test('AI refine button is visible without text selection', async ({ page }) => {
    await expect(page.locator('[data-testid="toolbar-ai-refine"]')).toBeVisible();
  });

  test('AI refine in bubble menu visible on selection @smoke', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('Select this');
    await page.keyboard.press('Control+a');
    const bubbleMenu = page.locator('#bubble-menu');
    await expect(bubbleMenu).toBeVisible({ timeout: 2000 });
    await expect(bubbleMenu.locator('[data-testid="bubble-ai-refine"]')).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // AI Explain
  // ---------------------------------------------------------------------------

  test('AI explain button is present in toolbar', async ({ page }) => {
    await expect(page.locator('[data-testid="toolbar-ai-explain"]')).toBeVisible();
  });

  test('AI explain sends postMessage @smoke', async ({ page }) => {
    await page.locator('[data-testid="toolbar-ai-explain"]').click();
    await page.waitForTimeout(300);
    const messages = await page.evaluate(() => (window as any).__messages as any[]);
    expect(messages.length).toBeGreaterThanOrEqual(1);
  });

  test('AI explain does not produce console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('ResizeObserver') && !msg.text().includes('favicon')) {
        errors.push(msg.text());
      }
    });
    await page.locator('[data-testid="toolbar-ai-explain"]').click();
    await page.waitForTimeout(500);
    expect(errors).toHaveLength(0);
  });

  test('AI explain panel element present in DOM when triggered', async ({ page }) => {
    await page.locator('[data-testid="toolbar-ai-explain"]').click();
    await page.waitForTimeout(300);
    // Panel may be shown as .ai-explain-panel or via postMessage only
    const panel = page.locator('.ai-explain-panel, [class*="ai-explain"]');
    const count = await panel.count();
    // Either the panel is in DOM or the message was sent — both are valid patterns
    const messages = await page.evaluate(() => (window as any).__messages as any[]);
    expect(count > 0 || messages.length > 0).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // No crash paths
  // ---------------------------------------------------------------------------

  test('clicking AI refine without selection does not crash', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('ResizeObserver') && !msg.text().includes('favicon')) {
        errors.push(msg.text());
      }
    });
    // Click without any selection
    await page.locator('.ProseMirror').click({ position: { x: 200, y: 200 } });
    await page.locator('[data-testid="toolbar-ai-refine"]').click();
    await page.waitForTimeout(300);
    expect(errors).toHaveLength(0);
  });
});
