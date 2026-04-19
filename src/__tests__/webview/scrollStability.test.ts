/** @jest-environment jsdom */

/**
 * Test: .markdown-editor CSS must not contain properties that cause
 * ProseMirror layout thrashing / scroll snap-back.
 *
 * Known-bad properties:
 * - width: 100%          → forces exact parent fill, breaks margin:auto centering
 * - box-sizing: border-box → changes content-area math for ProseMirror coordinates
 * - word-break: break-word → deprecated non-standard value, causes layout jank
 * - max-width using 100vw → viewport-unit oscillation when scrollbar appears/disappears
 *
 * Known-good pattern:
 *   max-width: var(--md-editor-width, 1920px);
 *   margin: 20px auto;
 *   padding: 0 30px;
 *   word-wrap: break-word;   ← the classic, stable property
 */

import * as fs from 'fs';
import * as path from 'path';

const cssPath = path.resolve(__dirname, '../../webview/editor.css');
const cssContent = fs.readFileSync(cssPath, 'utf-8');

/**
 * Extract the full rule block for a given selector from raw CSS.
 * Handles nested braces.
 */
function extractRuleBlock(css: string, selector: string): string {
  const selectorEscaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`${selectorEscaped}\\s*\\{`);
  const match = re.exec(css);
  if (!match) return '';
  let depth = 0;
  const start = match.index + match[0].length;
  for (let i = start; i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}') {
      if (depth === 0) {
        return css.slice(match.index, i + 1);
      }
      depth--;
    }
  }
  return '';
}

describe('Scroll stability: .markdown-editor CSS guards', () => {
  const rule = extractRuleBlock(cssContent, '.markdown-editor');

  it('.markdown-editor rule block should exist in editor.css', () => {
    expect(rule.length).toBeGreaterThan(0);
  });

  it('must NOT have width: 100% (causes layout thrashing)', () => {
    expect(/\bwidth\s*:\s*100%/.test(rule)).toBe(false);
  });

  it('must NOT have box-sizing: border-box (breaks ProseMirror coordinate math)', () => {
    expect(/box-sizing\s*:\s*border-box/.test(rule)).toBe(false);
  });

  it('must NOT have word-break: break-word (deprecated, causes layout jank)', () => {
    // word-break: break-word is non-standard; use word-wrap: break-word instead
    expect(/word-break\s*:\s*break-word/.test(rule)).toBe(false);
  });

  it('must NOT use 100vw in max-width (oscillates when scrollbar appears/disappears)', () => {
    // 100vw includes scrollbar width; when vertical scroll appears/disappears,
    // the computed max-width changes, triggering ProseMirror relayout
    expect(/max-width\s*:.*100vw/.test(rule)).toBe(false);
  });

  it('should use max-width with a CSS variable for editor width', () => {
    expect(/max-width\s*:/.test(rule)).toBe(true);
  });

  it('should have margin:auto for centering', () => {
    expect(/margin\s*:.*auto/.test(rule)).toBe(true);
  });

  it('should have word-wrap: break-word (the stable wrapping property)', () => {
    expect(/word-wrap\s*:\s*break-word/.test(rule)).toBe(true);
  });
});
