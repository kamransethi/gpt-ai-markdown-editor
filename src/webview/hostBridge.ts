/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

/**
 * @file hostBridge.ts - Abstraction layer for host communication
 * @description Provides a unified interface for webview↔host communication.
 * In VS Code, this routes through vscode.postMessage().
 * For standalone browser use, swap to createWebMockAdapter().
 * For future server-backed deployments, implement a ServerAdapter.
 */

export interface HostBridge {
  postMessage(message: { type: string; [key: string]: unknown }): void;
  onMessage(handler: (message: { type: string; [key: string]: unknown }) => void): void;
  /** Returns a Promise resolving to the initial document content. */
  requestInitialContent(): Promise<string>;
}

// Module-level active bridge — set before editor initializes via setBridge()
let _activeBridge: HostBridge | null = null;

/**
 * Register a bridge implementation before the editor boots.
 * Must be called before any editor code references getActiveBridge().
 */
export function setBridge(bridge: HostBridge): void {
  _activeBridge = bridge;
}

/**
 * Retrieve the active bridge. Falls back to createVsCodeBridge() on first use.
 * All editor code must call this lazily (inside event handlers, not at module scope).
 */
export function getActiveBridge(): HostBridge {
  if (!_activeBridge) {
    _activeBridge = createVsCodeBridge();
  }
  return _activeBridge;
}

/**
 * VS Code webview bridge - uses acquireVsCodeApi().postMessage()
 */
export function createVsCodeBridge(): HostBridge {
  const vscode = (window as any).acquireVsCodeApi?.();
  if (!vscode) {
    console.warn('[DK-AI] VS Code API not available, using no-op bridge');
    return createNoOpBridge();
  }

  // Expose globally for existing code that references window.vscode
  (window as any).vscode = vscode;

  return {
    postMessage(message) {
      vscode.postMessage(message);
    },
    onMessage(handler) {
      window.addEventListener('message', (event: MessageEvent) => {
        handler(event.data);
      });
    },
    requestInitialContent(): Promise<string> {
      // In VS Code the host pushes content via an UPDATE message — return empty string;
      // editor.ts waits for the UPDATE event via its own window message listener.
      return Promise.resolve('');
    },
  };
}

/** Default mock markdown shown in standalone mode when no saved session exists. */
const STANDALONE_MOCK_CONTENT = `# Welcome to Standalone Mode

This editor is running in standalone browser mode for development and testing.

## Features

- **Rich text editing** — bold, italic, headings, lists, tables
- **Markdown round-trip** — edit visually, output is standard Markdown
- **Persistence** — content is saved to \`localStorage\` on every edit

## Getting Started

Start typing here. Your changes are automatically saved to the browser's
local storage and will be restored when you refresh the page.

> **Note**: AI features and file-system operations are not available in standalone mode.
`;

const STANDALONE_STORAGE_KEY = 'gptai-standalone-content';

/**
 * Standalone browser adapter — used when running via \`npm run dev\`.
 * Reads/writes content to localStorage. Replaces VS Code postMessage with no-ops
 * (or local state updates) so the editor boots cleanly in a standard browser.
 */
export function createWebMockAdapter(): HostBridge {
  // Expose a window.vscode-compatible shim so BubbleMenuView.ts and
  // frontmatterUI.ts (which use window.vscode?.postMessage) continue to work.
  const vscodeLike = {
    postMessage(msg: { type: string; content?: string; [key: string]: unknown }) {
      const type = msg?.type ?? '';
      if (type === 'edit' || type === 'saveAndEdit') {
        if (typeof msg.content === 'string') {
          localStorage.setItem(STANDALONE_STORAGE_KEY, msg.content);
        }
      }
      console.log('[Standalone] postMessage:', type, msg);
    },
    getState() { return {}; },
    setState(_state: unknown) {},
  };
  (window as any).vscode = vscodeLike;

  return {
    postMessage(message) {
      vscodeLike.postMessage(message as any);
    },
    onMessage(handler) {
      window.addEventListener('message', (event: MessageEvent) => {
        handler(event.data);
      });
    },
    requestInitialContent(): Promise<string> {
      const saved = localStorage.getItem(STANDALONE_STORAGE_KEY);
      return Promise.resolve(saved ?? STANDALONE_MOCK_CONTENT);
    },
  };
}

/**
 * No-op bridge for unit testing or environments without any host backend.
 */
export function createNoOpBridge(): HostBridge {
  return {
    postMessage(message) {
      console.warn('[DK-AI] Bridge message (no-op):', message.type);
    },
    onMessage() {
      // No-op
    },
    requestInitialContent(): Promise<string> {
      return Promise.resolve('');
    },
  };
}
