/**
 * VS Code Webview Smoke Test
 * ──────────────────────────────────────────────────────────────────────────────
 * Loads the PRODUCTION dist/webview.js bundle inside a simulated VS Code
 * webview environment and verifies that:
 *
 *   1. The editor DOM element exists and TipTap mounts into it
 *   2. Text is VISIBLE after an UPDATE message is received (not hidden by CSS)
 *   3. The background is light (white), not dark, when theme override = "light"
 *   4. The editor correctly handles the dark-window scenario (VS Code dark class)
 *
 * Run:  npx playwright test vscode-webview.spec.ts --project=release
 * Smoke: npx playwright test vscode-webview.spec.ts --project=smoke
 *
 * This spec targets the REAL production bundle to catch regressions that the
 * harness-only tests cannot detect (e.g. CSS applied via webview.css, React
 * inspector panel blocking the editor, theme not resolving).
 */

import { test, expect, type Page } from '@playwright/test';

const SIM_URL = '/src/__tests__/playwright/harness/vscode-webview-sim.html';

const SAMPLE_MD = `# Hello from VS Code\n\nThis is a **test paragraph** to verify the editor renders visible text.\n\n- item one\n- item two\n`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** URL of the VS Code webview simulator harness */
async function openWebview(page: Page, themeClass?: 'vscode-light' | 'vscode-dark') {
  await page.goto(SIM_URL);

  // Simulate what VS Code adds to <body> automatically
  if (themeClass) {
    await page.evaluate(cls => {
      document.body.classList.add(cls);
    }, themeClass);
  }

  // Wait for the script to load and signal readiness
  await page.waitForFunction(() => typeof (window as any).__vscodeSimBridge !== 'undefined', {
    timeout: 10_000,
  });
}

/** Send an UPDATE message the same way MarkdownEditorProvider does */
async function sendUpdate(page: Page, content: string) {
  await page.evaluate(md => {
    (window as any).__vscodeSimBridge.send({
      type: 'update',
      content: md,
      settings: {},
    });
  }, content);
}

/** Wait for the TipTap .ProseMirror div to appear in #editor */
async function waitForEditor(page: Page, timeout = 15_000) {
  await page.waitForSelector('#editor .ProseMirror', { timeout });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('VS Code Webview — production bundle smoke', () => {
  test('editor mounts and ProseMirror div is present @smoke', async ({ page }) => {
    await openWebview(page, 'vscode-light');
    await sendUpdate(page, SAMPLE_MD);
    await waitForEditor(page);

    const proseMirror = page.locator('#editor .ProseMirror');
    await expect(proseMirror).toBeVisible();
  });

  test('text content is visible after UPDATE message @smoke', async ({ page }) => {
    await openWebview(page, 'vscode-light');
    await sendUpdate(page, SAMPLE_MD);
    await waitForEditor(page);

    // The heading should be visible
    const heading = page.locator('#editor h1');
    await expect(heading).toBeVisible();
    await expect(heading).toContainText('Hello from VS Code');

    // A paragraph with bold text
    const bold = page.locator('#editor strong');
    await expect(bold).toBeVisible();
  });

  test('background is white (light theme), not dark @smoke', async ({ page }) => {
    await openWebview(page, 'vscode-light');
    await sendUpdate(page, SAMPLE_MD);
    await waitForEditor(page);

    const bgColor = await page.evaluate(() => {
      const body = document.body;
      return window.getComputedStyle(body).backgroundColor;
    });

    // Light theme → white (#ffffff = rgb(255, 255, 255))
    // Any dark background (e.g. rgb(30, 30, 30)) should cause this to fail
    expect(bgColor).toBe('rgb(255, 255, 255)');
  });

  test('text is not invisible (foreground color has contrast on background) @smoke', async ({
    page,
  }) => {
    await openWebview(page, 'vscode-light');
    await sendUpdate(page, SAMPLE_MD);
    await waitForEditor(page);

    const { fg, bg } = await page.evaluate(() => {
      const editor = document.querySelector('#editor .ProseMirror') as HTMLElement;
      const style = window.getComputedStyle(editor);
      return { fg: style.color, bg: style.backgroundColor };
    });

    // Convert rgb(r,g,b) to luminance to check contrast
    function luminance(rgb: string): number {
      const m = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (!m) return 0;
      const [r, g, b] = [+m[1] / 255, +m[2] / 255, +m[3] / 255].map(c =>
        c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
      );
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }
    const fgL = luminance(fg);
    const bgL = luminance(bg);
    const ratio = (Math.max(fgL, bgL) + 0.05) / (Math.min(fgL, bgL) + 0.05);

    // WCAG AA requires 4.5:1 for normal text
    expect(ratio).toBeGreaterThan(4.5);
  });

  test('dark VS Code theme class does NOT force dark mode when themeOverride is light @smoke', async ({
    page,
  }) => {
    // Simulate: VS Code UI is dark, but user chose light in extension settings
    // The extension calls gptAiApplyTheme('light') on DOMContentLoaded
    await openWebview(page, 'vscode-dark'); // VS Code adds vscode-dark to body
    await sendUpdate(page, SAMPLE_MD);
    await waitForEditor(page);

    const bgColor = await page.evaluate(
      () => window.getComputedStyle(document.body).backgroundColor
    );

    // Should still be white because our CSS uses data-theme="light", not vscode-dark
    expect(bgColor).toBe('rgb(255, 255, 255)');
  });

  test('Inspector panel does not cover the editor content @smoke', async ({ page }) => {
    await openWebview(page, 'vscode-light');
    await sendUpdate(page, SAMPLE_MD);
    await waitForEditor(page);

    // Get the bounding boxes of the ProseMirror editor and the inspector (if present)
    const editorBox = await page.locator('#editor .ProseMirror').boundingBox();
    expect(editorBox).not.toBeNull();
    expect(editorBox!.width).toBeGreaterThan(200);

    const inspector = page.locator('.inspector-panel');
    const hasInspector = await inspector.count();

    if (hasInspector > 0) {
      const inspectorBox = await inspector.boundingBox();
      if (inspectorBox) {
        // Inspector must not overlap the left edge of the editor
        // (editor content must start before inspector begins)
        expect(editorBox!.x + editorBox!.width).toBeLessThanOrEqual(inspectorBox.x + 5);
      }
    }
  });

  test('screenshot — capture visual state for diagnosis', async ({ page }) => {
    await openWebview(page, 'vscode-light');
    await sendUpdate(page, SAMPLE_MD);

    // Wait up to 5s for editor — don't fail if it times out, screenshot is the goal
    try {
      await waitForEditor(page, 5_000);
    } catch {
      // still take screenshot even if editor didn't mount
    }

    await page.waitForTimeout(500); // let React render settle
    await page.screenshot({ path: 'test-results/vscode-webview-sim.png', fullPage: true });
    // This test always passes — its purpose is to capture the visual state
  });
});
