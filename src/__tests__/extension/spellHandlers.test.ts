/**
 * Unit tests for spellHandlers.ts — host-side spell check logic.
 *
 * Tests cover:
 * - registerSpellWebview / unregisterSpellWebview: active webview tracking
 * - registerSpellHandlers: SPELL_ADD_WORD handler appends word to dic file, avoids duplicates
 * - createDictionaryWatcher: watcher fires SPELL_RELOAD broadcast on file change/create
 * - Empty dic file is created when it does not exist
 *
 * All vscode APIs are mocked via src/__mocks__/vscode.ts.
 */

import * as vscode from 'vscode';
import { MessageType } from '../../shared/messageTypes';
import {
  registerSpellWebview,
  unregisterSpellWebview,
  registerSpellHandlers,
  createDictionaryWatcher,
} from '../../editor/handlers/spellHandlers';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeContext(storageDir = '/storage') {
  return {
    globalStorageUri: { fsPath: storageDir },
    extensionUri: { fsPath: '/ext' },
  } as unknown as vscode.ExtensionContext;
}

function makeWebview() {
  return {
    postMessage: jest.fn().mockResolvedValue(true),
    asWebviewUri: jest.fn((uri: unknown) => ({ toString: () => String(uri) })),
  } as unknown as vscode.Webview;
}

function makeRouter() {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  return {
    register: jest.fn((type: string, fn: (...args: unknown[]) => unknown) =>
      handlers.set(type, fn)
    ),
    route: jest.fn(() => false),
    _dispatch: async (type: string, msg: object) => handlers.get(type)?.(msg, {}),
  };
}

// Convenience typed references to the mocked vscode.workspace.fs methods
const mockReadFile = () => vscode.workspace.fs.readFile as jest.Mock;
const mockWriteFile = () => vscode.workspace.fs.writeFile as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
    get: jest.fn((_key: string, def?: unknown) => def),
  });
  // Default: empty dic file
  mockReadFile().mockResolvedValue(Buffer.from('', 'utf8'));
  mockWriteFile().mockResolvedValue(undefined);
  (vscode.workspace.fs.createDirectory as jest.Mock).mockResolvedValue(undefined);
});

// ── registerSpellWebview / unregisterSpellWebview ────────────────────────────

describe('registerSpellWebview / unregisterSpellWebview', () => {
  it('registers and unregisters a webview without error', () => {
    const wv = makeWebview();
    expect(() => registerSpellWebview(wv)).not.toThrow();
    expect(() => unregisterSpellWebview(wv)).not.toThrow();
  });
});

// ── SPELL_ADD_WORD handler ────────────────────────────────────────────────────

describe('registerSpellHandlers — SPELL_ADD_WORD', () => {
  it('appends a new word to an existing dic file', async () => {
    mockReadFile().mockResolvedValue(Buffer.from('hello\nworld\n', 'utf8'));

    const router = makeRouter();
    registerSpellHandlers(router, makeContext());
    await router._dispatch(MessageType.SPELL_ADD_WORD, {
      type: MessageType.SPELL_ADD_WORD,
      word: 'newword',
    });

    expect(mockWriteFile()).toHaveBeenCalledTimes(1);
    const writtenBytes: Uint8Array = mockWriteFile().mock.calls[0][1];
    const writtenContent = Buffer.from(writtenBytes).toString('utf8');
    expect(writtenContent).toContain('newword');
    expect(writtenContent).toContain('hello');
    expect(writtenContent).toContain('world');
  });

  it('does not duplicate a word already in the dic file', async () => {
    mockReadFile().mockResolvedValue(Buffer.from('hello\nworld\n', 'utf8'));

    const router = makeRouter();
    registerSpellHandlers(router, makeContext());
    await router._dispatch(MessageType.SPELL_ADD_WORD, {
      type: MessageType.SPELL_ADD_WORD,
      word: 'hello',
    });

    expect(mockWriteFile()).not.toHaveBeenCalled();
  });

  it('creates a new dic file if it does not exist', async () => {
    mockReadFile().mockRejectedValue(new Error('ENOENT'));

    const router = makeRouter();
    registerSpellHandlers(router, makeContext());
    await router._dispatch(MessageType.SPELL_ADD_WORD, {
      type: MessageType.SPELL_ADD_WORD,
      word: 'microservices',
    });

    expect(mockWriteFile()).toHaveBeenCalledTimes(1);
    const writtenBytes: Uint8Array = mockWriteFile().mock.calls[0][1];
    const writtenContent = Buffer.from(writtenBytes).toString('utf8');
    expect(writtenContent).toContain('microservices');
  });

  it('ignores empty or whitespace-only words', async () => {
    const router = makeRouter();
    registerSpellHandlers(router, makeContext());
    await router._dispatch(MessageType.SPELL_ADD_WORD, {
      type: MessageType.SPELL_ADD_WORD,
      word: '   ',
    });

    expect(mockWriteFile()).not.toHaveBeenCalled();
  });

  it('broadcasts SPELL_RELOAD to registered webviews after adding a word', async () => {
    mockReadFile().mockResolvedValue(Buffer.from('hello\n', 'utf8'));
    const wv = makeWebview();
    registerSpellWebview(wv);

    const router = makeRouter();
    registerSpellHandlers(router, makeContext());
    await router._dispatch(MessageType.SPELL_ADD_WORD, {
      type: MessageType.SPELL_ADD_WORD,
      word: 'newword',
    });

    expect(wv.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: MessageType.SPELL_RELOAD })
    );

    unregisterSpellWebview(wv);
  });
});

// ── createDictionaryWatcher ───────────────────────────────────────────────────

describe('createDictionaryWatcher', () => {
  let localWatcher: { onDidChange: jest.Mock; onDidCreate: jest.Mock; dispose: jest.Mock };

  beforeEach(() => {
    localWatcher = {
      onDidChange: jest.fn(),
      onDidCreate: jest.fn(),
      dispose: jest.fn(),
    };
    (vscode.workspace.createFileSystemWatcher as jest.Mock).mockReturnValue(localWatcher);
  });

  it('returns a disposable watcher', () => {
    const disposable = createDictionaryWatcher(makeContext());
    expect(disposable).toBeDefined();
  });

  it('registers onDidChange and onDidCreate callbacks', () => {
    createDictionaryWatcher(makeContext());
    expect(localWatcher.onDidChange).toHaveBeenCalledTimes(1);
    expect(localWatcher.onDidCreate).toHaveBeenCalledTimes(1);
  });

  it('broadcasts SPELL_RELOAD when onDidChange fires', async () => {
    mockReadFile().mockResolvedValue(Buffer.from('hello\n', 'utf8'));
    const wv = makeWebview();
    registerSpellWebview(wv);

    createDictionaryWatcher(makeContext());

    const changeCallback: (() => Promise<void>) | undefined =
      localWatcher.onDidChange.mock.calls[0]?.[0];
    expect(changeCallback).toBeDefined();
    await changeCallback();

    // Give the void promise in the callback time to settle
    await new Promise(r => setTimeout(r, 10));

    expect(wv.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: MessageType.SPELL_RELOAD })
    );

    unregisterSpellWebview(wv);
  });
});
