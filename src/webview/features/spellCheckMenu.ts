/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

/**
 * @file spellCheckMenu.ts
 *
 * Context menu that appears when the user right-clicks a misspelled word
 * (decorated with .spell-error).  Presents up to 3 suggestions plus
 * "Add to dictionary".
 */

import type { Editor } from '@tiptap/core';
import { MessageType } from '../../shared/messageTypes';
import { getSuggestionsAtPos } from '../extensions/spellCheck';

/** Replace the misspelled word at [from, to] with `replacement`. */
function applyCorrection(editor: Editor, from: number, to: number, replacement: string): void {
  editor.chain().focus().deleteRange({ from, to }).insertContentAt(from, replacement).run();
}

/** Send SPELL_ADD_WORD to the host. */
function addToDictionary(word: string, vscode: { postMessage: (m: unknown) => void }): void {
  vscode.postMessage({ type: MessageType.SPELL_ADD_WORD, word });
}

/** Remove any existing spell menu from the DOM. */
let currentSpellMenu: HTMLElement | null = null;

function removeSpellMenu(): void {
  if (currentSpellMenu) {
    currentSpellMenu.remove();
    currentSpellMenu = null;
  }
}

/**
 * Try to show the spell-check context menu for the position under the mouse.
 *
 * Returns `true` if a spell-error decoration was found and the menu was shown
 * (so the caller can skip the generic context menu).
 */
export function tryShowSpellMenu(
  event: MouseEvent,
  editor: Editor,
  vscode: { postMessage: (m: unknown) => void }
): boolean {
  const target = event.target as HTMLElement;
  const spellSpan = target.closest('.spell-error') as HTMLElement | null;
  if (!spellSpan) return false;

  const view = editor.view;
  const coords = { left: event.clientX, top: event.clientY };
  const hit = view.posAtCoords(coords);
  if (!hit) return false;

  const spellResult = getSuggestionsAtPos(editor.state, hit.pos);
  if (!spellResult) return false;

  event.preventDefault();
  removeSpellMenu();

  const { word, suggestions } = spellResult;

  // Find the decoration span's from/to in the document
  // Fallback: find the range by scanning decorations around the pos
  const docPos = hit.pos;

  // We need the from/to of the decoration. We search around the pos.
  // The decoration 'find' returns {from, to, spec} objects from DecorationSet.
  // Simplest reliable approach: search for the word boundaries around the cursor
  const $pos = editor.state.doc.resolve(docPos);
  const textNode = $pos.parent.textContent ?? '';
  const textOffset = $pos.parentOffset;
  // Walk left to word start
  let wStart = textOffset;
  while (wStart > 0 && !/\s/.test(textNode[wStart - 1])) wStart--;
  // Walk right to word end
  let wEnd = textOffset;
  while (wEnd < textNode.length && !/\s/.test(textNode[wEnd])) wEnd++;
  const nodeStart = docPos - $pos.parentOffset;
  const from = nodeStart + wStart;
  const to = nodeStart + wEnd;

  // Build menu
  const menu = document.createElement('ul');
  menu.setAttribute('role', 'menu');
  menu.className = 'context-menu';
  menu.style.cssText = `
    position: fixed;
    z-index: 1100;
    left: ${event.clientX}px;
    top: ${event.clientY}px;
  `;

  // Section label
  if (suggestions.length > 0) {
    const label = document.createElement('li');
    label.className = 'context-menu-section-label';
    label.textContent = 'Suggestions';
    menu.appendChild(label);

    for (const sug of suggestions) {
      const li = document.createElement('li');
      li.setAttribute('role', 'none');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'context-menu-item';
      btn.setAttribute('role', 'menuitem');
      const lbl = document.createElement('span');
      lbl.className = 'context-menu-label';
      lbl.textContent = sug;
      btn.style.fontWeight = '600';
      btn.appendChild(lbl);
      btn.addEventListener('click', e => {
        e.stopPropagation();
        removeSpellMenu();
        applyCorrection(editor, from, to, sug);
      });
      li.appendChild(btn);
      menu.appendChild(li);
    }

    const sep = document.createElement('li');
    sep.className = 'context-menu-separator';
    sep.setAttribute('role', 'separator');
    menu.appendChild(sep);
  } else {
    const noSug = document.createElement('li');
    noSug.className = 'context-menu-section-label';
    noSug.textContent = `No suggestions for "${word}"`;
    menu.appendChild(noSug);

    const sep = document.createElement('li');
    sep.className = 'context-menu-separator';
    sep.setAttribute('role', 'separator');
    menu.appendChild(sep);
  }

  // Add to dictionary
  {
    const li = document.createElement('li');
    li.setAttribute('role', 'none');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'context-menu-item';
    btn.setAttribute('role', 'menuitem');
    const lbl = document.createElement('span');
    lbl.className = 'context-menu-label';
    lbl.textContent = `Add "${word}" to dictionary`;
    btn.appendChild(lbl);
    btn.addEventListener('click', e => {
      e.stopPropagation();
      removeSpellMenu();
      addToDictionary(word, vscode);
    });
    li.appendChild(btn);
    menu.appendChild(li);
  }

  document.body.appendChild(menu);
  currentSpellMenu = menu;

  // Adjust position if off-screen
  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    menu.style.left = `${event.clientX - rect.width}px`;
  }
  if (rect.bottom > window.innerHeight) {
    menu.style.top = `${event.clientY - rect.height}px`;
  }

  // Dismiss on next click anywhere
  const dismiss = () => {
    removeSpellMenu();
    document.removeEventListener('click', dismiss, true);
    document.removeEventListener('contextmenu', dismiss, true);
  };
  setTimeout(() => {
    document.addEventListener('click', dismiss, true);
    document.addEventListener('contextmenu', dismiss, true);
  }, 0);

  return true;
}

/** Export cleanup for editor destroy. */
export function destroySpellMenu(): void {
  removeSpellMenu();
}
