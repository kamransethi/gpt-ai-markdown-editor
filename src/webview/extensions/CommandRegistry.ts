/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Unified Command Registry for slash-triggered commands.
 *
 * How file search works:
 *  - Typing `/link <query>` or `/file <query>` in the suggestion switches to file-search mode.
 *  - Selecting "File Link" from the block menu opens an inline file-picker overlay directly,
 *    using the client-side fileCache for instant search.
 *
 * IMPORTANT: The `items()` callback in @tiptap/suggestion only receives `{ query }`.
 * Do NOT add editor/range parameters — the plugin will silently stop working.
 */

import { Extension } from '@tiptap/core';
import { Suggestion, type SuggestionOptions } from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';
import { MERMAID_TEMPLATES } from '../mermaidTemplates';
import { formatLinkDisplay } from '../../shared/formatters';
import { fileCache } from '../utils/fileCache';
import { SuggestionList } from '../components/SuggestionList';

export interface CommandProviderItem {
  title: string;
  description: string;
  icon: string;
  command: (props: { editor: any; range: any }) => void;
  [key: string]: any;
}

// ── Inline Workspace Picker ──────────────────────────────────────────────────
// Opened when the user selects "File Link" or "Image" from the block menu.
// Positions itself at the cursor, searches fileCache, and inserts accordingly.

type WorkspacePickerMode = 'fileLink' | 'image';

function isImagePath(path: string): boolean {
  return /\.(png|jpe?g|gif|svg|webp|bmp|ico|tiff?)$/i.test(path);
}

function openWorkspacePicker(editor: any, insertFrom: number, mode: WorkspacePickerMode): void {
  // --- Container ---
  const container = document.createElement('div');
  container.className = 'slash-command-menu file-link-picker';
  container.style.position = 'fixed';
  container.style.zIndex = '1100';
  container.style.minWidth = '280px';
  container.style.maxWidth = '380px';

  // --- Input ---
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = mode === 'image' ? 'Search images…' : 'Search files…';
  input.className = 'file-link-search-input';
  input.style.cssText = [
    'width:100%',
    'box-sizing:border-box',
    'padding:6px 10px',
    'border:none',
    'border-bottom:1px solid var(--md-border)',
    'background:transparent',
    'color:var(--md-foreground)',
    'font-family:var(--md-font-sans)',
    'font-size:13px',
    'outline:none',
  ].join(';');

  // --- Results list ---
  const resultEl = document.createElement('div');

  container.appendChild(input);
  container.appendChild(resultEl);
  document.body.appendChild(container);

  // --- Position near cursor ---
  const coords = editor.view.coordsAtPos(Math.max(0, insertFrom - 1));
  const { innerHeight, innerWidth } = window;
  const popH = 300;
  const popW = 320;
  const top = coords.bottom + popH > innerHeight ? coords.top - popH : coords.bottom + 4;
  const left = Math.min(coords.left, innerWidth - popW - 8);
  container.style.top = `${top}px`;
  container.style.left = `${left}px`;

  // --- Rendering results ---
  let selectedIdx = 0;
  let currentFiles: { filename: string; path: string }[] = [];

  function renderResults(files: { filename: string; path: string }[]) {
    currentFiles = files;
    selectedIdx = 0;
    resultEl.innerHTML = '';

    if (files.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'slash-command-empty';
      empty.textContent = mode === 'image' ? 'No images found' : 'No files found';
      resultEl.appendChild(empty);
      return;
    }

    files.forEach((file, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'slash-command-item' + (i === 0 ? ' is-selected' : '');
      btn.setAttribute('role', 'option');
      btn.innerHTML = `
          <span class="slash-command-icon">${mode === 'image' ? '🖼' : '📄'}</span>
        <span class="slash-command-text">
          <span class="slash-command-title">${formatLinkDisplay(file.filename)}</span>
          <span class="slash-command-desc">${file.path}</span>
        </span>
      `;
      btn.addEventListener('mouseenter', () => {
        resultEl
          .querySelectorAll('.slash-command-item')
          .forEach(el => el.classList.remove('is-selected'));
        btn.classList.add('is-selected');
        selectedIdx = i;
      });
      btn.addEventListener('click', () => insertItem(file));
      resultEl.appendChild(btn);
    });
  }

  function updateSelection() {
    const btns = Array.from(resultEl.querySelectorAll('.slash-command-item'));
    btns.forEach((el, i) => {
      el.classList.toggle('is-selected', i === selectedIdx);
      if (i === selectedIdx) (el as HTMLElement).scrollIntoView({ block: 'nearest' });
    });
  }

  function insertItem(file: { filename: string; path: string }) {
    if (mode === 'image') {
      editor
        .chain()
        .focus()
        .insertContentAt(insertFrom, [
          {
            type: 'image',
            attrs: {
              src: file.path,
              alt: formatLinkDisplay(file.filename),
            },
          },
          { type: 'text', text: ' ' },
        ])
        .run();
      cleanup();
      return;
    }

    editor
      .chain()
      .focus()
      .insertContentAt(insertFrom, [
        {
          type: 'text',
          marks: [{ type: 'link', attrs: { href: file.path } }],
          text: formatLinkDisplay(file.filename),
        },
        { type: 'text', text: ' ' },
      ])
      .run();
    cleanup();
  }

  function cleanup() {
    container.remove();
    document.removeEventListener('mousedown', outsideClick, true);
  }

  function outsideClick(e: MouseEvent) {
    if (!container.contains(e.target as Node)) cleanup();
  }

  input.addEventListener('input', () => {
    renderResults(fileCache.search(input.value.trim(), 15));
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') {
      selectedIdx = Math.min(selectedIdx + 1, currentFiles.length - 1);
      updateSelection();
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      selectedIdx = Math.max(selectedIdx - 1, 0);
      updateSelection();
      e.preventDefault();
    } else if (e.key === 'Enter') {
      const file = currentFiles[selectedIdx];
      if (file) insertItem(file);
      e.preventDefault();
    } else if (e.key === 'Escape') {
      cleanup();
    }
  });

  document.addEventListener('mousedown', outsideClick, true);

  // Seed with full list (or empty if cache not ready yet)
  const initialFiles =
    mode === 'image'
      ? fileCache
          .search('', 200)
          .filter(file => isImagePath(file.path))
          .slice(0, 15)
      : fileCache.search('', 15);
  renderResults(initialFiles);
  input.focus();
}

// ── Block command list ────────────────────────────────────────────────────────

function makeBlockItems(): CommandProviderItem[] {
  return [
    {
      title: 'Heading 1',
      description: 'Large heading',
      icon: 'H1',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
      },
    },
    {
      title: 'Heading 2',
      description: 'Medium heading',
      icon: 'H2',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
      },
    },
    {
      title: 'Heading 3',
      description: 'Small heading',
      icon: 'H3',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run();
      },
    },
    {
      title: 'Bullet List',
      description: 'Unordered list',
      icon: '•',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBulletList().run();
      },
    },
    {
      title: 'Numbered List',
      description: 'Ordered list',
      icon: '1.',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleOrderedList().run();
      },
    },
    {
      title: 'Task List',
      description: 'Checkbox list',
      icon: '☑',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleTaskList().run();
      },
    },
    {
      title: 'Blockquote',
      description: 'Quote block',
      icon: '"',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setBlockquote().run();
      },
    },
    {
      title: 'Code Block',
      description: 'Fenced code block',
      icon: '</>',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setCodeBlock({ language: 'plaintext' }).run();
      },
    },
    {
      title: 'Horizontal Rule',
      description: 'Divider line',
      icon: '—',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHorizontalRule().run();
      },
    },
    {
      title: 'Table',
      description: '3×3 table',
      icon: '⊞',
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run();
      },
    },
    {
      title: 'Image',
      description: 'Search and insert a workspace image',
      icon: '🖼',
      command: ({ editor, range }) => {
        const insertFrom = range.from;
        editor.chain().focus().deleteRange(range).run();
        openWorkspacePicker(editor, insertFrom, 'image');
      },
    },
    {
      title: 'Mermaid Diagram',
      description: 'Flowchart / diagram',
      icon: '◇',
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent(
            `\`\`\`mermaid\n${MERMAID_TEMPLATES[0]?.diagram ?? 'graph TD\nA-->B'}\n\`\`\``,
            { contentType: 'markdown' }
          )
          .run();
      },
    },
    {
      title: 'Note Alert',
      description: 'GitHub note callout',
      icon: 'ℹ',
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent('> [!NOTE]\n> ', { contentType: 'markdown' })
          .run();
      },
    },
    {
      title: 'Warning Alert',
      description: 'GitHub warning callout',
      icon: '⚠',
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent('> [!WARNING]\n> ', { contentType: 'markdown' })
          .run();
      },
    },
    {
      title: 'File Link',
      description: 'Search and insert a workspace file link',
      icon: '🔗',
      command: ({ editor, range }) => {
        // Capture insert position BEFORE deleting the slash range
        const insertFrom = range.from;
        editor.chain().focus().deleteRange(range).run();
        // Open the inline picker at the original position
        openWorkspacePicker(editor, insertFrom, 'fileLink');
      },
    },
  ];
}

const blockItems = makeBlockItems();

// ── Helper: build a file item ─────────────────────────────────────────────────

function makeFileItem(file: { filename: string; path: string }): CommandProviderItem {
  return {
    title: formatLinkDisplay(file.filename),
    description: file.path,
    icon: '📄',
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent([
          {
            type: 'text',
            marks: [{ type: 'link', attrs: { href: file.path } }],
            text: formatLinkDisplay(file.filename),
          },
          { type: 'text', text: ' ' },
        ])
        .run();
    },
  };
}

// ── Extension ──────────────────────────────────────────────────────────────────

const commandRegistryPluginKey = new PluginKey('commandRegistry');

export const CommandRegistry = Extension.create({
  name: 'commandRegistry',

  addProseMirrorPlugins() {
    const suggestionConfig: Omit<SuggestionOptions, 'editor'> = {
      char: '/',
      pluginKey: commandRegistryPluginKey,

      // Fire anywhere inline text is accepted: paragraphs, list items, table cells, etc.
      allow: ({ state, range }) => {
        const $from = state.doc.resolve(range.from);
        return $from.parent.inlineContent;
      },

      // Called when an item is confirmed (Enter or click).
      command: ({ editor, range, props }: any) => {
        (props as CommandProviderItem).command({ editor, range });
      },

      // NOTE: @tiptap/suggestion only passes { query } here — no editor/range.
      items: ({ query }: { query: string }) => {
        const q = query.toLowerCase();

        // File-link mode: activated by typing "/link <text>" or "/file <text>"
        const fileLinkMatch = q.match(/^(link|file)\s(.*)/);
        if (fileLinkMatch) {
          return fileCache.search(fileLinkMatch[2].trim(), 15).map(makeFileItem);
        }

        // Image mode: activated by typing "/image <text>" or "/img <text>"
        const imageMatch = q.match(/^(image|img)\s(.*)/);
        if (imageMatch) {
          return fileCache
            .search(imageMatch[2].trim(), 200)
            .filter(file => isImagePath(file.path))
            .slice(0, 15)
            .map(file => ({
              title: formatLinkDisplay(file.filename),
              description: file.path,
              icon: '🖼',
              command: ({ editor, range }: { editor: any; range: any }) => {
                editor
                  .chain()
                  .focus()
                  .deleteRange(range)
                  .insertContentAt(range.from, [
                    {
                      type: 'image',
                      attrs: {
                        src: file.path,
                        alt: formatLinkDisplay(file.filename),
                      },
                    },
                    { type: 'text', text: ' ' },
                  ])
                  .run();
              },
            }));
        }

        // Default: block commands filtered by what the user has typed so far
        return blockItems.filter(
          item => item.title.toLowerCase().includes(q) || item.description.toLowerCase().includes(q)
        );
      },

      render: () => {
        let component: SuggestionList | null = null;
        let activeCommandCallback: ((item: any) => void) | null = null;

        return {
          onStart: (props: any) => {
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
    };

    return [Suggestion({ editor: this.editor, ...suggestionConfig })];
  },
});

export default CommandRegistry;
