/**
 * Editor Core — Playwright spec
 *
 * Tests fundamental text formatting, headings, undo/redo, paste, and
 * markdown roundtrip fidelity using the full-editor harness.
 *
 * Run smoke tests only: npx playwright test editor-core.spec.ts --project smoke
 * Run all:              npx playwright test editor-core.spec.ts
 */

import { test, expect } from '@playwright/test';
import {
  FULL_HARNESS_URL,
  waitForEditor,
  setContent,
  getContent,
  getActiveMarks,
  runEditorCommand,
} from './helpers/index';

test.describe('Editor Core', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FULL_HARNESS_URL);
    await waitForEditor(page);
    // Start each test with empty content
    await setContent(page, '');
  });

  // ---------------------------------------------------------------------------
  // Bold / Italic / Basic Marks
  // ---------------------------------------------------------------------------

  test('bold toggle via Ctrl+B applies and removes mark @smoke', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('Hello');
    // Select all
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Control+b');
    // Bold mark should be active
    const marks = await getActiveMarks(page);
    expect(marks).toContain('bold');
    // Bold again removes it
    await page.keyboard.press('Control+b');
    const marks2 = await getActiveMarks(page);
    expect(marks2).not.toContain('bold');
  });

  test('italic toggle via Ctrl+I @smoke', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('World');
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Control+i');
    const marks = await getActiveMarks(page);
    expect(marks).toContain('italic');
  });

  test('underline toggle via Ctrl+U', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('Underlined');
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Control+u');
    const marks = await getActiveMarks(page);
    expect(marks).toContain('underline');
  });

  test('strikethrough applies mark', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('Strike');
    await page.keyboard.press('Control+a');
    await runEditorCommand(page, 'toggleStrike');
    const marks = await getActiveMarks(page);
    expect(marks).toContain('strike');
  });

  test('inline code applies code mark', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('code');
    await page.keyboard.press('Control+a');
    await runEditorCommand(page, 'toggleCode');
    const marks = await getActiveMarks(page);
    expect(marks).toContain('code');
  });

  // ---------------------------------------------------------------------------
  // Headings
  // ---------------------------------------------------------------------------

  test('H1 via runCommand produces <h1> in DOM @smoke', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('My Heading');
    await page.keyboard.press('Home');
    await runEditorCommand(page, 'toggleHeading', { level: 1 });
    const h1 = page.locator('.ProseMirror h1');
    await expect(h1).toBeVisible();
    await expect(h1).toHaveText('My Heading');
  });

  test('H2 via runCommand produces <h2>', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('Section');
    await runEditorCommand(page, 'toggleHeading', { level: 2 });
    await expect(page.locator('.ProseMirror h2')).toBeVisible();
  });

  test('H3 via runCommand', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('Sub');
    await runEditorCommand(page, 'toggleHeading', { level: 3 });
    await expect(page.locator('.ProseMirror h3')).toBeVisible();
  });

  test('H4 via runCommand', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('Sub4');
    await runEditorCommand(page, 'toggleHeading', { level: 4 });
    await expect(page.locator('.ProseMirror h4')).toBeVisible();
  });

  test('H5 via runCommand', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('Sub5');
    await runEditorCommand(page, 'toggleHeading', { level: 5 });
    await expect(page.locator('.ProseMirror h5')).toBeVisible();
  });

  test('H6 via runCommand', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('Sub6');
    await runEditorCommand(page, 'toggleHeading', { level: 6 });
    await expect(page.locator('.ProseMirror h6')).toBeVisible();
  });

  test('H1 via # markdown shortcut', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('# My Heading');
    await page.keyboard.press('Space');
    await expect(page.locator('.ProseMirror h1')).toBeVisible();
  });

  test('H2 via ## markdown shortcut', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('## Section');
    await page.keyboard.press('Space');
    await expect(page.locator('.ProseMirror h2')).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // Block nodes
  // ---------------------------------------------------------------------------

  test('blockquote via runCommand', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('Quote me');
    await runEditorCommand(page, 'toggleBlockquote');
    await expect(page.locator('.ProseMirror blockquote')).toBeVisible();
  });

  test('horizontal rule via runCommand', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('Before');
    await page.keyboard.press('Enter');
    await runEditorCommand(page, 'setHorizontalRule');
    await expect(page.locator('.ProseMirror hr')).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // Undo / Redo
  // ---------------------------------------------------------------------------

  test('undo single change via Ctrl+Z @smoke', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('Before');
    await page.keyboard.press('Control+z');
    const content = await getContent(page);
    // After undo the typed text should be gone
    expect(content.trim()).not.toContain('Before');
  });

  test('redo restores undone change via Ctrl+Y', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('Redo me');
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+y');
    const content = await getContent(page);
    expect(content).toContain('Redo me');
  });

  test('undo chain — three changes then three undos returns to original', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('A');
    await page.keyboard.type('B');
    await page.keyboard.type('C');
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+z');
    const content = await getContent(page);
    expect(content.trim()).toBe('');
  });

  // ---------------------------------------------------------------------------
  // Roundtrip
  // ---------------------------------------------------------------------------

  test('markdown roundtrip — heading, list, table, code @smoke', async ({ page }) => {
    const md = `# Title\n\n- item 1\n- item 2\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n\`\`\`js\nconsole.log('hi');\n\`\`\`\n`;
    await setContent(page, md);
    const out = await getContent(page);
    // Round-trip: all key structures should survive
    expect(out).toContain('# Title');
    expect(out).toContain('- item 1');
    expect(out).toContain('| A |');
    expect(out).toContain("console.log('hi')");
  });

  test('setMarkdown with 100 headings — content still present after scroll', async ({ page }) => {
    const headings = Array.from({ length: 100 }, (_, i) => `## Heading ${i + 1}`).join('\n\n');
    await setContent(page, headings);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    // At least some headings should be in the DOM
    const count = await page.locator('.ProseMirror h2').count();
    expect(count).toBeGreaterThan(90);
  });

  test('plain text paste — pasted text appears in editor', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    // Use clipboard API to paste text
    await page.evaluate(() => {
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', 'Pasted text');
      const event = new ClipboardEvent('paste', {
        clipboardData: dataTransfer,
        bubbles: true,
        cancelable: true,
      });
      document.querySelector('.ProseMirror')!.dispatchEvent(event);
    });
    // Give TipTap time to process
    await page.waitForTimeout(100);
    const content = await getContent(page);
    expect(content).toContain('Pasted text');
  });

  test('hard break — Shift+Enter inside paragraph adds <br> in DOM @smoke', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('Line one');
    await page.keyboard.press('Shift+Enter');
    await page.keyboard.type('Line two');
    // <br> should be present inside the paragraph
    const br = page.locator('.ProseMirror p br');
    await expect(br).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // Bullet / ordered / task lists
  // ---------------------------------------------------------------------------

  test('bullet list via runCommand produces <ul>', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('Item');
    await runEditorCommand(page, 'toggleBulletList');
    await expect(page.locator('.ProseMirror ul')).toBeVisible();
  });

  test('ordered list via runCommand produces <ol>', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('First');
    await runEditorCommand(page, 'toggleOrderedList');
    await expect(page.locator('.ProseMirror ol')).toBeVisible();
  });

  test('task list via runCommand produces task item checkbox', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('Task');
    await runEditorCommand(page, 'toggleTaskList');
    await expect(page.locator('.ProseMirror ul[data-type="taskList"]')).toBeVisible();
    await expect(page.locator('.ProseMirror input[type="checkbox"]')).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // Highlight
  // ---------------------------------------------------------------------------

  test('highlight mark via runCommand produces .highlight class', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('Highlighted');
    await page.keyboard.press('Control+a');
    await runEditorCommand(page, 'toggleHighlight');
    await expect(page.locator('.ProseMirror .highlight')).toBeVisible();
  });
});
