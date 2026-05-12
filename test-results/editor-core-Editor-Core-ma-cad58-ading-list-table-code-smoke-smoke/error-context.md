# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: editor-core.spec.ts >> Editor Core >> markdown roundtrip — heading, list, table, code @smoke
- Location: src\__tests__\playwright\editor-core.spec.ts:197:7

# Error details

```
Error: expect(received).toContain(expected) // indexOf

Expected substring: "| A |"
Received string:    "# Title·
- item 1
- item 2··
| A   | B   |
| --- | --- |
| 1   | 2   |··
```js
console.log('hi');
```"
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
    - heading "Title" [level=1] [ref=e48]
    - list [ref=e49]:
      - listitem [ref=e50]:
        - paragraph [ref=e51]: item 1
      - listitem [ref=e52]:
        - paragraph [ref=e53]: item 2
    - table [ref=e55]:
      - rowgroup [ref=e59]:
        - row "A B" [ref=e60]:
          - columnheader "A" [ref=e61]:
            - paragraph [ref=e62]: A
          - columnheader "B" [ref=e63]:
            - paragraph [ref=e64]: B
        - row "1 2" [ref=e65]:
          - cell "1" [ref=e66]:
            - paragraph [ref=e67]: "1"
          - cell "2" [ref=e68]:
            - paragraph [ref=e69]: "2"
    - generic [ref=e70]:
      - generic [ref=e71]:
        - combobox "Code block language" [ref=e72]:
          - option "Plain Text"
          - option "JavaScript"
          - option "TypeScript"
          - option "Python"
          - option "Bash"
          - option "JSON"
          - option "Markdown"
          - option "CSS"
          - option "HTML"
          - option "SQL"
          - option "Java"
          - option "Go"
          - option "Rust"
          - option "Mermaid"
        - button "Copy" [ref=e73]
      - code [ref=e75]: console.log('hi');
    - paragraph [ref=e76]
  - generic [ref=e77]: Loading editor…
```

# Test source

```ts
  104 | 
  105 |   test('H4 via runCommand', async ({ page }) => {
  106 |     await page.locator('.ProseMirror').click();
  107 |     await page.keyboard.type('Sub4');
  108 |     await runEditorCommand(page, 'toggleHeading', { level: 4 });
  109 |     await expect(page.locator('.ProseMirror h4')).toBeVisible();
  110 |   });
  111 | 
  112 |   test('H5 via runCommand', async ({ page }) => {
  113 |     await page.locator('.ProseMirror').click();
  114 |     await page.keyboard.type('Sub5');
  115 |     await runEditorCommand(page, 'toggleHeading', { level: 5 });
  116 |     await expect(page.locator('.ProseMirror h5')).toBeVisible();
  117 |   });
  118 | 
  119 |   test('H6 via runCommand', async ({ page }) => {
  120 |     await page.locator('.ProseMirror').click();
  121 |     await page.keyboard.type('Sub6');
  122 |     await runEditorCommand(page, 'toggleHeading', { level: 6 });
  123 |     await expect(page.locator('.ProseMirror h6')).toBeVisible();
  124 |   });
  125 | 
  126 |   test('H1 via # markdown shortcut', async ({ page }) => {
  127 |     await page.locator('.ProseMirror').click();
  128 |     await page.keyboard.type('# My Heading');
  129 |     await page.keyboard.press('Space');
  130 |     await expect(page.locator('.ProseMirror h1')).toBeVisible();
  131 |   });
  132 | 
  133 |   test('H2 via ## markdown shortcut', async ({ page }) => {
  134 |     await page.locator('.ProseMirror').click();
  135 |     await page.keyboard.type('## Section');
  136 |     await page.keyboard.press('Space');
  137 |     await expect(page.locator('.ProseMirror h2')).toBeVisible();
  138 |   });
  139 | 
  140 |   // ---------------------------------------------------------------------------
  141 |   // Block nodes
  142 |   // ---------------------------------------------------------------------------
  143 | 
  144 |   test('blockquote via runCommand', async ({ page }) => {
  145 |     await page.locator('.ProseMirror').click();
  146 |     await page.keyboard.type('Quote me');
  147 |     await runEditorCommand(page, 'toggleBlockquote');
  148 |     await expect(page.locator('.ProseMirror blockquote')).toBeVisible();
  149 |   });
  150 | 
  151 |   test('horizontal rule via runCommand', async ({ page }) => {
  152 |     await page.locator('.ProseMirror').click();
  153 |     await page.keyboard.type('Before');
  154 |     await page.keyboard.press('Enter');
  155 |     await runEditorCommand(page, 'setHorizontalRule');
  156 |     await expect(page.locator('.ProseMirror hr')).toBeVisible();
  157 |   });
  158 | 
  159 |   // ---------------------------------------------------------------------------
  160 |   // Undo / Redo
  161 |   // ---------------------------------------------------------------------------
  162 | 
  163 |   test('undo single change via Ctrl+Z @smoke', async ({ page }) => {
  164 |     await page.locator('.ProseMirror').click();
  165 |     await page.keyboard.type('Before');
  166 |     await page.keyboard.press('Control+z');
  167 |     const content = await getContent(page);
  168 |     // After undo the typed text should be gone
  169 |     expect(content.trim()).not.toContain('Before');
  170 |   });
  171 | 
  172 |   test('redo restores undone change via Ctrl+Y', async ({ page }) => {
  173 |     await page.locator('.ProseMirror').click();
  174 |     await page.keyboard.type('Redo me');
  175 |     await page.keyboard.press('Control+z');
  176 |     await page.keyboard.press('Control+y');
  177 |     const content = await getContent(page);
  178 |     expect(content).toContain('Redo me');
  179 |   });
  180 | 
  181 |   test('undo chain — three changes then three undos returns to original', async ({ page }) => {
  182 |     await page.locator('.ProseMirror').click();
  183 |     await page.keyboard.type('A');
  184 |     await page.keyboard.type('B');
  185 |     await page.keyboard.type('C');
  186 |     await page.keyboard.press('Control+z');
  187 |     await page.keyboard.press('Control+z');
  188 |     await page.keyboard.press('Control+z');
  189 |     const content = await getContent(page);
  190 |     expect(content.trim()).toBe('');
  191 |   });
  192 | 
  193 |   // ---------------------------------------------------------------------------
  194 |   // Roundtrip
  195 |   // ---------------------------------------------------------------------------
  196 | 
  197 |   test('markdown roundtrip — heading, list, table, code @smoke', async ({ page }) => {
  198 |     const md = `# Title\n\n- item 1\n- item 2\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n\`\`\`js\nconsole.log('hi');\n\`\`\`\n`;
  199 |     await setContent(page, md);
  200 |     const out = await getContent(page);
  201 |     // Round-trip: all key structures should survive
  202 |     expect(out).toContain('# Title');
  203 |     expect(out).toContain('- item 1');
> 204 |     expect(out).toContain('| A |');
      |                 ^ Error: expect(received).toContain(expected) // indexOf
  205 |     expect(out).toContain("console.log('hi')");
  206 |   });
  207 | 
  208 |   test('setMarkdown with 100 headings — content still present after scroll', async ({ page }) => {
  209 |     const headings = Array.from({ length: 100 }, (_, i) => `## Heading ${i + 1}`).join('\n\n');
  210 |     await setContent(page, headings);
  211 |     await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  212 |     // At least some headings should be in the DOM
  213 |     const count = await page.locator('.ProseMirror h2').count();
  214 |     expect(count).toBeGreaterThan(90);
  215 |   });
  216 | 
  217 |   test('plain text paste — pasted text appears in editor', async ({ page }) => {
  218 |     await page.locator('.ProseMirror').click();
  219 |     // Use clipboard API to paste text
  220 |     await page.evaluate(() => {
  221 |       const dataTransfer = new DataTransfer();
  222 |       dataTransfer.setData('text/plain', 'Pasted text');
  223 |       const event = new ClipboardEvent('paste', { clipboardData: dataTransfer, bubbles: true, cancelable: true });
  224 |       document.querySelector('.ProseMirror')!.dispatchEvent(event);
  225 |     });
  226 |     // Give TipTap time to process
  227 |     await page.waitForTimeout(100);
  228 |     const content = await getContent(page);
  229 |     expect(content).toContain('Pasted text');
  230 |   });
  231 | 
  232 |   test('hard break — Shift+Enter inside paragraph adds <br> in DOM @smoke', async ({ page }) => {
  233 |     await page.locator('.ProseMirror').click();
  234 |     await page.keyboard.type('Line one');
  235 |     await page.keyboard.press('Shift+Enter');
  236 |     await page.keyboard.type('Line two');
  237 |     // <br> should be present inside the paragraph
  238 |     const br = page.locator('.ProseMirror p br');
  239 |     await expect(br).toBeVisible();
  240 |   });
  241 | 
  242 |   // ---------------------------------------------------------------------------
  243 |   // Bullet / ordered / task lists
  244 |   // ---------------------------------------------------------------------------
  245 | 
  246 |   test('bullet list via runCommand produces <ul>', async ({ page }) => {
  247 |     await page.locator('.ProseMirror').click();
  248 |     await page.keyboard.type('Item');
  249 |     await runEditorCommand(page, 'toggleBulletList');
  250 |     await expect(page.locator('.ProseMirror ul')).toBeVisible();
  251 |   });
  252 | 
  253 |   test('ordered list via runCommand produces <ol>', async ({ page }) => {
  254 |     await page.locator('.ProseMirror').click();
  255 |     await page.keyboard.type('First');
  256 |     await runEditorCommand(page, 'toggleOrderedList');
  257 |     await expect(page.locator('.ProseMirror ol')).toBeVisible();
  258 |   });
  259 | 
  260 |   test('task list via runCommand produces task item checkbox', async ({ page }) => {
  261 |     await page.locator('.ProseMirror').click();
  262 |     await page.keyboard.type('Task');
  263 |     await runEditorCommand(page, 'toggleTaskList');
  264 |     await expect(page.locator('.ProseMirror ul[data-type="taskList"]')).toBeVisible();
  265 |     await expect(page.locator('.ProseMirror input[type="checkbox"]')).toBeVisible();
  266 |   });
  267 | 
  268 |   // ---------------------------------------------------------------------------
  269 |   // Highlight
  270 |   // ---------------------------------------------------------------------------
  271 | 
  272 |   test('highlight mark via runCommand produces .highlight class', async ({ page }) => {
  273 |     await page.locator('.ProseMirror').click();
  274 |     await page.keyboard.type('Highlighted');
  275 |     await page.keyboard.press('Control+a');
  276 |     await runEditorCommand(page, 'toggleHighlight');
  277 |     await expect(page.locator('.ProseMirror .highlight')).toBeVisible();
  278 |   });
  279 | });
  280 | 
```