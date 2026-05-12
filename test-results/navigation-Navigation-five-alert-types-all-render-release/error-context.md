# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: navigation.spec.ts >> Navigation >> five alert types all render
- Location: src\__tests__\playwright\navigation.spec.ts:95:7

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  locator('.github-alert, [class*="github-alert"]')
Expected: 5
Received: 25
Timeout:  3000ms

Call log:
  - Expect "toHaveCount" with timeout 3000ms
  - waiting for locator('.github-alert, [class*="github-alert"]')
    7 × locator resolved to 25 elements
      - unexpected value "25"

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
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
  - textbox [ref=e47]:
    - blockquote [ref=e48]:
      - strong [ref=e50]: NOTE
      - paragraph [ref=e52]: This is a note.
    - blockquote [ref=e53]:
      - strong [ref=e55]: WARNING
      - paragraph [ref=e57]: This is a warning.
    - blockquote [ref=e58]:
      - strong [ref=e60]: TIP
      - paragraph [ref=e62]: This is a tip.
    - blockquote [ref=e63]:
      - strong [ref=e65]: IMPORTANT
      - paragraph [ref=e67]: This is important.
    - blockquote [ref=e68]:
      - strong [ref=e70]: CAUTION
      - paragraph [ref=e72]: Caution here.
    - paragraph [ref=e73]
  - generic [ref=e74]: Loading editor…
```

# Test source

```ts
  1   | /**
  2   |  * Navigation — Playwright spec
  3   |  *
  4   |  * Tests Table of Contents (TOC) generation and in-document navigation,
  5   |  * GitHub Alerts rendering, and heading anchor links.
  6   |  *
  7   |  * Run smoke tests only: npx playwright test navigation.spec.ts --project smoke
  8   |  * Run all:              npx playwright test navigation.spec.ts
  9   |  */
  10  | 
  11  | import { test, expect } from '@playwright/test';
  12  | import {
  13  |   FULL_HARNESS_URL,
  14  |   waitForEditor,
  15  |   setContent,
  16  |   getContent,
  17  | } from './helpers/index';
  18  | 
  19  | const HEADINGS_MD = `# Chapter One
  20  | 
  21  | Some content here.
  22  | 
  23  | ## Section A
  24  | 
  25  | More content.
  26  | 
  27  | ### Subsection A.1
  28  | 
  29  | Deep content.
  30  | 
  31  | ## Section B
  32  | 
  33  | Final content.
  34  | `;
  35  | 
  36  | const ALERTS_MD = `> [!NOTE]
  37  | > This is a note.
  38  | 
  39  | > [!WARNING]
  40  | > This is a warning.
  41  | 
  42  | > [!TIP]
  43  | > This is a tip.
  44  | 
  45  | > [!IMPORTANT]
  46  | > This is important.
  47  | 
  48  | > [!CAUTION]
  49  | > Caution here.
  50  | `;
  51  | 
  52  | test.describe('Navigation', () => {
  53  |   test.beforeEach(async ({ page }) => {
  54  |     await page.goto(FULL_HARNESS_URL);
  55  |     await waitForEditor(page);
  56  |     await setContent(page, '');
  57  |   });
  58  | 
  59  |   // ---------------------------------------------------------------------------
  60  |   // Table of Contents
  61  |   // ---------------------------------------------------------------------------
  62  | 
  63  |   test('TOC pane element exists in DOM @smoke', async ({ page }) => {
  64  |     await setContent(page, HEADINGS_MD);
  65  |     // TOC may be a side pane or in-document rendering
  66  |     const toc = page.locator('.toc-pane-mount, [class*="toc-pane"], [class*="table-of-contents"]');
  67  |     // TOC is present in DOM (may be hidden if no toolbar button clicked)
  68  |     const count = await toc.count();
  69  |     expect(count).toBeGreaterThanOrEqual(0); // Relaxed: implementation may differ
  70  |   });
  71  | 
  72  |   test('TOC toolbar button exists @smoke', async ({ page }) => {
  73  |     await setContent(page, HEADINGS_MD);
  74  |     const tocBtn = page.locator('[data-testid="toolbar-toc"], [data-testid*="toc"], [data-action*="toc"]');
  75  |     const count = await tocBtn.count();
  76  |     expect(count).toBeGreaterThanOrEqual(0); // Present if TOC feature enabled
  77  |   });
  78  | 
  79  |   // ---------------------------------------------------------------------------
  80  |   // GitHub Alerts
  81  |   // ---------------------------------------------------------------------------
  82  | 
  83  |   test('NOTE alert renders with .github-alert class @smoke', async ({ page }) => {
  84  |     await setContent(page, ALERTS_MD);
  85  |     const note = page.locator('.github-alert, .github-alert-note, [class*="github-alert"]');
  86  |     await expect(note.first()).toBeVisible({ timeout: 3000 });
  87  |   });
  88  | 
  89  |   test('WARNING alert renders', async ({ page }) => {
  90  |     await setContent(page, ALERTS_MD);
  91  |     const warn = page.locator('.github-alert-warning, [class*="warning"]');
  92  |     await expect(warn.first()).toBeVisible({ timeout: 3000 });
  93  |   });
  94  | 
  95  |   test('five alert types all render', async ({ page }) => {
  96  |     await setContent(page, ALERTS_MD);
  97  |     const alerts = page.locator('.github-alert, [class*="github-alert"]');
> 98  |     await expect(alerts).toHaveCount(5, { timeout: 3000 });
      |                          ^ Error: expect(locator).toHaveCount(expected) failed
  99  |   });
  100 | 
  101 |   test('alerts roundtrip — GitHub syntax preserved @smoke', async ({ page }) => {
  102 |     await setContent(page, ALERTS_MD);
  103 |     const output = await getContent(page);
  104 |     expect(output).toContain('[!NOTE]');
  105 |     expect(output).toContain('[!WARNING]');
  106 |   });
  107 | 
  108 |   test('alert content text preserved in roundtrip', async ({ page }) => {
  109 |     await setContent(page, ALERTS_MD);
  110 |     const output = await getContent(page);
  111 |     expect(output).toContain('This is a note');
  112 |     expect(output).toContain('This is a warning');
  113 |   });
  114 | 
  115 |   // ---------------------------------------------------------------------------
  116 |   // Headings
  117 |   // ---------------------------------------------------------------------------
  118 | 
  119 |   test('headings render as h1/h2/h3 DOM elements', async ({ page }) => {
  120 |     await setContent(page, HEADINGS_MD);
  121 |     await expect(page.locator('.ProseMirror h1')).toBeVisible();
  122 |     await expect(page.locator('.ProseMirror h2').first()).toBeVisible();
  123 |     await expect(page.locator('.ProseMirror h3')).toBeVisible();
  124 |   });
  125 | 
  126 |   test('heading count is correct', async ({ page }) => {
  127 |     await setContent(page, HEADINGS_MD);
  128 |     await expect(page.locator('.ProseMirror h1')).toHaveCount(1);
  129 |     await expect(page.locator('.ProseMirror h2')).toHaveCount(2);
  130 |     await expect(page.locator('.ProseMirror h3')).toHaveCount(1);
  131 |   });
  132 | 
  133 |   test('headings roundtrip — markdown preserved', async ({ page }) => {
  134 |     await setContent(page, HEADINGS_MD);
  135 |     const output = await getContent(page);
  136 |     expect(output).toContain('# Chapter One');
  137 |     expect(output).toContain('## Section A');
  138 |     expect(output).toContain('### Subsection A.1');
  139 |   });
  140 | 
  141 |   // ---------------------------------------------------------------------------
  142 |   // Mixed content
  143 |   // ---------------------------------------------------------------------------
  144 | 
  145 |   test('document with headings and alerts has no console errors', async ({ page }) => {
  146 |     const errors: string[] = [];
  147 |     page.on('console', msg => {
  148 |       if (msg.type() === 'error' && !msg.text().includes('ResizeObserver') && !msg.text().includes('favicon')) {
  149 |         errors.push(msg.text());
  150 |       }
  151 |     });
  152 |     await setContent(page, HEADINGS_MD + '\n' + ALERTS_MD);
  153 |     await page.waitForTimeout(500);
  154 |     expect(errors).toHaveLength(0);
  155 |   });
  156 | });
  157 | 
```