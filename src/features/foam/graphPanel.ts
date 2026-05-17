/**
 * Knowledge Graph Panel — renders the Foam note graph in a VS Code webview.
 *
 * The panel reads the current Foam snapshot (notes + backlinks) and renders
 * a force-directed graph. Clicking a node opens the corresponding file.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { getFoamSnapshot } from './foamAdapter';
import { getNonce } from '../../editor/utils';

let _panel: vscode.WebviewPanel | undefined;

export function openGraphPanel(context: vscode.ExtensionContext): void {
  if (_panel) {
    _panel.reveal();
    return;
  }

  _panel = vscode.window.createWebviewPanel(
    'gptAiKnowledgeGraph',
    'Knowledge Graph',
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'dist'))],
      retainContextWhenHidden: true,
    }
  );

  _panel.webview.html = buildHtml(_panel.webview, context);

  // Send snapshot as soon as the webview is ready
  _panel.webview.onDidReceiveMessage(msg => {
    if (msg.type === 'ready') {
      sendSnapshot(_panel!);
    } else if (msg.type === 'openFile') {
      const uri = vscode.Uri.file(msg.path as string);
      void vscode.commands.executeCommand('vscode.open', uri);
    }
  });

  _panel.onDidDispose(() => {
    _panel = undefined;
  });
}

/** Push a fresh snapshot to the panel (called when Foam re-indexes). */
export function updateGraphPanel(): void {
  if (_panel) sendSnapshot(_panel);
}

function sendSnapshot(panel: vscode.WebviewPanel): void {
  const snapshot = getFoamSnapshot();
  if (!snapshot) return;

  // Build nodes + edges from snapshot
  const nodes = snapshot.notes.map(n => ({
    id: n.path,
    label: n.title || n.filename,
    tags: n.tags,
  }));

  const edges: { source: string; target: string }[] = [];
  for (const [targetPath, backlinks] of Object.entries(snapshot.backlinks)) {
    for (const bl of backlinks) {
      edges.push({ source: bl.sourcePath, target: targetPath });
    }
  }

  void panel.webview.postMessage({ type: 'graphData', nodes, edges });
}

function buildHtml(webview: vscode.Webview, context: vscode.ExtensionContext): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.file(path.join(context.extensionPath, 'dist', 'graph.js'))
  );
  const nonce = getNonce();

  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';" />
  <title>Knowledge Graph</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: var(--vscode-editor-background, #1e1e1e); overflow: hidden; }
    canvas { display: block; width: 100vw; height: 100vh; }
    #overlay {
      position: fixed; top: 12px; right: 12px;
      color: var(--vscode-editor-foreground, #ccc);
      font: 11px var(--vscode-font-family, sans-serif);
      background: rgba(0,0,0,.45); padding: 6px 10px; border-radius: 4px;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <canvas id="graph"></canvas>
  <div id="overlay">Scroll to zoom · Drag to pan · Click node to open</div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
