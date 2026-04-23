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
import { parseDocumentFile } from './indexer';
import { chunkMarkdown } from './chunker';

import { FluxFlowWatcher } from './watcher';
import { BacklinksViewProvider } from './backlinksView';
import { registerFluxFlowCommands } from './commands';
import { openChatPanel } from './chatPanel';
import { createEmbeddingEngine, type EmbeddingEngine } from './embeddingEngine';
import { VectorStore } from './vectorStore';

let database: GraphDatabase | null = null;
let watcher: FluxFlowWatcher | null = null;
let backlinksView: BacklinksViewProvider | null = null;
let vectorStore: VectorStore | null = null;
let embeddingEngine: EmbeddingEngine | null = null;
let embeddingStatus: 'ready' | 'server-unavailable' | 'model-missing' = 'server-unavailable';
let embeddingError: string | null = null;
let embeddingErrorFull: string | null = null;
let currentWorkspacePath: string | null = null;
let disposables: vscode.Disposable[] = [];

/** Live progress state — updated during indexing and embedding phases. */
const progressState = {
  phase: 'idle' as 'idle' | 'indexing' | 'embedding' | 'ready',
  indexTotal: 0,
  indexDone: 0,
  embedTotal: 0,
  embedDone: 0,
};

/** Optional push channel: set by SettingsPanel to receive live progress updates. */
let onProgressPush: (() => void) | null = null;

export function setProgressPushCallback(cb: () => void): void {
  onProgressPush = cb;
}

function normalizeGraphFileTypes(raw: string): string[] {
  const seen = new Set<string>();
  return raw
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
    .map(ext => (ext.startsWith('*.') ? ext.slice(1) : ext))
    .map(ext => (ext.startsWith('.') ? ext : `.${ext}`))
    .map(ext => ext.toLowerCase())
    .filter(ext => {
      if (seen.has(ext)) return false;
      seen.add(ext);
      return true;
    });
}

function getConfiguredGraphFileTypes(): string[] {
  const workspaceCfg = vscode.workspace.getConfiguration('gptAiMarkdownEditor');
  const rawTypes = workspaceCfg.get<string>(
    'knowledgeGraph.indexedFileTypes',
    '.md, .csv, .html, .drawio.svg, .bpmn'
  );
  const fileTypes = normalizeGraphFileTypes(rawTypes);
  return fileTypes.length > 0 ? fileTypes : ['.md'];
}

function buildGraphGlobPatterns(fileTypes: string[]): string[] {
  return fileTypes.map(ext => `**/*${ext}`);
}

function createGraphWatcherPatterns(fileTypes: string[]): string[] {
  return fileTypes.length > 0 ? buildGraphGlobPatterns(fileTypes) : ['**/*.md'];
}

/** Register commands unconditionally (call from activate, always). */
export function registerCommands(context: vscode.ExtensionContext): void {
  const cmdDisposables = registerFluxFlowCommands(
    () => database,
    () => currentWorkspacePath,
    async () => {
      if (currentWorkspacePath) {
        await fullIndex(currentWorkspacePath);
      }
    },
    () => vectorStore,
    () => embeddingEngine
  );
  context.subscriptions.push(...cmdDisposables);

  // Register Graph Chat command
  context.subscriptions.push(
    vscode.commands.registerCommand('gptAiMarkdownEditor.graphChat', () => {
      openChatPanel(
        context,
        () => database,
        () => currentWorkspacePath,
        () => vectorStore,
        () => embeddingEngine
      );
    })
  );
}

/**
 * Initialize the Knowledge Graph system.
 * Call from extension.ts activate() when the feature flag is enabled.
 */
export async function initialize(_context: vscode.ExtensionContext): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) return;

  const workspacePath = workspaceFolder.uri.fsPath;
  currentWorkspacePath = workspacePath;

  // Initial state push
  progressState.phase = 'idle';
  onProgressPush?.();

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

  // 4. Start file watcher
  const fileTypes = getConfiguredGraphFileTypes();
  const watcherPatterns = createGraphWatcherPatterns(fileTypes);
  watcher = new FluxFlowWatcher(
    watcherPatterns,
    uri => {
      const relPath = path.relative(workspacePath, uri.fsPath).split(path.sep).join('/');
      indexSingleFile(workspacePath, relPath);
    },
    uri => {
      const relPath = path.relative(workspacePath, uri.fsPath).split(path.sep).join('/');
      const doc = database?.getDocumentByPath(relPath);
      if (doc && vectorStore) {
        vectorStore.removeByDocId(doc.id);
      }
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

  // 7. Initialize semantic search (local AI embeddings)
  await reinitializeEmbeddings();

  // 8. Listen for setting changes
  disposables.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (
        e.affectsConfiguration('gptAiMarkdownEditor.knowledgeGraph.enabled') ||
        e.affectsConfiguration('gptAiMarkdownEditor.knowledgeGraph.indexedFileTypes')
      ) {
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
      if (
        e.affectsConfiguration('gptAiMarkdownEditor.knowledgeGraph.embeddingModel') ||
        e.affectsConfiguration('gptAiMarkdownEditor.ollamaEndpoint')
      ) {
        reinitializeEmbeddings().catch(err =>
          console.error('[FluxFlow] Failed to reinitialize embeddings:', err)
        );
      }
    })
  );

  const count = database.getDocumentCount();
  console.log(`[FluxFlow] Knowledge Graph initialized: ${count} documents indexed`);
}

/**
 * Full re-index of all configured Knowledge Graph file types in the workspace.
 */
async function fullIndex(workspacePath: string): Promise<void> {
  if (!database) return;

  const fileTypes = getConfiguredGraphFileTypes();
  const patterns = buildGraphGlobPatterns(fileTypes);
  const filesByPath = new Map<string, vscode.Uri>();
  for (const pattern of patterns) {
    const found = await vscode.workspace.findFiles(pattern, '**/node_modules/**');
    for (const fileUri of found) {
      filesByPath.set(fileUri.fsPath, fileUri);
    }
  }
  const files = Array.from(filesByPath.values());

  // Update progress state
  progressState.phase = 'indexing';
  progressState.indexTotal = files.length;
  progressState.indexDone = 0;
  onProgressPush?.();

  database.begin();
  try {
    for (const fileUri of files) {
      const relPath = path.relative(workspacePath, fileUri.fsPath).split(path.sep).join('/');

      let content: string;
      try {
        content = await fs.promises.readFile(fileUri.fsPath, 'utf-8');
      } catch {
        progressState.indexDone++;
        continue; // Skip unreadable files
      }

      // Skip unchanged files
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      const existingHash = database.getDocumentHash(relPath);
      if (existingHash === hash) {
        progressState.indexDone++;
        continue;
      }

      const parsed = parseDocumentFile(content, relPath);
      const docId = database.upsertDocument(relPath, parsed.title, hash);

      database.clearLinksForDocument(docId);
      database.clearTagsForDocument(docId);
      database.clearPropertiesForDocument(docId);
      database.clearFtsForDocument(docId);
      database.clearChunksForDocument(docId);

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

      // Chunk the document for semantic search
      const workspaceCfg = vscode.workspace.getConfiguration('gptAiMarkdownEditor');
      const maxChars = workspaceCfg.get<number>('knowledgeGraph.rag.charsPerDoc', 2500);
      const chunks = chunkMarkdown(parsed.bodyText, parsed.title, parsed.properties, maxChars);
      for (const chunk of chunks) {
        database.insertChunk(docId, chunk.headerPath, chunk.content, chunk.tokenCount);
      }

      progressState.indexDone++;
      // Push progress every 10 files
      if (progressState.indexDone % 10 === 0) onProgressPush?.();
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

  progressState.indexDone = progressState.indexTotal;
  database.saveNow();
  onProgressPush?.();
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

  const parsed = parseDocumentFile(content, relPath);
  const docId = database.upsertDocument(relPath, parsed.title, hash);

  database.clearLinksForDocument(docId);
  database.clearTagsForDocument(docId);
  database.clearPropertiesForDocument(docId);
  database.clearFtsForDocument(docId);
  database.clearChunksForDocument(docId);

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

  // Chunk the document for semantic search
  const workspaceCfg = vscode.workspace.getConfiguration('gptAiMarkdownEditor');
  const maxChars = workspaceCfg.get<number>('knowledgeGraph.rag.charsPerDoc', 2500);
  const chunks = chunkMarkdown(parsed.bodyText, parsed.title, parsed.properties, maxChars);
  for (const chunk of chunks) {
    database.insertChunk(docId, chunk.headerPath, chunk.content, chunk.tokenCount);
  }

  database.resolveLinks();
  database.scheduleSave();

  // Remove old vectors for this doc and re-embed in background
  if (vectorStore) {
    vectorStore.removeByDocId(docId);
    embedChunksBackground().catch(err =>
      console.error('[FluxFlow] Background embedding error:', err)
    );
  }

  if (backlinksView) {
    backlinksView.updateActiveDocument(backlinksView.currentDocPath);
  }
}

/**
 * Embed un-embedded chunks in the background.
 * Runs after initial index and after single-file re-index.
 * Non-blocking — errors are logged but don't break the extension.
 */
let embeddingInProgress = false;
/**
 * (Re-)initialize the embedding engine and vector store.
 * Called at startup and when embedding model or server URL config changes.
 */
async function reinitializeEmbeddings(): Promise<void> {
  // Save existing vector store before switching
  vectorStore?.save();

  embeddingEngine = createEmbeddingEngine();
  const serverStatus = await embeddingEngine.checkStatus();

  // serverStatus may include an error message now. Keep full text for logs,
  // but expose only a short message to the webview UI.
  embeddingErrorFull = (serverStatus as any).error ?? null;
  embeddingError = null; // default; will set a short user-facing message below

  if (serverStatus.serverUp && serverStatus.modelInstalled) {
    try {
      const probe = await embeddingEngine.embed('test');
      const dims = probe.length;
      vectorStore = new VectorStore();
      vectorStore.open(currentWorkspacePath!, dims);
      embeddingStatus = 'ready';
      console.log(
        `[FluxFlow] Semantic search ready: ${embeddingEngine.getModel()} (${dims}D), ${vectorStore.count} vectors loaded`
      );

      embedChunksBackground().catch(err =>
        console.error('[FluxFlow] Background embedding error:', err)
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('[FluxFlow] Failed to initialize embeddings:', errMsg);
      embeddingErrorFull = errMsg;
      embeddingError = 'Failed to initialize embedding model (see Output)';
      embeddingEngine = null;
      vectorStore = null;
      embeddingStatus = 'server-unavailable';
    }
  } else if (serverStatus.serverUp) {
    const modelName = embeddingEngine?.getModel() ?? '(unknown)';
    const msg = `Embedding model "${modelName}" not installed — semantic search disabled.`;
    console.log(`[FluxFlow] ${msg}`);
    embeddingErrorFull = (serverStatus as any).error ?? msg;
    embeddingError = `Embedding model "${modelName}" not installed (see Output)`;
    embeddingEngine = null;
    vectorStore = null;
    embeddingStatus = 'model-missing';
  } else {
    const msg = 'Local AI server not available — semantic search disabled. FTS-only mode.';
    console.log(`[FluxFlow] ${msg}`);
    embeddingErrorFull = (serverStatus as any).error ?? msg;
    embeddingError = 'Local AI server not available (see Output)';
    embeddingEngine = null;
    vectorStore = null;
    embeddingStatus = 'server-unavailable';
  }

  // Always surface the detailed error in the Output channel for debugging
  if (embeddingErrorFull) {
    try {
      const out = vscode.window.createOutputChannel('FluxFlow Debug');
      out.appendLine(`[FluxFlow] Embedding detailed error: ${embeddingErrorFull}`);
    } catch (e) {
      void e;
    }
  }
}

async function embedChunksBackground(): Promise<void> {
  if (embeddingInProgress || !database || !vectorStore || !embeddingEngine) return;
  embeddingInProgress = true;

  try {
    const allChunkIds = database.getAllChunkIds();
    const embeddedIds = vectorStore.getEmbeddedChunkIds();
    const toEmbed = allChunkIds.filter(id => !embeddedIds.has(id));

    if (toEmbed.length === 0) {
      progressState.phase = 'ready';
      progressState.embedTotal = vectorStore.count;
      progressState.embedDone = vectorStore.count;
      onProgressPush?.();
      return;
    }

    // Set embedding phase
    progressState.phase = 'embedding';
    progressState.embedTotal = embeddedIds.size + toEmbed.length;
    progressState.embedDone = embeddedIds.size;
    onProgressPush?.();

    console.log(`[FluxFlow] Embedding ${toEmbed.length} chunks...`);
    const BATCH = 32;

    for (let i = 0; i < toEmbed.length; i += BATCH) {
      const batchIds = toEmbed.slice(i, i + BATCH);
      const texts: string[] = [];
      const metas: Array<{ chunkId: number; docId: number }> = [];

      for (const chunkId of batchIds) {
        const chunk = database.getChunkById(chunkId);
        if (!chunk) continue;
        texts.push(chunk.content);
        metas.push({ chunkId: chunk.id, docId: chunk.docId });
      }

      if (texts.length === 0) continue;

      const vectors = await embeddingEngine.embedBatch(texts);
      for (let j = 0; j < vectors.length; j++) {
        if (vectors[j].length === 0) continue;
        vectorStore.upsert(metas[j].chunkId, metas[j].docId, new Float32Array(vectors[j]));
      }

      progressState.embedDone = embeddedIds.size + Math.min(i + BATCH, toEmbed.length);
      onProgressPush?.();
    }

    vectorStore.save();
    progressState.phase = 'ready';
    progressState.embedDone = progressState.embedTotal;
    onProgressPush?.();
    console.log(`[FluxFlow] Embedding complete: ${vectorStore.count} vectors stored`);
  } finally {
    embeddingInProgress = false;
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
  vectorStore?.save();
  vectorStore = null;
  embeddingEngine = null;
  database?.close();
  database = null;
}

export function getGraphCallbacks(): {
  getStats: () => {
    docCount: number;
    tagCount: number;
    dbSizeKb: number;
    chunkCount: number;
    vectorCount: number;
    embeddingModel: string | null;
    embeddingStatus: 'ready' | 'server-unavailable' | 'model-missing';
    embeddingError?: string | null;
    phase: 'idle' | 'indexing' | 'embedding' | 'ready';
    indexTotal: number;
    indexDone: number;
    embedTotal: number;
    embedDone: number;
  } | null;
  rebuild: () => Promise<{ docCount: number; elapsedS: string }>;
} {
  return {
    getStats: () => {
      // Return partial stats even while DB is loading so the UI never shows 'null'
      const docCount = database?.getDocumentCount() ?? 0;
      const tagCount = database?.getAllTags().length ?? 0;
      const chunkCount = database?.getChunkCount() ?? 0;
      const vectorCount = vectorStore?.count ?? 0;
      const embeddingModel = embeddingEngine?.getModel() ?? null;
      const dbPath = database?.getDbPath();
      let dbSizeKb = 0;
      try {
        if (dbPath) {
          const stat = fs.statSync(dbPath);
          dbSizeKb = Math.round(stat.size / 1024);
        }
      } catch {
        /* not saved yet */
      }
      return {
        docCount,
        tagCount,
        dbSizeKb,
        chunkCount,
        vectorCount,
        embeddingModel,
        embeddingStatus,
        embeddingError,
        phase: progressState.phase,
        indexTotal: progressState.indexTotal,
        indexDone: progressState.indexDone,
        embedTotal: progressState.embedTotal,
        embedDone: progressState.embedDone,
      };
    },
    rebuild: async () => {
      if (!database || !currentWorkspacePath)
        throw new Error('Knowledge Graph is not initialized.');
      const wp = currentWorkspacePath!;
      const start = Date.now();
      // Reset progress for rebuild
      progressState.phase = 'idle';
      progressState.indexDone = 0;
      progressState.indexTotal = 0;
      progressState.embedDone = 0;
      progressState.embedTotal = 0;
      vectorStore?.clear();
      await fullIndex(wp);
      // Re-embed after rebuild
      if (vectorStore && embeddingEngine) {
        await embedChunksBackground();
      }
      const elapsedS = ((Date.now() - start) / 1000).toFixed(1);
      const docCount = database?.getDocumentCount() ?? 0;
      return { docCount, elapsedS };
    },
  };
}
