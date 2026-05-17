/**
 * Graph Chat — React webview entry point.
 *
 * Replaces chatWebview.ts with a React-powered AiPanel UI.
 * Protocol (MSG.*) stays exactly the same as the vanilla version
 * so no extension-host changes are needed.
 */
import './chatWebview.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ChatApp } from './ChatApp';

declare function acquireVsCodeApi(): {
  postMessage(msg: Record<string, unknown>): void;
};

// Acquire VS Code API once — React state machine drives all rendering
const vscode = acquireVsCodeApi();

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('chat-root');
  if (!root) return;

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <ChatApp vscode={vscode} />
    </React.StrictMode>
  );
});
