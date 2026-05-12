/**
 * Bubble Menu — Playwright spec
 *
 * Tests that the floating formatting bar (BubbleMenuExtension) appears on text
 * selection and that each button applies the correct mark or node transformation.
 *
 * The harness HTML pre-builds the #bubble-menu element; BubbleMenuExtension
 * controls its CSS display property. Buttons in the bubble menu call
 * window.editorAPI.runCommand() directly via onclick.
 */

import { test, expect } from '@playwright/test';
import {
  FULL_HARNESS_URL,
  waitForEditor,
  setContent,
  getActiveMarks,
  runEditorCommand,
} from './helpers/index';

// Helper: place cursor in editor, type text, then select all
async function typeAndSelectAll(page: any, text: string) {
  await page.locator('.ProseMirror').click();
  await page.keyboard.type(text);
  await page.keyboard.press('Control+a');
}

test.describe('Bubble Menu', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FULL_HARNESS_URL);
    await waitForEditor(page);
    await setContent(page, '');
  });

  // ---------------------------------------------------------------------------
  // Visibility
  // ---------------------------------------------------------------------------

  test('bubble menu appears on text selection @smoke', async ({ page }) => {
    await typeAndSelectAll(page, 'Hello world');
    const bubbleMenu = page.locator('#bubble-menu');
    await expect(bubbleMenu).toBeVisible({ timeout: 2000 });
  });

  test('bubble menu disappears when selection is cleared', async ({ page }) => {
    await typeAndSelectAll(page, 'Hello');
    const bubbleMenu = page.locator('#bubble-menu');
    await expect(bubbleMenu).toBeVisible({ timeout: 2000 });
    // Click somewhere to deselect
    await page.locator('.ProseMirror').click({ position: { x: 10, y: 200 } });
    await expect(bubbleMenu).toBeHidden({ timeout: 2000 });
  });

  // ---------------------------------------------------------------------------
  // Formatting buttons via toolbar (data-testid on toolbar row)
  // The toolbar buttons are always visible and call the same commands as bubble menu.
  // We test via toolbar since it's always accessible without needing to maintain selection.
  // ---------------------------------------------------------------------------

  test('Bold button applies <strong> mark @smoke', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('Bold me');
    await page.keyboard.press('Control+a');
    await page.locator('[data-testid="toolbar-bold"]').click();
    await expect(page.locator('.ProseMirror strong')).toBeVisible();
  });

  test('Italic button applies <em> mark', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('Italic me');
    await page.keyboard.press('Control+a');
    await page.locator('[data-testid="toolbar-italic"]').click();
    await expect(page.locator('.ProseMirror em')).toBeVisible();
  });

  test('Underline button applies underline mark', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('Underline me');
    await page.keyboard.press('Control+a');
    await page.locator('[data-testid="toolbar-underline"]').click();
    const marks = await getActiveMarks(page);
    expect(marks).toContain('underline');
  });

  test('Strikethrough button applies strike mark', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('Strike me');
    await page.keyboard.press('Control+a');
    await page.locator('[data-testid="toolbar-strike"]').click();
    const marks = await getActiveMarks(page);
    expect(marks).toContain('strike');
  });

  test('Inline code button applies code mark', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('code me');
    await page.keyboard.press('Control+a');
    await page.locator('[data-testid="toolbar-code"]').click();
    await expect(page.locator('.ProseMirror code')).toBeVisible();
  });

  test('Highlight button applies .highlight class', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('Highlight me');
    await page.keyboard.press('Control+a');
    await page.locator('[data-testid="toolbar-highlight"]').click();
    await expect(page.locator('.ProseMirror .highlight')).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // Heading buttons
  // ---------------------------------------------------------------------------

  test('H1 button sets h1 node', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('Heading');
    await page.locator('[data-testid="toolbar-h1"]').click();
    await expect(page.locator('.ProseMirror h1')).toBeVisible();
  });

  test('H2 button sets h2 node', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('H2');
    await page.locator('[data-testid="toolbar-h2"]').click();
    await expect(page.locator('.ProseMirror h2')).toBeVisible();
  });

  test('H3 button sets h3 node', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('H3');
    await page.locator('[data-testid="toolbar-h3"]').click();
    await expect(page.locator('.ProseMirror h3')).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // List buttons
  // ---------------------------------------------------------------------------

  test('Bullet list button inserts <ul>', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('List item');
    await page.locator('[data-testid="toolbar-bullet-list"]').click();
    await expect(page.locator('.ProseMirror ul')).toBeVisible();
  });

  test('Ordered list button inserts <ol>', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('First item');
    await page.locator('[data-testid="toolbar-ordered-list"]').click();
    await expect(page.locator('.ProseMirror ol')).toBeVisible();
  });

  test('Task list button inserts task item checkbox', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('Task');
    await page.locator('[data-testid="toolbar-task-list"]').click();
    await expect(page.locator('.ProseMirror input[type="checkbox"]')).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // Table-specific buttons
  // ---------------------------------------------------------------------------

  test('table add-row-after button visible @smoke', async ({ page }) => {
    await expect(page.locator('[data-testid="toolbar-add-row-after"]')).toBeVisible();
  });

  test('table add-row-before button visible', async ({ page }) => {
    await expect(page.locator('[data-testid="toolbar-add-row-before"]')).toBeVisible();
  });

  test('table delete-row button visible', async ({ page }) => {
    await expect(page.locator('[data-testid="toolbar-delete-row"]')).toBeVisible();
  });

  test('table add-col-after button visible', async ({ page }) => {
    await expect(page.locator('[data-testid="toolbar-add-col-after"]')).toBeVisible();
  });

  test('table add-col-before button visible', async ({ page }) => {
    await expect(page.locator('[data-testid="toolbar-add-col-before"]')).toBeVisible();
  });

  test('table delete-col button visible', async ({ page }) => {
    await expect(page.locator('[data-testid="toolbar-delete-col"]')).toBeVisible();
  });

  test('table operations via toolbar buttons work inside a table', async ({ page }) => {
    await runEditorCommand(page, 'insertTable', { rows: 2, cols: 2, withHeaderRow: true });
    const firstCell = page.locator('.ProseMirror table td').first();
    await firstCell.click();
    const before = await page.locator('.ProseMirror table tr').count();
    await page.locator('[data-testid="toolbar-add-row-after"]').click();
    const after = await page.locator('.ProseMirror table tr').count();
    expect(after).toBe(before + 1);
  });

  // ---------------------------------------------------------------------------
  // AI buttons
  // ---------------------------------------------------------------------------

  test('AI refine toolbar button is present @smoke', async ({ page }) => {
    await expect(page.locator('[data-testid="toolbar-ai-refine"]')).toBeVisible();
  });

  test('AI explain toolbar button is present', async ({ page }) => {
    await expect(page.locator('[data-testid="toolbar-ai-explain"]')).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // Bubble menu button-specific tests (tests that require a live selection)
  // ---------------------------------------------------------------------------

  test('bubble menu bold button applies mark on selection', async ({ page }) => {
    await typeAndSelectAll(page, 'Bubble bold');
    const bubbleMenu = page.locator('#bubble-menu');
    await expect(bubbleMenu).toBeVisible({ timeout: 2000 });
    await bubbleMenu.locator('[data-testid="bubble-bold"]').click();
    await expect(page.locator('.ProseMirror strong')).toBeVisible();
  });

  test('bubble menu italic button applies mark on selection', async ({ page }) => {
    await typeAndSelectAll(page, 'Bubble italic');
    const bubbleMenu = page.locator('#bubble-menu');
    await expect(bubbleMenu).toBeVisible({ timeout: 2000 });
    await bubbleMenu.locator('[data-testid="bubble-italic"]').click();
    await expect(page.locator('.ProseMirror em')).toBeVisible();
  });

  test('bubble menu AI refine button is present @smoke', async ({ page }) => {
    await typeAndSelectAll(page, 'AI refine test');
    const bubbleMenu = page.locator('#bubble-menu');
    await expect(bubbleMenu).toBeVisible({ timeout: 2000 });
    await expect(bubbleMenu.locator('[data-testid="bubble-ai-refine"]')).toBeVisible();
  });
});
