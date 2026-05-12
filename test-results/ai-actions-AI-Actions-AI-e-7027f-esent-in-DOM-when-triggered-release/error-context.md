# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ai-actions.spec.ts >> AI Actions >> AI explain panel element present in DOM when triggered
- Location: src\__tests__\playwright\ai-actions.spec.ts:82:7

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
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
      - button "💡 AI Explain" [active] [ref=e43] [cursor=pointer]
  - textbox [ref=e47]:
    - heading "Test" [level=1] [ref=e48]
    - paragraph [ref=e49]: Some paragraph content here.
  - generic [ref=e50]: Loading editor…
```

# Test source

```ts
  1   | /**
  2   |  * AI Actions — Playwright spec
  3   |  *
  4   |  * Tests AI Explain panel behavior and AI Refine integration.
  5   |  * In the harness, window.vscode.postMessage is a no-op but records messages.
  6   |  * We verify that AI actions trigger the right messages and don't crash.
  7   |  *
  8   |  * Run smoke tests only: npx playwright test ai-actions.spec.ts --project smoke
  9   |  * Run all:              npx playwright test ai-actions.spec.ts
  10  |  */
  11  | 
  12  | import { test, expect } from '@playwright/test';
  13  | import {
  14  |   FULL_HARNESS_URL,
  15  |   waitForEditor,
  16  |   setContent,
  17  | } from './helpers/index';
  18  | 
  19  | test.describe('AI Actions', () => {
  20  |   test.beforeEach(async ({ page }) => {
  21  |     await page.goto(FULL_HARNESS_URL);
  22  |     await waitForEditor(page);
  23  |     await setContent(page, '# Test\n\nSome paragraph content here.\n');
  24  |   });
  25  | 
  26  |   // ---------------------------------------------------------------------------
  27  |   // AI Refine
  28  |   // ---------------------------------------------------------------------------
  29  | 
  30  |   test('AI refine toolbar button sends postMessage @smoke', async ({ page }) => {
  31  |     // Select text first
  32  |     await page.locator('.ProseMirror').click();
  33  |     await page.keyboard.press('Control+a');
  34  |     // Click AI refine
  35  |     await page.locator('[data-testid="toolbar-ai-refine"]').click();
  36  |     await page.waitForTimeout(300);
  37  |     // Verify a message was posted
  38  |     const lastMessage = await page.evaluate(() => (window as any).__lastMessage);
  39  |     expect(lastMessage).not.toBeNull();
  40  |   });
  41  | 
  42  |   test('AI refine button is visible without text selection', async ({ page }) => {
  43  |     await expect(page.locator('[data-testid="toolbar-ai-refine"]')).toBeVisible();
  44  |   });
  45  | 
  46  |   test('AI refine in bubble menu visible on selection @smoke', async ({ page }) => {
  47  |     await page.locator('.ProseMirror').click();
  48  |     await page.keyboard.type('Select this');
  49  |     await page.keyboard.press('Control+a');
  50  |     const bubbleMenu = page.locator('#bubble-menu');
  51  |     await expect(bubbleMenu).toBeVisible({ timeout: 2000 });
  52  |     await expect(bubbleMenu.locator('[data-testid="bubble-ai-refine"]')).toBeVisible();
  53  |   });
  54  | 
  55  |   // ---------------------------------------------------------------------------
  56  |   // AI Explain
  57  |   // ---------------------------------------------------------------------------
  58  | 
  59  |   test('AI explain button is present in toolbar', async ({ page }) => {
  60  |     await expect(page.locator('[data-testid="toolbar-ai-explain"]')).toBeVisible();
  61  |   });
  62  | 
  63  |   test('AI explain sends postMessage @smoke', async ({ page }) => {
  64  |     await page.locator('[data-testid="toolbar-ai-explain"]').click();
  65  |     await page.waitForTimeout(300);
  66  |     const messages = await page.evaluate(() => (window as any).__messages as any[]);
  67  |     expect(messages.length).toBeGreaterThanOrEqual(1);
  68  |   });
  69  | 
  70  |   test('AI explain does not produce console errors', async ({ page }) => {
  71  |     const errors: string[] = [];
  72  |     page.on('console', msg => {
  73  |       if (msg.type() === 'error' && !msg.text().includes('ResizeObserver') && !msg.text().includes('favicon')) {
  74  |         errors.push(msg.text());
  75  |       }
  76  |     });
  77  |     await page.locator('[data-testid="toolbar-ai-explain"]').click();
  78  |     await page.waitForTimeout(500);
  79  |     expect(errors).toHaveLength(0);
  80  |   });
  81  | 
  82  |   test('AI explain panel element present in DOM when triggered', async ({ page }) => {
  83  |     await page.locator('[data-testid="toolbar-ai-explain"]').click();
  84  |     await page.waitForTimeout(300);
  85  |     // Panel may be shown as .ai-explain-panel or via postMessage only
  86  |     const panel = page.locator('.ai-explain-panel, [class*="ai-explain"]');
  87  |     const count = await panel.count();
  88  |     // Either the panel is in DOM or the message was sent — both are valid patterns
  89  |     const messages = await page.evaluate(() => (window as any).__messages as any[]);
> 90  |     expect(count > 0 || messages.length > 0).toBe(true);
      |                                              ^ Error: expect(received).toBe(expected) // Object.is equality
  91  |   });
  92  | 
  93  |   // ---------------------------------------------------------------------------
  94  |   // No crash paths
  95  |   // ---------------------------------------------------------------------------
  96  | 
  97  |   test('clicking AI refine without selection does not crash', async ({ page }) => {
  98  |     const errors: string[] = [];
  99  |     page.on('console', msg => {
  100 |       if (msg.type() === 'error' && !msg.text().includes('ResizeObserver') && !msg.text().includes('favicon')) {
  101 |         errors.push(msg.text());
  102 |       }
  103 |     });
  104 |     // Click without any selection
  105 |     await page.locator('.ProseMirror').click({ position: { x: 200, y: 200 } });
  106 |     await page.locator('[data-testid="toolbar-ai-refine"]').click();
  107 |     await page.waitForTimeout(300);
  108 |     expect(errors).toHaveLength(0);
  109 |   });
  110 | });
  111 | 
```