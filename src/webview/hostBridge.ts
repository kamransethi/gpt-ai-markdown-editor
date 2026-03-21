/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

/**
 * @file hostBridge.ts - Abstraction layer for host communication
 * @description Provides a unified interface for webview↔host communication.
 * In VS Code, this routes through vscode.postMessage().
 * For a standalone app, this can be swapped with direct implementations.
 */

export interface HostBridge {
  postMessage(message: { type: string; [key: string]: unknown }): void;
  onMessage(handler: (message: { type: string; [key: string]: unknown }) => void): void;
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
  };
}

/**
 * No-op bridge for testing or standalone without backend
 */
export function createNoOpBridge(): HostBridge {
  return {
    postMessage(message) {
      devLog('[DK-AI] Bridge message (no-op):', message.type);
    },
    onMessage() {
      // No-op
    },
  };
}
