/**
 * Full Editor Test Harness for Playwright Component Tests
 *
 * Initializes TipTap with ALL production extensions (same set as editor.ts)
 * and exposes two APIs on window for Playwright to drive without any VS Code
 * dependency:
 *
 *   window.editorAPI  — editor content + mark queries + command execution
 *   window.spellAPI   — spell check state + dictionary management
 *
 * The host HTML (full-editor.html) sets window.vscode to a no-op mock
 * BEFORE this script loads, so all getVscodeApi() / window.vscode calls
 * inside extensions resolve silently.
 *
 * Extension list kept in sync with src/webview/editor.ts.
 * Last synced: 2026-05-10
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { TableKit, Table, TableCell } from '@tiptap/extension-table';
import { BulletList, ListKit, TaskList } from '@tiptap/extension-list';
import { TableOfContents } from '@tiptap/extension-table-of-contents';
import Link from '@tiptap/extension-link';
import { BubbleMenu as BubbleMenuExtension } from '@tiptap/extension-bubble-menu';
import Focus from '@tiptap/extension-focus';
import CharacterCount from '@tiptap/extension-character-count';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import Typography from '@tiptap/extension-typography';
import { Marked } from 'marked';

// Custom extensions — same imports as src/webview/editor.ts
import { CodeBlockWithUi } from '../../../webview/extensions/codeBlockShikiWithUi';
import { common, createLowlight } from 'lowlight';
import { Mermaid } from '../../../webview/extensions/mermaid';
import { IndentedImageCodeBlock } from '../../../webview/extensions/indentedImageCodeBlock';
import { SpaceFriendlyImagePaths } from '../../../webview/extensions/spaceFriendlyImagePaths';
import { TabIndentation } from '../../../webview/extensions/tabIndentation';
import { GitHubAlerts } from '../../../webview/extensions/githubAlerts';
import { ImageBoundaryNav } from '../../../webview/extensions/imageBoundaryNav';
import { OrderedListMarkdownFix } from '../../../webview/extensions/orderedListMarkdownFix';
import { TaskItemClipboardFix } from '../../../webview/extensions/taskItemClipboardFix';
import { GenericHTMLInline, GenericHTMLBlock } from '../../../webview/extensions/htmlPreservation';
import { HtmlCommentInline, HtmlCommentBlock } from '../../../webview/extensions/htmlComment';
import { TextColorMark, CustomTextStyle } from '../../../webview/extensions/textColor';
import { CustomImage } from '../../../webview/extensions/customImage';
import { ImageUploadPlugin } from '../../../webview/extensions/imageUploadPlugin';
import { SearchAndReplace } from '../../../webview/extensions/searchAndReplace';
import { CommandRegistry } from '../../../webview/extensions/CommandRegistry';
import { TableBulletListSmart } from '../../../webview/extensions/tableBulletListSmart';
import { AiExplain } from '../../../webview/extensions/aiExplain';
import {
  SpellCheck,
  initSpellCheck,
  reloadUserWords,
  spellCheckKey,
} from '../../../webview/extensions/spellCheck';

// Utilities
import { renderTableToMarkdownWithBreaks } from '../../../webview/utils/tableMarkdownSerializer';
import { getEditorMarkdownForSync } from '../../../webview/utils/markdownSerialization';
import { shouldAutoLink } from '../../../webview/utils/linkValidation';

// ---------------------------------------------------------------------------
// Table extension — production-identical renderMarkdown + parseHTML
// ---------------------------------------------------------------------------

function createTableExtension() {
  return Table.extend({
    renderMarkdown(node: any, h: any) {
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
    resizable: true,
    HTMLAttributes: { class: 'markdown-table' },
  });
}

// ---------------------------------------------------------------------------
// Editor initialisation
// ---------------------------------------------------------------------------

const mountEl = document.getElementById('editor')!;
const bubbleMenuEl = document.getElementById('bubble-menu')!;

// User-words list managed by spellAPI for addToDictionary / removeFromDictionary
const userDictionary: string[] = [];

// Frontmatter stored separately so TipTap never sees raw YAML (mirrors editor.ts behaviour)
let harnessStoredFrontmatter: string | null = null;
/** The exact newline sequence that followed the closing --- in the original document. */
let harnessStoredFmTrail: string = '\n';

/**
 * Strip YAML frontmatter from markdown and return the body + the extracted YAML.
 * Also captures the trailing newlines after the closing --- so they can be
 * restored exactly by getMarkdown(), preventing line-shift diffs.
 * Mirrors extractAndStoreFrontmatter() in editor.ts.
 */
function harnessSplitFrontmatter(md: string): { body: string; frontmatter: string | null } {
  if (!md.startsWith('---')) return { body: md, frontmatter: null };
  // Capture the YAML between the delimiters AND all trailing newlines after closing ---
  const match = md.match(/^---\r?\n([\s\S]*?)\r?\n---((?:\r?\n)+)/);
  if (match) {
    harnessStoredFmTrail = match[2];
    return { body: md.substring(match[0].length), frontmatter: match[1] };
  }
  // Fallback: closing --- at very end of file with single newline
  const minimal = md.match(/^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/);
  if (!minimal) return { body: md, frontmatter: null };
  harnessStoredFmTrail = minimal[2] || '\n';
  return { body: md.substring(minimal[0].length), frontmatter: minimal[1] };
}

const editor = new Editor({
  element: mountEl,
  extensions: [
    // ── Pre-StarterKit extensions (order matters for markdown tokenizer priority) ──
    Mermaid,
    IndentedImageCodeBlock,
    SpaceFriendlyImagePaths,
    GitHubAlerts,

    Highlight.extend({
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
    }).configure({ HTMLAttributes: { class: 'highlight' } }),

    Typography,

    Placeholder.configure({
      placeholder: 'Start writing markdown...',
      emptyEditorClass: 'is-editor-empty',
      emptyNodeClass: 'is-empty',
      showOnlyCurrent: false,
    }),

    CharacterCount,

    GenericHTMLInline,
    GenericHTMLBlock,
    HtmlCommentInline,
    HtmlCommentBlock,
    CustomTextStyle,
    TextColorMark,

    // ── StarterKit ──
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      paragraph: true,
      codeBlock: false,
      bulletList: false,
      orderedList: false,
      listItem: false,
      taskList: false,
      taskItem: false,
      listKeymap: false,
      link: false,
      undoRedo: { depth: 100 } as any,
    } as any),

    // ── Code blocks ──
    CodeBlockWithUi.configure({
      lowlight: createLowlight(common),
      defaultLanguage: 'plaintext',
      HTMLAttributes: { class: 'code-block-highlighted' },
    }),

    // ── Markdown ──
    Markdown.configure({
      marked: new Marked() as any,
      markedOptions: { gfm: true, breaks: true },
    }),

    // ── Table ──
    createTableExtension(),
    TableKit.configure({ table: false, tableCell: false }),
    TableCell.extend({ content: 'block+' }),

    // ── Lists ──
    BulletList.extend({
      addInputRules() {
        return [];
      },
      // Override parseMarkdown to fix pure task list parsing.
      // @tiptap/markdown's parseListToken only handles MIXED lists (some task,
      // some non-task). For PURE task lists (!hasNonTask), it falls back to the
      // BulletList handler which creates listItem nodes (losing checkboxes).
      // This override detects pure task lists and creates taskList+taskItem nodes.
      parseMarkdown(token: any, helpers: any) {
        if (token.type !== 'list' || token.ordered) return [];
        const items: any[] = token.items || [];
        const allTask = items.length > 0 && items.every((item: any) => item.task === true);
        if (allTask) {
          const taskItemNodes = items.map((item: any) => {
            const tokens: any[] = item.tokens || [];
            const textToken = tokens.find((t: any) => t.type === 'text');
            const nestedTokens = tokens.filter(
              (t: any) => t.type !== 'checkbox' && t.type !== 'text'
            );
            // Tight list: inline content from text token's sub-tokens
            const hasParagraph = tokens.some((t: any) => t.type === 'paragraph');
            let paragraphContent: any[];
            if (hasParagraph) {
              paragraphContent = helpers.parseChildren(
                tokens.filter((t: any) => t.type !== 'checkbox')
              );
            } else {
              const inlineTokens = textToken?.tokens || [];
              const inlineContent =
                inlineTokens.length > 0
                  ? helpers.parseInline(inlineTokens)
                  : textToken?.text
                    ? [{ type: 'text', text: textToken.text }]
                    : [];
              paragraphContent = [{ type: 'paragraph', content: inlineContent }];
            }
            const nestedContent =
              nestedTokens.length > 0 ? helpers.parseChildren(nestedTokens) : [];
            return {
              type: 'taskItem',
              attrs: { checked: item.checked === true },
              content: [...paragraphContent, ...nestedContent],
            };
          });
          return { type: 'taskList', content: taskItemNodes };
        }
        return {
          type: 'bulletList',
          content: items.length > 0 ? helpers.parseChildren(items) : [],
        };
      },
    }),
    ListKit.configure({
      bulletList: false,
      orderedList: false,
      taskList: false,
      taskItem: false,
    }),
    TaskList.configure({ HTMLAttributes: { class: 'task-list' } }),
    TaskItemClipboardFix.configure({ nested: true }),
    OrderedListMarkdownFix,

    // ── Navigation / keyboard ──
    TabIndentation,
    ImageBoundaryNav,

    // ── Links ──
    Link.configure({
      openOnClick: false,
      HTMLAttributes: { class: 'markdown-link' },
      shouldAutoLink,
    }).extend({
      inclusive() {
        return false;
      },
    }),

    // ── Images ──
    CustomImage.configure({
      allowBase64: true,
      HTMLAttributes: { class: 'markdown-image' },
    }),
    ImageUploadPlugin,

    // ── Search & Replace ──
    SearchAndReplace,

    // ── Slash Commands ──
    CommandRegistry,

    // ── Table utilities ──
    TableBulletListSmart,

    // ── Table of Contents ──
    TableOfContents.configure({
      anchorTypes: ['heading'],
      scrollParent: () => window,
      onUpdate: () => {}, // Tests inspect DOM directly; no pane in harness
    }),

    // ── AI features (no-op bridge — window.vscode is a no-op mock from HTML) ──
    AiExplain,

    // ── Spell check (worker initialised lazily via spellAPI.init()) ──
    SpellCheck,

    // ── Focus class ──
    Focus.configure({ className: 'has-focus', mode: 'shallowest' }),

    // ── Bubble menu (element pre-built in full-editor.html) ──
    BubbleMenuExtension.configure({
      element: bubbleMenuEl,
      shouldShow: ({ state }) => {
        const { from, to, empty } = state.selection;
        return !empty && from !== to;
      },
      options: {
        placement: 'top',
        offset: 8,
      },
      updateDelay: 50,
    }),
  ],
  content: '',
});

// ---------------------------------------------------------------------------
// Public API — window.editorAPI
// ---------------------------------------------------------------------------

interface EditorAPI {
  isReady(): boolean;
  setMarkdown(md: string): void;
  getMarkdown(): string;
  runCommand(name: string, ...args: unknown[]): boolean;
  getActiveMarks(): string[];
  getSelectionCoords(): { top: number; left: number; width: number; height: number } | null;
  focusCell(cellText: string): boolean;
  insertText(text: string): void;
  indentBulletLine(): boolean;
  dedentBulletLine(): boolean;
}

(window as any).editorAPI = {
  isReady(): boolean {
    return !editor.isDestroyed;
  },

  setMarkdown(md: string): void {
    const { body, frontmatter } = harnessSplitFrontmatter(md);
    harnessStoredFrontmatter = frontmatter;
    editor.commands.setContent(body, { contentType: 'markdown' } as any);
  },

  getMarkdown(): string {
    const body = getEditorMarkdownForSync(editor);
    if (!harnessStoredFrontmatter) return body;
    // Trim any leading newlines that the serializer may produce before the first block
    const trimmedBody = body.replace(/^\n+/, '');
    // Restore frontmatter with the exact trailing newline(s) from the original document
    return `---\n${harnessStoredFrontmatter}\n---${harnessStoredFmTrail}${trimmedBody}`;
  },

  runCommand(name: string, ...args: unknown[]): boolean {
    const cmd = (editor.commands as any)[name];
    if (typeof cmd !== 'function') {
      console.warn(`[full-harness] Unknown command: ${name}`);
      return false;
    }
    return cmd(...args);
  },

  getActiveMarks(): string[] {
    const marks: string[] = [];
    const checkMark = (name: string, attrs?: Record<string, unknown>) => {
      if (editor.isActive(name, attrs)) marks.push(name);
    };
    checkMark('bold');
    checkMark('italic');
    checkMark('underline');
    checkMark('strike');
    checkMark('code');
    checkMark('highlight');
    checkMark('link');
    checkMark('textStyle');
    // Heading levels
    for (let level = 1; level <= 6; level++) {
      if (editor.isActive('heading', { level })) marks.push(`heading${level}`);
    }
    // Block nodes
    ['blockquote', 'codeBlock', 'bulletList', 'orderedList', 'taskList'].forEach(node => {
      if (editor.isActive(node)) marks.push(node);
    });
    return marks;
  },

  getSelectionCoords(): { top: number; left: number; width: number; height: number } | null {
    const { from, to, empty } = editor.state.selection;
    if (empty) return null;
    try {
      const start = editor.view.coordsAtPos(from);
      const end = editor.view.coordsAtPos(to);
      return {
        top: Math.min(start.top, end.top),
        left: Math.min(start.left, end.left),
        width: Math.abs(end.left - start.left),
        height: Math.abs(end.bottom - start.top),
      };
    } catch {
      return null;
    }
  },

  focusCell(cellText: string): boolean {
    let found = false;
    editor.state.doc.descendants((node, pos) => {
      if (found) return false;
      if (node.isText && node.text?.includes(cellText)) {
        editor.commands.setTextSelection(pos);
        editor.view.focus();
        found = true;
        return false;
      }
      return true;
    });
    return found;
  },

  insertText(text: string): void {
    editor.commands.insertContent(text);
  },

  indentBulletLine(): boolean {
    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      code: 'Tab',
      bubbles: true,
      cancelable: true,
    });
    return editor.view.dom.dispatchEvent(event);
  },

  dedentBulletLine(): boolean {
    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      code: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    return editor.view.dom.dispatchEvent(event);
  },
} satisfies EditorAPI;

// ---------------------------------------------------------------------------
// Public API — window.spellAPI
// ---------------------------------------------------------------------------

interface SpellAPI {
  isReady(): boolean;
  isWorkerReady(): boolean;
  setMarkdown(md: string): void;
  getSpellErrorWords(): string[];
  getSuggestions(word: string): string[];
  addToDictionary(word: string): void;
  removeFromDictionary(word: string): void;
  /** Initialise the spell worker with dictionary URLs. Must be called before word queries work. */
  init(affUrl: string, dicUrl: string): Promise<void>;
}

(window as any).spellAPI = {
  isReady(): boolean {
    return !editor.isDestroyed;
  },

  isWorkerReady(): boolean {
    const state = spellCheckKey.getState(editor.state);
    return state?.workerReady ?? false;
  },

  setMarkdown(md: string): void {
    editor.commands.setContent(md, { contentType: 'markdown' } as any);
  },

  getSpellErrorWords(): string[] {
    const state = spellCheckKey.getState(editor.state);
    if (!state) return [];
    return state.decorations
      .find()
      .map((d: any) => (d.spec as { word?: string }).word ?? '')
      .filter(Boolean);
  },

  getSuggestions(word: string): string[] {
    const state = spellCheckKey.getState(editor.state);
    if (!state) return [];
    const dec = state.decorations.find().find((d: any) => (d.spec as any).word === word);
    return dec ? (((dec as any).spec as any).suggestions ?? []) : [];
  },

  addToDictionary(word: string): void {
    if (!userDictionary.includes(word)) {
      userDictionary.push(word);
      reloadUserWords(userDictionary);
    }
  },

  removeFromDictionary(word: string): void {
    const idx = userDictionary.indexOf(word);
    if (idx !== -1) {
      userDictionary.splice(idx, 1);
      reloadUserWords(userDictionary);
    }
  },

  async init(affUrl: string, dicUrl: string): Promise<void> {
    return initSpellCheck({ affUrl, dicUrl, userWords: userDictionary });
  },
} satisfies SpellAPI;

// ---------------------------------------------------------------------------
// Signal readiness to Playwright
// ---------------------------------------------------------------------------

document.dispatchEvent(new CustomEvent('editor-ready'));
