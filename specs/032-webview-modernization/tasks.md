# Implementation Tasks: Webview Modernization

**Folder**: `specs/032-webview-modernization/tasks.md`

## Phase 1: Setup

*(No project initialization or setup tasks required for this feature)*

## Phase 2: FR-006 — Web-Paste Regression Fix [US5]

**Goal**: Fix silent paste drop when clipboard has both `text/html` and binary `image/*` MIME types.
**Independent Test**: Copy a webpage section with inline images and paste — text content appears, uploads are queued.

- [ ] T001 [US5] Add `hasOnlyImageContent(clipboardData)` helper to `src/webview/utils/pasteHandler.ts` — returns `true` only when zero `text/html` items exist and at least one `image/*` item exists
- [ ] T002 [US5] Expose `queueImageFromUrl(editor, url)` from `src/webview/features/imageDragDrop.ts` for routing web-pasted `<img src>` URLs through the upload flow
- [ ] T003 [US5] Modify `src/webview/features/clipboardHandling.ts`: replace `if (result.isImage) return` guard with `if (result.isImage && hasOnlyImageContent(clipboardData)) return`; after HTML insert, extract `<img src>` URLs from HTML, strip `<img>` tags from HTML payload, then call `queueImageFromUrl` for each URL
- [ ] T004 [US5] Extend `src/__tests__/webview/paste-handling.test.ts` with:
  - `it('processes HTML when clipboard has both text/html and image/png')`
  - `it('routes to image-upload when clipboard is pure image/png with no text/html')`
  - `it('extracts img src URLs from pasted HTML and queues each for upload')`
  - `it('strips img tags from HTML before TipTap insertion to avoid double-insert')`

## Phase 3: FR-002 — Native Image Placeholders [US2]

**Goal**: Use ProseMirror `DecorationSet` for upload placeholders instead of DOM-scraping.
**Independent Test**: Drop image and immediately type text — final image appears at original drop position.

- [ ] T005 [US2] Create `src/webview/extensions/imageUploadPlugin.ts`: TipTap extension managing `DecorationSet` plugin state; exports `addUploadDecoration(editor, pos, id)`, `resolveUploadDecoration(editor, id, imageAttrs)`, `cancelUploadDecoration(editor, id)`; plugin `apply()` maps all stored positions through `tr.mapping.map(pos)` each transaction
- [ ] T006 [US2] Refactor `insertImage()` in `src/webview/features/imageDragDrop.ts` to call `addUploadDecoration` instead of inserting `<img data-placeholder-id>`; on upload complete call `resolveUploadDecoration`; on abort/cancel call `cancelUploadDecoration`
- [ ] T007 [US2] In plugin `apply()`, detect if a decoration's mapped position was deleted (`mapResult.deleted`) and call `cancelUploadDecoration` for that id → triggers `AbortController.abort()` on the in-flight upload
- [ ] T008 [US2] Create `src/__tests__/webview/imagePlaceholder.test.ts`:
  - `it('adds widget decoration at drop pos without mutating the document')`
  - `it('replaces decoration with real image at correct mapped pos after concurrent typing')`
  - `it('cancels upload when user deletes placeholder range')`
  - `it('maps placeholder pos correctly when text is typed before it')`

## Phase 4: FR-004 — Unified Event Pipeline [US4]

**Goal**: Move drop/paste event routing into TipTap `editorProps` instead of `view.dom` listeners.
**Independent Test**: Drag file into a table cell — correct handler fires with no event collision.

- [ ] T009 [US4] In `src/webview/editor.ts`, extend `editorProps` with `handleDrop(view, event, slice, moved)` and `handlePaste(view, event, slice)` — move routing logic from `imageDragDrop.ts` DOM listeners here; return `true` when event is handled to stop ProseMirror default
- [ ] T010 [US4] In `src/webview/features/imageDragDrop.ts`, remove `view.dom.addEventListener('drop')` and `view.dom.addEventListener('paste')` calls from `setupImageDragDrop()`; keep upload queue init and `queueImageFromUrl` export
- [ ] T011 [US4] Extend `src/__tests__/webview/paste-handling.test.ts`:
  - `it('handleDrop in editorProps is called for file drops; no global window listener registered')`
  - `it('handlePaste in editorProps processes image files without window-level paste listener')`

## Phase 5: FR-001 — Reactive Settings Panel [US1]

**Goal**: Replace querySelector-based state binding with a typed state model.
**Independent Test**: Open settings panel — toggling any setting updates UI without querySelector calls during render.

- [ ] T012 [US1] Create `src/webview/settings/settingsState.ts`: export `SettingsState` interface (all setting keys typed), `createDefaultState(): SettingsState`, and `applyConfiguration(state: SettingsState, config: Partial<SettingsState>): SettingsState`
- [ ] T013 [US1] Refactor `src/webview/settings/settingsPanel.ts` render pipeline: pass `SettingsState` as sole input to `render(state)`; remove all `querySelector`/`querySelectorAll` calls used for state-reading; renderers read from state object only
- [ ] T014 [US1] Wire reload re-hydration: on init, call `render(createDefaultState())` synchronously, then `vscode.postMessage({type:'GET_CONFIGURATION'})`; on `configuration` message received, call `render(applyConfiguration(currentState, config))`
- [ ] T015 [US1] Replace scattered `setTimeout(fn, 400)` debounce wrappers with a single shared `debounce(fn, delay)` utility (add to `src/webview/utils/debounce.ts` or inline in settingsPanel)
- [ ] T016 [US1] Create `src/__tests__/webview/settingsPanel-reactive.test.ts`:
  - `it('render() never calls document.querySelector or querySelectorAll')`
  - `it('conditional sections respond to state changes without DOM reads')`
  - `it('on empty-state reload: renders defaults then dispatches exactly one GET_CONFIGURATION message')`
  - `it('applyConfiguration merges partial config over defaults without overwriting unrelated keys')`

## Phase 6: FR-003 — AST-Based Export Serialization [US3]

**Goal**: Replace `cloneNode(true)` + CSS-class-based DOM queries with `doc.descendants()` traversal.
**Independent Test**: Export a 100-image document — no UI freeze, no cloneNode call in profile.

- [ ] T017 [US3] Create `src/webview/utils/docSerializer.ts`: export `serializeDocToHtml(doc: PMNode, options?: SerializeOptions): string`; walk `doc.descendants()`, emit HTML per node type — `image` → `<img src="${attrs.src}">`, `mermaidBlock` → `<img data-mermaid-id="${attrs.id}">`, `rawHtml` → raw `attrs.raw` string, all others → standard HTML tags
- [ ] T018 [US3] Refactor `collectExportContent()` in `src/webview/utils/exportContent.ts`: call `serializeDocToHtml(editor.state.doc)` instead of `editorElement.cloneNode(true)`; remove the `querySelectorAll('.mermaid-split-wrapper')`, `querySelectorAll('.raw-html-tag')`, `querySelectorAll('img')` chain; keep `svgToPng()` unchanged
- [ ] T019 [US3] Create `src/__tests__/webview/exportContent-ast.test.ts`:
  - `it('serializeDocToHtml produces correct HTML from a doc with text, headings, and images')`
  - `it('collectExportContent never calls cloneNode')` — spy on `Element.prototype.cloneNode`
  - `it('mermaid blocks are emitted as img with data-mermaid-id, not by CSS class query')`
  - `it('raw HTML nodes use node.attrs.raw, not DOM data-raw attribute reads')`

## Phase 7: FR-005 — BaseOverlay Framework [US1/Edge Cases]

**Goal**: Unified overlay lifecycle with automatic focus-return stack.
**Independent Test**: Open Table Insert → close → cursor is back in editor at pre-open position.

- [ ] T020 [US5] Create `src/webview/overlays/BaseOverlay.ts`: class with `open(triggerEl?: Element)` (saves `document.activeElement`, mounts overlay, sets up focus trap), `close()` (unmounts, restores saved focus); module-level `overlayStack: Array<{overlay, savedFocus}>` for nested overlay support; `close()` pops stack and restores to previous entry's savedFocus
- [ ] T021 [US5] Refactor `src/webview/features/tableInsert.ts` to use `BaseOverlay`: extend or compose; replace `document.body.appendChild` + manual focus with `super.open()` / `super.close()`; remove `focusEditor()` try-catch
- [ ] T022 [US5] Refactor `src/webview/features/searchOverlay.ts` to use `BaseOverlay` for DOM lifecycle; keep ProseMirror search plugin and `DecorationSet` logic unchanged
- [ ] T023 [US5] Refactor `src/webview/features/tocOverlay.ts` to use `BaseOverlay` for DOM lifecycle; keep heading navigation logic unchanged
- [ ] T024 [US5] Create `src/__tests__/webview/baseOverlay.test.ts`:
  - `it('open() saves activeElement; close() restores it')`
  - `it('closing inner overlay restores focus inside outer overlay (nested stack)')`
  - `it('closing outer overlay restores focus to pre-open trigger element')`
  - `it('event listeners registered on overlay content are removed on close()')`

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T025 Run `npm test` — all existing tests pass with no regressions
- [ ] T026 Verify `SC-005`: run paste-handling tests with mixed clipboard fixture, assert upload queue mock called
- [ ] T027 Verify `SC-006`: run settingsPanel-reactive test for empty-state reload, assert exactly one GET_CONFIGURATION dispatched
- [ ] T028 Verify `SC-002`: run imagePlaceholder tests — no "placeholder not found" errors, cancellation clean
- [ ] T029 Verify `SC-003`: run exportContent-ast tests — cloneNode spy never called

## Dependencies

- T002 must precede T003 (queueImageFromUrl must exist before clipboardHandling uses it)
- T005 must precede T006 (plugin must exist before imageDragDrop uses it)
- T009, T010 are sequential (add editorProps hooks, then remove DOM listeners)
- T012 must precede T013, T014 (settingsState.ts must exist before settingsPanel uses it)
- T017 must precede T018 (docSerializer must exist before exportContent uses it)
- T020 must precede T021, T022, T023 (BaseOverlay must exist before overlays use it)
- T025–T029 must run after all functional phases complete

## Implementation Strategy

Ship phases in priority order: FR-006 first (unblocks active paste regression), then FR-002 (SC-002 reliability), then FR-004 (event cleanup), then FR-001 (SC-001 settings), then FR-003 (SC-003 export), then FR-005 (SC-005 overlay UX). Each phase is independently testable. Run `npm test` after each phase to catch regressions early.
