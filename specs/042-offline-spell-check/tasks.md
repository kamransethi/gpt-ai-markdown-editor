# Tasks: Offline Spell Check

**Input**: `specs/042-offline-spell-check/`
**Prerequisites**: plan.md ✅, spec.md ✅

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1=underlines while typing, US2=right-click corrections, US3=contraction handling, US4=manual dictionary edit)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Build pipeline, dependencies, dictionary assets, message protocol

- [x] T001 Install `nspell` npm dependency in package.json
- [x] T002 Download and place `en-US.aff` and `en-US.dic` into `resources/dictionaries/`
- [x] T003 Add `spellcheck-worker` esbuild entry point in `scripts/build-webview.js`
- [x] T004 [P] Add `SPELL_INIT`, `SPELL_ADD_WORD`, `SPELL_RELOAD` to `src/shared/messageTypes.ts`
- [x] T005 [P] Add `gptAiMarkdownEditor.spellCheck.enabled` and `gptAiMarkdownEditor.spellCheck.language` config contributions and `openUserDictionary` command to `package.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Worker, host handler, CSP fix, and SPELL_INIT wiring — must be complete before any scanning can work

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T006 Create `src/webview/spellchecker.worker.ts` — handles `INIT`, `CHECK`, `UPDATE_USER_WORDS` messages; uses nspell; returns `RESULTS` with `SpellError[]` including pre-computed suggestions (top 3)
- [x] T007 Create `src/editor/handlers/spellHandlers.ts` — registers `SPELL_ADD_WORD` handler (appends word to `user_dictionary.dic` in `globalStorageUri`), sets up `FileSystemWatcher` on the dic file, posts `SPELL_RELOAD` with updated `userWords[]` to all active webviews on file change, exposes `sendSpellInit()` helper
- [x] T008 Modify `src/editor/MarkdownEditorProvider.ts` — (1) add `worker-src ${webview.cspSource};` to CSP meta tag in `getHtmlForWebview()`; (2) inject `window.SPELLCHECK_WORKER_URL` via a nonce-guarded inline script; (3) register `spellHandlers` with the router; (4) call `sendSpellInit()` inside the `READY` message handler
- [x] T009 [P] Implement `openUserDictionary` command in `src/extension.ts` — reads/creates `user_dictionary.dic` in `globalStorageUri`, opens it with `vscode.window.showTextDocument`

**Checkpoint**: Worker loads, SPELL_INIT fires on document open, host handler processes SPELL_ADD_WORD

---

## Phase 3: User Story 1 — Underlines while typing (Priority: P1) 🎯 MVP

**Goal**: Misspelled words get red wavy underlines within 500ms of typing stopping; no underlines in code/frontmatter

**Independent Test**: Type "teh" in a paragraph, pause 400ms → red underline appears. Type inside a code block → no underline.

### Implementation for User Story 1

- [x] T010 [US1] Create `src/webview/extensions/spellCheck.ts` — TipTap Extension (SpellCheck) with ProseMirror plugin
- [x] T011 [US1] Implement no-scan zone predicate inside `spellCheck.ts` — codeBlock, code mark, frontmatterBlock, mermaidBlock, drawioBlock, image, hardBreak, horizontalRule
- [x] T012 [US1] Implement text normalisation inside `spellCheck.ts` scanner — smart-quote normalisation + URL/email masking
- [x] T013 [US1] Register `SpellCheck` extension in `src/webview/editor.ts` and wire `SPELL_INIT` / `SPELL_RELOAD` messages
- [x] T014 [US1] Add `.spell-error` CSS rule to `src/webview/editor.css` — SVG wavy red underline

**Checkpoint**: Red underlines appear on misspelled words; code zones are clean

---

## Phase 4: User Story 2 — Right-click corrections (Priority: P1)

**Goal**: Right-clicking a `.spell-error` word shows instant suggestions; clicking one replaces the word (undoable); "Add to Dictionary" works

**Independent Test**: Right-click "teh" underline → menu shows "the" → click it → word replaced → Ctrl+Z restores "teh"

### Implementation for User Story 2

- [x] T015 [US2] Create `src/webview/features/spellCheckMenu.ts` — `tryShowSpellMenu()` shows suggestions + "Add to dictionary"
- [x] T016 [US2] Modify `src/webview/editor.ts` `contextMenuHandler` — add spell-check branch before generic text menu

**Checkpoint**: Right-click on underlined word → spell-check menu; word replacement is undoable

---

## Phase 5: User Story 3 — Contractions (Priority: P2)

**Goal**: Standard English contractions with smart apostrophes (Typography extension) are never underlined

**Independent Test**: Type "don't isn't you're" → no underlines after 400ms

- [x] T017 [US3] Extend normalisation step in `spellCheck.ts` (T012) to replace U+2018 (`‘`, left single quotation mark) and U+2019 (`’`, right single quotation mark) with ASCII `'` (U+0027) — verify nspell accepts the resulting word against the en-US dictionary

**Checkpoint**: No false positives on contractions — covered by T012's normalisation; this task adds an explicit integration verification step

---

## Phase 6: User Story 4 — Manual dictionary editing (Priority: P3)

**Goal**: `openUserDictionary` opens the dic file; saving it triggers live re-check

**Independent Test**: Add "microservices" to dic file via command → save → underline on "microservices" disappears within 2 seconds

- [x] T018 [US4] Verify `openUserDictionary` command (T009) creates the file if it doesn't exist, then opens it with `vscode.window.showTextDocument` in a standard tab
- [x] T019 [US4] Verify `FileSystemWatcher` in `spellHandlers.ts` (T007) fires on `user_dictionary.dic` save, re-reads the file, posts `SPELL_RELOAD { userWords }` to all active webviews
- [x] T020 [US4] Verify the `SPELL_RELOAD` handler in `spellCheck.ts` (T010) sends `UPDATE_USER_WORDS` to the worker and triggers a full re-scan

**Checkpoint**: Save dic file → all open editors re-scan within 2 seconds

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T021 [P] Write `src/__tests__/spellCheck.test.ts` — unit tests: no-scan zone predicate (codeBlock, inlineCode, frontmatter), text normalisation (smart quotes, URL masking, wiki-link masking), decoration creation from SpellError[], cursor exclusion logic
- [x] T022 [P] Write `src/__tests__/spellHandlers.test.ts` — unit tests: `SPELL_ADD_WORD` appends to file, `FileSystemWatcher` callback posts `SPELL_RELOAD`, empty dic file is created if missing
- [x] T023 Verify CSP: load extension in Extension Development Host, open DevTools, confirm no `worker-src` CSP violation in console
- [x] T024 Verify build: `npm run build:debug` succeeds with `dist/spellcheck-worker.js` emitted alongside `dist/webview.js`
- [x] T025 [P] Add `nspell` to `THIRD_PARTY_LICENSES.md`

---

## Dependencies

```
T001 → T006 (nspell must be installed before worker can import it)
T002 → T008 (dic files must exist before SPELL_INIT can resolve URLs)
T003 → T024 (build entry point needed before build verification)
T004 → T006, T007, T008, T013 (message types needed by all parties)
T005 → T009 (command registration needs package.json entry)
T006 → T010 (worker must exist before plugin can post messages to it)
T007 → T008 (handler must exist before provider can register it)
T008 → T013 (SPELL_INIT must be sent before plugin handles it)
T010 → T015, T016 (plugin must export spellCheckPlugin before menu and context handler use it)
T012 → T017 (normalisation step exists before contraction test)
T009 → T018, T019, T020 (command and watcher must exist before verification tasks)
```

## Parallel Opportunities

**After T001–T005 complete**, the following can run in parallel:
- T006 (worker), T007 (host handler), T009 (command)

**After T006–T009 complete**:
- T010, T011, T012, T013, T014 can all be worked on together (same file T010–T012, different files T013, T014)

**After T010–T014 complete**:
- T015 and T016 can proceed in parallel (different files)
- T021 and T022 can proceed in parallel (different test files)

## Implementation Strategy

**MVP scope**: Phase 1 + Phase 2 + Phase 3 (T001–T014) — delivers red underlines with no-scan zones, which is the entire visible value of the feature. Users can see it working before corrections (Phase 4) are added.

**Total tasks**: 25
**Tasks per story**: US1=5, US2=2, US3=1, US4=3, Polish=5, Setup/Foundation=9
