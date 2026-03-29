/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 *
 * @fileoverview Emoji picker powered by emoji-picker-element web component.
 * Provides a lightweight, accessible emoji picker with search, categories,
 * skin tone support, and favorites — all via a Shadow DOM web component.
 *
 * @module emojiPicker
 */

import type { Editor } from '@tiptap/core';
import 'emoji-picker-element';

let pickerOverlay: HTMLElement | null = null;
let currentEditor: Editor | null = null;

function isCurrentThemeDark(): boolean {
  const override = (window as any).gptAiCurrentThemeOverride;
  if (override) return override === 'dark';
  return (
    document.body.getAttribute('data-theme') === 'dark' ||
    document.body.classList.contains('vscode-dark')
  );
}

/**
 * Apply our editor theme variables to the emoji picker via its CSS custom properties.
 */
function applyPickerTheme(picker: HTMLElement): void {
  const style = getComputedStyle(document.body);
  const bg = style.getPropertyValue('--md-dropdown-bg').trim();
  const fg = style.getPropertyValue('--md-dropdown-fg').trim();
  const borderColor = style.getPropertyValue('--md-dropdown-border').trim();
  const inputFg = style.getPropertyValue('--md-input-fg').trim();
  const accent = style.getPropertyValue('--md-button-bg').trim();
  const hoverBg = style.getPropertyValue('--md-hover-bg').trim();

  if (bg) picker.style.setProperty('--background', bg);
  if (fg) picker.style.setProperty('--category-font-color', fg);
  if (borderColor) picker.style.setProperty('--border-color', borderColor);
  if (borderColor) picker.style.setProperty('--input-border-color', borderColor);
  if (inputFg) picker.style.setProperty('--input-font-color', inputFg);
  if (accent) picker.style.setProperty('--indicator-color', accent);
  if (hoverBg) picker.style.setProperty('--button-hover-background', hoverBg);
  picker.style.setProperty('--border-radius', '12px');
}

/**
 * Show the emoji picker popup near the toolbar button.
 */
export function showEmojiPicker(editor: Editor, anchorEl?: HTMLElement): void {
  // If already open, close it (toggle behavior)
  if (pickerOverlay) {
    closeEmojiPicker();
    return;
  }

  currentEditor = editor;

  const overlay = document.createElement('div');
  overlay.className = 'emoji-picker-overlay';

  const container = document.createElement('div');
  container.className = 'emoji-picker-container';

  const picker = document.createElement('emoji-picker') as any;
  picker.className = isCurrentThemeDark() ? 'dark' : 'light';
  applyPickerTheme(picker);

  picker.addEventListener('emoji-click', ((e: CustomEvent) => {
    const unicode = e.detail?.unicode;
    if (unicode && currentEditor) {
      currentEditor.chain().focus().insertContent(unicode).run();
    }
    closeEmojiPicker();
  }) as EventListener);

  // Prevent mousedown from stealing focus from editor
  container.addEventListener('mousedown', e => {
    if (e.target === container) {
      e.preventDefault();
    }
  });

  container.appendChild(picker);

  // Position near anchor
  if (anchorEl) {
    const rect = anchorEl.getBoundingClientRect();
    container.style.position = 'fixed';
    container.style.top = `${rect.bottom + 4}px`;
    const pickerWidth = 352;
    const left = Math.max(
      4,
      Math.min(rect.left + rect.width / 2 - pickerWidth / 2, window.innerWidth - pickerWidth - 4)
    );
    container.style.left = `${left}px`;
  }

  overlay.appendChild(container);
  document.body.appendChild(overlay);
  pickerOverlay = overlay;

  // Close on outside click
  const handleOutsideClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    // Don't close if clicking the picker itself or the anchor button (let the button handle toggle)
    if (
      pickerOverlay &&
      !pickerOverlay.contains(target) &&
      (!anchorEl || !anchorEl.contains(target))
    ) {
      closeEmojiPicker();
    }
  };

  // Close on Escape
  const handleEsc = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeEmojiPicker();
    }
  };

  document.addEventListener('mousedown', handleOutsideClick);
  document.addEventListener('keydown', handleEsc);

  // Store listeners for cleanup in closeEmojiPicker
  (overlay as any)._cleanup = () => {
    document.removeEventListener('mousedown', handleOutsideClick);
    document.removeEventListener('keydown', handleEsc);
  };
}

export function closeEmojiPicker(): void {
  if (pickerOverlay) {
    if ((pickerOverlay as any)._cleanup) {
      (pickerOverlay as any)._cleanup();
    }
    pickerOverlay.remove();
    pickerOverlay = null;
  }
  if (currentEditor) {
    // Return focus to editor to prevent toolbar disabling/caret loss
    currentEditor.commands.focus();
    currentEditor = null;
  }
}
