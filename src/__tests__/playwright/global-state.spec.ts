/**
 * Global State — Playwright spec
 *
 * Tests that window.__lastMessage and window.__messages are captured correctly
 * by the no-op vscode mock, that editor state is accessible via editorAPI,
 * and that the editor resets cleanly between content loads.
 *
 * Run smoke tests only: npx playwright test global-state.spec.ts --project smoke
 * Run all:              npx playwright test global-state.spec.ts
 */

import { test, expect } from '@playwright/test';
import {
  FULL_HARNESS_URL,
  waitForEditor,
  setContent,
  getContent,
} from './helpers/index';

test.describe('Global State', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FULL_HARNESS_URL);
    await waitForEditor(page);
  });

  // ---------------------------------------------------------------------------
  // vscode no-op mock
  // ---------------------------------------------------------------------------

  test('window.vscode is defined on load @smoke', async ({ page }) => {
    const defined = await page.evaluate(() => typeof (window as any).vscode !== 'undefined');
    expect(defined).toBe(true);
  });

  test('window.__messages starts as empty array @smoke', async ({ page }) => {
    const msgs = await page.evaluate(() => (window as any).__messages);
    expect(Array.isArray(msgs)).toBe(true);
    expect(msgs.length).toBe(0);
  });

  test('postMessage records to __lastMessage', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).vscode.postMessage({ type: 'test', value: 'hello' });
    });
    const last = await page.evaluate(() => (window as any).__lastMessage);
    expect(last).toMatchObject({ type: 'test', value: 'hello' });
  });

  test('postMessage appends to __messages array', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).vscode.postMessage({ type: 'msg1' });
      (window as any).vscode.postMessage({ type: 'msg2' });
    });
    const msgs = await page.evaluate(() => (window as any).__messages);
    expect(msgs.length).toBe(2);
    expect(msgs[0].type).toBe('msg1');
    expect(msgs[1].type).toBe('msg2');
  });

  // ---------------------------------------------------------------------------
  // editorAPI availability
  // ---------------------------------------------------------------------------

  test('window.editorAPI is defined @smoke', async ({ page }) => {
    const defined = await page.evaluate(() => typeof (window as any).editorAPI !== 'undefined');
    expect(defined).toBe(true);
  });

  test('editorAPI.isReady() returns true after load', async ({ page }) => {
    const ready = await page.evaluate(() => (window as any).editorAPI.isReady());
    expect(ready).toBe(true);
  });

  test('editorAPI.getMarkdown() returns string', async ({ page }) => {
    const md = await page.evaluate(() => (window as any).editorAPI.getMarkdown());
    expect(typeof md).toBe('string');
  });

  // ---------------------------------------------------------------------------
  // spellAPI availability
  // ---------------------------------------------------------------------------

  test('window.spellAPI is defined @smoke', async ({ page }) => {
    const defined = await page.evaluate(() => typeof (window as any).spellAPI !== 'undefined');
    expect(defined).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Content reset between calls
  // ---------------------------------------------------------------------------

  test('setMarkdown then getMarkdown returns correct content', async ({ page }) => {
    await setContent(page, '# First\n\nContent.\n');
    const first = await getContent(page);
    await setContent(page, '# Second\n\nNew content.\n');
    const second = await getContent(page);
    expect(first).toContain('First');
    expect(second).toContain('Second');
    expect(second).not.toContain('First');
  });

  test('successive setMarkdown calls overwrite content @smoke', async ({ page }) => {
    for (let i = 1; i <= 3; i++) {
      await setContent(page, `# Iteration ${i}\n\nLoop content.\n`);
    }
    const final = await getContent(page);
    expect(final).toContain('Iteration 3');
    expect(final).not.toContain('Iteration 1');
  });

  // ---------------------------------------------------------------------------
  // Error isolation
  // ---------------------------------------------------------------------------

  test('invalid runCommand name does not crash the editor', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('ResizeObserver') && !msg.text().includes('favicon')) {
        errors.push(msg.text());
      }
    });
    // Non-existent command should fail gracefully
    await page.evaluate(() => {
      try {
        (window as any).editorAPI.runCommand('commandThatDoesNotExist99999');
      } catch (_) {
        // Expected — just shouldn't crash the editor state
      }
    });
    await page.waitForTimeout(200);
    // Editor should still be functional
    await setContent(page, '# Still works\n');
    const md = await getContent(page);
    expect(md).toContain('Still works');
  });
});
