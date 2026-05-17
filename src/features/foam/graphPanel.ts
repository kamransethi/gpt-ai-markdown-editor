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
      const snapshot = getFoamSnapshot();
      if (snapshot) {
        sendSnapshot(_panel!);
      } else {
        // Foam hasn't finished indexing — send empty data so the webview
        // shows a loading state instead of a black screen.
        try {
          void _panel!.webview.postMessage({
            type: 'graphData',
            nodes: [],
            edges: [],
            loading: true,
          });
        } catch {
          // panel disposed before ready — safe to ignore
        }
      }
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

  // Guard: panel may have been disposed between the caller's null-check and here
  try {
    void panel.webview.postMessage({ type: 'graphData', nodes, edges });
  } catch {
    // Panel disposed — safe to ignore
  }
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
    #control-panel {
      position: fixed; top: 12px; left: 12px;
      width: 280px;
      background: var(--vscode-editorWidget-background, #252526);
      border: 1px solid var(--vscode-widget-border, #454545);
      color: var(--vscode-editor-foreground, #cccccc);
      border-radius: 6px;
      padding: 12px;
      font: 12px var(--vscode-font-family, sans-serif);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .panel-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }
    .panel-row label {
      flex: 1;
    }
    .panel-input {
      background: var(--vscode-input-background, #3c3c3c);
      color: var(--vscode-input-foreground, #cccccc);
      border: 1px solid var(--vscode-input-border, transparent);
      padding: 4px 6px;
      border-radius: 2px;
      outline: none;
      width: 100%;
    }
    .panel-input:focus {
      border-color: var(--vscode-focusBorder, #007acc);
    }
    input[type=range] {
      width: 100px;
    }
    hr {
      border: none;
      border-top: 1px solid var(--vscode-widget-border, #454545);
      margin: 4px 0;
    }
    .header {
      font-weight: bold;
      font-size: 13px;
      margin-bottom: 4px;
    }
  </style>
</head>
<body>
  <canvas id="graph"></canvas>
  <div id="overlay">Scroll to zoom · Drag to pan · Click node to open</div>
  <div id="control-panel">
    <div class="header">Graph Settings</div>
    <div>
      <input type="text" id="searchInput" class="panel-input" placeholder="Filter notes..." />
    </div>
    <hr />
    <div class="panel-row">
      <label for="repulsionSlider">Repulsion</label>
      <input type="range" id="repulsionSlider" min="1000" max="10000" step="500" value="3000" />
    </div>
    <div class="panel-row">
      <label for="springSlider">Link Distance</label>
      <input type="range" id="springSlider" min="20" max="300" step="10" value="120" />
    </div>
    <hr />
    <div class="panel-row">
      <label for="showLabelsCheck">Show Labels</label>
      <input type="checkbox" id="showLabelsCheck" checked />
    </div>
    <div class="panel-row">
      <label for="showOrphansCheck">Show Orphans</label>
      <input type="checkbox" id="showOrphansCheck" checked />
    </div>
  </div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
