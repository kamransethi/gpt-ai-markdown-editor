/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 *
 * Keyboard shortcut handler for the markdown editor webview.
 * Intercepts Cmd/Ctrl shortcuts that VS Code would otherwise steal.
 */

import type { Editor } from '@tiptap/core';
import { isSaveShortcut } from '../utils/shortcutKeys';
import { showLinkDialog } from '../features/linkDialog';
import { toggleSearchOverlay } from '../features/searchOverlay';
import { devLog } from '../utils/devLog';

export interface KeyboardDeps {
  getEditor: () => Editor | null;
  immediateUpdate: () => void;
}

/**
 * Create and register the keydown handler for editor keyboard shortcuts.
 *
 * @returns The handler function (caller is responsible for adding/removing the listener).
 */
export function createKeydownHandler(deps: KeyboardDeps): (e: KeyboardEvent) => void {
  const { getEditor, immediateUpdate } = deps;

  return (e: KeyboardEvent) => {
    const editor = getEditor();
    const isMod = e.metaKey || e.ctrlKey; // Cmd on Mac, Ctrl on Windows/Linux

    // ESC key - dismiss floating selection toolbar by collapsing selection
    if (e.key === 'Escape' && editor && !editor.state.selection.empty) {
      const { to } = editor.state.selection;
      editor.chain().setTextSelection(to).run();
      return;
    }

    // Log ALL modifier key presses for debugging
    if (isMod) {
      devLog(`[DK-AI] Key pressed: ${e.key}, metaKey: ${e.metaKey}, ctrlKey: ${e.ctrlKey}`);
    }

    // Save shortcut - immediate save
    if (isSaveShortcut(e)) {
      devLog('[DK-AI] *** SAVE SHORTCUT TRIGGERED ***');
      e.preventDefault();
      e.stopPropagation();
      immediateUpdate();

      // Visual feedback - flash the document briefly
      document.body.style.opacity = '0.7';
      setTimeout(() => {
        document.body.style.opacity = '1';
      }, 100);

      return;
    }

    // Prevent VS Code from handling markdown formatting shortcuts
    // TipTap will handle these natively
    const formattingShortcuts = [
      'b', // Bold
      'i', // Italic
      'u', // Underline (some editors)
    ];

    if (isMod && formattingShortcuts.includes(e.key.toLowerCase())) {
      e.stopPropagation(); // Stop event from reaching VS Code
      devLog(`[DK-AI] Intercepted Cmd+${e.key.toUpperCase()} for editor`);
      // TipTap will handle the formatting
      return;
    }

    // Intercept Cmd+K for link in markdown context
    if (isMod && e.key === 'k') {
      e.preventDefault();
      e.stopPropagation();
      devLog('[DK-AI] Link shortcut');
      if (editor) {
        showLinkDialog(editor);
      }
      return;
    }

    // Intercept Cmd/Ctrl+F for in-document search
    if (isMod && e.key === 'f') {
      e.preventDefault();
      e.stopPropagation();
      devLog('[DK-AI] Search shortcut');
      if (editor) {
        toggleSearchOverlay(editor);
      }
      return;
    }
  };
}
