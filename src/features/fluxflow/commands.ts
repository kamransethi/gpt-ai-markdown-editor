/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import type { GraphDatabase } from './database';
import type { SearchResult } from './types';

export function registerFluxFlowCommands(
  db: GraphDatabase,
  workspacePath: string,
  rebuildFn: () => Promise<void>
): vscode.Disposable[] {
  const disposables: vscode.Disposable[] = [];

  disposables.push(
    vscode.commands.registerCommand('gptAiMarkdownEditor.knowledgeGraph.rebuildIndex', async () => {
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
      const count = db.getDocumentCount();
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      vscode.window.showInformationMessage(
        `Knowledge Graph: Indexed ${count} documents in ${elapsed}s`
      );
    })
  );

  disposables.push(
    vscode.commands.registerCommand('gptAiMarkdownEditor.knowledgeGraph.search', async () => {
      const query = await vscode.window.showInputBox({
        prompt: 'Search across all markdown files',
        placeHolder: 'Enter search terms...',
      });
      if (!query) return;

      const results: SearchResult[] = db.search(query);
      if (results.length === 0) {
        vscode.window.showInformationMessage(`No results for "${query}"`);
        return;
      }

      const picked = await vscode.window.showQuickPick(
        results.map(r => ({
          label: r.title,
          description: r.path,
          detail: r.snippet,
          result: r,
        })),
        { placeHolder: `${results.length} results for "${query}"` }
      );

      if (picked) {
        const uri = vscode.Uri.file(path.join(workspacePath, picked.result.path));
        await vscode.commands.executeCommand('vscode.open', uri);
      }
    })
  );

  disposables.push(
    vscode.commands.registerCommand('gptAiMarkdownEditor.knowledgeGraph.stats', () => {
      const count = db.getDocumentCount();
      const tags = db.getAllTags();
      const topTags = tags
        .slice(0, 10)
        .map(t => `#${t.tag} (${t.count})`)
        .join(', ');
      vscode.window.showInformationMessage(
        `Knowledge Graph: ${count} documents, ${tags.length} unique tags. Top: ${topTags || 'none'}`
      );
    })
  );

  return disposables;
}
