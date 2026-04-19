/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import type { GraphDatabase } from './database';
import type { VectorStore } from './vectorStore';
import type { EmbeddingEngine } from './embeddingEngine';
import { hybridSearch } from './hybridSearch';

/**
 * Register all FluxFlow Knowledge Graph commands.
 * Commands are always registered so VS Code doesn't show "command not found".
 * They check `getDb()` at runtime — if the graph isn't active, they prompt the user.
 */
export function registerFluxFlowCommands(
  getDb: () => GraphDatabase | null,
  getWorkspacePath: () => string | null,
  rebuildFn: () => Promise<void>,
  getVectorStore?: () => VectorStore | null,
  getEmbeddingEngine?: () => EmbeddingEngine | null
): vscode.Disposable[] {
  const disposables: vscode.Disposable[] = [];

  function requireGraph(): { db: GraphDatabase; workspacePath: string } | null {
    const db = getDb();
    const workspacePath = getWorkspacePath();
    if (!db || !workspacePath) {
      const enabled = vscode.workspace
        .getConfiguration('gptAiMarkdownEditor')
        .get<boolean>('knowledgeGraph.enabled', false);
      if (!enabled) {
        vscode.window
          .showWarningMessage(
            'Knowledge Graph is disabled. Enable it in Settings → "Knowledge Graph: Enabled" and reload.',
            'Open Settings'
          )
          .then(action => {
            if (action === 'Open Settings') {
              vscode.commands.executeCommand(
                'workbench.action.openSettings',
                'gptAiMarkdownEditor.knowledgeGraph.enabled'
              );
            }
          });
      } else {
        vscode.window.showWarningMessage(
          'Knowledge Graph is still initializing. Please try again in a moment.'
        );
      }
      return null;
    }
    return { db, workspacePath };
  }

  disposables.push(
    vscode.commands.registerCommand('gptAiMarkdownEditor.knowledgeGraph.rebuildIndex', async () => {
      const graph = requireGraph();
      if (!graph) return;

      const start = Date.now();
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Knowledge Graph: Rebuilding index...',
          cancellable: false,
        },
        async () => {
          await rebuildFn();
        }
      );
      const count = graph.db.getDocumentCount();
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      vscode.window.showInformationMessage(
        `Knowledge Graph: Indexed ${count} documents in ${elapsed}s`
      );
    })
  );

  disposables.push(
    vscode.commands.registerCommand('gptAiMarkdownEditor.knowledgeGraph.search', async () => {
      const graph = requireGraph();
      if (!graph) return;

      const query = await vscode.window.showInputBox({
        prompt: 'Search across all markdown files (hybrid: FTS + semantic)',
        placeHolder: 'Enter search terms...',
      });
      if (!query) return;

      const results = await hybridSearch(
        query,
        graph.db,
        getVectorStore?.() ?? null,
        getEmbeddingEngine?.() ?? null,
        { topK: 20 }
      );

      if (results.length === 0) {
        vscode.window.showInformationMessage(`No results for "${query}"`);
        return;
      }

      const picked = await vscode.window.showQuickPick(
        results.map(r => ({
          label: r.title,
          description: `${r.path} ${r.sources.length > 0 ? '(' + r.sources.join('+') + ')' : ''}`,
          detail: r.snippet,
          result: r,
        })),
        { placeHolder: `${results.length} results for "${query}"` }
      );

      if (picked) {
        const uri = vscode.Uri.file(path.join(graph.workspacePath, picked.result.path));
        await vscode.commands.executeCommand('vscode.open', uri);
      }
    })
  );

  disposables.push(
    vscode.commands.registerCommand('gptAiMarkdownEditor.knowledgeGraph.stats', () => {
      const graph = requireGraph();
      if (!graph) return;

      const count = graph.db.getDocumentCount();
      const chunks = graph.db.getChunkCount();
      const tags = graph.db.getAllTags();
      const vs = getVectorStore?.();
      const eng = getEmbeddingEngine?.();
      const vectorCount = vs?.getEmbeddedChunkIds().size ?? 0;
      const modelName = eng?.getModel() ?? null;
      const topTags = tags
        .slice(0, 10)
        .map(t => `#${t.tag} (${t.count})`)
        .join(', ');

      let msg = `Knowledge Graph: ${count} docs, ${chunks} chunks, ${tags.length} tags.`;
      if (modelName) {
        msg += ` Semantic: ${vectorCount} vectors (${modelName}).`;
      } else {
        msg += ' Semantic: unavailable (local AI server not reachable).';
      }
      msg += ` Top tags: ${topTags || 'none'}`;
      vscode.window.showInformationMessage(msg);
    })
  );

  return disposables;
}
