# Tasks: Compression Enhancement

**Input**: `spec.md`, `plan.md`

## Phase 1: Configuration & Schema

- [ ] T001 Add `gptAiMarkdownEditor.compressTables` (boolean, default false) to `package.json`.
- [ ] T002 Add `gptAiMarkdownEditor.trimBlankLines` (boolean, default false) to `package.json`.
- [ ] T003 [P] Add `compressTables` and `trimBlankLines` to `SETTING_KEYS` in `src/editor/SettingsPanel.ts`.
- [ ] T004 [P] Update `MarkdownEditorProvider.getWebviewSettings()` in `src/editor/MarkdownEditorProvider.ts` to include the new keys.
- [ ] T005 [P] Update the configuration change watcher in `src/editor/MarkdownEditorProvider.ts` to trigger on the new keys.

## Phase 2: UI Implementation

- [ ] T006 [P] Add a new `SettingGroup` titled "COMPRESSION" to the `editor` page in `src/webview/settings/settingsPanel.ts`.
- [ ] T007 [P] Move/Add toggles for `compressTables` and `trimBlankLines` into the new "COMPRESSION" group.
- [ ] T008 [P] Remove the old `compressContent` toggle from the "Behavior" group in `src/webview/settings/settingsPanel.ts`.

## Phase 3: Core Logic (Serialization)

- [ ] T009 Refactor `src/webview/utils/markdownSerialization.ts` `compressMarkdown` to accept an options object: `{ compressTables: boolean; trimBlankLines: boolean }`.
- [ ] T010 [P] Implement `trimBlankLines` logic: collapse `\n{3,}` to `\n\n` outside code blocks and trim leading/trailing whitespace from the final string.
- [ ] T011 [P] Ensure `compressTables` only applies table minification when enabled.
- [ ] T012 [P] Update `getEditorMarkdownForSync` signature and calls to pass the granular flags.
- [ ] T013 [P] Update `src/webview/editor.ts` to pass the correct flags from the runtime settings.

## Phase 4: Testing & Validation

- [ ] T014 [P] Create/Update unit tests in `src/__tests__/webview/markdownSerialization.test.ts` for:
    - Tables only compression.
    - Blank lines only compression.
    - Both enabled.
    - Neither enabled.
    - Code block preservation.
- [ ] T015 [P] Verify settings persistence in `src/__tests__/extension/settingsPersistence.test.ts`.
- [ ] T016 [P] Manual verification of the new "COMPRESSION" heading in the settings UI.

## Phase 5: Cleanup

- [ ] T017 Remove `compressContent` from `package.json` and any other references if no longer needed (deprecate it).
- [ ] T018 Run full test suite and ensure no regressions.
