/**
 * Settings Panel — Extension-side provider
 *
 * Opens a webview panel with the custom settings UI.
 * Handles settings reads/writes and interactive actions (connectivity check, browse).
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { isOllamaAvailable } from '../features/llm/providerAvailability';

const PANEL_ID = 'gptAiMarkdownEditor.settingsPanel';

const MSG = {
  GET_ALL_SETTINGS: 'settings.getAllSettings',
  ALL_SETTINGS_DATA: 'settings.allSettingsData',
  UPDATE_SETTING: 'updateSetting',
  CHECK_OLLAMA: 'settings.checkOllama',
  OLLAMA_STATUS: 'settings.ollamaStatus',
  FETCH_OLLAMA_MODELS: 'settings.fetchOllamaModels',
  OLLAMA_MODELS_RESULT: 'settings.ollamaModelsResult',
  BROWSE_PATH: 'settings.browsePath',
  BROWSE_PATH_RESULT: 'settings.browsePathResult',
  OPEN_FILE: 'settings.openFile',
  CHECK_COPILOT_MODELS: 'settings.checkCopilotModels',
  COPILOT_MODELS_RESULT: 'settings.copilotModelsResult',
  THEME_UPDATE: 'theme.update',
} as const;

/** All setting keys (without the gptAiMarkdownEditor. prefix) */
export const SETTING_KEYS = [
  'themeOverride',
  'editorZoomLevel',
  'editorWidth',
  'showSelectionToolbar',
  'defaultMarkdownViewer',
  'tocMaxDepth',
  'preserveHtmlComments',
  'compressTables',
  'trimBlankLines',
  'developerMode',
  'llmProvider',
  'llmVisionProvider',
  'aiModel',
  'ollamaModel',
  'ollamaImageModel',
  'ollamaEndpoint',
  'mediaPathBase',
  'mediaPath',
  'imageResize.skipWarning',
  'chromePath',
  'pandocPath',
  'pandocTemplatePath',
  'customPromptsFile',
] as const;

let currentPanel: vscode.WebviewPanel | undefined;

export function openSettingsPanel(context: vscode.ExtensionContext): void {
  if (currentPanel) {
    currentPanel.reveal();
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    PANEL_ID,
    'Flux Flow Settings',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist')],
    }
  );

  currentPanel = panel;

  panel.webview.html = getSettingsHtml(panel.webview, context);

  panel.webview.onDidReceiveMessage(
    msg => handleSettingsMessage(msg, panel),
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
    currentPanel = undefined;
  });
}

function getSettingsHtml(webview: vscode.Webview, context: vscode.ExtensionContext): string {
  const cacheBust = String(Date.now());

  const scriptUri = webview
    .asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'dist', 'settings.js'))
    .toString();
  const styleUri = webview
    .asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'dist', 'settings.css'))
    .toString();

  const scriptUrl = `${scriptUri}${scriptUri.includes('?') ? '&' : '?'}v=${cacheBust}`;
  const styleUrl = `${styleUri}${styleUri.includes('?') ? '&' : '?'}v=${cacheBust}`;

  // Read themeOverride from VS Code settings (default: 'light')
  const config = vscode.workspace.getConfiguration('gptAiMarkdownEditor');
  const themeOverride = config.get<string>('themeOverride', 'light');

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
  <title>Flux Flow Settings</title>
</head>
<body data-theme="${themeOverride}">
  <div id="settings-root"></div>
  <script nonce="${nonce}" src="${scriptUrl}"></script>
</body>
</html>`;
}

export async function handleSettingsMessage(
  msg: { type: string; [key: string]: unknown },
  panel: vscode.WebviewPanel
): Promise<void> {
  switch (msg.type) {
    case MSG.GET_ALL_SETTINGS: {
      const config = vscode.workspace.getConfiguration('gptAiMarkdownEditor');
      const data: Record<string, unknown> = {};
      for (const key of SETTING_KEYS) {
        data[key] = config.get(key);
      }
      panel.webview.postMessage({ type: MSG.ALL_SETTINGS_DATA, settings: data });
      break;
    }

    case MSG.UPDATE_SETTING: {
      const key = msg.key as string;
      const value = msg.value;
      if (typeof key === 'string' && SETTING_KEYS.includes(key as (typeof SETTING_KEYS)[number])) {
        vscode.workspace
          .getConfiguration('gptAiMarkdownEditor')
          .update(key, value, vscode.ConfigurationTarget.Global)
          .then(undefined, (err: unknown) => {
            console.error('[FluxFlow] Failed to sync setting to VS Code:', err);
          });
      }
      break;
    }

    case MSG.CHECK_OLLAMA: {
      const available = await isOllamaAvailable();
      panel.webview.postMessage({ type: MSG.OLLAMA_STATUS, available });
      break;
    }

    case MSG.FETCH_OLLAMA_MODELS: {
      try {
        const config = vscode.workspace.getConfiguration('gptAiMarkdownEditor');
        const endpoint = config.get<string>('ollamaEndpoint', 'http://localhost:11434');
        const res = await fetch(`${endpoint}/api/tags`, {
          method: 'GET',
          signal: AbortSignal.timeout(3000),
        });
        if (!res.ok) {
          panel.webview.postMessage({
            type: MSG.OLLAMA_MODELS_RESULT,
            error: `Server returned ${res.status}`,
          });
          break;
        }
        const data = (await res.json()) as { models?: Array<{ name: string }> };
        const models = (data.models ?? []).map(m => m.name).sort();
        panel.webview.postMessage({ type: MSG.OLLAMA_MODELS_RESULT, models });
      } catch {
        panel.webview.postMessage({ type: MSG.OLLAMA_MODELS_RESULT, error: 'Server unreachable' });
      }
      break;
    }

    case MSG.BROWSE_PATH: {
      const settingKey = msg.settingKey as string;
      const pathType = msg.pathType as string;
      const rawFilters = msg.filters as Record<string, string[]> | undefined;

      const options: vscode.OpenDialogOptions = {
        canSelectMany: false,
        canSelectFolders: pathType === 'folder',
        canSelectFiles: pathType !== 'folder',
      };

      if (rawFilters) {
        options.filters = rawFilters;
      }

      const result = await vscode.window.showOpenDialog(options);
      if (result && result[0]) {
        const selectedPath = result[0].fsPath;
        // Persist the setting
        if (SETTING_KEYS.includes(settingKey as (typeof SETTING_KEYS)[number])) {
          vscode.workspace
            .getConfiguration('gptAiMarkdownEditor')
            .update(settingKey, selectedPath, vscode.ConfigurationTarget.Global)
            .then(undefined, (err: unknown) => {
              console.error('[FluxFlow] Failed to sync setting to VS Code:', err);
            });
        }
        panel.webview.postMessage({
          type: MSG.BROWSE_PATH_RESULT,
          settingKey,
          path: selectedPath,
        });
      }
      break;
    }

    case MSG.OPEN_FILE: {
      const filePath = msg.filePath as string;
      const pathType = msg.pathType as string | undefined;
      if (!filePath) {
        vscode.window.showErrorMessage('No path configured');
        break;
      }
      try {
        const resolved = filePath.startsWith('~')
          ? path.join(os.homedir(), filePath.slice(1))
          : filePath;
        const uri = vscode.Uri.file(resolved);
        if (pathType === 'folder') {
          await vscode.env.openExternal(uri);
        } else {
          await vscode.window.showTextDocument(uri);
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to open: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      break;
    }

    case MSG.CHECK_COPILOT_MODELS: {
      try {
        // Query available Copilot models via VS Code Language Model API
        const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
        const modelNames = models.map(m => m.id);

        if (modelNames.length > 0) {
          panel.webview.postMessage({
            type: MSG.COPILOT_MODELS_RESULT,
            available: true,
            models: modelNames,
          });
        } else {
          panel.webview.postMessage({
            type: MSG.COPILOT_MODELS_RESULT,
            available: false,
            error: 'No models returned',
          });
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        panel.webview.postMessage({
          type: MSG.COPILOT_MODELS_RESULT,
          available: false,
          error: errorMsg,
        });
      }
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
