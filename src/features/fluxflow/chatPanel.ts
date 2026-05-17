/**
 * Chat Panel — Extension-side WebviewPanel host for the Graph Chat interface.
 *
 * Creates and manages the webview, handles message routing between
 * the webview UI and the graphChat orchestrator (powered by Foam).
 */

import * as vscode from 'vscode';
import { streamAnswer, type ChatMessage } from './graphChat';
import { getModelDisplayName } from '../llm/providerFactory';

const PANEL_ID = 'gptAiMarkdownEditor.graphChatPanel';

const MSG = {
  // Webview → Extension
  SEND: 'chat.send',
  STOP: 'chat.stop',
  OPEN_FILE: 'chat.openFile',
  GET_MODEL_NAME: 'chat.getModelName',
  // Extension → Webview
  SOURCES: 'chat.sources',
  CHUNK: 'chat.chunk',
  DONE: 'chat.done',
  ERROR: 'chat.error',
  MODEL_NAME: 'chat.modelName',
  THEME_UPDATE: 'theme.update',
} as const;

let currentPanel: vscode.WebviewPanel | undefined;
let currentAbort: AbortController | null = null;

export function openChatPanel(
  context: vscode.ExtensionContext,
  getWorkspacePath: () => string | null
): void {
  if (currentPanel) {
    currentPanel.reveal(vscode.ViewColumn.Beside);
    return;
  }

  const panel = vscode.window.createWebviewPanel(PANEL_ID, 'Graph Chat', vscode.ViewColumn.Beside, {
    enableScripts: true,
    retainContextWhenHidden: true,
    localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist')],
  });

  currentPanel = panel;
  // Use extension icon as panel icon (ThemeIcon isn't assignable to WebviewPanel.iconPath)
  try {
    panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'icon.png');
  } catch (e) {
    void e;
  }

  const config = vscode.workspace.getConfiguration('gptAiMarkdownEditor');
  const themeOverride = config.get<string>('themeOverride', 'light');
  panel.webview.html = getChatHtml(panel.webview, context, themeOverride);

  panel.webview.onDidReceiveMessage(
    msg => handleChatMessage(msg, panel, getWorkspacePath),
    undefined,
    context.subscriptions
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('gptAiMarkdownEditor.themeOverride')) {
        const theme = vscode.workspace
          .getConfiguration('gptAiMarkdownEditor')
          .get<string>('themeOverride', 'light');
        panel.webview.postMessage({ type: MSG.THEME_UPDATE, theme });
      }
    })
  );

  panel.onDidDispose(() => {
    if (currentAbort) {
      currentAbort.abort();
      currentAbort = null;
    }
    currentPanel = undefined;
  });
}

function getChatHtml(
  webview: vscode.Webview,
  context: vscode.ExtensionContext,
  theme: string
): string {
  const cacheBust = String(Date.now());

  const scriptUri = webview
    .asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'dist', 'chat.js'))
    .toString();
  const styleUri = webview
    .asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'dist', 'chat.css'))
    .toString();

  const scriptUrl = `${scriptUri}${scriptUri.includes('?') ? '&' : '?'}v=${cacheBust}`;
  const styleUrl = `${styleUri}${styleUri.includes('?') ? '&' : '?'}v=${cacheBust}`;

  const nonce = getNonce();

  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none';
                 style-src ${webview.cspSource} 'unsafe-inline';
                 script-src 'nonce-${nonce}';
                 font-src ${webview.cspSource};">
  <link href="${styleUrl}" rel="stylesheet">
  <title>Graph Chat</title>
</head>
<body data-theme="${theme}">
  <div id="chat-root"></div>
  <script nonce="${nonce}" src="${scriptUrl}"></script>
</body>
</html>`;
}

/** Conversation history kept for multi-turn context */
let conversationHistory: ChatMessage[] = [];

async function handleChatMessage(
  msg: { type: string; [key: string]: unknown },
  panel: vscode.WebviewPanel,
  getWorkspacePath: () => string | null
): Promise<void> {
  switch (msg.type) {
    case MSG.SEND: {
      const query = ((msg.query as string) || '').trim();
      if (!query) return;

      const workspacePath = getWorkspacePath();
      if (!workspacePath) {
        panel.webview.postMessage({
          type: MSG.ERROR,
          error: 'Workspace not initialized. Please reload.',
        });
        return;
      }

      // Cancel any in-progress stream
      if (currentAbort) {
        currentAbort.abort();
      }
      currentAbort = new AbortController();
      const signal = currentAbort.signal;

      try {
        const stream = streamAnswer(workspacePath, query, conversationHistory, signal);

        let fullText = '';
        for await (const event of stream) {
          if (signal.aborted) break;

          switch (event.type) {
            case 'sources':
              panel.webview.postMessage({
                type: MSG.SOURCES,
                sources: event.sources,
              });
              break;
            case 'chunk':
              fullText = event.fullText || '';
              panel.webview.postMessage({
                type: MSG.CHUNK,
                text: event.text,
                fullText: event.fullText,
              });
              break;
            case 'done':
              fullText = event.fullText || fullText;
              panel.webview.postMessage({
                type: MSG.DONE,
                fullText,
              });
              // Save to history for multi-turn
              conversationHistory.push({ role: 'user', content: query });
              conversationHistory.push({ role: 'assistant', content: fullText });
              // Keep history bounded (last 10 messages = 5 exchanges)
              if (conversationHistory.length > 10) {
                conversationHistory = conversationHistory.slice(-10);
              }
              break;
            case 'error':
              panel.webview.postMessage({
                type: MSG.ERROR,
                error: event.error,
              });
              break;
          }
        }
      } catch (err: unknown) {
        if (!signal.aborted) {
          panel.webview.postMessage({
            type: MSG.ERROR,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      } finally {
        if (currentAbort?.signal === signal) {
          currentAbort = null;
        }
      }
      break;
    }

    case MSG.STOP: {
      if (currentAbort) {
        currentAbort.abort();
        currentAbort = null;
      }
      break;
    }

    case MSG.OPEN_FILE: {
      const filePath = msg.filePath as string;
      const workspacePath = getWorkspacePath();
      if (!filePath || !workspacePath) return;

      try {
        const uri = vscode.Uri.file(filePath);
        await vscode.window.showTextDocument(uri, { preview: true });
      } catch {
        vscode.window.showErrorMessage(`Could not open file: ${filePath}`);
      }
      break;
    }

    case MSG.GET_MODEL_NAME: {
      panel.webview.postMessage({
        type: MSG.MODEL_NAME,
        modelName: getModelDisplayName(),
      });
      break;
    }
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
