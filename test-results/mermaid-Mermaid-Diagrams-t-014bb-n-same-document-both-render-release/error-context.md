# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: mermaid.spec.ts >> Mermaid Diagrams >> two mermaid blocks in same document both render
- Location: src\__tests__\playwright\mermaid.spec.ts:106:7

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  locator('[data-type="mermaid"], .mermaid-diagram, .mermaid-wrapper, [class*="mermaid"]')
Expected: 2
Received: 13
Timeout:  5000ms

Call log:
  - Expect "toHaveCount" with timeout 5000ms
  - waiting for locator('[data-type="mermaid"], .mermaid-diagram, .mermaid-wrapper, [class*="mermaid"]')
    9 × locator resolved to 13 elements
      - unexpected value "13"

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
    - generic [ref=e48]:
      - generic [ref=e49]:
        - generic [ref=e50]: Mermaid
        - button "Edit" [ref=e51]
      - document [ref=e53]:
        - generic [ref=e55]:
          - generic [ref=e59]:
            - paragraph [ref=e65]: "Yes"
            - paragraph [ref=e71]: "No"
          - generic [ref=e72]:
            - paragraph [ref=e79]: Start
            - paragraph [ref=e86]: Decision
            - paragraph [ref=e93]: Do thing
            - paragraph [ref=e100]: Skip it
    - paragraph [ref=e101]: Some text
    - generic [ref=e102]:
      - generic [ref=e103]:
        - generic [ref=e104]: Mermaid
        - button "Edit" [ref=e105]
      - document [ref=e107]:
        - generic [ref=e110]: Bob
        - generic [ref=e113]: Alice
        - generic [ref=e117]: Bob
        - generic [ref=e121]: Alice
        - generic [ref=e122]: Hello Bob!
        - generic [ref=e123]: Hi Alice!
    - paragraph [ref=e124]
  - generic [ref=e125]: Loading editor…
```

# Test source

```ts
  10  | 
  11  | import { test, expect } from '@playwright/test';
  12  | import {
  13  |   FULL_HARNESS_URL,
  14  |   waitForEditor,
  15  |   setContent,
  16  |   getContent,
  17  | } from './helpers/index';
  18  | 
  19  | const FLOW_MD = `\`\`\`mermaid
  20  | graph TD
  21  |   A[Start] --> B{Decision}
  22  |   B --> |Yes| C[Do thing]
  23  |   B --> |No| D[Skip it]
  24  | \`\`\`
  25  | `;
  26  | 
  27  | const SEQUENCE_MD = `\`\`\`mermaid
  28  | sequenceDiagram
  29  |   Alice->>Bob: Hello Bob!
  30  |   Bob->>Alice: Hi Alice!
  31  | \`\`\`
  32  | `;
  33  | 
  34  | test.describe('Mermaid Diagrams', () => {
  35  |   test.beforeEach(async ({ page }) => {
  36  |     await page.goto(FULL_HARNESS_URL);
  37  |     await waitForEditor(page);
  38  |     await setContent(page, '');
  39  |   });
  40  | 
  41  |   // ---------------------------------------------------------------------------
  42  |   // Basic rendering
  43  |   // ---------------------------------------------------------------------------
  44  | 
  45  |   test('mermaid fenced block renders as diagram node (not raw code) @smoke', async ({ page }) => {
  46  |     await setContent(page, FLOW_MD);
  47  |     // The extension should render a diagram node, not a raw <pre>
  48  |     const diagramNode = page.locator(
  49  |       '[data-type="mermaid"], .mermaid-diagram, .mermaid-wrapper, [class*="mermaid"]'
  50  |     );
  51  |     await expect(diagramNode.first()).toBeVisible({ timeout: 5000 });
  52  |   });
  53  | 
  54  |   test('sequence diagram renders @smoke', async ({ page }) => {
  55  |     await setContent(page, SEQUENCE_MD);
  56  |     const diagramNode = page.locator(
  57  |       '[data-type="mermaid"], .mermaid-diagram, .mermaid-wrapper, [class*="mermaid"]'
  58  |     );
  59  |     await expect(diagramNode.first()).toBeVisible({ timeout: 5000 });
  60  |   });
  61  | 
  62  |   // ---------------------------------------------------------------------------
  63  |   // Roundtrip
  64  |   // ---------------------------------------------------------------------------
  65  | 
  66  |   test('mermaid diagram roundtrip — code preserved @smoke', async ({ page }) => {
  67  |     await setContent(page, FLOW_MD);
  68  |     const output = await getContent(page);
  69  |     expect(output).toContain('graph TD');
  70  |     expect(output).toContain('A[Start]');
  71  |   });
  72  | 
  73  |   test('mermaid diagram roundtrip — fenced with mermaid tag', async ({ page }) => {
  74  |     await setContent(page, FLOW_MD);
  75  |     const output = await getContent(page);
  76  |     expect(output).toContain('```mermaid');
  77  |   });
  78  | 
  79  |   test('sequence diagram roundtrip — content preserved', async ({ page }) => {
  80  |     await setContent(page, SEQUENCE_MD);
  81  |     const output = await getContent(page);
  82  |     expect(output).toContain('sequenceDiagram');
  83  |     expect(output).toContain('Alice->>Bob');
  84  |   });
  85  | 
  86  |   // ---------------------------------------------------------------------------
  87  |   // No console errors on render
  88  |   // ---------------------------------------------------------------------------
  89  | 
  90  |   test('mermaid render produces no console errors', async ({ page }) => {
  91  |     const errors: string[] = [];
  92  |     page.on('console', msg => {
  93  |       if (msg.type() === 'error' && !msg.text().includes('ResizeObserver') && !msg.text().includes('favicon')) {
  94  |         errors.push(msg.text());
  95  |       }
  96  |     });
  97  |     await setContent(page, FLOW_MD);
  98  |     await page.waitForTimeout(2000); // Give mermaid time to render
  99  |     expect(errors).toHaveLength(0);
  100 |   });
  101 | 
  102 |   // ---------------------------------------------------------------------------
  103 |   // Multiple diagrams
  104 |   // ---------------------------------------------------------------------------
  105 | 
  106 |   test('two mermaid blocks in same document both render', async ({ page }) => {
  107 |     const twoMd = FLOW_MD + '\nSome text\n\n' + SEQUENCE_MD;
  108 |     await setContent(page, twoMd);
  109 |     const nodes = page.locator('[data-type="mermaid"], .mermaid-diagram, .mermaid-wrapper, [class*="mermaid"]');
> 110 |     await expect(nodes).toHaveCount(2, { timeout: 5000 });
      |                         ^ Error: expect(locator).toHaveCount(expected) failed
  111 |   });
  112 | 
  113 |   test('two diagrams roundtrip — both codes preserved', async ({ page }) => {
  114 |     const twoMd = FLOW_MD + '\nSome text\n\n' + SEQUENCE_MD;
  115 |     await setContent(page, twoMd);
  116 |     const output = await getContent(page);
  117 |     expect(output).toContain('graph TD');
  118 |     expect(output).toContain('sequenceDiagram');
  119 |   });
  120 | });
  121 | 
```