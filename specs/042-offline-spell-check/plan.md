# Implementation Plan: Offline Spell Check

**Folder**: `specs/042-offline-spell-check/plan.md` | **Date**: 2026-05-10 | **Spec**: [spec.md](spec.md)
**Status**: Draft

## Summary

Implement a 100% offline Microsoft Word-style spell checker using `nspell` (Hunspell JS) running in a dedicated Web Worker, with ProseMirror `Decoration.inline()` for underlines and pre-computed suggestions stored in decoration metadata. The extension host manages the personal dictionary file and sends it to the webview via the existing `postMessage` protocol.

## Stack

**Language/Runtime**: TypeScript 5.x, Chromium/Electron (VS Code webview)
**Key deps**: `nspell` (new), `en-US` Hunspell dictionary files (resources/dictionaries/), `@tiptap/core` (existing), ProseMirror `prosemirror-view` (existing)
**Testing**: Jest + jsdom (existing suite)

---

## Phases

**Phase 1 — Infrastructure**: Worker pipeline, CSP, build entry point, message protocol, host handler

- Files: see table below
- Tests: 8 unit tests — worker message handling, host handler read/write, CSP verification

**Phase 2 — Core Scanner**: ProseMirror plugin, decoration management, no-scan zones, initial scan trigger

- Files: see table below
- Tests: 12 unit tests — node exclusion logic, normalization, decoration creation/invalidation, cursor exclusion

**Phase 3 — UI**: Context menu integration, spell-check sub-menu via MenuBuilder, "Add to Dictionary", "Ignore", `openUserDictionary` command

- Files: see table below
- Tests: 6 unit tests — menu branch selection, word replacement transaction, session ignore set

---

## Files


| File                                     | Action | Purpose                                                                                                                                               |
| ---------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resources/dictionaries/en-US.aff`       | CREATE | Hunspell affix rules for en-US (bundled asset)                                                                                                        |
| `resources/dictionaries/en-US.dic`       | CREATE | Hunspell base wordlist for en-US (bundled asset)                                                                                                      |
| `src/webview/spellchecker.worker.ts`     | CREATE | Web Worker: loads nspell, checks words, returns errors + suggestions                                                                                  |
| `src/webview/extensions/spellCheck.ts`   | CREATE | TipTap extension wrapping the ProseMirror spell-check plugin                                                                                          |
| `src/webview/features/spellCheckMenu.ts` | CREATE | Builds the spell-check context menu branch using MenuBuilder                                                                                          |
| `src/editor/handlers/spellHandlers.ts`   | CREATE | Host-side: SPELL_ADD_WORD handler, reads/writes user_dictionary.dic, FileSystemWatcher                                                                |
| `src/shared/messageTypes.ts`             | MODIFY | Add SPELL_INIT, SPELL_ADD_WORD, SPELL_RELOAD                                                                                                          |
| `src/editor/MarkdownEditorProvider.ts`   | MODIFY | (1) Inject `window.SPELLCHECK_WORKER_URL`; (2) add `worker-src ${webview.cspSource}` to CSP; (3) register spellHandlers; (4) send SPELL_INIT on ready |
| `scripts/build-webview.js`               | MODIFY | Add `{ in: 'src/webview/spellchecker.worker.ts', out: 'spellcheck-worker' }` entry point                                                              |
| `src/webview/editor.ts`                  | MODIFY | (1) Register SpellCheck extension; (2) wire SPELL_INIT/SPELL_RELOAD messages; (3) intercept contextmenu for `.spell-error` targets                    |
| `src/webview/editor.css`                 | MODIFY | Add `.spell-error` SVG wavy underline rule                                                                                                            |
| `package.json`                           | MODIFY | Add `gptAiMarkdownEditor.spellCheck.enabled`, `gptAiMarkdownEditor.spellCheck.language` config contributions; add `openUserDictionary` command        |
| `src/__tests__/spellCheck.test.ts`       | CREATE | Unit tests: node exclusion, normalization, decoration logic                                                                                           |
| `src/__tests__/spellHandlers.test.ts`    | CREATE | Unit tests: host handler add-word, reload trigger                                                                                                     |


---

## Key Risks


| Risk                                                           | Cause                                                        | Mitigation                                                                                                                                            |
| -------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Worker blocked at runtime                                      | Missing `worker-src` in CSP                                  | Phase 1 adds it explicitly; verified in tests via CSP string assertion                                                                                |
| Smart-quote false positives on contractions                    | Typography extension converts `'` → U+2019                   | Normalise U+2018/U+2019 → `'` in scanner before sending to worker                                                                                     |
| `suggest()` latency freezes context menu                       | nspell `suggest()` is synchronous and slow for obscure words | Worker pre-computes suggestions at decoration-creation time; menu reads from `.spec` object only                                                      |
| Decoration retrieval path incorrect                            | `EditorState` has no `.decorations` property                 | Use exported plugin instance: `spellCheckPlugin.getState(view.state).find(pos, pos)` — never `state.decorations`                                      |
| 50k-word initial scan drops frames                             | Full sync walk on main thread                                | Worker handles all nspell calls; scanner sends text fragments via `postMessage`, never blocks render                                                  |
| User dictionary in `globalStorageUri` unreachable from webview | `globalStorageUri` not in `localResourceRoots`               | Host reads the file and sends `userWords: string[]` in SPELL_INIT payload; never fetched by webview directly                                          |
| Dictionary asset not in `localResourceRoots`                   | `resources/` not served to webview                           | It's under `extensionUri` which is already in `localResourceRoots` (MarkdownEditorProvider.ts:253); verified by reviewing existing image serving path |


---

## Architecture Notes

### Worker Contract

The worker runs as a separate esbuild bundle (`dist/spellcheck-worker.js`). It is instantiated with `new Worker(window.SPELLCHECK_WORKER_URL)`. Communication is entirely via structured-clone `postMessage`.

**Inbound messages to worker**:

```ts
// Initialise with dictionary buffers
{ type: 'INIT', aff: string, dic: string, userWords: string[] }

// Check a batch of text fragments
{ type: 'CHECK', id: string, fragments: Array<{ key: string, text: string }> }

// Update user word list after add/reload
{ type: 'UPDATE_USER_WORDS', userWords: string[] }
```

**Outbound messages from worker**:

```ts
// Results for a CHECK request
{ type: 'RESULTS', id: string, results: Array<{ key: string, errors: SpellError[] }> }

type SpellError = { word: string, from: number, to: number, suggestions: string[] }
```

### Message Protocol (Host ↔ Webview)

Add to `shared/messageTypes.ts`:

```ts
SPELL_INIT:    'spellInit'    // Host → Webview: { affUrl: string, dicUrl: string, userWords: string[] }
SPELL_ADD_WORD:'spellAddWord' // Webview → Host: { word: string }
SPELL_RELOAD:  'spellReload'  // Host → Webview: { userWords: string[] }
```

`SPELL_INIT` is sent by the host inside the existing `READY` handler, immediately after the webview reports ready, so dictionary loading begins before the user has a chance to type.

### CSP Change (MarkdownEditorProvider.ts)

The existing CSP line:

```
script-src 'nonce-${nonce}' 'wasm-unsafe-eval' 'unsafe-eval';
```

becomes:

```
script-src 'nonce-${nonce}' 'wasm-unsafe-eval' 'unsafe-eval';
worker-src ${webview.cspSource};
```

This is the only change required to allow the worker to load from a `vscode-resource:` URI.

### ProseMirror Plugin (spellCheck.ts)

The plugin exports a singleton `spellCheckPlugin` so the context menu handler can call `spellCheckPlugin.getState(view.state).find(pos, pos)` to retrieve decoration metadata.

Decoration creation:

```ts
Decoration.inline(from, to, { class: 'spell-error' }, { suggestions: string[], word: string })
//                           ^ DOM attrs              ^ spec (not rendered, metadata only)
```

No-scan zones are implemented as a node predicate evaluated during `doc.nodesBetween`:

- Skip if `node.type.name` is in `{ codeBlock, codeBlockLowlight, frontmatterBlock, mermaid }`
- Skip if any mark in `node.marks` has `type.name === 'code'`
- Skip text matching URL regex, email regex, or `[[...]]` wiki-link pattern

### Context Menu Integration (editor.ts)

Inside the existing `contextMenuHandler` at line ~1450, add a new branch **before** the existing table/image/text checks:

```ts
const spellEl = target.closest('.spell-error') as HTMLElement | null;
if (spellEl && target.closest('.ProseMirror')) {
  e.preventDefault();
  const coords = { left: e.clientX, top: e.clientY };
  const hit = editorInstance.view.posAtCoords(coords);
  if (hit) {
    const decos = spellCheckPlugin.getState(editorInstance.state)?.find(hit.pos, hit.pos);
    if (decos?.length) {
      spellContextMenuCtrl?.show(e.clientX, e.clientY, decos[0].spec);
      return;
    }
  }
}
```

### No-Scan Zone: URLs and Wiki-Links

Applied at text-node level (not block level). Before sending a text node to the worker, the scanner replaces matches for the following patterns with spaces (preserving offsets):

- URLs: `/https?:\/\/\S+/g`
- Emails: `/[\w.+-]+@[\w-]+\.[a-z]{2,}/gi`
- Wiki-links: `/\[\[.*?\]\]/g`

Replacing with equal-length spaces keeps all character offsets valid for mapping error positions back to the document.

### Initial Scan Trigger

After the worker acknowledges `INIT` (sends back a `{ type: 'READY' }` message), the plugin performs a full scan by calling the scanner over the entire document range `(0, doc.content.size)`. This is chunked: paragraphs are batched into groups of 50 and posted sequentially to the worker, yielding between batches via `setTimeout(fn, 0)` to keep the event loop responsive.

### User Dictionary Storage

- Path: `context.globalStorageUri.fsPath + '/user_dictionary.dic'`
- Format: UTF-8, one word per line, no blank lines
- On extension activation: `spellHandlers.ts` sets up a `vscode.workspace.createFileSystemWatcher` on this path. On change/create events, it reads the file and posts `SPELL_RELOAD` to all active webviews.

---

## Implementation Decisions

*Confirm before coding. Reply with choices or "all good".*

**Decision 1 — nspell bundle size**: nspell + en-US dictionary adds ~2.5 MB to the worker bundle (dic file is large).

- [x] **A**: Bundle dic/aff as separate `fetch()`-ed files (keeps worker bundle small, two extra HTTP round-trips to `vscode-resource:`)
- [ ] **B**: Inline dic/aff as base64 strings in the worker bundle (single bundle, larger download, but only loaded once per session)

- Recommendation: **A** — dictionary files are static assets already in `resources/dictionaries/`; fetching them is the established pattern in this codebase (matches how images and fonts are served)

**Decision 2 — Ignore (session) storage**: Where are session-ignored words tracked?

- [x] **A**: In-memory `Set<string>` inside the ProseMirror plugin state (lost on panel hide/show, simplest)
- [ ] **B**: In `sessionStorage` (survives panel re-renders, lost when VS Code closes)

- Recommendation: **A** — session ignore is explicitly transient per the spec; a `Set` is zero-overhead

**Decision 3 — Suggestion count**: Worker returns how many suggestions per word?

- [x] **A**: Top 3 from nspell (fast, matches UI spec)
- [ ] **B**: Top 5 (more options, slightly slower)

- Recommendation: **A** — spec says "up to 3 suggestions"; computing more wastes cycles