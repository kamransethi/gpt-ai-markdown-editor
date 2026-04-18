/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 *
 * Slash command menu for inserting blocks (headings, lists, tables, etc.).
 * Uses @tiptap/suggestion to show a floating menu when the user types "/".
 *
 * @module slashCommand
 */

import { Extension } from '@tiptap/core';
import { Suggestion, type SuggestionOptions } from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';
import { MERMAID_TEMPLATES } from '../mermaidTemplates';

export interface SlashCommandItem {
  title: string;
  description: string;
  icon: string;
  command: (props: { editor: any; range: any }) => void;
}

const slashCommandItems: SlashCommandItem[] = [
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
    description: 'Insert image from URL',
    icon: '🖼',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      // Dispatch event for image dialog
      window.dispatchEvent(new CustomEvent('slashCommandInsertImage'));
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
];

// ── Popup rendering ─────────────────────────────────────

let popupEl: HTMLElement | null = null;
let selectedIndex = 0;

function createPopup(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'slash-command-menu';
  el.setAttribute('role', 'listbox');
  return el;
}

function renderItems(items: SlashCommandItem[], onSelect: (item: SlashCommandItem) => void) {
  if (!popupEl) return;
  popupEl.innerHTML = '';
  selectedIndex = 0;

  if (items.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'slash-command-empty';
    empty.textContent = 'No matching commands';
    popupEl.appendChild(empty);
    return;
  }

  items.forEach((item, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'slash-command-item';
    if (i === 0) btn.classList.add('is-selected');
    btn.setAttribute('role', 'option');

    btn.innerHTML = `
      <span class="slash-command-icon">${item.icon}</span>
      <span class="slash-command-text">
        <span class="slash-command-title">${item.title}</span>
        <span class="slash-command-desc">${item.description}</span>
      </span>
    `;

    btn.addEventListener('click', () => onSelect(item));
    btn.addEventListener('mouseenter', () => {
      popupEl
        ?.querySelectorAll('.slash-command-item')
        .forEach(el => el.classList.remove('is-selected'));
      btn.classList.add('is-selected');
      selectedIndex = i;
    });

    popupEl!.appendChild(btn);
  });
}

function updateSelection() {
  const allBtns = popupEl?.querySelectorAll('.slash-command-item');
  if (!allBtns) return;
  allBtns.forEach((el, i) => {
    el.classList.toggle('is-selected', i === selectedIndex);
    if (i === selectedIndex) {
      (el as HTMLElement).scrollIntoView({ block: 'nearest' });
    }
  });
}

const slashSuggestionPluginKey = new PluginKey('slashCommand');

export const SlashCommand = Extension.create({
  name: 'slashCommand',

  addProseMirrorPlugins() {
    const suggestionConfig: Omit<SuggestionOptions, 'editor'> = {
      char: '/',
      pluginKey: slashSuggestionPluginKey,
      command: ({ editor, range, props }: any) => {
        props.command({ editor, range });
      },
      items: ({ query }: { query: string }) => {
        const q = query.toLowerCase();
        return slashCommandItems.filter(
          item => item.title.toLowerCase().includes(q) || item.description.toLowerCase().includes(q)
        );
      },
      render: () => {
        let currentItems: SlashCommandItem[] = [];
        let selectCallback: ((item: SlashCommandItem) => void) | null = null;

        return {
          onStart: (props: any) => {
            popupEl = createPopup();
            document.body.appendChild(popupEl);

            selectCallback = (item: SlashCommandItem) => {
              props.command(item);
            };

            currentItems = props.items;
            renderItems(currentItems, selectCallback);

            // Position near cursor
            const coords = props.clientRect?.();
            if (coords && popupEl) {
              const { left, bottom, top } = coords;
              // Basic viewport check to flip upwards if needed
              const popupHeight = 350; // max-height typically used
              const viewportHeight = window.innerHeight;
              if (bottom + popupHeight > viewportHeight && top - popupHeight > 0) {
                popupEl.style.top = `${top - popupHeight}px`;
              } else {
                popupEl.style.top = `${bottom + 4}px`;
              }
              popupEl.style.left = `${left}px`;
            }
          },
          onUpdate: (props: any) => {
            currentItems = props.items;
            if (selectCallback) renderItems(currentItems, selectCallback);

            const coords = props.clientRect?.();
            if (coords && popupEl) {
              const { left, bottom, top } = coords;
              const popupHeight = popupEl.clientHeight || 350;
              const viewportHeight = window.innerHeight;
              if (bottom + popupHeight > viewportHeight && top - popupHeight > 0) {
                popupEl.style.top = `${top - popupHeight}px`;
              } else {
                popupEl.style.top = `${bottom + 4}px`;
              }
              popupEl.style.left = `${left}px`;
            }
          },
          onKeyDown: (props: any) => {
            const { event } = props;
            if (event.key === 'ArrowDown') {
              selectedIndex = (selectedIndex + 1) % currentItems.length;
              updateSelection();
              return true;
            }
            if (event.key === 'ArrowUp') {
              selectedIndex = (selectedIndex - 1 + currentItems.length) % currentItems.length;
              updateSelection();
              return true;
            }
            if (event.key === 'Enter') {
              const item = currentItems[selectedIndex];
              if (item && selectCallback) selectCallback(item);
              return true;
            }
            if (event.key === 'Escape') {
              popupEl?.remove();
              popupEl = null;
              return true;
            }
            return false;
          },
          onExit: () => {
            popupEl?.remove();
            popupEl = null;
          },
        };
      },
    };

    return [
      Suggestion({
        editor: this.editor,
        ...suggestionConfig,
      }),
    ];
  },
});

export default SlashCommand;
