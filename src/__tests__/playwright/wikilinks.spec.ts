/**
 * WikiLinks — Playwright spec
 *
 * Tests the WikiLink & WikiLinkSuggest extensions (typing [[, autocomplete, and click navigation).
 *
 * Run smoke tests only: npx playwright test wikilinks.spec.ts --project smoke
 * Run all:              npx playwright test wikilinks.spec.ts
 */

import { test, expect } from '@playwright/test';
import { FULL_HARNESS_URL, waitForEditor, setContent, getContent } from './helpers/index';

test.describe('WikiLinks', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FULL_HARNESS_URL);
    await waitForEditor(page);
    await setContent(page, '');

    // Seed the note list cache with mock notes for testing autocomplete
    await page.evaluate(() => {
      (window as any).editorAPI.updateCachedNoteList([
        {
          title: 'Project Overview',
          filename: 'project-overview',
          path: '/notes/project-overview.md',
        },
        {
          title: 'API Specification',
          filename: 'api-specification',
          path: '/notes/api-specification.md',
        },
        { title: 'Release Notes', filename: 'release-notes', path: '/notes/release-notes.md' },
      ]);
    });
  });

  const DROPDOWN_MENU = '.slash-command-menu';
  const DROPDOWN_ITEM = '.slash-command-item';

  test('typing [[ triggers suggestion dropdown @smoke', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('[[');

    // Suggestion dropdown should appear
    const dropdown = page.locator(DROPDOWN_MENU);
    await expect(dropdown).toBeVisible({ timeout: 3000 });

    // Verify list item count and titles
    const items = dropdown.locator(DROPDOWN_ITEM);
    await expect(items).toHaveCount(3);
    await expect(items.nth(0).locator('.slash-command-title')).toHaveText('Project Overview');
    await expect(items.nth(1).locator('.slash-command-title')).toHaveText('API Specification');
    await expect(items.nth(2).locator('.slash-command-title')).toHaveText('Release Notes');
  });

  test('typing after [[ filters suggestion list', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('[[');
    await expect(page.locator(DROPDOWN_MENU)).toBeVisible({ timeout: 3000 });

    // Type "api" to narrow down options
    await page.keyboard.type('api');
    await page.waitForTimeout(200);

    const items = page.locator(`${DROPDOWN_MENU} ${DROPDOWN_ITEM}`);
    await expect(items).toHaveCount(1);
    await expect(items.first().locator('.slash-command-title')).toHaveText('API Specification');
  });

  test('selecting a suggestion from the dropdown inserts wikilink @smoke', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('[[');
    await expect(page.locator(DROPDOWN_MENU)).toBeVisible({ timeout: 3000 });

    // Press Enter to select the first option ("Project Overview")
    await page.keyboard.press('Enter');

    // The dropdown should disappear
    await expect(page.locator(DROPDOWN_MENU)).toBeHidden({ timeout: 2000 });

    // Verify rendered link structure
    const link = page.locator('.ProseMirror a[data-wikilink]');
    await expect(link).toBeVisible();
    await expect(link).toHaveText('[[project-overview]]');
    const target = await link.getAttribute('data-wikilink');
    expect(target).toBe('project-overview');

    // Check round-trip serialization matches exact syntax
    const savedContent = await getContent(page);
    expect(savedContent.trim()).toBe('[[project-overview]]');
  });

  test('Escape key closes suggestion dropdown without inserting link', async ({ page }) => {
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('[[');
    await expect(page.locator(DROPDOWN_MENU)).toBeVisible({ timeout: 3000 });

    // Press Escape
    await page.keyboard.press('Escape');

    // Dropdown should be dismissed
    await expect(page.locator(DROPDOWN_MENU)).toBeHidden({ timeout: 2000 });

    // Link node should not exist
    await expect(page.locator('.ProseMirror a[data-wikilink]')).toHaveCount(0);

    // Text in the editor should just be "[["
    const savedContent = await getContent(page);
    expect(savedContent.trim()).toBe('[[');
  });

  test('typing closing ]] manually converts to wikilink node @smoke', async ({ page }) => {
    await page.locator('.ProseMirror').click();

    // Type manual syntax [[custom-link]]
    await page.keyboard.type('[[custom-link]]');

    // The node inputRule should trigger on closing ]] and convert to a wikilink node
    const link = page.locator('.ProseMirror a[data-wikilink]');
    await expect(link).toBeVisible({ timeout: 2000 });
    await expect(link).toHaveText('[[custom-link]]');
    const target = await link.getAttribute('data-wikilink');
    expect(target).toBe('custom-link');

    // Verify round-trip matches input
    const savedContent = await getContent(page);
    expect(savedContent.trim()).toBe('[[custom-link]]');
  });

  test('markdown import rendering of existing wikilink works', async ({ page }) => {
    // Seed the editor with initial content containing a wikilink with custom label
    await setContent(page, 'Check out [[api-specification|API Docs]] for details.\n');

    // Verify that the link is rendered with the label
    const link = page.locator('.ProseMirror a[data-wikilink]');
    await expect(link).toBeVisible();
    await expect(link).toHaveText('[[API Docs]]');
    const target = await link.getAttribute('data-wikilink');
    expect(target).toBe('api-specification');

    // Verify round-trip back to markdown
    const savedContent = await getContent(page);
    expect(savedContent.trim()).toBe('Check out [[api-specification|API Docs]] for details.');
  });

  test('clicking wikilink opens inline edit dialog and can modify target/label', async ({
    page,
  }) => {
    await setContent(page, 'Visit [[project-overview]] node.');

    // Click the rendered wikilink
    const link = page.locator('.ProseMirror a[data-wikilink]');
    await expect(link).toBeVisible();
    await link.click();

    // Verify popover edit dialog is visible
    const dialog = page.locator('#wikilink-edit-dialog');
    await expect(dialog).toBeVisible();

    const targetInput = dialog.locator('#wikilink-target-input');
    const labelInput = dialog.locator('#wikilink-label-input');
    const saveBtn = dialog.locator('#wikilink-ok-btn');

    // Verify inputs pre-populated correctly
    await expect(targetInput).toHaveValue('project-overview');
    await expect(labelInput).toHaveValue('');

    // Modify values
    await targetInput.fill('api-specification');
    await labelInput.fill('Core API');
    await saveBtn.click();

    // Verify popover closed
    await expect(dialog).toBeHidden();

    // Verify updated node attributes in DOM
    const updatedLink = page.locator('.ProseMirror a[data-wikilink]');
    await expect(updatedLink).toBeVisible();
    await expect(updatedLink).toHaveText('[[Core API]]');
    const newTarget = await updatedLink.getAttribute('data-wikilink');
    expect(newTarget).toBe('api-specification');
    const newLabel = await updatedLink.getAttribute('data-label');
    expect(newLabel).toBe('Core API');

    // Verify roundtrip serialization is updated
    const savedContent = await getContent(page);
    expect(savedContent.trim()).toBe('Visit [[api-specification|Core API]] node.');
  });

  test('clicking remove button in edit dialog deletes the wikilink node', async ({ page }) => {
    await setContent(page, 'Delete [[project-overview]] here.');

    // Click link to open dialog
    const link = page.locator('.ProseMirror a[data-wikilink]');
    await expect(link).toBeVisible();
    await link.click();

    const dialog = page.locator('#wikilink-edit-dialog');
    await expect(dialog).toBeVisible();

    // Click remove
    const removeBtn = dialog.locator('#wikilink-remove-btn');
    await removeBtn.click();

    // Dialog closed and link removed
    await expect(dialog).toBeHidden();
    await expect(page.locator('.ProseMirror a[data-wikilink]')).toHaveCount(0);

    // Verify raw text in editor
    const savedContent = await getContent(page);
    expect(savedContent.trim()).toBe('Delete  here.'); // Double space left where the leaf node was
  });
});
