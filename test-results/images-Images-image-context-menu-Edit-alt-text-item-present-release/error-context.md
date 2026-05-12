# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: images.spec.ts >> Images >> image context menu: "Edit alt text" item present
- Location: src\__tests__\playwright\images.spec.ts:59:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.context-menu, [class*="context-menu"]').first()
Expected: visible
Timeout: 3000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 3000ms
  - waiting for locator('.context-menu, [class*="context-menu"]').first()

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
    - paragraph [ref=e48]:
      - img "Alt text" [ref=e50]
  - generic [ref=e51]: Loading editor…
```

# Test source

```ts
  1   | /**
  2   |  * Images — Playwright spec
  3   |  *
  4   |  * Tests image context menu (all menu items present and clickable),
  5   |  * Draw.io diagram detection, and image-specific behaviours.
  6   |  *
  7   |  * Run smoke tests only: npx playwright test images.spec.ts --project smoke
  8   |  * Run all:              npx playwright test images.spec.ts
  9   |  */
  10  | 
  11  | import { test, expect } from '@playwright/test';
  12  | import {
  13  |   FULL_HARNESS_URL,
  14  |   waitForEditor,
  15  |   setContent,
  16  | } from './helpers/index';
  17  | 
  18  | // A simple base64 1×1 transparent PNG to embed in markdown without a real file
  19  | const TINY_PNG_BASE64 =
  20  |   'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  21  | 
  22  | const IMAGE_MD = `![Alt text](${TINY_PNG_BASE64})\n`;
  23  | const DRAWIO_MD = `![Diagram](diagram.drawio.svg)\n`;
  24  | 
  25  | test.describe('Images', () => {
  26  |   test.beforeEach(async ({ page }) => {
  27  |     await page.goto(FULL_HARNESS_URL);
  28  |     await waitForEditor(page);
  29  |   });
  30  | 
  31  |   // ---------------------------------------------------------------------------
  32  |   // Basic image rendering
  33  |   // ---------------------------------------------------------------------------
  34  | 
  35  |   test('image markdown renders <img> element in editor', async ({ page }) => {
  36  |     await setContent(page, IMAGE_MD);
  37  |     await expect(page.locator('.ProseMirror img')).toBeVisible();
  38  |   });
  39  | 
  40  |   test('image has .markdown-image CSS class', async ({ page }) => {
  41  |     await setContent(page, IMAGE_MD);
  42  |     await expect(page.locator('.ProseMirror .markdown-image')).toBeVisible();
  43  |   });
  44  | 
  45  |   // ---------------------------------------------------------------------------
  46  |   // Context menu
  47  |   // ---------------------------------------------------------------------------
  48  | 
  49  |   test('right-click image opens context menu @smoke', async ({ page }) => {
  50  |     await setContent(page, IMAGE_MD);
  51  |     const img = page.locator('.ProseMirror img').first();
  52  |     await expect(img).toBeVisible();
  53  |     await img.click({ button: 'right' });
  54  |     // Context menu with class .context-menu or similar
  55  |     const menu = page.locator('.context-menu, [class*="context-menu"], [class*="image-context"]');
  56  |     await expect(menu.first()).toBeVisible({ timeout: 3000 });
  57  |   });
  58  | 
  59  |   test('image context menu: "Edit alt text" item present', async ({ page }) => {
  60  |     await setContent(page, IMAGE_MD);
  61  |     const img = page.locator('.ProseMirror img').first();
  62  |     await img.click({ button: 'right' });
  63  |     await page.waitForTimeout(300);
  64  |     const menu = page.locator('.context-menu, [class*="context-menu"]').first();
> 65  |     await expect(menu).toBeVisible({ timeout: 3000 });
      |                        ^ Error: expect(locator).toBeVisible() failed
  66  |     // Item text may be "Edit alt text" or "Alt text"
  67  |     const altItem = menu.locator('li, [role=menuitem]').filter({ hasText: /alt text/i });
  68  |     await expect(altItem.first()).toBeVisible();
  69  |   });
  70  | 
  71  |   test('image context menu: "Rename file" item present', async ({ page }) => {
  72  |     await setContent(page, IMAGE_MD);
  73  |     await page.locator('.ProseMirror img').first().click({ button: 'right' });
  74  |     await page.waitForTimeout(300);
  75  |     const menu = page.locator('.context-menu, [class*="context-menu"]').first();
  76  |     await expect(menu).toBeVisible({ timeout: 3000 });
  77  |     const item = menu.locator('li, [role=menuitem]').filter({ hasText: /rename/i });
  78  |     await expect(item.first()).toBeVisible();
  79  |   });
  80  | 
  81  |   test('image context menu: "Resize" item present @smoke', async ({ page }) => {
  82  |     await setContent(page, IMAGE_MD);
  83  |     await page.locator('.ProseMirror img').first().click({ button: 'right' });
  84  |     await page.waitForTimeout(300);
  85  |     const menu = page.locator('.context-menu, [class*="context-menu"]').first();
  86  |     await expect(menu).toBeVisible({ timeout: 3000 });
  87  |     const item = menu.locator('li, [role=menuitem]').filter({ hasText: /resize/i });
  88  |     await expect(item.first()).toBeVisible();
  89  |   });
  90  | 
  91  |   test('image context menu: "AI explain" item present @smoke', async ({ page }) => {
  92  |     await setContent(page, IMAGE_MD);
  93  |     await page.locator('.ProseMirror img').first().click({ button: 'right' });
  94  |     await page.waitForTimeout(300);
  95  |     const menu = page.locator('.context-menu, [class*="context-menu"]').first();
  96  |     await expect(menu).toBeVisible({ timeout: 3000 });
  97  |     const item = menu.locator('li, [role=menuitem]').filter({ hasText: /explain/i });
  98  |     await expect(item.first()).toBeVisible();
  99  |   });
  100 | 
  101 |   test('image context menu: "Copy path" item present', async ({ page }) => {
  102 |     await setContent(page, IMAGE_MD);
  103 |     await page.locator('.ProseMirror img').first().click({ button: 'right' });
  104 |     await page.waitForTimeout(300);
  105 |     const menu = page.locator('.context-menu, [class*="context-menu"]').first();
  106 |     await expect(menu).toBeVisible({ timeout: 3000 });
  107 |     const item = menu.locator('li, [role=menuitem]').filter({ hasText: /copy/i });
  108 |     await expect(item.first()).toBeVisible();
  109 |   });
  110 | 
  111 |   test('clicking outside context menu dismisses it', async ({ page }) => {
  112 |     await setContent(page, IMAGE_MD);
  113 |     await page.locator('.ProseMirror img').first().click({ button: 'right' });
  114 |     await page.waitForTimeout(300);
  115 |     const menu = page.locator('.context-menu, [class*="context-menu"]').first();
  116 |     await expect(menu).toBeVisible({ timeout: 3000 });
  117 |     // Click somewhere else
  118 |     await page.keyboard.press('Escape');
  119 |     await page.waitForTimeout(200);
  120 |     // Menu should be gone
  121 |     await expect(menu).toBeHidden({ timeout: 2000 });
  122 |   });
  123 | 
  124 |   // ---------------------------------------------------------------------------
  125 |   // Draw.io detection
  126 |   // ---------------------------------------------------------------------------
  127 | 
  128 |   test('draw.io: .drawio.svg filename recognized — context menu shows "Open diagram" not "Resize"', async ({ page }) => {
  129 |     await setContent(page, DRAWIO_MD);
  130 |     // The image might render as a placeholder
  131 |     const img = page.locator('.ProseMirror img').first();
  132 |     // If it exists, right-click it; otherwise this test is informational
  133 |     const imgCount = await img.count();
  134 |     if (imgCount > 0) {
  135 |       await img.click({ button: 'right' });
  136 |       await page.waitForTimeout(300);
  137 |       const menu = page.locator('.context-menu, [class*="context-menu"]').first();
  138 |       if (await menu.isVisible()) {
  139 |         const openItem = menu.locator('li, [role=menuitem]').filter({ hasText: /open|diagram/i });
  140 |         const resizeItem = menu.locator('li, [role=menuitem]').filter({ hasText: /resize/i });
  141 |         // If "open diagram" exists, that's the draw.io item
  142 |         if (await openItem.count() > 0) {
  143 |           await expect(openItem.first()).toBeVisible();
  144 |           // resize should not be the primary action
  145 |           await expect(resizeItem.first()).toBeHidden().catch(() => {/* OK if absent */});
  146 |         }
  147 |       }
  148 |     }
  149 |     // If draw.io extension not available in harness, the test still passes
  150 |     // (draw.io depends on VS Code host to open the editor)
  151 |   });
  152 | });
  153 | 
```