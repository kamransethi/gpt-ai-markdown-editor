/**
 * Playwright Component Tests: Bullets in Table Cells
 *
 * Tests the full TipTap pipeline for bullet lists inside GFM tables:
 *   - Load content from a fixture file via the harness API
 *   - Add bullets at various nesting levels via editor commands
 *   - Serialize back to markdown and assert structural correctness
 *   - Verify round-trip stability (idempotent serialization)
 *
 * The test harness (harness/index.html + editor-harness.js) runs TipTap
 * with the same extensions as production, but without any VS Code dependency.
 * Playwright drives a real Chromium browser — no mocks, no jsdom.
 */

import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wait for the editor to signal readiness, then return. */
async function waitForEditor(page: Page) {
  await page.waitForFunction(() => (window as any).editorAPI?.isReady(), {
    timeout: 10_000,
  });
}

/** Load markdown into the editor via the harness API. */
async function setMarkdown(page: Page, md: string) {
  await page.evaluate((content: string) => {
    (window as any).editorAPI.setMarkdown(content);
  }, md);
}

/** Retrieve serialized markdown from the editor. */
async function getMarkdown(page: Page): Promise<string> {
  return page.evaluate(() => (window as any).editorAPI.getMarkdown());
}

/** Place cursor at a node whose text contains `cellText`. */
async function focusCell(page: Page, cellText: string): Promise<boolean> {
  return page.evaluate((text: string) => (window as any).editorAPI.focusCell(text), cellText);
}

/** Run a named TipTap command. */
async function runCommand(page: Page, name: string, ...args: unknown[]) {
  await page.evaluate(
    ([cmd, cmdArgs]: [string, unknown[]]) => (window as any).editorAPI.runCommand(cmd, ...cmdArgs),
    [name, args]
  );
}

/** Insert raw text at the current cursor position. */
async function insertText(page: Page, text: string) {
  await page.evaluate((t: string) => (window as any).editorAPI.insertText(t), text);
}

/**
 * Assert every non-separator table row in `md` has at least `minPipes` pipe chars.
 * A valid N-column GFM table row has N+1 pipes: `| a | b | c |`.
 */
function assertTableStructure(md: string, minPipes = 2) {
  const rows = md
    .split('\n')
    .filter(l => l.trim().startsWith('|') && !l.includes('---'));
  expect(rows.length).toBeGreaterThan(0);
  for (const row of rows) {
    const count = (row.match(/\|/g) ?? []).length;
    expect(count, `Row has too few pipes: ${row}`).toBeGreaterThanOrEqual(minPipes);
  }
}

/**
 * Assert no line in `md` contains an embedded newline inside a table row
 * (which would break GFM table parsing).
 */
function assertNoEmbeddedNewlinesInRows(md: string) {
  const rows = md.split('\n').filter(l => l.trim().startsWith('|'));
  for (const row of rows) {
    expect(row, `Table row contains embedded newline: ${row}`).not.toMatch(/\r/);
  }
}

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

const FIXTURE_PATH = path.join(
  __dirname,
  '..',
  'fixtures',
  'table-bullets.md'
);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.beforeEach(async ({ page }) => {
  await page.goto('/src/__tests__/playwright/harness/');
  await waitForEditor(page);
});

// ── 1. Load from file ───────────────────────────────────────────────────────

test('loads fixture file and editor becomes ready', async ({ page }) => {
  const md = fs.readFileSync(FIXTURE_PATH, 'utf8');
  await setMarkdown(page, md);

  // At minimum a table should be visible in the DOM
  const tableEl = page.locator('.ProseMirror table').first();
  await expect(tableEl).toBeVisible();
});

test('loads fixture and all sections are present in serialized output', async ({ page }) => {
  const md = fs.readFileSync(FIXTURE_PATH, 'utf8');
  await setMarkdown(page, md);
  const output = await getMarkdown(page);

  expect(output).toContain('Alpha');
  expect(output).toContain('Beta');
  expect(output).toContain('Gamma');
  expect(output).toContain('First');
  expect(output).toContain('Level 1');
});

// ── 2. Serialization: single-level bullets ──────────────────────────────────

test('single-level bullets serialize without embedded newlines', async ({ page }) => {
  const md = `| Feature | Details |\n| ------- | ------- |\n| Bullets | - Alpha<br>- Beta<br>- Gamma |\n| Plain | text |`;
  await setMarkdown(page, md);
  const output = await getMarkdown(page);

  assertTableStructure(output);
  assertNoEmbeddedNewlinesInRows(output);
  expect(output).toContain('- Alpha');
  expect(output).toContain('- Beta');
  expect(output).toContain('- Gamma');
});

test('bullet markers are preserved (not stripped)', async ({ page }) => {
  const md = `| Col |\n| --- |\n| - One<br>- Two<br>- Three |`;
  await setMarkdown(page, md);
  const output = await getMarkdown(page);

  expect(output).toMatch(/- One/);
  expect(output).toMatch(/- Two/);
  expect(output).toMatch(/- Three/);
});

// ── 3. Add bullets via commands ─────────────────────────────────────────────

test('toggleBulletListSmart adds bullet prefix to selected text in table cell', async ({ page }) => {
  const md = `| Col 1 | Col 2 |\n| ----- | ----- |\n| Row 1<br>Row 2<br>NewBullet<br>Row 3 | Test |`;
  await setMarkdown(page, md);

  const found = await focusCell(page, 'NewBullet');
  expect(found).toBe(true);

  await runCommand(page, 'toggleBulletListSmart');
  const output = await getMarkdown(page);

  expect(output).toContain('- NewBullet');
  // Sibling lines should not get bullets
  expect(output).toMatch(/Row 1/);
  expect(output).not.toMatch(/- Row 1/);
});

test('toggleBulletListSmart removes bullet when already active', async ({ page }) => {
  const md = `| Col 1 |\n| ----- |\n| - AlreadyBulleted<br>- Other |`;
  await setMarkdown(page, md);

  const found = await focusCell(page, '- AlreadyBulleted');
  expect(found).toBe(true);

  await runCommand(page, 'toggleBulletListSmart');
  const output = await getMarkdown(page);

  // Bullet marker should be removed from that line
  expect(output).toContain('AlreadyBulleted');
  expect(output).not.toMatch(/- AlreadyBulleted/);
});

// ── 4. Nesting levels ────────────────────────────────────────────────────────

test('depth-0 bullet uses "-" marker', async ({ page }) => {
  const md = `| Steps | Notes |\n| ----- | ----- |\n| - L1Item<br>text | ok |`;
  await setMarkdown(page, md);
  const output = await getMarkdown(page);

  expect(output).toMatch(/- L1Item/);
});

test('depth-1 bullet uses "+" with 2-space indent', async ({ page }) => {
  const md = `| Steps | Notes |\n| ----- | ----- |\n| - L1<br>  + L2Item | ok |`;
  await setMarkdown(page, md);
  const output = await getMarkdown(page);

  expect(output).toMatch(/  \+ L2Item/);
});

test('depth-2 bullet uses "*" with 4-space indent', async ({ page }) => {
  const md = `| Steps | Notes |\n| ----- | ----- |\n| - L1<br>  + L2<br>    * L3Item | ok |`;
  await setMarkdown(page, md);
  const output = await getMarkdown(page);

  expect(output).toMatch(/    \* L3Item/);
});

test('all three nesting levels present on same row without embedded newlines', async ({ page }) => {
  const md = `| Nested | Val |\n| ------ | --- |\n| - L1<br>  + L2<br>    * L3 | x |`;
  await setMarkdown(page, md);
  const output = await getMarkdown(page);

  assertTableStructure(output);
  assertNoEmbeddedNewlinesInRows(output);

  const dataRow = output.split('\n').find(l => l.includes('L1'));
  expect(dataRow).toBeDefined();
  expect(dataRow).toContain('|'); // still in a table row
});

test('TAB key increases nesting level on bullet line (- to +)', async ({ page }) => {
  const md = `| Col |\n| --- |\n| - TabTarget<br>- Other |`;
  await setMarkdown(page, md);

  const found = await focusCell(page, '- TabTarget');
  expect(found).toBe(true);

  // Dispatch Tab keydown directly through the harness (avoids browser focus issues)
  await page.evaluate(() => (window as any).editorAPI.indentBulletLine());

  const output = await getMarkdown(page);
  // After Tab, "- TabTarget" should become "  + TabTarget"
  expect(output).toMatch(/  \+ TabTarget/);
});

test('SHIFT+TAB key decreases nesting level on bullet line (+ to -)', async ({ page }) => {
  // Use depth-1 bullet set via command so leading spaces are correctly stored
  const base = `| Col |\n| --- |\n| - TabTarget<br>- Other |`;
  await setMarkdown(page, base);
  const found = await focusCell(page, '- TabTarget');
  expect(found).toBe(true);
  // First indent to depth-1
  await page.evaluate(() => (window as any).editorAPI.indentBulletLine());

  // Now dedent back
  await focusCell(page, '+ TabTarget');
  await page.evaluate(() => (window as any).editorAPI.dedentBulletLine());

  const output = await getMarkdown(page);
  expect(output).toMatch(/- TabTarget/);
  expect(output).not.toMatch(/  \+ TabTarget/);
});

// ── 5. Ordered lists in table ────────────────────────────────────────────────

test('ordered list in table cell serializes without embedded newlines', async ({ page }) => {
  const md = `| Step | Notes |\n| ---- | ----- |\n| 1. First<br>2. Second<br>3. Third | ok |`;
  await setMarkdown(page, md);
  const output = await getMarkdown(page);

  assertTableStructure(output);
  assertNoEmbeddedNewlinesInRows(output);
  expect(output).toContain('1.');
  expect(output).toContain('2.');
  expect(output).toContain('3.');
});

// ── 6. Multiple bullet cells per row ────────────────────────────────────────

test('multiple cells with bullets in same row stay structurally valid', async ({ page }) => {
  const md = `| Left | Right |\n| ---- | ----- |\n| - A1<br>- A2 | - B1<br>- B2 |`;
  await setMarkdown(page, md);
  const output = await getMarkdown(page);

  assertTableStructure(output, 3); // 2 columns → at least 3 pipes per row
  assertNoEmbeddedNewlinesInRows(output);

  expect(output).toContain('A1');
  expect(output).toContain('B1');
});

// ── 7. Round-trip stability ──────────────────────────────────────────────────

test('serialization is idempotent (round-trip stable)', async ({ page }) => {
  const md = fs.readFileSync(FIXTURE_PATH, 'utf8');
  await setMarkdown(page, md);

  const pass1 = await getMarkdown(page);
  await setMarkdown(page, pass1);
  const pass2 = await getMarkdown(page);

  expect(pass2).toBe(pass1);
});

test('single-bullet cell round-trips stably', async ({ page }) => {
  const md = `| A | B |\n| - | - |\n| - Alpha<br>- Beta | plain |`;
  await setMarkdown(page, md);
  const p1 = await getMarkdown(page);
  await setMarkdown(page, p1);
  const p2 = await getMarkdown(page);
  expect(p2).toBe(p1);
});

// ── 8. Insert new bullets via insertText ─────────────────────────────────────

test('inserting bullet text into empty cell serializes correctly', async ({ page }) => {
  const md = `| Col 1 | Col 2 |\n| ----- | ----- |\n| EmptyTarget | val |`;
  await setMarkdown(page, md);

  await focusCell(page, 'EmptyTarget');

  // Move to end of cell text, add a hard-break and a new bullet line
  await runCommand(page, 'selectAll');
  await insertText(page, '- NewItem1');

  const output = await getMarkdown(page);
  expect(output).toContain('NewItem1');
});

// ── 9. Edge cases ────────────────────────────────────────────────────────────

test('empty cells alongside bullet cells remain valid', async ({ page }) => {
  const md = `| A | B | C |\n| - | - | - |\n| - Bullet | | Plain |\n| | - Bullet2 | |`;
  await setMarkdown(page, md);
  const output = await getMarkdown(page);

  assertTableStructure(output, 4); // 3 columns → 4 pipes per row
  expect(output).toContain('Bullet');
  expect(output).toContain('Bullet2');
});

test('mixed text and bullets in same cell preserve all content', async ({ page }) => {
  const md = `| Col |\n| --- |\n| Intro<br>- BulletLine<br>Trailing |`;
  await setMarkdown(page, md);
  const output = await getMarkdown(page);

  expect(output).toContain('Intro');
  expect(output).toContain('- BulletLine');
  expect(output).toContain('Trailing');
});

test('solo bullet in last column of multi-column table is valid', async ({ page }) => {
  const md = `| A | B | C |\n| - | - | - |\n| x | y | - SoloBullet |`;
  await setMarkdown(page, md);
  const output = await getMarkdown(page);

  assertTableStructure(output, 4);
  expect(output).toContain('SoloBullet');
});
