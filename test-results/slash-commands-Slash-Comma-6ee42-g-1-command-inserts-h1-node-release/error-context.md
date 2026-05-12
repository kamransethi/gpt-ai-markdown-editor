# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: slash-commands.spec.ts >> Slash Commands >> Heading 1 command inserts h1 node
- Location: src\__tests__\playwright\slash-commands.spec.ts:46:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.ProseMirror h1')
Expected: visible
Timeout: 2000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 2000ms
  - waiting for locator('.ProseMirror h1')

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e3]:
      - button "B" [ref=e4] [cursor=pointer]
      - button "I" [ref=e5] [cursor=pointer]
      - button "U" [ref=e6] [cursor=pointer]
      - button "S" [ref=e7] [cursor=pointer]
      - 'button "``" [ref=e8] [cursor=pointer]'
      - button "H" [ref=e9] [cursor=pointer]
    - generic [ref=e11]:
      - button "H1" [ref=e12] [cursor=pointer]
      - button "H2" [ref=e13] [cursor=pointer]
      - button "H3" [ref=e14] [cursor=pointer]
      - button "H4" [ref=e15] [cursor=pointer]
      - button "H5" [ref=e16] [cursor=pointer]
      - button "H6" [ref=e17] [cursor=pointer]
    - generic [ref=e19]:
      - button "\"\"" [ref=e20] [cursor=pointer]
      - button "—" [ref=e21] [cursor=pointer]
      - button "•" [ref=e22] [cursor=pointer]
      - button "1." [ref=e23] [cursor=pointer]
      - button "☐" [ref=e24] [cursor=pointer]
    - generic [ref=e26]:
      - button "⊞" [ref=e27] [cursor=pointer]
      - button "+↑" [ref=e28] [cursor=pointer]
      - button "+↓" [ref=e29] [cursor=pointer]
      - button "✕↑" [ref=e30] [cursor=pointer]
      - button "+←" [ref=e31] [cursor=pointer]
      - button "+→" [ref=e32] [cursor=pointer]
      - button "✕←" [ref=e33] [cursor=pointer]
    - generic [ref=e35]:
      - button "🔍" [ref=e36] [cursor=pointer]
      - button "🔗" [ref=e37] [cursor=pointer]
      - button "↩" [ref=e38] [cursor=pointer]
      - button "↪" [ref=e39] [cursor=pointer]
    - generic [ref=e41]:
      - button "✨ AI Refine" [ref=e42] [cursor=pointer]
      - button "💡 AI Explain" [ref=e43] [cursor=pointer]
  - textbox [active] [ref=e47]:
    - paragraph [ref=e48]: /heading 1
    - paragraph [ref=e49]
  - generic [ref=e50]: Loading editor…
```

# Test source

```ts
  1   | /**
  2   |  * Slash Commands — Playwright spec
  3   |  *
  4   |  * Tests the CommandRegistry slash-command palette (type / at start of line).
  5   |  *
  6   |  * Run smoke tests only: npx playwright test slash-commands.spec.ts --project smoke
  7   |  * Run all:              npx playwright test slash-commands.spec.ts
  8   |  */
  9   | 
  10  | import { test, expect } from '@playwright/test';
  11  | import {
  12  |   FULL_HARNESS_URL,
  13  |   waitForEditor,
  14  |   setContent,
  15  | } from './helpers/index';
  16  | 
  17  | test.describe('Slash Commands', () => {
  18  |   test.beforeEach(async ({ page }) => {
  19  |     await page.goto(FULL_HARNESS_URL);
  20  |     await waitForEditor(page);
  21  |     await setContent(page, '');
  22  |   });
  23  | 
  24  |   const SUGGESTION_LIST = '.suggestion-list, [class*="suggestion"], [class*="slash"]';
  25  | 
  26  |   test('/ at start of line opens command palette @smoke', async ({ page }) => {
  27  |     await page.locator('.ProseMirror').click();
  28  |     await page.keyboard.type('/');
  29  |     // Suggestion list should appear
  30  |     const list = page.locator(SUGGESTION_LIST);
  31  |     await expect(list.first()).toBeVisible({ timeout: 3000 });
  32  |   });
  33  | 
  34  |   test('typing after / narrows suggestions', async ({ page }) => {
  35  |     await page.locator('.ProseMirror').click();
  36  |     await page.keyboard.type('/');
  37  |     await expect(page.locator(SUGGESTION_LIST).first()).toBeVisible({ timeout: 3000 });
  38  |     const allCount = await page.locator(`${SUGGESTION_LIST} li, ${SUGGESTION_LIST} [class*="item"]`).count();
  39  |     await page.keyboard.type('hea');
  40  |     await page.waitForTimeout(200);
  41  |     const filteredCount = await page.locator(`${SUGGESTION_LIST} li, ${SUGGESTION_LIST} [class*="item"]`).count();
  42  |     // After filtering there should be fewer items
  43  |     expect(filteredCount).toBeLessThanOrEqual(allCount);
  44  |   });
  45  | 
  46  |   test('Heading 1 command inserts h1 node', async ({ page }) => {
  47  |     await page.locator('.ProseMirror').click();
  48  |     await page.keyboard.type('/');
  49  |     await expect(page.locator(SUGGESTION_LIST).first()).toBeVisible({ timeout: 3000 });
  50  |     await page.keyboard.type('heading 1');
  51  |     await page.waitForTimeout(200);
  52  |     // Press Enter to select
  53  |     await page.keyboard.press('Enter');
> 54  |     await expect(page.locator('.ProseMirror h1')).toBeVisible({ timeout: 2000 });
      |                                                   ^ Error: expect(locator).toBeVisible() failed
  55  |   });
  56  | 
  57  |   test('Code block command inserts code block', async ({ page }) => {
  58  |     await page.locator('.ProseMirror').click();
  59  |     await page.keyboard.type('/');
  60  |     await expect(page.locator(SUGGESTION_LIST).first()).toBeVisible({ timeout: 3000 });
  61  |     await page.keyboard.type('code');
  62  |     await page.waitForTimeout(200);
  63  |     await page.keyboard.press('Enter');
  64  |     await expect(page.locator('.ProseMirror pre, .ProseMirror .code-block-highlighted')).toBeVisible({ timeout: 2000 });
  65  |   });
  66  | 
  67  |   test('Table command inserts table', async ({ page }) => {
  68  |     await page.locator('.ProseMirror').click();
  69  |     await page.keyboard.type('/');
  70  |     await expect(page.locator(SUGGESTION_LIST).first()).toBeVisible({ timeout: 3000 });
  71  |     await page.keyboard.type('table');
  72  |     await page.waitForTimeout(200);
  73  |     await page.keyboard.press('Enter');
  74  |     await expect(page.locator('.ProseMirror table')).toBeVisible({ timeout: 2000 });
  75  |   });
  76  | 
  77  |   test('Bullet list command inserts ul', async ({ page }) => {
  78  |     await page.locator('.ProseMirror').click();
  79  |     await page.keyboard.type('/');
  80  |     await expect(page.locator(SUGGESTION_LIST).first()).toBeVisible({ timeout: 3000 });
  81  |     await page.keyboard.type('bullet');
  82  |     await page.waitForTimeout(200);
  83  |     await page.keyboard.press('Enter');
  84  |     await expect(page.locator('.ProseMirror ul')).toBeVisible({ timeout: 2000 });
  85  |   });
  86  | 
  87  |   test('Blockquote command inserts blockquote', async ({ page }) => {
  88  |     await page.locator('.ProseMirror').click();
  89  |     await page.keyboard.type('/');
  90  |     await expect(page.locator(SUGGESTION_LIST).first()).toBeVisible({ timeout: 3000 });
  91  |     await page.keyboard.type('quote');
  92  |     await page.waitForTimeout(200);
  93  |     await page.keyboard.press('Enter');
  94  |     await expect(page.locator('.ProseMirror blockquote')).toBeVisible({ timeout: 2000 });
  95  |   });
  96  | 
  97  |   test('Escape closes palette without insertion @smoke', async ({ page }) => {
  98  |     await page.locator('.ProseMirror').click();
  99  |     await page.keyboard.type('/');
  100 |     await expect(page.locator(SUGGESTION_LIST).first()).toBeVisible({ timeout: 3000 });
  101 |     await page.keyboard.press('Escape');
  102 |     await expect(page.locator(SUGGESTION_LIST).first()).toBeHidden({ timeout: 2000 });
  103 |     // No special nodes should have been inserted
  104 |     await expect(page.locator('.ProseMirror h1, .ProseMirror h2, .ProseMirror table')).toHaveCount(0);
  105 |   });
  106 | });
  107 | 
```