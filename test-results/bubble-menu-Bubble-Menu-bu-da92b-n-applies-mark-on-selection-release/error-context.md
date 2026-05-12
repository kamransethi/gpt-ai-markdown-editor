# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: bubble-menu.spec.ts >> Bubble Menu >> bubble menu bold button applies mark on selection
- Location: src\__tests__\playwright\bubble-menu.spec.ts:214:7

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
    - paragraph [ref=e48]: Bubble bold
  - generic [ref=e49]: Loading editor…
```

# Test source

```ts
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
  143 |     await expect(page.locator('.ProseMirror ul')).toBeVisible();
  144 |   });
  145 | 
  146 |   test('Ordered list button inserts <ol>', async ({ page }) => {
  147 |     await page.locator('.ProseMirror').click();
  148 |     await page.keyboard.type('First item');
  149 |     await page.locator('[data-testid="toolbar-ordered-list"]').click();
  150 |     await expect(page.locator('.ProseMirror ol')).toBeVisible();
  151 |   });
  152 | 
  153 |   test('Task list button inserts task item checkbox', async ({ page }) => {
  154 |     await page.locator('.ProseMirror').click();
  155 |     await page.keyboard.type('Task');
  156 |     await page.locator('[data-testid="toolbar-task-list"]').click();
  157 |     await expect(page.locator('.ProseMirror input[type="checkbox"]')).toBeVisible();
  158 |   });
  159 | 
  160 |   // ---------------------------------------------------------------------------
  161 |   // Table-specific buttons
  162 |   // ---------------------------------------------------------------------------
  163 | 
  164 |   test('table add-row-after button visible @smoke', async ({ page }) => {
  165 |     await expect(page.locator('[data-testid="toolbar-add-row-after"]')).toBeVisible();
  166 |   });
  167 | 
  168 |   test('table add-row-before button visible', async ({ page }) => {
  169 |     await expect(page.locator('[data-testid="toolbar-add-row-before"]')).toBeVisible();
  170 |   });
  171 | 
  172 |   test('table delete-row button visible', async ({ page }) => {
  173 |     await expect(page.locator('[data-testid="toolbar-delete-row"]')).toBeVisible();
  174 |   });
  175 | 
  176 |   test('table add-col-after button visible', async ({ page }) => {
  177 |     await expect(page.locator('[data-testid="toolbar-add-col-after"]')).toBeVisible();
  178 |   });
  179 | 
  180 |   test('table add-col-before button visible', async ({ page }) => {
  181 |     await expect(page.locator('[data-testid="toolbar-add-col-before"]')).toBeVisible();
  182 |   });
  183 | 
  184 |   test('table delete-col button visible', async ({ page }) => {
  185 |     await expect(page.locator('[data-testid="toolbar-delete-col"]')).toBeVisible();
  186 |   });
  187 | 
  188 |   test('table operations via toolbar buttons work inside a table', async ({ page }) => {
  189 |     await runEditorCommand(page, 'insertTable', { rows: 2, cols: 2, withHeaderRow: true });
  190 |     const firstCell = page.locator('.ProseMirror table td').first();
  191 |     await firstCell.click();
  192 |     const before = await page.locator('.ProseMirror table tr').count();
  193 |     await page.locator('[data-testid="toolbar-add-row-after"]').click();
  194 |     const after = await page.locator('.ProseMirror table tr').count();
  195 |     expect(after).toBe(before + 1);
  196 |   });
  197 | 
  198 |   // ---------------------------------------------------------------------------
  199 |   // AI buttons
  200 |   // ---------------------------------------------------------------------------
  201 | 
  202 |   test('AI refine toolbar button is present @smoke', async ({ page }) => {
  203 |     await expect(page.locator('[data-testid="toolbar-ai-refine"]')).toBeVisible();
  204 |   });
  205 | 
  206 |   test('AI explain toolbar button is present', async ({ page }) => {
  207 |     await expect(page.locator('[data-testid="toolbar-ai-explain"]')).toBeVisible();
  208 |   });
  209 | 
  210 |   // ---------------------------------------------------------------------------
  211 |   // Bubble menu button-specific tests (tests that require a live selection)
  212 |   // ---------------------------------------------------------------------------
  213 | 
  214 |   test('bubble menu bold button applies mark on selection', async ({ page }) => {
  215 |     await typeAndSelectAll(page, 'Bubble bold');
  216 |     const bubbleMenu = page.locator('#bubble-menu');
> 217 |     await expect(bubbleMenu).toBeVisible({ timeout: 2000 });
      |                              ^ Error: expect(locator).toBeVisible() failed
  218 |     await bubbleMenu.locator('[data-testid="bubble-bold"]').click();
  219 |     await expect(page.locator('.ProseMirror strong')).toBeVisible();
  220 |   });
  221 | 
  222 |   test('bubble menu italic button applies mark on selection', async ({ page }) => {
  223 |     await typeAndSelectAll(page, 'Bubble italic');
  224 |     const bubbleMenu = page.locator('#bubble-menu');
  225 |     await expect(bubbleMenu).toBeVisible({ timeout: 2000 });
  226 |     await bubbleMenu.locator('[data-testid="bubble-italic"]').click();
  227 |     await expect(page.locator('.ProseMirror em')).toBeVisible();
  228 |   });
  229 | 
  230 |   test('bubble menu AI refine button is present @smoke', async ({ page }) => {
  231 |     await typeAndSelectAll(page, 'AI refine test');
  232 |     const bubbleMenu = page.locator('#bubble-menu');
  233 |     await expect(bubbleMenu).toBeVisible({ timeout: 2000 });
  234 |     await expect(bubbleMenu.locator('[data-testid="bubble-ai-refine"]')).toBeVisible();
  235 |   });
  236 | });
  237 | 
```