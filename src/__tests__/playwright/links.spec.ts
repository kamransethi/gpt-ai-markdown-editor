/**
 * Links — Playwright spec
 *
 * Tests link insertion, autocomplete, and dialog interactions.
 *
 * Run smoke tests only: npx playwright test links.spec.ts --project smoke
 * Run all:              npx playwright test links.spec.ts
 */

import { test, expect } from '@playwright/test';
import {
  FULL_HARNESS_URL,
  waitForEditor,
  setContent,
  getContent,
  runEditorCommand,
} from './helpers/index';

test.describe('Links', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FULL_HARNESS_URL);
    await waitForEditor(page);
    await setContent(page, '');
  });

  // ---------------------------------------------------------------------------
  // Link dialog via command
  // ---------------------------------------------------------------------------

  test('runCommand openLinkDialog does not crash @smoke', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('Click here');
    await page.keyboard.press('Control+a');
    // The link toolbar button calls window.editorAPI.openLinkDialog?.()
    // Test that it doesn't throw
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.locator('[data-testid="toolbar-link"]').click();
    await page.waitForTimeout(300);
    expect(errors.filter(e => !e.includes('ResizeObserver'))).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // Insert link via markdown
  // ---------------------------------------------------------------------------

  test('markdown link syntax renders <a> element @smoke', async ({ page }) => {
    await setContent(page, '[GitHub](https://github.com)\n');
    await expect(page.locator('.ProseMirror a[href]')).toBeVisible();
    await expect(page.locator('.ProseMirror a')).toHaveText('GitHub');
  });

  test('link has .markdown-link CSS class', async ({ page }) => {
    await setContent(page, '[GitHub](https://github.com)\n');
    await expect(page.locator('.ProseMirror .markdown-link')).toBeVisible();
  });

  test('link with internal file path renders correctly', async ({ page }) => {
    await setContent(page, '[Docs](./README.md)\n');
    const link = page.locator('.ProseMirror a');
    await expect(link).toBeVisible();
    const href = await link.getAttribute('href');
    expect(href).toContain('README.md');
  });

  // ---------------------------------------------------------------------------
  // Roundtrip
  // ---------------------------------------------------------------------------

  test('link roundtrip — setMarkdown with link, getMarkdown returns link', async ({ page }) => {
    const md = '[Click here](https://example.com)\n';
    await setContent(page, md);
    const out = await getContent(page);
    expect(out).toContain('https://example.com');
    expect(out).toContain('Click here');
  });

  // ---------------------------------------------------------------------------
  // Remove link
  // ---------------------------------------------------------------------------

  test('unsetLink removes link mark, keeps text', async ({ page }) => {
    await setContent(page, '[My link](https://example.com)\n');
    // Select the link text
    await page.locator('.ProseMirror a').click();
    await page.keyboard.press('Control+a');
    await runEditorCommand(page, 'unsetLink');
    // Link element should be gone
    await expect(page.locator('.ProseMirror a')).toHaveCount(0);
    // Text should remain
    const content = await getContent(page);
    expect(content).toContain('My link');
  });
});
