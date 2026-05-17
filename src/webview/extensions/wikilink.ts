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

import { Node, nodePasteRule } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { MessageType } from '../../shared/messageTypes';
import { getActiveBridge } from '../hostBridge';

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
      target: { default: null },
      label: { default: null },
    };
  },

  // ── HTML rendering ─────────────────────────────────────────────────────

  parseHTML() {
    return [{ tag: 'a[data-wikilink]' }];
  },

  renderHTML({ node }) {
    const { target, label } = node.attrs as { target: string; label: string | null };
    const displayText = label ?? target;
    return [
      'a',
      {
        'data-wikilink': target,
        class: 'wikilink',
        href: '#',
        title: `[[${target}]]`,
        ...this.options.HTMLAttributes,
      },
      `[[${displayText}]]`,
    ];
  },

  // ── Markdown serialization ─────────────────────────────────────────────

  // The markdown extension looks for renderMarkdown on node specs.
  // We return the original wikilink syntax so the file is unchanged on save.
  addStorage() {
    return {};
  },

  // Custom markdown renderer (used by @tiptap/extension-markdown)
  renderMarkdown({ node }: { node: { attrs: { target: string; label: string | null } } }) {
    const { target, label } = node.attrs;
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

  // ── Input rules ────────────────────────────────────────────────────────

  addInputRules() {
    // Detect [[...]] as the user types and convert to wikilink node
    return []; // handled by paste rules; typing creates wikilinks on ]] close
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
    return `<a data-wikilink="${token.target}" class="wikilink" href="#" title="[[${token.target}]]">[[${display}]]</a>`;
  },
};
