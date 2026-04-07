/** @jest-environment jsdom */

/**
 * Build-time lossless roundtrip test for STRESS_TEST_DOC.md (FR-001, FR-002, FR-003).
 *
 * Loads the canonical stress test fixture into a headless TipTap editor configured
 * with the same extensions as the production editor, serializes back to markdown,
 * and asserts the output is semantically equivalent to the input.
 *
 * A unified-diff report is printed on failure so the exact content change is visible
 * in CI output without opening any files.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { TableKit, Table } from '@tiptap/extension-table';
import { ListKit } from '@tiptap/extension-list';
import Link from '@tiptap/extension-link';
import Highlight from '@tiptap/extension-highlight';
import { CodeBlock } from '@tiptap/extension-code-block';
import { MarkdownParagraph } from '../../webview/extensions/markdownParagraph';
import { OrderedListMarkdownFix } from '../../webview/extensions/orderedListMarkdownFix';
import { TaskItemClipboardFix } from '../../webview/extensions/taskItemClipboardFix';
import { GitHubAlerts } from '../../webview/extensions/githubAlerts';
import { GenericHTMLInline, GenericHTMLBlock } from '../../webview/extensions/htmlPreservation';
import {
  HtmlCommentInline,
  HtmlCommentBlock,
  setPreserveHtmlComments,
} from '../../webview/extensions/htmlComment';
import { IndentedImageCodeBlock } from '../../webview/extensions/indentedImageCodeBlock';
import { SpaceFriendlyImagePaths } from '../../webview/extensions/spaceFriendlyImagePaths';
import { CustomImage } from '../../webview/extensions/customImage';
import { CustomTextStyle, TextColorMark } from '../../webview/extensions/textColor';
import { Mermaid } from '../../webview/extensions/mermaid';
import { renderTableToMarkdownWithBreaks } from '../../webview/utils/tableMarkdownSerializer';

// ─── Constants ────────────────────────────────────────────────────────────────

const STRESS_TEST_DOC_PATH = path.join(__dirname, '..', 'STRESS_TEST_DOC.md');

/**
 * Elements the editor intentionally does not roundtrip losslessly
 * (no TipTap extension, treated as plain text or purposely normalised).
 * These are documented here for auditability.
 */
const KNOWN_OUT_OF_SCOPE = [
  'Footnotes ([^1]) — no TipTap footnote extension; parsed as literal text',
  'Reference-style links ([ref]) — undefined reference targets; may not roundtrip to identical text',
  'Marp-specific YAML directives — stripped via frontmatter extraction before TipTap sees the content',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Strip YAML frontmatter (between opening and closing ---) from the start of a
 * markdown string.  This mirrors what `extractAndStoreFrontmatter` does in the
 * production editor — TipTap must never see YAML frontmatter because it interprets
 * `key: value\n---` as a setext H2 heading.
 */
function stripFrontmatter(markdown: string): string {
  const match = markdown.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/);
  if (!match) return markdown;
  return markdown.slice(match[0].length);
}

/**
 * Normalise for string comparison:
 * - CRLF → LF
 * - Strip trailing whitespace from every line (table column-padding etc.)
 * - Decode `&amp;` → `&` (TipTap consistently encodes bare `&` in text on
 *   serialize; marked decodes it back on reload, so it is a stable lossless
 *   transformation and should not count as a diff)
 * - Collapse 4+ consecutive newlines to 3 (matches sanitizeSerialized in production;
 *   TipTap may emit slightly different blank-line counts between adjacent block nodes)
 * - Ensure exactly one trailing newline
 */
function normalizeForComparison(markdown: string): string {
  return (
    markdown
      .replace(/\r\n/g, '\n')
      // Decode only &amp; — do NOT decode &lt;/&gt; as that would hide real tag-loss bugs
      .replace(/&amp;/g, '&')
      // Collapse excess blank lines (≥4 \n = 3+ blank lines) to at most 2 blank lines.
      // This mirrors the sanitizeSerialized() call in production and avoids false
      // failures caused by TipTap emitting one extra blank line between adjacent tables.
      .replace(/\n{4,}/g, '\n\n\n')
      .split('\n')
      .map(line => line.trimEnd())
      .join('\n')
      .replace(/\n+$/, '') + '\n'
  );
}

/**
 * Produce a readable unified-diff style report for test failure output.
 * Truncates at MAX_DIFF_LINES pairs to keep output manageable.
 */
function buildDiffReport(original: string, actual: string): string {
  const MAX_DIFF_LINES = 30;
  const origLines = original.split('\n');
  const actLines = actual.split('\n');
  const maxLen = Math.max(origLines.length, actLines.length);
  const diffLines: string[] = [];
  let diffCount = 0;

  for (let i = 0; i < maxLen; i++) {
    const o = origLines[i] ?? '<missing>';
    const a = actLines[i] ?? '<missing>';
    if (o !== a) {
      diffCount++;
      if (diffLines.length < MAX_DIFF_LINES * 2) {
        diffLines.push(`@@ line ${i + 1} @@`);
        diffLines.push(`--- ${JSON.stringify(o)}`);
        diffLines.push(`+++ ${JSON.stringify(a)}`);
      }
    }
  }

  if (diffCount === 0) return '(no line differences found — possible whitespace-only delta)';

  const header = `${diffCount} line(s) differ between original and serialized output:`;
  const truncNote =
    diffCount > MAX_DIFF_LINES ? `\n... (${diffCount - MAX_DIFF_LINES} more differences)` : '';
  return `${header}\n${diffLines.join('\n')}${truncNote}`;
}

// ─── Editor factory ───────────────────────────────────────────────────────────

/**
 * Create a headless TipTap editor using the same extension configuration as
 * the production editor (editor.ts).  UI-only extensions that do not affect
 * markdown parsing or serialisation are intentionally omitted (BubbleMenu,
 * CharacterCount, Placeholder, Typography, DragHandle, TableOfContents,
 * TabIndentation, ImageEnterSpacing, TableCellEnterHandler, SearchAndReplace,
 * SlashCommand, AiExplain, DraggableBlocks, GlobalDragHandle).
 */
function createRoundtripEditor(): Editor {
  const element = document.createElement('div');
  document.body.appendChild(element);

  return new Editor({
    element,
    extensions: [
      // Mermaid must precede CodeBlock to intercept mermaid-language fences
      Mermaid,
      // Must precede CodeBlock to intercept indented image tokens
      IndentedImageCodeBlock,
      // Fallback: image lines with spaces in path
      SpaceFriendlyImagePaths,
      // GitHubAlerts must precede StarterKit blockquote handling
      GitHubAlerts,
      Highlight.extend({
        // Disable ==text== markdown tokenizer — only <mark> HTML is supported.
        markdownTokenizer: undefined,
        addInputRules() {
          return [];
        },
        addPasteRules() {
          return [];
        },
        renderMarkdown(node: any, h: any) {
          return `<mark>${h.renderChildren(node)}</mark>`;
        },
      }).configure({
        HTMLAttributes: { class: 'highlight' },
      }),
      GenericHTMLInline,
      GenericHTMLBlock,
      HtmlCommentInline,
      HtmlCommentBlock,
      CustomTextStyle,
      TextColorMark,
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        paragraph: false,
        codeBlock: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        listKeymap: false,
        link: false,
        undoRedo: { depth: 100 },
      }),
      MarkdownParagraph,
      CodeBlock.configure({
        defaultLanguage: 'plaintext',
      }),
      Markdown.configure({
        // Use the global marked instance (same as taskListRoundTrip.test.ts).
        // NOTE: production uses `new Marked()` to isolate tokeniser state.
        // In tests we create one editor per test so cross-contamination is not
        // a concern, and using global marked ensures the colorSpan tokeniser
        // (registered at import time by textColor.ts) is available.
        markedOptions: {
          gfm: true,
          breaks: true,
        },
      }),
      Table.extend({
        renderMarkdown(node, h) {
          return renderTableToMarkdownWithBreaks(node, h);
        },
        parseHTML() {
          return [
            {
              tag: 'table',
              contentElement(node: HTMLElement) {
                node.querySelectorAll(':scope > colgroup').forEach(el => el.remove());
                const sections = node.querySelectorAll(
                  ':scope > thead, :scope > tbody, :scope > tfoot'
                );
                for (const section of Array.from(sections)) {
                  while (section.firstChild) {
                    node.insertBefore(section.firstChild, section);
                  }
                  section.remove();
                }
                return node;
              },
            },
          ];
        },
      }).configure({
        resizable: false,
        HTMLAttributes: { class: 'markdown-table' },
      }),
      TableKit.configure({ table: false }),
      ListKit.configure({
        orderedList: false,
        taskItem: false,
      }),
      TaskItemClipboardFix.configure({ nested: true }),
      OrderedListMarkdownFix,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'markdown-link' },
      }),
      CustomImage.configure({
        allowBase64: true,
        HTMLAttributes: { class: 'markdown-image' },
      }),
    ],
    editorProps: {
      attributes: { class: 'markdown-editor' },
    },
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('STRESS_TEST_DOC.md roundtrip', () => {
  let editor: Editor;

  beforeAll(() => {
    // CustomImage's message plugin calls window.vscode.postMessage to resolve
    // relative image paths.  Provide a no-op stub so the test doesn't throw.
    (window as any).vscode = { postMessage: jest.fn(), getState: jest.fn(), setState: jest.fn() };

    // Enable HTML comment preservation (matches production default)
    setPreserveHtmlComments(true);
  });

  afterAll(() => {
    setPreserveHtmlComments(false);
  });

  afterEach(() => {
    editor?.destroy();
  });

  it('stress test document exists', () => {
    expect(fs.existsSync(STRESS_TEST_DOC_PATH)).toBe(true);
  });

  it('roundtrips STRESS_TEST_DOC.md without content loss', () => {
    const raw = fs.readFileSync(STRESS_TEST_DOC_PATH, 'utf-8');
    const body = stripFrontmatter(raw);

    editor = createRoundtripEditor();
    editor.commands.setContent(body, { contentType: 'markdown' });

    const serialized = editor.getMarkdown();

    const normalizedOriginal = normalizeForComparison(body);
    const normalizedActual = normalizeForComparison(serialized);

    if (normalizedOriginal !== normalizedActual) {
      const report = buildDiffReport(normalizedOriginal, normalizedActual);
      // Log for CI visibility, then fail with a concise message.
      console.error(
        `\nROUNDTRIP FAILURE — saving this file WILL alter its content.\n` +
          `Known out-of-scope items (acceptable losses):\n` +
          KNOWN_OUT_OF_SCOPE.map(s => `  • ${s}`).join('\n') +
          `\n\nDiff report:\n${report}`
      );
    }

    // Always call expect so assertion-count checks pass.
    expect(normalizedActual).toBe(normalizedOriginal);
  });

  it('serialized output does not contain undefined or [object Object]', () => {
    const raw = fs.readFileSync(STRESS_TEST_DOC_PATH, 'utf-8');
    const body = stripFrontmatter(raw);

    editor = createRoundtripEditor();
    editor.commands.setContent(body, { contentType: 'markdown' });

    const serialized = editor.getMarkdown();

    expect(serialized).not.toContain('undefined');
    expect(serialized).not.toContain('[object Object]');
  });

  it('serialized output preserves all heading levels', () => {
    const raw = fs.readFileSync(STRESS_TEST_DOC_PATH, 'utf-8');
    const body = stripFrontmatter(raw);

    editor = createRoundtripEditor();
    editor.commands.setContent(body, { contentType: 'markdown' });

    const serialized = editor.getMarkdown();

    // All six heading levels must survive the roundtrip
    expect(serialized).toMatch(/^# /m);
    expect(serialized).toMatch(/^## /m);
    expect(serialized).toMatch(/^### /m);
    expect(serialized).toMatch(/^#### /m);
    expect(serialized).toMatch(/^##### /m);
    expect(serialized).toMatch(/^###### /m);
  });

  it('serialized output preserves bold and italic inline marks', () => {
    const raw = fs.readFileSync(STRESS_TEST_DOC_PATH, 'utf-8');
    const body = stripFrontmatter(raw);

    editor = createRoundtripEditor();
    editor.commands.setContent(body, { contentType: 'markdown' });

    const serialized = editor.getMarkdown();

    expect(serialized).toMatch(/\*\*Bold Text\*\*/);
    expect(serialized).toMatch(/\*Italic Text\*/);
    expect(serialized).toMatch(/\*\*\*Bold/);
    expect(serialized).toMatch(/~~Strikethrough~~/);
  });

  it('serialized output preserves ordered list inline marks (OrderedListMarkdownFix)', () => {
    const orderedListMd = ['1. First Item', '2. Second Item', '3. Third Item'].join('\n');

    editor = createRoundtripEditor();
    editor.commands.setContent(orderedListMd, { contentType: 'markdown' });

    const serialized = editor.getMarkdown();
    expect(serialized).toContain('1. First Item');
    expect(serialized).toContain('2. Second Item');
    expect(serialized).toContain('3. Third Item');
  });

  it('serialized output preserves GitHub Alerts', () => {
    const raw = fs.readFileSync(STRESS_TEST_DOC_PATH, 'utf-8');
    const body = stripFrontmatter(raw);

    editor = createRoundtripEditor();
    editor.commands.setContent(body, { contentType: 'markdown' });

    const serialized = editor.getMarkdown();

    expect(serialized).toMatch(/\[!NOTE\]/);
    expect(serialized).toMatch(/\[!CAUTION\]/);
    expect(serialized).toMatch(/\[!WARNING\]/);
  });

  it('serialized output preserves task lists', () => {
    const raw = fs.readFileSync(STRESS_TEST_DOC_PATH, 'utf-8');
    const body = stripFrontmatter(raw);

    editor = createRoundtripEditor();
    editor.commands.setContent(body, { contentType: 'markdown' });

    const serialized = editor.getMarkdown();

    expect(serialized).toContain('- [x] Completed task');
    expect(serialized).toContain('- [ ] Incomplete task');
  });

  it('serialized output preserves highlight as <mark>', () => {
    const raw = fs.readFileSync(STRESS_TEST_DOC_PATH, 'utf-8');
    const body = stripFrontmatter(raw);

    editor = createRoundtripEditor();
    editor.commands.setContent(body, { contentType: 'markdown' });

    const serialized = editor.getMarkdown();

    expect(serialized).toContain('<mark>highlight</mark>');
    expect(serialized).not.toContain('==highlight==');
  });

  it('serialized output preserves mermaid code blocks', () => {
    const raw = fs.readFileSync(STRESS_TEST_DOC_PATH, 'utf-8');
    const body = stripFrontmatter(raw);

    editor = createRoundtripEditor();
    editor.commands.setContent(body, { contentType: 'markdown' });

    const serialized = editor.getMarkdown();

    expect(serialized).toContain('```mermaid');
    expect(serialized).toContain('graph TD');
    expect(serialized).toContain('sequenceDiagram');
  });

  it('serialized output preserves colored spans', () => {
    const raw = fs.readFileSync(STRESS_TEST_DOC_PATH, 'utf-8');
    const body = stripFrontmatter(raw);

    editor = createRoundtripEditor();
    editor.commands.setContent(body, { contentType: 'markdown' });

    const serialized = editor.getMarkdown();

    // Colored text spans must survive
    expect(serialized).toMatch(/<span style="color:/i);
  });
});
