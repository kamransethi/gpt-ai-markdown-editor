# Tasks: WikiLink Autocomplete & Backlinks (046)

**Spec**: [spec.md](spec.md)  
**Plan**: [plan.md](plan.md)  
**Created**: 2026-05-16

---

## Phase 1 — Message Types & Host Infrastructure

### Task 1.1 — Add new message types
**File**: `src/shared/messageTypes.ts`  
**Action**: Add `GET_NOTE_LIST`, `NOTE_LIST_RESULT`, and `FOAM_REINDEX` to the `MessageType` constant.

- [x] Add `GET_NOTE_LIST: 'getNoteList'`
- [x] Add `NOTE_LIST_RESULT: 'noteListResult'`
- [x] Add `FOAM_REINDEX: 'foamReindex'`

---

### Task 1.2 — Export `reindexWorkspace` from foamAdapter
**File**: `src/features/foam/foamAdapter.ts`  
**Action**: Add and export a `reindexWorkspace()` async function that rebuilds `_snapshot` using the same globs as `initFoamAdapter`, without resetting the watcher.

- [x] Implement `export async function reindexWorkspace(): Promise<void>`
- [x] Guard: return immediately if `_snapshot` is null (adapter not yet initialized)

---

### Task 1.3 — Send backlinks on READY
**File**: `src/editor/MarkdownEditorProvider.ts`  
**Action**: In the `MessageType.READY` handler, after calling `updateWebview` and `sendSpellInit`, dispatch a `FOAM_BACKLINKS_UPDATE` message with backlinks for the current document.

- [x] Import `getBacklinks` if not already imported (already is — line 24)
- [x] Add backlink dispatch in the `READY` handler

---

### Task 1.4 — Handle GET_NOTE_LIST in host
**File**: `src/editor/MarkdownEditorProvider.ts`  
**Action**: Add a `MessageType.GET_NOTE_LIST` case in the message switch that reads the Foam snapshot and returns a slimmed `NOTE_LIST_RESULT`.

- [x] Import `getFoamSnapshot` (check if already imported)
- [x] Add `case MessageType.GET_NOTE_LIST:` with `getFoamSnapshot()` read and message dispatch

---

### Task 1.5 — Handle FOAM_REINDEX in host
**File**: `src/editor/MarkdownEditorProvider.ts`  
**Action**: Add a `MessageType.FOAM_REINDEX` case that calls `reindexWorkspace()` and then sends updated backlinks.

- [x] Import `reindexWorkspace` from `foamAdapter`
- [x] Add `case MessageType.FOAM_REINDEX:` with reindex + backlink dispatch

---

## Phase 2 — WikiLink TipTap Extension Registration

### Task 2.1 — Register WikiLink + wikilinkMarkedExtension in Markdown parser
**File**: `src/webview/editor.ts`  
**Action**:
1. Import `WikiLink`, `WikiLinkSuggest` (to be created in Task 2.2), and `wikilinkMarkedExtension` from `./extensions/wikilink`
2. Create a fresh `Marked` instance with the wikilink extension registered via `.use()`
3. Pass that Marked instance to `Markdown.configure` instead of the bare `new Marked()`
4. Add `WikiLink` and `WikiLinkSuggest` to the `rawExtensions` array (before `Markdown`)
5. Add `NOTE_LIST_RESULT` and `FOAM_REINDEX` message handler calls (see Task 2.3)

- [x] Add import line for `WikiLink`, `WikiLinkSuggest`, `wikilinkMarkedExtension`
- [x] Create `markedWithWikilinks` instance and call `.use({ extensions: [wikilinkMarkedExtension] })`
- [x] Replace `new Marked()` in `Markdown.configure` with `markedWithWikilinks`
- [x] Add `WikiLink` to `rawExtensions` before `Markdown`
- [x] Add `WikiLinkSuggest` to `rawExtensions` before `Markdown`

---

### Task 2.2 — Implement WikiLinkSuggest extension
**File**: `src/webview/extensions/wikilink.ts`  
**Action**: Create and export a `WikiLinkSuggest` TipTap `Extension` that uses `@tiptap/suggestion` to:
- Trigger on `[[`
- Request note list from host (`GET_NOTE_LIST`) on first open, cache result
- Listen for `NOTE_LIST_RESULT` message and update cache
- Filter notes by query as user types
- Render a positioned dropdown with keyboard navigation (ArrowUp/Down/Enter/Escape)
- On selection, replace the `[[query` range with a `WikiLink` node

Sub-tasks:
- [x] Import `Extension` from `@tiptap/core` and `Suggestion` from `@tiptap/suggestion`
- [x] Add module-scope `_noteCache` array and `updateCachedNoteList()` export
- [x] Implement `buildSuggestionRenderer()` — creates/updates/destroys a `<div>` dropdown
- [x] Implement `WikiLinkSuggest` using `Suggestion(...)` in `addProseMirrorPlugins`
- [x] Export `WikiLinkSuggest`

---

### Task 2.3 — Handle NOTE_LIST_RESULT message in webview
**File**: `src/webview/editor.ts`  
**Action**: In the `window.addEventListener('message', ...)` handler, add a case for `MessageType.NOTE_LIST_RESULT` that calls `updateCachedNoteList(message.notes)`.

- [x] Import `updateCachedNoteList` from `./extensions/wikilink`
- [x] Add `case MessageType.NOTE_LIST_RESULT:` that calls `updateCachedNoteList`

---

## Phase 3 — CSS Styling

### Task 3.1 — Add wikilink styles
**File**: `src/webview/editor.css`  
**Action**: Add CSS for:
- `.wikilink` rendered link (color, dashed underline, hover)
- `.wikilink-dropdown` popup container (background, border, shadow, scroll)
- `.wikilink-dropdown-item` list items (padding, cursor)
- `.wikilink-dropdown-item.selected` / `:hover` highlight
- `.wikilink-dropdown-empty` empty state text

- [x] Add `.wikilink` styles
- [x] Add `.wikilink-dropdown` + child styles

---

## Phase 4 — Playwright Tests

### Task 4.1 — Create Playwright test file
**File**: `src/__tests__/playwright/wikilinks.spec.ts`  
**Action**: Write tests covering all spec acceptance scenarios.

Test list:
- [x] **T1**: Type `[[` → dropdown appears within 300ms (checks `.wikilink-dropdown` visible)
- [x] **T2**: Type `[[Note` → items filtered (checks `.wikilink-dropdown-item` text)
- [x] **T3**: Press Escape → dropdown closes, no wikilink node inserted
- [x] **T4**: Select item (click or Enter) → `[[NoteTitle]]` inserted, dropdown closed
- [x] **T5**: Open file containing `[[Target]]` → element with `data-wikilink="Target"` is visible
- [x] **T6**: Open file containing `[[Target]]` → backlinks section is populated (without tab switch)
- [x] **T7**: Round-trip: load doc with `[[Target]]`, save, read file → `[[Target]]` preserved
- [x] **T8**: Click a wikilink → `OPEN_FILE_LINK` message is sent (check via mock bridge)
- [x] **T9**: Click opens popover edit dialog, allowing editing target & label and saving
- [x] **T10**: Click remove button inside popover edit dialog deletes the wikilink node

### Task 4.2 — Run tests interactively
**Action**: Run the wikilink Playwright tests

- [x] All T1–T10 tests pass
- [x] No regressions in existing test suite

---

## Phase 5 — Validation & Commit

### Task 5.1 — Build and lint check
- [x] `npm run build:debug` — no errors
- [x] `npm run lint` — no new lint errors

### Task 5.2 — Manual smoke test in VS Code
- [x] Open a markdown file, type `[[` → dropdown appears
- [x] Select a note → wikilink inserted
- [x] Open file with `[[...]]` → renders as link
- [x] Click link → target note opens
- [x] Open Inspector → Backlinks populated immediately
- [x] Run reindex command → works without error

### Task 5.3 — Commit
- [x] Commit all work to the main branch
