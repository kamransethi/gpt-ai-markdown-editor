# Tasks: Unified AI Explanation Webview with Markdown Table Support

**Input**: Design documents from `specs/038-unified-ai-webview-markdown/`  
**Plan**: [plan.md](plan.md) | **Spec**: [spec.md](spec.md)  
**Decisions**: A/A/A — Extension-host truncation, incremental rendering, single component file

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story label (US1–US4)

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: Add streaming message types and 4K truncation to extension host before any webview work begins.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T001 Add `AI_EXPLAIN_CHUNK` and `AI_EXPLAIN_DONE` constants to `src/shared/messageTypes.ts`
- [ ] T002 Modify `src/features/aiExplain.ts`: change `for await` loop to stream chunks via `AI_EXPLAIN_CHUNK` messages, enforce 4K character hard-stop (abort generator once `result.length >= 4000`), send `AI_EXPLAIN_DONE` on completion — follow exact pattern from `src/features/fluxflow/chatPanel.ts` lines 155–185

**Checkpoint**: Extension host streams chunks; webview can now receive incremental AI results.

---

## Phase 2: User Story 1 — Markdown Rendering (Priority: P1) 🎯 MVP

**Goal**: Replace `parseExplanation()` with `markdown-it` rendering so tables, lists, headings, and code blocks display correctly.

**Independent Test**: Trigger "Generate Summary" on a document. AI response containing a markdown table (`| Col | Col |`) renders with visible borders and aligned columns in the panel.

- [ ] T003 [US1] Create `src/webview/extensions/aiExplain-unified.ts`: initialise `markdown-it` with `html: false, linkify: true` and `@tiptap/markdown` table support enabled via `md.enable('table')`; export `renderMarkdown(text: string): string` function that calls `md.render(text)`
- [ ] T004 [US1] In `src/webview/extensions/aiExplain-unified.ts`: export `truncateTo4K(text: string): string` that slices at ≤4000 chars on a word boundary (do not cut mid-word)
- [ ] T005 [P] [US1] Replace `parseExplanation()` call inside `handleAiExplainResult()` in `src/webview/extensions/aiExplain.ts` with `renderMarkdown(data.explanation)` imported from `aiExplain-unified.ts`
- [ ] T006 [P] [US1] Replace `parseExplanation()` call inside `handleImageAskResult()` in `src/webview/extensions/aiExplain.ts` with `renderMarkdown(data.response)` from `aiExplain-unified.ts`
- [ ] T007 [US1] Add markdown table CSS to `src/webview/editor.css` under `.ai-explain-body`: `table { border-collapse: collapse; width: 100%; }`, `th, td { border: 1px solid var(--md-border); padding: 6px 12px; text-align: left; }`, `th { background: var(--md-surface-raised); font-weight: 600; }`, `tr:nth-child(even) { background: var(--md-surface-subtle); }`; also ensure `.ai-explain-body { overflow-x: auto; }` for horizontal table scroll
- [ ] T008 [US1] Write failing tests in `src/__tests__/webview/aiExplain.test.ts`: (a) `renderMarkdown` converts `| A | B |` table to `<table>` HTML with `<th>` and `<td>`, (b) bold `**text**` renders as `<strong>`, (c) code block renders as `<pre><code>`, (d) `truncateTo4K` on 5000-char string returns ≤4000 chars and doesn't cut mid-word
- [ ] T009 [US1] Run `npm test -- --testPathPattern=aiExplain` and confirm T008 tests pass

---

## Phase 3: User Story 4 — Streaming to WebView (Priority: P1)

**Goal**: AI responses stream incrementally to the webview panel, first token visible within 300ms of request.

**Independent Test**: Trigger "Generate Summary". Panel shows text appearing word-by-word (not blank then full response). Cancel button halts stream mid-way.

**Dependency**: Requires Phase 1 (T001, T002) complete.

- [ ] T010 [US4] In `src/webview/extensions/aiExplain-unified.ts`: export `createStreamingHandler()` that returns an object with `onChunk(fullText: string): void` (re-renders panel body with `renderMarkdown(fullText)` via `requestAnimationFrame`), `onDone(fullText: string): void`, and `onError(message: string): void`
- [ ] T011 [US4] In `src/webview/extensions/aiExplain.ts`: handle `MessageType.AI_EXPLAIN_CHUNK` message — call `streamingHandler.onChunk(data.fullText)` where `streamingHandler` is created at request start; handle `MessageType.AI_EXPLAIN_DONE` — call `streamingHandler.onDone(data.fullText)` and re-add action buttons
- [ ] T012 [US4] In `src/webview/extensions/aiExplain.ts` `explainDocument` command: replace single-shot result path with streaming path — create streaming handler, show loading state, send `AI_EXPLAIN` message to extension host; loading spinner stays until first chunk arrives
- [ ] T013 [US4] Add cancel/stop button to panel HTML in `showExplainPanel()` in `src/webview/extensions/aiExplain.ts`: `<button class="ai-explain-stop" title="Stop">&#x25A0;</button>` next to close button; clicking it sends `AI_EXPLAIN_STOP` message to extension host and calls `streamingHandler.onDone(currentText)`
- [ ] T014 [US4] Add `AI_EXPLAIN_STOP` to `src/shared/messageTypes.ts`; handle it in `src/features/aiExplain.ts` by calling `abortController.abort()`; wrap generator loop in signal-abort check (already pattern exists in chatPanel.ts)
- [ ] T015 [US4] Write failing tests: (a) `onChunk` called 3× with increasing fullText — panel body reflects latest fullText after each call, (b) `onDone` removes loading state and shows full content, (c) streaming renders markdown incrementally — table not shown until `|` row arrives in fullText
- [ ] T016 [US4] Run `npm test -- --testPathPattern=aiExplain` and confirm T015 tests pass

---

## Phase 4: User Story 2 — Unified Component (Priority: P1)

**Goal**: Single code path serves both text and image operations with no duplication.

**Independent Test**: Trigger "Generate Summary" then right-click image → "Explain Image". Both use the same panel element. Inspect DOM — one `.ai-explain-panel` element present throughout.

**Dependency**: Requires Phase 2 (markdown rendering) and Phase 3 (streaming handler) complete.

- [ ] T017 [US2] In `src/webview/extensions/aiExplain-unified.ts`: export `setTitle(titleText: string): void` and `setFooterModel(modelName: string): void` helper functions that operate on the shared `panelEl`; migrate the inline title-setting code from both `handleAiExplainResult` and `showImageAskLoading` to use these helpers
- [ ] T018 [US2] In `src/webview/extensions/aiExplain.ts`: update `showImageAskLoading()` to call `createStreamingHandler()` from `aiExplain-unified.ts` and store the handler for use when `IMAGE_ASK_RESULT` arrives — eliminates the separate non-streaming path for image results
- [ ] T019 [US2] Delete the standalone `parseExplanation()`, `formatInline()`, and `escapeHtml()` functions from `src/webview/extensions/aiExplain.ts` (now replaced by `renderMarkdown` from `aiExplain-unified.ts`)
- [ ] T020 [P] [US2] Verify `src/webview/extensions/aiExplain.ts` imports: remove any dead imports; ensure only `renderMarkdown`, `createStreamingHandler`, `setTitle`, `setFooterModel`, `truncateTo4K` are imported from `aiExplain-unified.ts`
- [ ] T021 [US2] Write failing tests: (a) after `handleAiExplainResult` and then `handleImageAskResult`, only one `.ai-explain-panel` exists in DOM, (b) panel title changes to `IMAGE_ASK_TITLES[action]` for image operations and "AI Summary" for document operations, (c) image streaming and text streaming both call `renderMarkdown`
- [ ] T022 [US2] Run `npm test -- --testPathPattern=aiExplain` and confirm T021 tests pass

---

## Phase 5: User Story 3 — Copy and Insert Actions (Priority: P2)

**Goal**: Copy button and Insert Below button work consistently from a single implementation for all operation types.

**Independent Test**: After generating a summary, click Copy. `navigator.clipboard.writeText` called with full response text. Button text briefly shows "Copied!".

**Dependency**: Requires Phase 4 (unified component) complete.

- [ ] T023 [US3] Move `addActionsBar()` and `removeActionsBar()` logic from `src/webview/extensions/aiExplain.ts` into `src/webview/extensions/aiExplain-unified.ts`; export `showActions(action: string): void` and `hideActions(): void`
- [ ] T024 [US3] Update `handleAiExplainResult` in `src/webview/extensions/aiExplain.ts` to call `showActions('summary')` after streaming completes; add `'summary'` as a recognised action in `addActionsBar` — show Copy + Insert Below for this action
- [ ] T025 [P] [US3] Verify that image operations (`altText`, `extractText`, `describe`, `explain`, `custom`) all correctly pass their action string to `showActions()` via the unified `handleImageAskResult` path
- [ ] T026 [US3] Write failing tests: (a) `showActions('summary')` renders Copy and Insert Below buttons, (b) `showActions('altText')` renders Copy and Apply Alt Text (not Insert Below), (c) Copy button calls `navigator.clipboard.writeText` with `lastResponseText`, (d) Insert Below calls `editorRef.chain().focus().insertContentAt()`
- [ ] T027 [US3] Run `npm test -- --testPathPattern=aiExplain` and confirm T026 tests pass

---

## Phase 6: Polish & Verification

**Purpose**: CSS cleanup, full regression check, TypeScript compilation clean.

- [ ] T028 [P] Add `max-height: 70vh; overflow-y: auto;` to `.ai-explain-body` in `src/webview/editor.css` to ensure long streaming responses don't overflow the viewport
- [ ] T029 [P] Add `.ai-explain-stop` button CSS to `src/webview/editor.css`: `display: inline-flex; align-items: center; background: none; border: none; cursor: pointer; color: var(--md-foreground); padding: 2px 4px;`; hide button once stream is done via `display: none`
- [ ] T030 Run `npm run build:debug` and confirm zero TypeScript errors
- [ ] T031 Run full test suite `npm test` and confirm all 1000+ tests pass with no regressions
- [ ] T032 [P] Manual smoke test: trigger "Generate Summary" — verify table in response renders with borders; trigger "Explain Image" — verify same panel reuses, markdown renders, copy works

---

## Dependency Graph

```
Phase 1 (T001-T002)
  └─► Phase 2 (T003-T009) — markdown rendering
        └─► Phase 4 (T017-T022) — unified component
              └─► Phase 5 (T023-T027) — copy/insert
  └─► Phase 3 (T010-T016) — streaming
        └─► Phase 4 (T017-T022) — unified component

Phase 2 + Phase 3 can run in parallel after Phase 1 completes.
Phase 6 runs after all phases complete.
```

## Parallel Execution Opportunities

| Parallel Group | Tasks | Condition |
|----------------|-------|-----------|
| Group A | T003, T007 | Phase 1 done; different files |
| Group B | T005, T006 | T003 done; both modify `aiExplain.ts` (serialize within file) |
| Group C | T013, T014 | T010 done; different concerns |
| Group D | T019, T020 | T017 done; cleanup tasks |
| Group E | T028, T029, T032 | All phases done; CSS + manual |

## MVP Scope

**Minimum viable: Phases 1 + 2 (T001–T009)**  
After these 9 tasks: markdown tables render correctly in AI summary panel, 4K truncation active, `renderMarkdown` replaces the broken `parseExplanation`. Streaming and unified component follow in subsequent phases.

## Total

| Phase | Tasks | Story |
|-------|-------|-------|
| Phase 1: Foundation | T001–T002 | — |
| Phase 2: Markdown Rendering | T003–T009 | US1 |
| Phase 3: Streaming | T010–T016 | US4 |
| Phase 4: Unified Component | T017–T022 | US2 |
| Phase 5: Copy/Insert | T023–T027 | US3 |
| Phase 6: Polish | T028–T032 | — |
| **Total** | **32 tasks** | |
