# Tasks: Minify Markdown

**Input**: `spec.md`, `plan.md`

## Phase 1: Setup

**Purpose**: Add the new setting schema and ensure configuration can flow from VS Code into the webview.

- [ ] T001 Add `gptAiMarkdownEditor.compressContent` to `package.json` with type `boolean`, default `false`, and a description under the extension configuration schema.
- [ ] T002 [P] Add `compressContent` to `src/editor/SettingsPanel.ts` `SETTING_KEYS` so VS Code settings reads and writes the key.
- [ ] T003 [P] Add `compressContent` to `MarkdownEditorProvider.getWebviewSettings()` in `src/editor/MarkdownEditorProvider.ts`.
- [ ] T004 [P] Extend the VS Code config change watcher in `src/editor/MarkdownEditorProvider.ts` to send `compressContent` updates to the webview when the setting changes.
- [ ] T005 [P] Add `compressContent` handling to `src/webview/editor.ts` `applyWebviewSettings()` so the webview runtime receives the setting.

---

## Phase 2: Foundational

**Purpose**: Implement the core markdown compression pipeline and enable it only when the feature is enabled.

- [ ] T006 Create or extend the transformer in `src/webview/utils/markdownSerialization.ts` to compress markdown output when `compressContent` is enabled.
- [ ] T007 [P] Add a post-processing hook in `src/webview/utils/markdownSerialization.ts` or `src/webview/editor.ts` to route `getEditorMarkdownForSync()` output through the compression transformer.
- [ ] T008 [P] Ensure the compressor preserves fenced code blocks, indented code, and literal text by skipping compression inside those blocks.

---

## Phase 3: User Story 1 - Enable compressed table formatting (Priority: P1)

**Goal**: Compress Markdown table output by removing padding and aligned-column spacing without changing rendered appearance.

**Independent Test**: Enable `Compress Content`, serialize a markdown table, and verify the resulting markdown uses compact pipes and no padding while rendering identically in a standard markdown preview.

- [ ] T009 [P] Add unit tests in `src/__tests__/webview/markdownSerialization.test.ts` for compressed table output that removes alignment whitespace.
- [ ] T010 Implement table cell padding compression in `src/webview/utils/markdownSerialization.ts`.
- [ ] T011 Verify that compressed table markdown still renders equivalent table layout in standard markdown renderers.

---

## Phase 4: User Story 2 - Preserve non-table visual rendering (Priority: P2)

**Goal**: Trim redundant blank lines and tighten delimiter whitespace outside tables while preserving visible document structure.

**Independent Test**: Enable `Compress Content`, serialize a document with headings, lists, and tables, and confirm visible rendering is unchanged while output size is reduced.

- [ ] T012 [P] Add unit tests in `src/__tests__/webview/markdownSerialization.test.ts` for blank-line trimming and delimiter whitespace compression.
- [ ] T013 Implement non-table compression rules in `src/webview/utils/markdownSerialization.ts`, preserving spacing inside fenced code blocks and preformatted text.
- [ ] T014 Verify the compressed output does not alter visible rendering for headings, lists, blockquotes, and other non-table content.

---

## Phase 5: User Story 3 - Configure behavior from Editor > Behavior (Priority: P3)

**Goal**: Surface the new toggle in the Editor settings UI and ensure it persists as OFF by default.

**Independent Test**: Open Editor settings, locate `Compress Content` under Behavior, toggle it, and verify the choice persists.

- [ ] T015 Add the `Compress Content` setting row under `Editor > Behavior` in `src/webview/settings/settingsPanel.ts`.
- [ ] T016 [P] Add or update tests in `src/__tests__/webview/settingsPanel.test.ts` to verify the setting is present and defaults to OFF.
- [ ] T017 [P] Add or update `src/__tests__/extension/settingsPersistence.test.ts` to verify `gptAiMarkdownEditor.compressContent` is persisted when changed.
- [ ] T018 Verify the setting is sent to the webview and that enabling it activates compression in the runtime path.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finish integration, documentation, and validation across the feature.

- [ ] T019 [P] Add inline comments or README notes documenting the `Compress Content` behavior and how it affects saved Markdown.
- [ ] T020 [P] Run `npm test` for the new serialization and settings tests and ensure no regressions.
- [ ] T021 [P] Review the compressor implementation for readability and maintainability in `src/webview/utils/markdownSerialization.ts`.

---

## Dependencies & Execution Order

- Phase 1 must complete before Phase 2.
- Phase 2 must complete before User Story implementation phases.
- User Stories 1, 2, and 3 can proceed in parallel after foundational work is complete.
- Phase 6 is final polish and may run after any story is functionally complete.

## Parallel Opportunities

- `T002`, `T003`, `T004`, and `T005` can be implemented in parallel because they touch separate files.
- `T009` and `T012` can be written in parallel as independent test coverage tasks.
- `T015`, `T016`, and `T017` can be executed in parallel because they target independent UI and persistence validation.
