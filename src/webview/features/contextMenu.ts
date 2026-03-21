/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Text context menu for the WYSIWYG markdown editor.
 * Shows on right-click outside of tables. Includes clipboard ops,
 * AI refine submenu, insert actions, and clear formatting.
 *
 * @module contextMenu
 */

import type { Editor } from '@tiptap/core';
import { showLinkDialog } from './linkDialog';
import { requestAiRefine, showCustomRefineInput } from './aiRefine';
import { MenuBuilder, type MenuController } from '../utils/menuBuilder';
import { modSymbol as mod } from '../utils/platform';

// ── Helpers ─────────────────────────────────────────────────────────

function hasTextSelection(editor: Editor): boolean {
  const { from, to } = editor.state.selection;
  return from !== to;
}

// ── Builder ─────────────────────────────────────────────────────────

export function createContextMenu(editor: Editor): MenuController {
  const mb = new MenuBuilder('context-menu', 'Context menu');

  // ── CLIPBOARD ──
  mb.addItem('Cut', () => document.execCommand('cut'), {
    shortcut: `${mod}X`,
    enabledFn: () => hasTextSelection(editor),
  });
  mb.addItem('Copy', () => document.execCommand('copy'), {
    shortcut: `${mod}C`,
    enabledFn: () => hasTextSelection(editor),
  });
  mb.addItem('Paste', () => document.execCommand('paste'), {
    shortcut: `${mod}V`,
  });
  mb.addItem(
    'Paste without formatting',
    () => {
      navigator.clipboard
        .readText()
        .then(text => {
          editor.chain().focus().insertContent(text).run();
        })
        .catch(() => {
          // Fallback
          document.execCommand('paste');
        });
    },
    {
      shortcut: `${mod}⇧V`,
    }
  );
  mb.addItem('Delete', () => editor.chain().focus().deleteSelection().run(), {
    enabledFn: () => hasTextSelection(editor),
    className: 'context-menu-danger',
  });

  // ── AI REFINE ──
  mb.addSeparator();

  const refineItems: Array<{
    label: string;
    mode: string;
    separator?: boolean;
  }> = [
    { label: 'Custom…', mode: 'custom' },
    { label: '', mode: '', separator: true },
    { label: 'Rephrase', mode: 'rephrase' },
    { label: 'Shorten', mode: 'shorten' },
    { label: 'More Formal', mode: 'formal' },
    { label: 'More Casual', mode: 'casual' },
    { label: 'Bulletize', mode: 'bulletize' },
    { label: 'Summarize', mode: 'summarize' },
  ];

  mb.addSubmenuTrigger(
    'Refine the selected text',
    submenu => {
      refineItems.forEach(item => {
        if (item.separator) {
          const sep = document.createElement('div');
          sep.className = 'context-menu-separator';
          submenu.appendChild(sep);
          return;
        }
        const subBtn = document.createElement('button');
        subBtn.type = 'button';
        subBtn.className = 'context-menu-item';
        subBtn.setAttribute('role', 'menuitem');
        const lbl = document.createElement('span');
        lbl.className = 'context-menu-label';
        lbl.textContent = item.label;
        subBtn.appendChild(lbl);
        subBtn.onclick = e => {
          e.preventDefault();
          e.stopPropagation();
          const { from, to } = editor.state.selection;
          const selectedText = editor.state.doc.textBetween(from, to, '\n');
          if (item.mode === 'custom') {
            showCustomRefineInput(editor, selectedText, from, to);
          } else {
            requestAiRefine(item.mode, selectedText, from, to);
          }
          mb.hide();
        };
        submenu.appendChild(subBtn);
      });
    },
    {
      enabledFn: () => hasTextSelection(editor),
      badge: 'AI',
    }
  );

  // ── INSERT ──
  mb.addSeparator();

  mb.addItem('Insert Emoji', () => {
    // Attempt native emoji picker. Some browsers/OSes support it.
    const input = document.createElement('input');
    input.style.cssText =
      'position:fixed;top:50%;left:50%;opacity:0;width:0;height:0;pointer-events:none;';
    document.body.appendChild(input);
    input.focus();
    // Cmd+Ctrl+Space on macOS triggers the emoji picker when an input is focused
    // For cross-platform, we fire an event and fall back gracefully
    try {
      // Try the new showPicker() API (Chromium 133+)
      if ('showPicker' in HTMLInputElement.prototype) {
        (input as any).showPicker();
      }
    } catch {
      // Ignored — emoji picker is OS-level
    }
    // Clean up after a moment
    setTimeout(() => {
      input.remove();
      editor.commands.focus();
    }, 100);
  });

  mb.addItem('Insert Link', () => showLinkDialog(editor), {
    shortcut: `${mod}K`,
  });

  // ── CLEAR FORMATTING ──
  mb.addSeparator();

  mb.addItem(
    'Clear Formatting',
    () => {
      editor.chain().focus().clearNodes().unsetAllMarks().run();
    },
    { shortcut: `${mod}\\` }
  );

  // ── Lifecycle ──

  mb.mount();

  return {
    element: mb.element,
    show: (x: number, y: number) => mb.show(x, y),
    hide: () => mb.hide(),
    destroy: () => mb.destroy(),
  };
}
