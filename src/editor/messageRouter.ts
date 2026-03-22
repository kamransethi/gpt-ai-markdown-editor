/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Message router for the markdown editor provider.
 * Replaces the monolithic switch statement with a handler registry,
 * enabling domain-specific handler modules to register their own message types.
 */

import * as vscode from 'vscode';

/** Context passed to every message handler. */
export interface HandlerContext {
  document: vscode.TextDocument;
  webview: vscode.Webview;
  getConfig: <T>(key: string, defaultValue: T) => T;
}

/** A function that handles a single message type. */
export type MessageHandler = (
  message: { type: string; [key: string]: unknown },
  ctx: HandlerContext
) => void | Promise<void>;

/** Registry + dispatcher for webview messages. */
export interface MessageRouter {
  /** Register a handler for a specific message type. */
  register(type: string, handler: MessageHandler): void;
  /** Attempt to route a message. Returns true if a handler was found. */
  route(message: { type: string; [key: string]: unknown }, ctx: HandlerContext): boolean;
}

/** Create a new message router instance. */
export function createMessageRouter(): MessageRouter {
  const handlers = new Map<string, MessageHandler>();

  return {
    register(type: string, handler: MessageHandler): void {
      if (handlers.has(type)) {
        console.warn(`[DK-AI] MessageRouter: overwriting handler for "${type}"`);
      }
      handlers.set(type, handler);
    },

    route(message: { type: string; [key: string]: unknown }, ctx: HandlerContext): boolean {
      const handler = handlers.get(message.type);
      if (handler) {
        void handler(message, ctx);
        return true;
      }
      return false;
    },
  };
}
