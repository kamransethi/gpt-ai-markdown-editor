/**
 * Mermaid Diagrams — Playwright spec
 *
 * Tests that Mermaid fenced code blocks are rendered as diagram nodes,
 * the diagram code is preserved through roundtrip, and editing works.
 *
 * Run smoke tests only: npx playwright test mermaid.spec.ts --project smoke
 * Run all:              npx playwright test mermaid.spec.ts
 */

import { test, expect } from '@playwright/test';
import {
  FULL_HARNESS_URL,
  waitForEditor,
  setContent,
  getContent,
} from './helpers/index';

const FLOW_MD = `\`\`\`mermaid
graph TD
  A[Start] --> B{Decision}
  B --> |Yes| C[Do thing]
  B --> |No| D[Skip it]
\`\`\`
`;

const SEQUENCE_MD = `\`\`\`mermaid
sequenceDiagram
  Alice->>Bob: Hello Bob!
  Bob->>Alice: Hi Alice!
\`\`\`
`;

test.describe('Mermaid Diagrams', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FULL_HARNESS_URL);
    await waitForEditor(page);
    await setContent(page, '');
  });

  // ---------------------------------------------------------------------------
  // Basic rendering
  // ---------------------------------------------------------------------------

  test('mermaid fenced block renders as diagram node (not raw code) @smoke', async ({ page }) => {
    await setContent(page, FLOW_MD);
    // The extension should render a diagram node, not a raw <pre>
    const diagramNode = page.locator(
      '[data-type="mermaid"], .mermaid-diagram, .mermaid-wrapper, [class*="mermaid"]'
    );
    await expect(diagramNode.first()).toBeVisible({ timeout: 5000 });
  });

  test('sequence diagram renders @smoke', async ({ page }) => {
    await setContent(page, SEQUENCE_MD);
    const diagramNode = page.locator(
      '[data-type="mermaid"], .mermaid-diagram, .mermaid-wrapper, [class*="mermaid"]'
    );
    await expect(diagramNode.first()).toBeVisible({ timeout: 5000 });
  });

  // ---------------------------------------------------------------------------
  // Roundtrip
  // ---------------------------------------------------------------------------

  test('mermaid diagram roundtrip — code preserved @smoke', async ({ page }) => {
    await setContent(page, FLOW_MD);
    const output = await getContent(page);
    expect(output).toContain('graph TD');
    expect(output).toContain('A[Start]');
  });

  test('mermaid diagram roundtrip — fenced with mermaid tag', async ({ page }) => {
    await setContent(page, FLOW_MD);
    const output = await getContent(page);
    expect(output).toContain('```mermaid');
  });

  test('sequence diagram roundtrip — content preserved', async ({ page }) => {
    await setContent(page, SEQUENCE_MD);
    const output = await getContent(page);
    expect(output).toContain('sequenceDiagram');
    expect(output).toContain('Alice->>Bob');
  });

  // ---------------------------------------------------------------------------
  // No console errors on render
  // ---------------------------------------------------------------------------

  test('mermaid render produces no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('ResizeObserver') && !msg.text().includes('favicon')) {
        errors.push(msg.text());
      }
    });
    await setContent(page, FLOW_MD);
    await page.waitForTimeout(2000); // Give mermaid time to render
    expect(errors).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // Multiple diagrams
  // ---------------------------------------------------------------------------

  test('two mermaid blocks in same document both render', async ({ page }) => {
    const twoMd = FLOW_MD + '\nSome text\n\n' + SEQUENCE_MD;
    await setContent(page, twoMd);
    const nodes = page.locator('[data-type="mermaid"], .mermaid-diagram, .mermaid-wrapper, [class*="mermaid"]');
    await expect(nodes).toHaveCount(2, { timeout: 5000 });
  });

  test('two diagrams roundtrip — both codes preserved', async ({ page }) => {
    const twoMd = FLOW_MD + '\nSome text\n\n' + SEQUENCE_MD;
    await setContent(page, twoMd);
    const output = await getContent(page);
    expect(output).toContain('graph TD');
    expect(output).toContain('sequenceDiagram');
  });
});
