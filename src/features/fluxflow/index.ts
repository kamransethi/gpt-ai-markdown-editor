/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { GraphDatabase } from './database';
import { parseMarkdownFile } from './indexer';
import { FluxFlowWatcher } from './watcher';
import { BacklinksViewProvider } from './backlinksView';
import { registerFluxFlowCommands } from './commands';

let database: GraphDatabase | null = null;
let watcher: FluxFlowWatcher | null = null;
let backlinksView: BacklinksViewProvider | null = null;
let disposables: vscode.Disposable[] = [];

/**
 * Initialize the Knowledge Graph system.
 * Call from extension.ts activate() when the feature flag is enabled.
 */
export async function initialize(_context: vscode.ExtensionContext): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) return;

  const workspacePath = workspaceFolder.uri.fsPath;

  // Set context key so the Backlinks view becomes visible
  await vscode.commands.executeCommand(
    'setContext',
    'gptAiMarkdownEditor.knowledgeGraph.active',
    true
  );

  // 1. Open database
  database = new GraphDatabase();
  await database.open(workspacePath);

  // 2. Register Backlinks TreeView
  backlinksView = new BacklinksViewProvider(
    workspacePath,
    docPath => database!.getBacklinks(docPath),
    docPath => database!.getUnlinkedReferences(docPath)
  );

  const treeView = vscode.window.createTreeView('gptAiMarkdownEditorBacklinks', {
    treeDataProvider: backlinksView,
    showCollapseAll: true,
  });
  disposables.push(treeView);

  // 3. Track active editor to update backlinks
  disposables.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (!backlinksView) return;
      if (
        editor &&
        editor.document.uri.scheme === 'file' &&
        editor.document.languageId === 'markdown'
      ) {
        const relPath = path
          .relative(workspacePath, editor.document.uri.fsPath)
          .split(path.sep)
          .join('/');
        backlinksView.updateActiveDocument(relPath);
      } else {
        backlinksView.updateActiveDocument(null);
      }
    })
  );

  // 4. Register commands
  const cmdDisposables = registerFluxFlowCommands(database, workspacePath, () =>
    fullIndex(workspacePath)
  );
  disposables.push(...cmdDisposables);

  // 5. Start file watcher
  watcher = new FluxFlowWatcher(
    uri => {
      const relPath = path.relative(workspacePath, uri.fsPath).split(path.sep).join('/');
      indexSingleFile(workspacePath, relPath);
    },
    uri => {
      const relPath = path.relative(workspacePath, uri.fsPath).split(path.sep).join('/');
      database?.deleteDocument(relPath);
      database?.scheduleSave();
      if (backlinksView) {
        backlinksView.updateActiveDocument(backlinksView.currentDocPath);
      }
    }
  );
  watcher.start();
  disposables.push(watcher);

  // 6. Run initial full index
  await fullIndex(workspacePath);

  // 7. Listen for setting changes
  disposables.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('gptAiMarkdownEditor.knowledgeGraph.enabled')) {
        vscode.window
          .showInformationMessage(
            'Knowledge Graph setting changed. Reload window to apply.',
            'Reload'
          )
          .then(action => {
            if (action === 'Reload') {
              vscode.commands.executeCommand('workbench.action.reloadWindow');
            }
          });
      }
    })
  );

  const count = database.getDocumentCount();
  console.log(`[FluxFlow] Knowledge Graph initialized: ${count} documents indexed`);
}

/**
 * Full re-index of all .md files in the workspace.
 */
async function fullIndex(workspacePath: string): Promise<void> {
  if (!database) return;

  const files = await vscode.workspace.findFiles('**/*.md', '**/node_modules/**');

  database.begin();
  try {
    for (const fileUri of files) {
      const relPath = path.relative(workspacePath, fileUri.fsPath).split(path.sep).join('/');

      let content: string;
      try {
        content = await fs.promises.readFile(fileUri.fsPath, 'utf-8');
      } catch {
        continue; // Skip unreadable files
      }

      // Skip unchanged files
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      const existingHash = database.getDocumentHash(relPath);
      if (existingHash === hash) continue;

      const parsed = parseMarkdownFile(content, relPath);
      const docId = database.upsertDocument(relPath, parsed.title, hash);

      database.clearLinksForDocument(docId);
      database.clearTagsForDocument(docId);
      database.clearPropertiesForDocument(docId);
      database.clearFtsForDocument(docId);

      for (const link of parsed.links) {
        database.insertLink(docId, link.target, link.lineNumber, link.context);
      }
      for (const tag of parsed.tags) {
        database.insertTag(docId, tag.tag, tag.source);
      }
      for (const prop of parsed.properties) {
        database.insertProperty(docId, prop.key, prop.value);
      }
      database.upsertFts(docId, parsed.title, parsed.bodyText);
    }

    database.resolveLinks();
    database.commit();
  } catch (err) {
    console.error('[FluxFlow] Index error:', err);
    try {
      database.commit();
    } catch {
      /* ignore */
    }
    throw err;
  }

  database.saveNow();
}

/**
 * Re-index a single file (incremental update on save).
 */
function indexSingleFile(workspacePath: string, relPath: string): void {
  if (!database) return;

  const absPath = path.join(workspacePath, relPath);
  let content: string;
  try {
    content = fs.readFileSync(absPath, 'utf-8');
  } catch {
    return;
  }

  const hash = crypto.createHash('sha256').update(content).digest('hex');
  const existingHash = database.getDocumentHash(relPath);
  if (existingHash === hash) return;

  const parsed = parseMarkdownFile(content, relPath);
  const docId = database.upsertDocument(relPath, parsed.title, hash);

  database.clearLinksForDocument(docId);
  database.clearTagsForDocument(docId);
  database.clearPropertiesForDocument(docId);
  database.clearFtsForDocument(docId);

  for (const link of parsed.links) {
    database.insertLink(docId, link.target, link.lineNumber, link.context);
  }
  for (const tag of parsed.tags) {
    database.insertTag(docId, tag.tag, tag.source);
  }
  for (const prop of parsed.properties) {
    database.insertProperty(docId, prop.key, prop.value);
  }
  database.upsertFts(docId, parsed.title, parsed.bodyText);
  database.resolveLinks();
  database.scheduleSave();

  if (backlinksView) {
    backlinksView.updateActiveDocument(backlinksView.currentDocPath);
  }
}

/**
 * Clean up on extension deactivation.
 */
export function deactivate(): void {
  for (const d of disposables) {
    d.dispose();
  }
  disposables = [];
  watcher = null;
  backlinksView = null;
  database?.close();
  database = null;
}
