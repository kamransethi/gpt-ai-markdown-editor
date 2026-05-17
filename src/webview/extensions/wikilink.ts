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
import type { EditorView } from '@tiptap/pm/view';
import type { Node as ProsemirrorNode } from '@tiptap/pm/model';

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

            // Robust node lookup containing the clicked position
            let node: ProsemirrorNode | null = null;
            let nodePos = -1;

            view.state.doc.descendants((child, childPos) => {
              if (
                child.type.name === 'wikilink' &&
                pos >= childPos &&
                pos <= childPos + child.nodeSize
              ) {
                node = child;
                nodePos = childPos;
                return false; // stop traversal
              }
              return true;
            });

            if (!node || nodePos === -1) {
              // Fallback to simple pos check
              nodePos = pos;
              node = view.state.doc.nodeAt(pos);
              if (!node || node.type.name !== 'wikilink') {
                nodePos = pos - 1;
                if (nodePos >= 0) {
                  node = view.state.doc.nodeAt(nodePos);
                }
              }
            }

            if (!node || node.type.name !== 'wikilink') {
              return false;
            }

            const isMod = event.metaKey || event.ctrlKey;
            if (isMod) {
              // Navigate to the linked note via extension host
              getActiveBridge().postMessage({
                type: MessageType.OPEN_FILE_LINK,
                path: noteName, // FIX: send 'path' instead of 'href' to match the host handler
              });
            } else {
              // Regular click: open the premium edit dialog!
              showWikiLinkEditDialog(view, nodePos, node);
            }

            event.preventDefault();
            return true;
          },
        },
      }),
    ];
  },
});

/**
 * Premium floating edit dialog for WikiLink nodes.
 * Inherits all VS Code theme CSS variables and look-and-feel natively.
 */
function showWikiLinkEditDialog(view: EditorView, pos: number, node: ProsemirrorNode) {
  // Prevent duplicate dialogs
  let dialog = document.getElementById('wikilink-edit-dialog');
  if (dialog) dialog.remove();

  dialog = document.createElement('div');
  dialog.id = 'wikilink-edit-dialog';
  dialog.className = 'link-dialog-popover';
  dialog.style.position = 'fixed';
  dialog.style.inset = '0';
  dialog.style.zIndex = '6000';
  dialog.style.backgroundColor = 'rgba(0, 0, 0, 0.4)';
  dialog.style.display = 'flex';
  dialog.style.alignItems = 'center';
  dialog.style.justifyContent = 'center';

  const panel = document.createElement('div');
  panel.className = 'export-settings-overlay-panel';
  panel.style.maxWidth = '400px';
  panel.style.width = '90%';
  panel.style.boxShadow = '0 12px 32px rgba(0,0,0,0.24)';
  panel.style.background = 'var(--vscode-editor-background, var(--md-bg))';
  panel.style.border = '1px solid var(--md-border)';
  panel.style.borderRadius = '6px';
  panel.style.overflow = 'hidden';

  const header = document.createElement('div');
  header.className = 'export-settings-overlay-header';
  header.innerHTML = `
    <h2 class="export-settings-overlay-title">Edit WikiLink</h2>
    <button class="export-settings-overlay-close" aria-label="Close dialog" title="Close (Esc)">×</button>
  `;

  const closeBtn = header.querySelector('.export-settings-overlay-close') as HTMLElement;

  const content = document.createElement('div');
  content.className = 'export-settings-content';
  content.style.padding = '16px';
  content.innerHTML = `
    <div class="export-settings-section" style="margin-bottom: 12px;">
      <label class="export-settings-label" for="wikilink-target-input">Target Note</label>
      <input
        type="text"
        id="wikilink-target-input"
        class="export-settings-select"
        style="padding: 8px 12px; width: 100%; box-sizing: border-box;"
        placeholder="e.g. note-name"
      />
    </div>
    <div class="export-settings-section" style="margin-bottom: 16px;">
      <label class="export-settings-label" for="wikilink-label-input">Display Label (Optional)</label>
      <input
        type="text"
        id="wikilink-label-input"
        class="export-settings-select"
        style="padding: 8px 12px; width: 100%; box-sizing: border-box;"
        placeholder="Custom text to show"
      />
    </div>
    <div style="display: flex; gap: 8px; justify-content: flex-end; border-top: 1px solid var(--md-border); padding-top: 12px;">
      <button
        id="wikilink-remove-btn"
        class="export-settings-select"
        style="width: auto; padding: 6px 14px; background: var(--vscode-button-secondaryBackground, var(--md-button-secondary-bg)); color: var(--vscode-button-secondaryForeground, var(--md-button-secondary-fg)); border: none; cursor: pointer; border-radius: 4px; margin-right: auto;"
      >
        Remove
      </button>
      <button
        id="wikilink-cancel-btn"
        class="export-settings-select"
        style="width: auto; padding: 6px 16px; background: var(--vscode-button-secondaryBackground, var(--md-button-secondary-bg)); color: var(--vscode-button-secondaryForeground, var(--md-button-secondary-fg)); border: none; cursor: pointer; border-radius: 4px;"
      >
        Cancel
      </button>
      <button
        id="wikilink-ok-btn"
        class="export-settings-select"
        style="width: auto; padding: 6px 16px; background: var(--vscode-button-background, var(--md-button-bg)); color: var(--vscode-button-foreground, var(--md-button-fg)); border: none; cursor: pointer; border-radius: 4px;"
      >
        Save
      </button>
    </div>
  `;

  const targetInput = content.querySelector('#wikilink-target-input') as HTMLInputElement;
  const labelInput = content.querySelector('#wikilink-label-input') as HTMLInputElement;
  const okBtn = content.querySelector('#wikilink-ok-btn') as HTMLButtonElement;
  const cancelBtn = content.querySelector('#wikilink-cancel-btn') as HTMLButtonElement;
  const removeBtn = content.querySelector('#wikilink-remove-btn') as HTMLButtonElement;

  // Pre-populate values
  targetInput.value = node.attrs.target || '';
  labelInput.value = node.attrs.label || '';

  const cleanup = () => {
    dialog?.remove();
    view.focus();
  };

  closeBtn.onclick = cleanup;
  cancelBtn.onclick = cleanup;

  okBtn.onclick = () => {
    const targetVal = targetInput.value.trim();
    if (!targetVal) {
      targetInput.focus();
      return;
    }
    const labelVal = labelInput.value.trim() || null;

    const { tr } = view.state;
    const newNode = view.state.schema.nodes.wikilink.create({
      target: targetVal,
      label: labelVal,
    });
    tr.replaceWith(pos, pos + node.nodeSize, newNode);
    view.dispatch(tr);
    cleanup();
  };

  removeBtn.onclick = () => {
    const { tr } = view.state;
    tr.delete(pos, pos + node.nodeSize);
    view.dispatch(tr);
    cleanup();
  };

  // Keyboard accessibility
  dialog.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      cleanup();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      okBtn.click();
    }
  });

  panel.appendChild(header);
  panel.appendChild(content);
  dialog.appendChild(panel);
  document.body.appendChild(dialog);

  // Focus and select target text
  requestAnimationFrame(() => {
    targetInput.focus();
    targetInput.select();
  });
}

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
