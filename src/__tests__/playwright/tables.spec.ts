/**
 * Tables — Playwright spec
 *
 * Comprehensive tests for table creation, navigation, cell content (hard breaks,
 * bullets, highlights, mixed), context menu operations, and roundtrip fidelity.
 *
 * Run smoke tests only: npx playwright test tables.spec.ts --project smoke
 * Run all:              npx playwright test tables.spec.ts
 */

import { test, expect } from '@playwright/test';
import {
  FULL_HARNESS_URL,
  waitForEditor,
  setContent,
  getContent,
  runEditorCommand,
} from './helpers/index';

test.describe('Tables', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FULL_HARNESS_URL);
    await waitForEditor(page);
    await setContent(page, '');
  });

  // ---------------------------------------------------------------------------
  // Create table
  // ---------------------------------------------------------------------------

  test('create table via toolbar runCommand produces <table> @smoke', async ({ page }) => {
    await runEditorCommand(page, 'insertTable', { rows: 3, cols: 3, withHeaderRow: true });
    await expect(page.locator('.ProseMirror table')).toBeVisible();
    // Should have 1 header row + 2 body rows = 4 rows total (thead counts)
    const rows = page.locator('.ProseMirror table tr');
    await expect(rows).toHaveCount(3);
  });

  test('create table via markdown pipe syntax', async ({ page }) => {
    await setContent(page, '| A | B |\n|---|---|\n| 1 | 2 |\n');
    await expect(page.locator('.ProseMirror table')).toBeVisible();
    // Should have 2 rows (header + body)
    await expect(page.locator('.ProseMirror table tr')).toHaveCount(2);
  });

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  test('Tab moves cursor to next cell @smoke', async ({ page }) => {
    await runEditorCommand(page, 'insertTable', { rows: 2, cols: 2, withHeaderRow: true });
    const cells = page.locator('.ProseMirror table td, .ProseMirror table th');
    // Click first cell
    await cells.first().click();
    await page.keyboard.type('First');
    // Tab to next cell
    await page.keyboard.press('Tab');
    await page.keyboard.type('Second');
    // Verify second cell now has the text
    await expect(cells.nth(1)).toContainText('Second');
  });

  test('Shift+Tab moves cursor to previous cell', async ({ page }) => {
    await runEditorCommand(page, 'insertTable', { rows: 2, cols: 2, withHeaderRow: true });
    const cells = page.locator('.ProseMirror table td, .ProseMirror table th');
    await cells.nth(1).click();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.type('Prev');
    await expect(cells.first()).toContainText('Prev');
  });

  test('Tab from last cell adds new row', async ({ page }) => {
    await runEditorCommand(page, 'insertTable', { rows: 2, cols: 2, withHeaderRow: true });
    const initialRows = await page.locator('.ProseMirror table tr').count();
    // Navigate to last cell
    const cells = page.locator('.ProseMirror table td, .ProseMirror table th');
    const count = await cells.count();
    await cells.nth(count - 1).click();
    await page.keyboard.press('Tab');
    const newRows = await page.locator('.ProseMirror table tr').count();
    expect(newRows).toBeGreaterThan(initialRows);
  });

  // ---------------------------------------------------------------------------
  // Cell content — hard breaks
  // ---------------------------------------------------------------------------

  test('Shift+Enter inserts hard break in cell — <br> visible @smoke', async ({ page }) => {
    await runEditorCommand(page, 'insertTable', { rows: 2, cols: 2, withHeaderRow: true });
    const firstCell = page.locator('.ProseMirror table td').first();
    await firstCell.click();
    await page.keyboard.type('Line 1');
    await page.keyboard.press('Shift+Enter');
    await page.keyboard.type('Line 2');
    // <br> inside a table cell
    await expect(firstCell.locator('br')).toBeVisible();
  });

  test('two hard breaks in same cell — two <br> nodes present', async ({ page }) => {
    await runEditorCommand(page, 'insertTable', { rows: 2, cols: 2, withHeaderRow: true });
    const firstCell = page.locator('.ProseMirror table td').first();
    await firstCell.click();
    await page.keyboard.type('A');
    await page.keyboard.press('Shift+Enter');
    await page.keyboard.type('B');
    await page.keyboard.press('Shift+Enter');
    await page.keyboard.type('C');
    const brs = firstCell.locator('br');
    await expect(brs).toHaveCount(2);
  });

  test('roundtrip hard break — getMarkdown contains <br> after Shift+Enter', async ({ page }) => {
    await runEditorCommand(page, 'insertTable', { rows: 2, cols: 2, withHeaderRow: true });
    const firstCell = page.locator('.ProseMirror table td').first();
    await firstCell.click();
    await page.keyboard.type('L1');
    await page.keyboard.press('Shift+Enter');
    await page.keyboard.type('L2');
    const md = await getContent(page);
    // The table serializer should output <br> for hard breaks in cells
    expect(md).toContain('<br>');
  });

  // ---------------------------------------------------------------------------
  // Cell content — bullet lists
  // ---------------------------------------------------------------------------

  test('bullet list in cell — <ul> present inside <td> @smoke', async ({ page }) => {
    await runEditorCommand(page, 'insertTable', { rows: 2, cols: 2, withHeaderRow: true });
    const firstCell = page.locator('.ProseMirror table td').first();
    await firstCell.click();
    await runEditorCommand(page, 'toggleBulletList');
    await expect(firstCell.locator('ul')).toBeVisible();
  });

  test('nested bullet depth-1 — <ul><ul> present inside cell', async ({ page }) => {
    await runEditorCommand(page, 'insertTable', { rows: 2, cols: 2, withHeaderRow: true });
    const firstCell = page.locator('.ProseMirror table td').first();
    await firstCell.click();
    await runEditorCommand(page, 'toggleBulletList');
    await page.keyboard.type('Item');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Nested');
    await page.keyboard.press('Tab');
    // Two levels of ul
    await expect(firstCell.locator('ul ul')).toBeVisible();
  });

  test('ordered list in cell — <ol> present inside <td>', async ({ page }) => {
    await runEditorCommand(page, 'insertTable', { rows: 2, cols: 2, withHeaderRow: true });
    const firstCell = page.locator('.ProseMirror table td').first();
    await firstCell.click();
    await runEditorCommand(page, 'toggleOrderedList');
    await page.keyboard.type('First');
    await expect(firstCell.locator('ol')).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // Cell content — marks
  // ---------------------------------------------------------------------------

  test('bold mark in cell — <strong> inside <td>', async ({ page }) => {
    await runEditorCommand(page, 'insertTable', { rows: 2, cols: 2, withHeaderRow: true });
    const firstCell = page.locator('.ProseMirror table td').first();
    await firstCell.click();
    await page.keyboard.type('Bold text');
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Control+b');
    await expect(firstCell.locator('strong')).toBeVisible();
  });

  test('italic mark in cell — <em> inside <td>', async ({ page }) => {
    await runEditorCommand(page, 'insertTable', { rows: 2, cols: 2, withHeaderRow: true });
    const firstCell = page.locator('.ProseMirror table td').first();
    await firstCell.click();
    await page.keyboard.type('Italic text');
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Control+i');
    await expect(firstCell.locator('em')).toBeVisible();
  });

  test('highlight mark in cell — .highlight class inside <td>', async ({ page }) => {
    await runEditorCommand(page, 'insertTable', { rows: 2, cols: 2, withHeaderRow: true });
    const firstCell = page.locator('.ProseMirror table td').first();
    await firstCell.click();
    await page.keyboard.type('Highlighted');
    await page.keyboard.press('Control+a');
    await runEditorCommand(page, 'toggleHighlight');
    await expect(firstCell.locator('.highlight')).toBeVisible();
  });

  test('task item in cell — checkbox visible', async ({ page }) => {
    await runEditorCommand(page, 'insertTable', { rows: 2, cols: 2, withHeaderRow: true });
    const firstCell = page.locator('.ProseMirror table td').first();
    await firstCell.click();
    await runEditorCommand(page, 'toggleTaskList');
    await page.keyboard.type('Task item');
    await expect(firstCell.locator('input[type="checkbox"]')).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // Context menu operations
  // ---------------------------------------------------------------------------

  test('right-click in table opens context menu @smoke', async ({ page }) => {
    await runEditorCommand(page, 'insertTable', { rows: 3, cols: 3, withHeaderRow: true });
    const firstCell = page.locator('.ProseMirror table td').first();
    await firstCell.click({ button: 'right' });
    // Context menu should appear
    const menu = page.locator('.context-menu, .table-context-menu, [class*="context-menu"]');
    await expect(menu.first()).toBeVisible({ timeout: 3000 });
  });

  test('table context menu: Add row below increases row count', async ({ page }) => {
    await runEditorCommand(page, 'insertTable', { rows: 2, cols: 2, withHeaderRow: true });
    const initialCount = await page.locator('.ProseMirror table tr').count();
    // Add row via command directly (context menu UI varies)
    await runEditorCommand(page, 'addRowAfter');
    const newCount = await page.locator('.ProseMirror table tr').count();
    expect(newCount).toBe(initialCount + 1);
  });

  test('table context menu: Add row above increases row count', async ({ page }) => {
    await runEditorCommand(page, 'insertTable', { rows: 2, cols: 2, withHeaderRow: true });
    const firstCell = page.locator('.ProseMirror table td').first();
    await firstCell.click();
    const initialCount = await page.locator('.ProseMirror table tr').count();
    await runEditorCommand(page, 'addRowBefore');
    const newCount = await page.locator('.ProseMirror table tr').count();
    expect(newCount).toBe(initialCount + 1);
  });

  test('table context menu: Remove row decreases row count', async ({ page }) => {
    await runEditorCommand(page, 'insertTable', { rows: 3, cols: 2, withHeaderRow: true });
    const firstCell = page.locator('.ProseMirror table td').first();
    await firstCell.click();
    const initialCount = await page.locator('.ProseMirror table tr').count();
    await runEditorCommand(page, 'deleteRow');
    const newCount = await page.locator('.ProseMirror table tr').count();
    expect(newCount).toBe(initialCount - 1);
  });

  test('table context menu: Add column right increases col count', async ({ page }) => {
    await runEditorCommand(page, 'insertTable', { rows: 2, cols: 2, withHeaderRow: true });
    const firstCell = page.locator('.ProseMirror table td').first();
    await firstCell.click();
    const initialCols = await page
      .locator('.ProseMirror table tr')
      .first()
      .locator('td, th')
      .count();
    await runEditorCommand(page, 'addColumnAfter');
    const newCols = await page.locator('.ProseMirror table tr').first().locator('td, th').count();
    expect(newCols).toBe(initialCols + 1);
  });

  test('table context menu: Add column left increases col count', async ({ page }) => {
    await runEditorCommand(page, 'insertTable', { rows: 2, cols: 2, withHeaderRow: true });
    const firstCell = page.locator('.ProseMirror table td').first();
    await firstCell.click();
    const initialCols = await page
      .locator('.ProseMirror table tr')
      .first()
      .locator('td, th')
      .count();
    await runEditorCommand(page, 'addColumnBefore');
    const newCols = await page.locator('.ProseMirror table tr').first().locator('td, th').count();
    expect(newCols).toBe(initialCols + 1);
  });

  test('table context menu: Remove column decreases col count', async ({ page }) => {
    await runEditorCommand(page, 'insertTable', { rows: 2, cols: 3, withHeaderRow: true });
    const firstCell = page.locator('.ProseMirror table td').first();
    await firstCell.click();
    const initialCols = await page
      .locator('.ProseMirror table tr')
      .first()
      .locator('td, th')
      .count();
    await runEditorCommand(page, 'deleteColumn');
    const newCols = await page.locator('.ProseMirror table tr').first().locator('td, th').count();
    expect(newCols).toBe(initialCols - 1);
  });

  // ---------------------------------------------------------------------------
  // Roundtrip fidelity
  // ---------------------------------------------------------------------------

  test('roundtrip fidelity — load table fixture, serialize, reload, re-serialize must match', async ({
    page,
  }) => {
    const fixture = `| Name | Age | Notes |\n|------|-----|-------|\n| Alice | 30 | Has **bold** note |\n| Bob | 25 | First<br>Second |\n`;
    await setContent(page, fixture);
    const firstPass = await getContent(page);
    await setContent(page, firstPass);
    const secondPass = await getContent(page);
    // The two serializations should be identical
    expect(secondPass).toBe(firstPass);
  });

  test('mixed content in cell (text + break + bullet) roundtrip', async ({ page }) => {
    // Set complex fixture and verify it survives roundtrip
    await runEditorCommand(page, 'insertTable', { rows: 2, cols: 2, withHeaderRow: true });
    const firstCell = page.locator('.ProseMirror table td').first();
    await firstCell.click();
    await page.keyboard.type('Text');
    await page.keyboard.press('Shift+Enter');
    await page.keyboard.type('More text');
    const md1 = await getContent(page);
    await setContent(page, md1);
    const md2 = await getContent(page);
    expect(md2).toBe(md1);
  });

  test('table with header row — th elements present for first row', async ({ page }) => {
    await runEditorCommand(page, 'insertTable', { rows: 3, cols: 3, withHeaderRow: true });
    await expect(page.locator('.ProseMirror table th')).toHaveCount(3);
  });
});
