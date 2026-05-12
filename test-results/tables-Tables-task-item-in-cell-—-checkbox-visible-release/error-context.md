# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tables.spec.ts >> Tables >> task item in cell — checkbox visible
- Location: src\__tests__\playwright\tables.spec.ts:192:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.ProseMirror table td').first().locator('input[type="checkbox"]')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('.ProseMirror table td').first().locator('input[type="checkbox"]')

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
    - table [ref=e49]:
      - rowgroup [ref=e53]:
        - row "Task item checkbox for Task item Task item" [ref=e54]:
          - columnheader "Task item checkbox for Task item Task item" [ref=e55]:
            - list [ref=e56]:
              - listitem [ref=e57]:
                - checkbox "Task item checkbox for Task item" [ref=e59]
                - paragraph [ref=e61]: Task item
          - columnheader [ref=e62]:
            - paragraph [ref=e63]
        - row [ref=e64]:
          - cell [ref=e65]:
            - paragraph [ref=e66]
          - cell [ref=e67]:
            - paragraph [ref=e68]
    - paragraph [ref=e69]
  - generic [ref=e70]: Loading editor…
```

# Test source

```ts
  98  | 
  99  |   test('two hard breaks in same cell — two <br> nodes present', async ({ page }) => {
  100 |     await runEditorCommand(page, 'insertTable', { rows: 2, cols: 2, withHeaderRow: true });
  101 |     const firstCell = page.locator('.ProseMirror table td').first();
  102 |     await firstCell.click();
  103 |     await page.keyboard.type('A');
  104 |     await page.keyboard.press('Shift+Enter');
  105 |     await page.keyboard.type('B');
  106 |     await page.keyboard.press('Shift+Enter');
  107 |     await page.keyboard.type('C');
  108 |     const brs = firstCell.locator('br');
  109 |     await expect(brs).toHaveCount(2);
  110 |   });
  111 | 
  112 |   test('roundtrip hard break — getMarkdown contains <br> after Shift+Enter', async ({ page }) => {
  113 |     await runEditorCommand(page, 'insertTable', { rows: 2, cols: 2, withHeaderRow: true });
  114 |     const firstCell = page.locator('.ProseMirror table td').first();
  115 |     await firstCell.click();
  116 |     await page.keyboard.type('L1');
  117 |     await page.keyboard.press('Shift+Enter');
  118 |     await page.keyboard.type('L2');
  119 |     const md = await getContent(page);
  120 |     // The table serializer should output <br> for hard breaks in cells
  121 |     expect(md).toContain('<br>');
  122 |   });
  123 | 
  124 |   // ---------------------------------------------------------------------------
  125 |   // Cell content — bullet lists
  126 |   // ---------------------------------------------------------------------------
  127 | 
  128 |   test('bullet list in cell — <ul> present inside <td> @smoke', async ({ page }) => {
  129 |     await runEditorCommand(page, 'insertTable', { rows: 2, cols: 2, withHeaderRow: true });
  130 |     const firstCell = page.locator('.ProseMirror table td').first();
  131 |     await firstCell.click();
  132 |     await runEditorCommand(page, 'toggleBulletList');
  133 |     await expect(firstCell.locator('ul')).toBeVisible();
  134 |   });
  135 | 
  136 |   test('nested bullet depth-1 — <ul><ul> present inside cell', async ({ page }) => {
  137 |     await runEditorCommand(page, 'insertTable', { rows: 2, cols: 2, withHeaderRow: true });
  138 |     const firstCell = page.locator('.ProseMirror table td').first();
  139 |     await firstCell.click();
  140 |     await runEditorCommand(page, 'toggleBulletList');
  141 |     await page.keyboard.type('Item');
  142 |     await page.keyboard.press('Enter');
  143 |     await page.keyboard.type('Nested');
  144 |     await page.keyboard.press('Tab');
  145 |     // Two levels of ul
  146 |     await expect(firstCell.locator('ul ul')).toBeVisible();
  147 |   });
  148 | 
  149 |   test('ordered list in cell — <ol> present inside <td>', async ({ page }) => {
  150 |     await runEditorCommand(page, 'insertTable', { rows: 2, cols: 2, withHeaderRow: true });
  151 |     const firstCell = page.locator('.ProseMirror table td').first();
  152 |     await firstCell.click();
  153 |     await runEditorCommand(page, 'toggleOrderedList');
  154 |     await page.keyboard.type('First');
  155 |     await expect(firstCell.locator('ol')).toBeVisible();
  156 |   });
  157 | 
  158 |   // ---------------------------------------------------------------------------
  159 |   // Cell content — marks
  160 |   // ---------------------------------------------------------------------------
  161 | 
  162 |   test('bold mark in cell — <strong> inside <td>', async ({ page }) => {
  163 |     await runEditorCommand(page, 'insertTable', { rows: 2, cols: 2, withHeaderRow: true });
  164 |     const firstCell = page.locator('.ProseMirror table td').first();
  165 |     await firstCell.click();
  166 |     await page.keyboard.type('Bold text');
  167 |     await page.keyboard.press('Control+a');
  168 |     await page.keyboard.press('Control+b');
  169 |     await expect(firstCell.locator('strong')).toBeVisible();
  170 |   });
  171 | 
  172 |   test('italic mark in cell — <em> inside <td>', async ({ page }) => {
  173 |     await runEditorCommand(page, 'insertTable', { rows: 2, cols: 2, withHeaderRow: true });
  174 |     const firstCell = page.locator('.ProseMirror table td').first();
  175 |     await firstCell.click();
  176 |     await page.keyboard.type('Italic text');
  177 |     await page.keyboard.press('Control+a');
  178 |     await page.keyboard.press('Control+i');
  179 |     await expect(firstCell.locator('em')).toBeVisible();
  180 |   });
  181 | 
  182 |   test('highlight mark in cell — .highlight class inside <td>', async ({ page }) => {
  183 |     await runEditorCommand(page, 'insertTable', { rows: 2, cols: 2, withHeaderRow: true });
  184 |     const firstCell = page.locator('.ProseMirror table td').first();
  185 |     await firstCell.click();
  186 |     await page.keyboard.type('Highlighted');
  187 |     await page.keyboard.press('Control+a');
  188 |     await runEditorCommand(page, 'toggleHighlight');
  189 |     await expect(firstCell.locator('.highlight')).toBeVisible();
  190 |   });
  191 | 
  192 |   test('task item in cell — checkbox visible', async ({ page }) => {
  193 |     await runEditorCommand(page, 'insertTable', { rows: 2, cols: 2, withHeaderRow: true });
  194 |     const firstCell = page.locator('.ProseMirror table td').first();
  195 |     await firstCell.click();
  196 |     await runEditorCommand(page, 'toggleTaskList');
  197 |     await page.keyboard.type('Task item');
> 198 |     await expect(firstCell.locator('input[type="checkbox"]')).toBeVisible();
      |                                                               ^ Error: expect(locator).toBeVisible() failed
  199 |   });
  200 | 
  201 |   // ---------------------------------------------------------------------------
  202 |   // Context menu operations
  203 |   // ---------------------------------------------------------------------------
  204 | 
  205 |   test('right-click in table opens context menu @smoke', async ({ page }) => {
  206 |     await runEditorCommand(page, 'insertTable', { rows: 3, cols: 3, withHeaderRow: true });
  207 |     const firstCell = page.locator('.ProseMirror table td').first();
  208 |     await firstCell.click({ button: 'right' });
  209 |     // Context menu should appear
  210 |     const menu = page.locator('.context-menu, .table-context-menu, [class*="context-menu"]');
  211 |     await expect(menu.first()).toBeVisible({ timeout: 3000 });
  212 |   });
  213 | 
  214 |   test('table context menu: Add row below increases row count', async ({ page }) => {
  215 |     await runEditorCommand(page, 'insertTable', { rows: 2, cols: 2, withHeaderRow: true });
  216 |     const initialCount = await page.locator('.ProseMirror table tr').count();
  217 |     // Add row via command directly (context menu UI varies)
  218 |     await runEditorCommand(page, 'addRowAfter');
  219 |     const newCount = await page.locator('.ProseMirror table tr').count();
  220 |     expect(newCount).toBe(initialCount + 1);
  221 |   });
  222 | 
  223 |   test('table context menu: Add row above increases row count', async ({ page }) => {
  224 |     await runEditorCommand(page, 'insertTable', { rows: 2, cols: 2, withHeaderRow: true });
  225 |     const firstCell = page.locator('.ProseMirror table td').first();
  226 |     await firstCell.click();
  227 |     const initialCount = await page.locator('.ProseMirror table tr').count();
  228 |     await runEditorCommand(page, 'addRowBefore');
  229 |     const newCount = await page.locator('.ProseMirror table tr').count();
  230 |     expect(newCount).toBe(initialCount + 1);
  231 |   });
  232 | 
  233 |   test('table context menu: Remove row decreases row count', async ({ page }) => {
  234 |     await runEditorCommand(page, 'insertTable', { rows: 3, cols: 2, withHeaderRow: true });
  235 |     const firstCell = page.locator('.ProseMirror table td').first();
  236 |     await firstCell.click();
  237 |     const initialCount = await page.locator('.ProseMirror table tr').count();
  238 |     await runEditorCommand(page, 'deleteRow');
  239 |     const newCount = await page.locator('.ProseMirror table tr').count();
  240 |     expect(newCount).toBe(initialCount - 1);
  241 |   });
  242 | 
  243 |   test('table context menu: Add column right increases col count', async ({ page }) => {
  244 |     await runEditorCommand(page, 'insertTable', { rows: 2, cols: 2, withHeaderRow: true });
  245 |     const firstCell = page.locator('.ProseMirror table td').first();
  246 |     await firstCell.click();
  247 |     const initialCols = await page.locator('.ProseMirror table tr').first().locator('td, th').count();
  248 |     await runEditorCommand(page, 'addColumnAfter');
  249 |     const newCols = await page.locator('.ProseMirror table tr').first().locator('td, th').count();
  250 |     expect(newCols).toBe(initialCols + 1);
  251 |   });
  252 | 
  253 |   test('table context menu: Add column left increases col count', async ({ page }) => {
  254 |     await runEditorCommand(page, 'insertTable', { rows: 2, cols: 2, withHeaderRow: true });
  255 |     const firstCell = page.locator('.ProseMirror table td').first();
  256 |     await firstCell.click();
  257 |     const initialCols = await page.locator('.ProseMirror table tr').first().locator('td, th').count();
  258 |     await runEditorCommand(page, 'addColumnBefore');
  259 |     const newCols = await page.locator('.ProseMirror table tr').first().locator('td, th').count();
  260 |     expect(newCols).toBe(initialCols + 1);
  261 |   });
  262 | 
  263 |   test('table context menu: Remove column decreases col count', async ({ page }) => {
  264 |     await runEditorCommand(page, 'insertTable', { rows: 2, cols: 3, withHeaderRow: true });
  265 |     const firstCell = page.locator('.ProseMirror table td').first();
  266 |     await firstCell.click();
  267 |     const initialCols = await page.locator('.ProseMirror table tr').first().locator('td, th').count();
  268 |     await runEditorCommand(page, 'deleteColumn');
  269 |     const newCols = await page.locator('.ProseMirror table tr').first().locator('td, th').count();
  270 |     expect(newCols).toBe(initialCols - 1);
  271 |   });
  272 | 
  273 |   // ---------------------------------------------------------------------------
  274 |   // Roundtrip fidelity
  275 |   // ---------------------------------------------------------------------------
  276 | 
  277 |   test('roundtrip fidelity — load table fixture, serialize, reload, re-serialize must match', async ({ page }) => {
  278 |     const fixture = `| Name | Age | Notes |\n|------|-----|-------|\n| Alice | 30 | Has **bold** note |\n| Bob | 25 | First<br>Second |\n`;
  279 |     await setContent(page, fixture);
  280 |     const firstPass = await getContent(page);
  281 |     await setContent(page, firstPass);
  282 |     const secondPass = await getContent(page);
  283 |     // The two serializations should be identical
  284 |     expect(secondPass).toBe(firstPass);
  285 |   });
  286 | 
  287 |   test('mixed content in cell (text + break + bullet) roundtrip', async ({ page }) => {
  288 |     // Set complex fixture and verify it survives roundtrip
  289 |     await runEditorCommand(page, 'insertTable', { rows: 2, cols: 2, withHeaderRow: true });
  290 |     const firstCell = page.locator('.ProseMirror table td').first();
  291 |     await firstCell.click();
  292 |     await page.keyboard.type('Text');
  293 |     await page.keyboard.press('Shift+Enter');
  294 |     await page.keyboard.type('More text');
  295 |     const md1 = await getContent(page);
  296 |     await setContent(page, md1);
  297 |     const md2 = await getContent(page);
  298 |     expect(md2).toBe(md1);
```