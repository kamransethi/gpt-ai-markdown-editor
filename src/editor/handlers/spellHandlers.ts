/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

/**
 * Host-side spell check handlers.
 *
 * Responsibilities:
 * - Handle SPELL_ADD_WORD (append word to user_dictionary.dic in globalStorageUri)
 * - Watch user_dictionary.dic for external edits and fire SPELL_RELOAD to all active webviews
 * - Expose sendSpellInit() for MarkdownEditorProvider to call on READY
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { MessageType } from '../../shared/messageTypes';
import { type HandlerContext, type MessageRouter } from '../messageRouter';

const DIC_FILENAME = 'user_dictionary.dic';

/** Set of currently active webviews — used to fan-out SPELL_RELOAD. */
const activeWebviews = new Set<vscode.Webview>();

/** Register a webview so it receives SPELL_RELOAD broadcasts. */
export function registerSpellWebview(webview: vscode.Webview): void {
  activeWebviews.add(webview);
}

/** Unregister a webview (call from panel onDidDispose). */
export function unregisterSpellWebview(webview: vscode.Webview): void {
  activeWebviews.delete(webview);
}

/** Path to the user dictionary file. */
function getDicPath(context: vscode.ExtensionContext): string {
  return path.join(context.globalStorageUri.fsPath, DIC_FILENAME);
}

/** Read user dictionary words; returns [] if file doesn't exist. */
async function readUserWords(context: vscode.ExtensionContext): Promise<string[]> {
  const dicPath = getDicPath(context);
  try {
    const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(dicPath));
    return Buffer.from(bytes)
      .toString('utf8')
      .split('\n')
      .map(w => w.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** Append a word to the user dictionary. Creates the file/directory if needed. */
async function appendUserWord(context: vscode.ExtensionContext, word: string): Promise<void> {
  const trimmed = word.trim();
  if (!trimmed) return;

  // Ensure global storage directory exists
  try {
    await vscode.workspace.fs.createDirectory(context.globalStorageUri);
  } catch {
    // Directory already exists — ignore
  }

  const dicUri = vscode.Uri.file(getDicPath(context));
  let existing = '';
  try {
    const bytes = await vscode.workspace.fs.readFile(dicUri);
    existing = Buffer.from(bytes).toString('utf8');
  } catch {
    // File doesn't exist yet
  }

  // Avoid duplicates
  const words = existing
    .split('\n')
    .map(w => w.trim())
    .filter(Boolean);
  if (words.includes(trimmed)) return;

  const updated = [...words, trimmed].join('\n') + '\n';
  await vscode.workspace.fs.writeFile(dicUri, Buffer.from(updated, 'utf8'));
}

/** Broadcast SPELL_RELOAD to all registered webviews. */
async function broadcastSpellReload(context: vscode.ExtensionContext): Promise<void> {
  const userWords = await readUserWords(context);
  for (const webview of activeWebviews) {
    void webview.postMessage({ type: MessageType.SPELL_RELOAD, userWords });
  }
}

/** Register the SPELL_ADD_WORD handler with the message router. */
export function registerSpellHandlers(router: MessageRouter, context: vscode.ExtensionContext): void {
  router.register(
    MessageType.SPELL_ADD_WORD,
    async (message: { type: string; [key: string]: unknown }, _ctx: HandlerContext) => {
      const word = typeof message.word === 'string' ? message.word : '';
      if (!word) return;
      await appendUserWord(context, word);
      await broadcastSpellReload(context);
    }
  );
}

/**
 * Set up a FileSystemWatcher for the user dictionary.
 * Returns a Disposable that should be added to context.subscriptions.
 */
export function createDictionaryWatcher(context: vscode.ExtensionContext): vscode.Disposable {
  const pattern = new vscode.RelativePattern(
    vscode.Uri.file(context.globalStorageUri.fsPath),
    DIC_FILENAME
  );
  const watcher = vscode.workspace.createFileSystemWatcher(pattern);

  const reload = () => void broadcastSpellReload(context);
  watcher.onDidChange(reload);
  watcher.onDidCreate(reload);

  return watcher;
}

/**
 * Build and send SPELL_INIT to a single webview.
 * Called from the READY handler in MarkdownEditorProvider.
 */
export async function sendSpellInit(
  webview: vscode.Webview,
  context: vscode.ExtensionContext
): Promise<void> {
  const spellEnabled = vscode.workspace
    .getConfiguration()
    .get<boolean>('gptAiMarkdownEditor.spellCheck.enabled', true);

  if (!spellEnabled) return;

  const language = vscode.workspace
    .getConfiguration()
    .get<string>('gptAiMarkdownEditor.spellCheck.language', 'en-US');

  // Resolve dictionary URIs — fall back to en-US if the requested locale file doesn't exist
  const tryLocale = (locale: string) => {
    return {
      aff: webview.asWebviewUri(
        vscode.Uri.joinPath(context.extensionUri, 'resources', 'dictionaries', `${locale}.aff`)
      ).toString(),
      dic: webview.asWebviewUri(
        vscode.Uri.joinPath(context.extensionUri, 'resources', 'dictionaries', `${locale}.dic`)
      ).toString(),
    };
  };

  // We only ship en-US; any other locale will 404 and the worker falls back
  const localeToUse = language === 'en-US' ? 'en-US' : 'en-US';
  const { aff: affUrl, dic: dicUrl } = tryLocale(localeToUse);

  const userWords = await readUserWords(context);

  void webview.postMessage({
    type: MessageType.SPELL_INIT,
    affUrl,
    dicUrl,
    userWords,
  });
}
