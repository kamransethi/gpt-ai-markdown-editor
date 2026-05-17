/**
 * WikiLink TipTap 3.x Extension
 *
 * Renders [[Target Note]] and [[Target Note|Display Text]] as clickable
 * wikilinks in the editor. Clicking opens the linked note via the extension host.
 *
 * This is a custom TipTap 3.x extension — existing npm packages target TipTap 2.x
 * and are incompatible.
 *
 * Markdown round-trip: wikilinks are preserved verbatim in the markdown output
 * using a custom leaf node that stores the raw wikilink text.
 */

import { Node, Extension, nodePasteRule, InputRule } from '@tiptap/core';
import { marked } from 'marked';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Suggestion } from '@tiptap/suggestion';
import { MessageType } from '../../shared/messageTypes';
import { getActiveBridge } from '../hostBridge';
import { SuggestionList } from '../components/SuggestionList';

// ── Types ──────────────────────────────────────────────────────────────────

export interface WikiLinkOptions {
  /** CSS class applied to rendered wikilinks */
  HTMLAttributes: Record<string, string>;
}

// ── Extension ──────────────────────────────────────────────────────────────

/**
 * WikiLink node — an inline leaf node that renders as a `<a class="wikilink">`.
 *
 * Attrs:
 *  - target: the note name / path inside [[ ]]
 *  - label:  optional display text after the pipe |
 */
export const WikiLink = Node.create<WikiLinkOptions>({
  name: 'wikilink',

  group: 'inline',
  inline: true,
  atom: true, // treated as a single unit for cursor movement

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      target: {
        default: null,
        parseHTML: element => element.getAttribute('data-wikilink'),
      },
      label: {
        default: null,
        parseHTML: element => element.getAttribute('data-label'),
      },
    };
  },

  // ── HTML rendering ─────────────────────────────────────────────────────

  parseHTML() {
    return [{ tag: 'a[data-wikilink]' }];
  },

  renderHTML({ node }) {
    const { target, label } = node.attrs as { target: string; label: string | null };
    const displayText = label ?? target;
    const attrs: Record<string, string> = {
      'data-wikilink': target,
      class: 'wikilink',
      href: '#',
      title: `[[${target}]]`,
      ...this.options.HTMLAttributes,
    };
    if (label) {
      attrs['data-label'] = label;
    }
    return ['a', attrs, `[[${displayText}]]`];
  },

  // ── Markdown serialization ─────────────────────────────────────────────

  // The markdown extension looks for renderMarkdown on node specs.
  // We return the original wikilink syntax so the file is unchanged on save.
  addStorage() {
    return {};
  },

  // Match the token name produced by wikilinkMarkedExtension so the
  // Markdown extension's token dispatcher routes 'wikilink' tokens here.
  markdownTokenName: 'wikilink',

  // Parse a wikilink token from Marked into a ProseMirror node.
  parseMarkdown(token: any) {
    return {
      type: 'wikilink' as const,
      attrs: {
        target: token.target ?? token.text ?? '',
        label: token.label ?? null,
      },
    };
  },

  // Custom markdown renderer (used by @tiptap/extension-markdown)
  renderMarkdown(node: any) {
    const target = node.attrs?.target ?? '';
    const label = node.attrs?.label;
    return label ? `[[${target}|${label}]]` : `[[${target}]]`;
  },

  // ── Paste rules ────────────────────────────────────────────────────────

  addPasteRules() {
    return [
      nodePasteRule({
        find: /\[\[([^\]|#]+?)(?:\|([^\]]*?))?\]\]/g,
        type: this.type,
        getAttributes(match) {
          return { target: match[1], label: match[2] ?? null };
        },
      }),
    ];
  },

  addInputRules() {
    // Detect [[...]] as the user types and convert to wikilink node on closing ]]
    return [
      new InputRule({
        find: /\[\[([^\]|#]+?)(?:\|([^\]]*?))?\]\]$/,
        handler({ state, range, match }) {
          const { tr } = state;
          const start = range.from;
          const end = range.to;

          const target = match[1].trim();
          const label = match[2]?.trim() ?? null;

          const node = state.schema.nodes.wikilink.create({ target, label });
          tr.replaceWith(start, end, node);
          return tr;
        },
      }),
    ];
  },

  // ── Click handler ──────────────────────────────────────────────────────

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('wikilink-click'),
        props: {
          handleClick(view, pos, event) {
            const target = event.target as HTMLElement;
            const link = target.closest('[data-wikilink]') as HTMLElement | null;
            if (!link) return false;

            const noteName = link.dataset.wikilink;
            if (!noteName) return false;

            // Navigate to the linked note via extension host
            getActiveBridge().postMessage({
              type: MessageType.OPEN_FILE_LINK,
              href: noteName, // extension host resolves by note name
            });

            event.preventDefault();
            return true;
          },
        },
      }),
    ];
  },
});

// ── Markdown input parsing ─────────────────────────────────────────────────

/**
 * A marked.js tokenizer extension that converts [[Target]] tokens in the
 * markdown source into wikilink nodes during import.
 *
 * Usage: pass to the markedInstance as a custom extension.
 */
export const wikilinkMarkedExtension = {
  name: 'wikilink',
  level: 'inline' as const,
  start(src: string) {
    return src.indexOf('[[');
  },
  tokenizer(src: string) {
    const match = src.match(/^\[\[([^\]|#]+?)(?:\|([^\]]*?))?\]\]/);
    if (!match) return undefined;
    return {
      type: 'wikilink',
      raw: match[0],
      target: match[1].trim(),
      label: match[2]?.trim() ?? null,
    };
  },
  renderer(token: { target: string; label: string | null }) {
    const display = token.label ?? token.target;
    const labelAttr = token.label ? ` data-label="${token.label}"` : '';
    return `<a data-wikilink="${token.target}"${labelAttr} class="wikilink" href="#" title="[[${token.target}]]">[[${display}]]</a>`;
  },
};

// Register the extension globally on the marked singleton
marked.use({ extensions: [wikilinkMarkedExtension as any] });

// ── Note list cache for autocomplete ───────────────────────────────────────

interface NoteEntry {
  title: string;
  filename: string;
  path: string;
}

let _noteCache: NoteEntry[] = [];

/** Called by editor.ts when a NOTE_LIST_RESULT message is received. */
export function updateCachedNoteList(notes: NoteEntry[]): void {
  _noteCache = notes;
}

/** Return the cached note list (for future autocomplete use). */
export function getCachedNoteList(): NoteEntry[] {
  return _noteCache;
}

// ── WikiLink Suggestion Dropdown Extension ─────────────────────────────────

export const WikiLinkSuggest = Extension.create({
  name: 'wikilinkSuggest',

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: '[[',
        pluginKey: new PluginKey('wikilinkSuggest'),

        allow: ({ state, range }) => {
          const $from = state.doc.resolve(range.from);
          return $from.parent.inlineContent;
        },

        command: ({ editor, range, props }: any) => {
          const note = props.note;
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent({
              type: 'wikilink',
              attrs: { target: note.filename, label: null },
            })
            .run();
        },

        items: ({ query }: { query: string }) => {
          return getCachedNoteList()
            .filter(
              n =>
                (n.title ?? '').toLowerCase().includes(query.toLowerCase()) ||
                (n.filename ?? '').toLowerCase().includes(query.toLowerCase())
            )
            .slice(0, 20)
            .map(n => ({
              title: n.title || n.filename,
              description: n.path,
              icon: '📄',
              note: n, // attach original note object
            }));
        },

        render: () => {
          let component: SuggestionList | null = null;
          let activeCommandCallback: ((item: any) => void) | null = null;

          return {
            onStart: (props: any) => {
              // Fetch a fresh note list from the host when the user starts typing [[
              getActiveBridge().postMessage({ type: MessageType.GET_NOTE_LIST });

              activeCommandCallback = props.command;
              component = new SuggestionList(item => {
                if (activeCommandCallback) {
                  activeCommandCallback(item);
                }
              });
              component.mount(props);
            },
            onUpdate: (props: any) => {
              activeCommandCallback = props.command;
              component?.update(props);
            },
            onKeyDown: (props: any) => {
              return component?.handleKeyDown(props.event) ?? false;
            },
            onExit: () => {
              component?.destroy();
              component = null;
              activeCommandCallback = null;
            },
          };
        },
      }),
    ];
  },
});
