# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: bubble-menu.spec.ts >> Bubble Menu >> bubble menu appears on text selection @smoke
- Location: src\__tests__\playwright\bubble-menu.spec.ts:39:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator:  locator('#bubble-menu')
Expected: visible
Received: hidden
Timeout:  2000ms

Call log:
  - Expect "toBeVisible" with timeout 2000ms
  - waiting for locator('#bubble-menu')
    6 × locator resolved to <div tabindex="0" role="toolbar" id="bubble-menu" aria-label="Formatting">…</div>
      - unexpected value "hidden"

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
    - paragraph [ref=e48]: Hello world
  - generic [ref=e49]: Loading editor…
```

# Test source

```ts
  1   | /**
  2   |  * Bubble Menu — Playwright spec
  3   |  *
  4   |  * Tests that the floating formatting bar (BubbleMenuExtension) appears on text
  5   |  * selection and that each button applies the correct mark or node transformation.
  6   |  *
  7   |  * The harness HTML pre-builds the #bubble-menu element; BubbleMenuExtension
  8   |  * controls its CSS display property. Buttons in the bubble menu call
  9   |  * window.editorAPI.runCommand() directly via onclick.
  10  |  */
  11  | 
  12  | import { test, expect } from '@playwright/test';
  13  | import {
  14  |   FULL_HARNESS_URL,
  15  |   waitForEditor,
  16  |   setContent,
  17  |   getActiveMarks,
  18  |   runEditorCommand,
  19  | } from './helpers/index';
  20  | 
  21  | // Helper: place cursor in editor, type text, then select all
  22  | async function typeAndSelectAll(page: any, text: string) {
  23  |   await page.locator('.ProseMirror').click();
  24  |   await page.keyboard.type(text);
  25  |   await page.keyboard.press('Control+a');
  26  | }
  27  | 
  28  | test.describe('Bubble Menu', () => {
  29  |   test.beforeEach(async ({ page }) => {
  30  |     await page.goto(FULL_HARNESS_URL);
  31  |     await waitForEditor(page);
  32  |     await setContent(page, '');
  33  |   });
  34  | 
  35  |   // ---------------------------------------------------------------------------
  36  |   // Visibility
  37  |   // ---------------------------------------------------------------------------
  38  | 
  39  |   test('bubble menu appears on text selection @smoke', async ({ page }) => {
  40  |     await typeAndSelectAll(page, 'Hello world');
  41  |     const bubbleMenu = page.locator('#bubble-menu');
> 42  |     await expect(bubbleMenu).toBeVisible({ timeout: 2000 });
      |                              ^ Error: expect(locator).toBeVisible() failed
  43  |   });
  44  | 
  45  |   test('bubble menu disappears when selection is cleared', async ({ page }) => {
  46  |     await typeAndSelectAll(page, 'Hello');
  47  |     const bubbleMenu = page.locator('#bubble-menu');
  48  |     await expect(bubbleMenu).toBeVisible({ timeout: 2000 });
  49  |     // Click somewhere to deselect
  50  |     await page.locator('.ProseMirror').click({ position: { x: 10, y: 200 } });
  51  |     await expect(bubbleMenu).toBeHidden({ timeout: 2000 });
  52  |   });
  53  | 
  54  |   // ---------------------------------------------------------------------------
  55  |   // Formatting buttons via toolbar (data-testid on toolbar row)
  56  |   // The toolbar buttons are always visible and call the same commands as bubble menu.
  57  |   // We test via toolbar since it's always accessible without needing to maintain selection.
  58  |   // ---------------------------------------------------------------------------
  59  | 
  60  |   test('Bold button applies <strong> mark @smoke', async ({ page }) => {
  61  |     await page.locator('.ProseMirror').click();
  62  |     await page.keyboard.type('Bold me');
  63  |     await page.keyboard.press('Control+a');
  64  |     await page.locator('[data-testid="toolbar-bold"]').click();
  65  |     await expect(page.locator('.ProseMirror strong')).toBeVisible();
  66  |   });
  67  | 
  68  |   test('Italic button applies <em> mark', async ({ page }) => {
  69  |     await page.locator('.ProseMirror').click();
  70  |     await page.keyboard.type('Italic me');
  71  |     await page.keyboard.press('Control+a');
  72  |     await page.locator('[data-testid="toolbar-italic"]').click();
  73  |     await expect(page.locator('.ProseMirror em')).toBeVisible();
  74  |   });
  75  | 
  76  |   test('Underline button applies underline mark', async ({ page }) => {
  77  |     await page.locator('.ProseMirror').click();
  78  |     await page.keyboard.type('Underline me');
  79  |     await page.keyboard.press('Control+a');
  80  |     await page.locator('[data-testid="toolbar-underline"]').click();
  81  |     const marks = await getActiveMarks(page);
  82  |     expect(marks).toContain('underline');
  83  |   });
  84  | 
  85  |   test('Strikethrough button applies strike mark', async ({ page }) => {
  86  |     await page.locator('.ProseMirror').click();
  87  |     await page.keyboard.type('Strike me');
  88  |     await page.keyboard.press('Control+a');
  89  |     await page.locator('[data-testid="toolbar-strike"]').click();
  90  |     const marks = await getActiveMarks(page);
  91  |     expect(marks).toContain('strike');
  92  |   });
  93  | 
  94  |   test('Inline code button applies code mark', async ({ page }) => {
  95  |     await page.locator('.ProseMirror').click();
  96  |     await page.keyboard.type('code me');
  97  |     await page.keyboard.press('Control+a');
  98  |     await page.locator('[data-testid="toolbar-code"]').click();
  99  |     await expect(page.locator('.ProseMirror code')).toBeVisible();
  100 |   });
  101 | 
  102 |   test('Highlight button applies .highlight class', async ({ page }) => {
  103 |     await page.locator('.ProseMirror').click();
  104 |     await page.keyboard.type('Highlight me');
  105 |     await page.keyboard.press('Control+a');
  106 |     await page.locator('[data-testid="toolbar-highlight"]').click();
  107 |     await expect(page.locator('.ProseMirror .highlight')).toBeVisible();
  108 |   });
  109 | 
  110 |   // ---------------------------------------------------------------------------
  111 |   // Heading buttons
  112 |   // ---------------------------------------------------------------------------
  113 | 
  114 |   test('H1 button sets h1 node', async ({ page }) => {
  115 |     await page.locator('.ProseMirror').click();
  116 |     await page.keyboard.type('Heading');
  117 |     await page.locator('[data-testid="toolbar-h1"]').click();
  118 |     await expect(page.locator('.ProseMirror h1')).toBeVisible();
  119 |   });
  120 | 
  121 |   test('H2 button sets h2 node', async ({ page }) => {
  122 |     await page.locator('.ProseMirror').click();
  123 |     await page.keyboard.type('H2');
  124 |     await page.locator('[data-testid="toolbar-h2"]').click();
  125 |     await expect(page.locator('.ProseMirror h2')).toBeVisible();
  126 |   });
  127 | 
  128 |   test('H3 button sets h3 node', async ({ page }) => {
  129 |     await page.locator('.ProseMirror').click();
  130 |     await page.keyboard.type('H3');
  131 |     await page.locator('[data-testid="toolbar-h3"]').click();
  132 |     await expect(page.locator('.ProseMirror h3')).toBeVisible();
  133 |   });
  134 | 
  135 |   // ---------------------------------------------------------------------------
  136 |   // List buttons
  137 |   // ---------------------------------------------------------------------------
  138 | 
  139 |   test('Bullet list button inserts <ul>', async ({ page }) => {
  140 |     await page.locator('.ProseMirror').click();
  141 |     await page.keyboard.type('List item');
  142 |     await page.locator('[data-testid="toolbar-bullet-list"]').click();
```