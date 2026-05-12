/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

/**
 * @file standalone.ts — Standalone browser entry point
 *
 * This module is the esbuild entry point for the standalone dev server (npm run dev).
 * It runs LAST in the IIFE bundle (after all dependencies), so by the time it executes:
 *   - hostBridge.ts module code has run
 *   - editor.ts module code has run (event listeners registered, but no bridge calls made)
 *
 * We call setBridge() here to register the WebMockAdapter, then dispatch a synthetic
 * UPDATE message so the editor initializes with content from localStorage (or mock content).
 *
 * In VS Code mode this file is NOT included in the bundle — the webview.js entry
 * is src/webview/editor.ts directly, which calls getActiveBridge() lazily and gets
 * the VS Code bridge automatically.
 */

// Must be imported first — registers window message listener and initialises TipTap
import './editor';
import { setBridge, createWebMockAdapter } from './hostBridge';
import { MessageType } from '../shared/messageTypes';

// Register the mock adapter BEFORE any bridge call is made by editor.ts event handlers.
// editor.ts calls getActiveBridge() lazily (inside event handlers, not at module scope),
// so this registration happens in time.
const adapter = setBridgeAndGet();

function setBridgeAndGet() {
  const bridge = createWebMockAdapter();
  setBridge(bridge);
  return bridge;
}

// Dispatch a synthetic UPDATE message with the initial content.
// editor.ts has already registered its window 'message' listener at this point.
// The UPDATE handler sets pendingInitialContent if DOM isn't ready yet,
// or calls initializeEditor() immediately if DOM is ready.
adapter.requestInitialContent().then(content => {
  window.dispatchEvent(
    new MessageEvent('message', {
      data: {
        type: MessageType.UPDATE,
        content,
        fileModifiedTime: 0,
        // Propagate sensible defaults for settings that editor.ts reads from UPDATE
        showSelectionToolbar: false,
        compressTables: false,
        trimBlankLines: false,
        preserveHtmlComments: false,
        showWordCount: true,
        showCharacterCount: false,
        defaultZoomLevel: 100,
        themeOverride: 'light',
      },
    })
  );

  // Also send SPELL_INIT to initialize the spell checker.
  // In VS Code, this is sent by the host in response to a READY message.
  // In standalone mode, we dispatch it manually after the editor is initialized.
  window.dispatchEvent(
    new MessageEvent('message', {
      data: {
        type: MessageType.SPELL_INIT,
        affUrl: '/resources/dictionaries/en-US.aff',
        dicUrl: '/resources/dictionaries/en-US.dic',
        userWords: [],
      },
    })
  );
});
