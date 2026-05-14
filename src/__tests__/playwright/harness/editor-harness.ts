/**
 * TipTap Test Harness for Playwright Component Tests
 *
 * Initializes a headless TipTap editor with the same table+list extensions
 * used in production and exposes a minimal API on `window` for Playwright
 * to drive without any VS Code dependency.
 *
 * Exposed API:
 *   window.editorAPI.setMarkdown(md: string): void
 *   window.editorAPI.getMarkdown(): string
 *   window.editorAPI.runCommand(name: string, ...args: any[]): boolean
 *   window.editorAPI.isReady(): boolean
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { TableKit, Table } from '@tiptap/extension-table';
import { ListKit } from '@tiptap/extension-list';
import Paragraph from '@tiptap/extension-paragraph';
import { OrderedListMarkdownFix } from '../../../webview/extensions/orderedListMarkdownFix';
import { TaskItemClipboardFix } from '../../../webview/extensions/taskItemClipboardFix';
import { TableBulletListSmart } from '../../../webview/extensions/tableBulletListSmart';
import { renderTableToMarkdownWithBreaks } from '../../../webview/utils/tableMarkdownSerializer';

// ---------------------------------------------------------------------------
// Table extension with production-identical renderMarkdown + parseHTML
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
  }).configure({ resizable: false });
}

// ---------------------------------------------------------------------------
// Editor initialisation
// ---------------------------------------------------------------------------

const mountEl = document.getElementById('editor')!;

const editor = new Editor({
  element: mountEl,
  extensions: [
    StarterKit.configure({
      paragraph: false,
      bulletList: false,
      orderedList: false,
      listItem: false,
      listKeymap: false,
      link: false,
    }),
    Paragraph,
    Markdown.configure({ markedOptions: { gfm: true, breaks: true } }),
    createTableExtension(),
    TableKit.configure({ table: false }),
    ListKit.configure({ taskItem: false, orderedList: false }),
    TaskItemClipboardFix.configure({ nested: true }),
    OrderedListMarkdownFix,
    TableBulletListSmart,
  ],
  content: '',
});

// ---------------------------------------------------------------------------
// Public API exposed to Playwright
// ---------------------------------------------------------------------------

interface EditorAPI {
  isReady(): boolean;
  setMarkdown(md: string): void;
  getMarkdown(): string;
  /** Run a TipTap command by name with optional arguments. Returns success boolean. */
  runCommand(name: string, ...args: unknown[]): boolean;
  /** Place cursor at the start of a cell whose text contains `cellText`. */
  focusCell(cellText: string): boolean;
  /** Insert text at current cursor position. */
  insertText(text: string): void;
  /** Directly trigger the Tab-key indent handler for the current line (bypasses keyboard dispatch). */
  indentBulletLine(): boolean;
  /** Directly trigger the Shift+Tab dedent handler for the current line (bypasses keyboard dispatch). */
  dedentBulletLine(): boolean;
}

(window as any).editorAPI = {
  isReady(): boolean {
    return !editor.isDestroyed;
  },

  setMarkdown(md: string): void {
    editor.commands.setContent(md, { contentType: 'markdown' } as any);
  },

  getMarkdown(): string {
    return (editor as any).getMarkdown();
  },

  runCommand(name: string, ...args: unknown[]): boolean {
    const cmd = (editor.commands as any)[name];
    if (typeof cmd !== 'function') {
      console.warn(`[harness] Unknown command: ${name}`);
      return false;
    }
    return cmd(...args);
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

  indentBulletLine(): boolean {
    // Simulate Tab key by dispatching a keydown event directly to the editor view
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

  insertText(text: string): void {
    editor.commands.insertContent(text);
  },
} satisfies EditorAPI;

// Signal readiness to Playwright
document.dispatchEvent(new CustomEvent('editor-ready'));
