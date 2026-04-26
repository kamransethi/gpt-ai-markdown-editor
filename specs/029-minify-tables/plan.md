# Implementation Plan: Minify Markdown

**Folder**: `specs/029-minify-tables/` | **Date**: 2026-04-25 | **Spec**: [spec.md](./spec.md)
**Status**: Draft

## Summary

Add a new editor setting `Compress Content` under `Editor > Behavior` that is OFF by default. When enabled, Markdown serialization will emit compressed table syntax and trim non-visible formatting such as excessive blank lines and whitespace around delimiters without changing the visual rendering of the document.

## Stack

- Language/Runtime: TypeScript, Node.js
- VS Code extension host + Webview-based TipTap editor
- Key deps: `@tiptap/core`, `@tiptap/markdown`, `markdown-it`, `turndown`
- Testing: Jest + jsdom

## Phases

### Phase 1 — Configuration and UI

- Add the new `gptAiMarkdownEditor.compressContent` configuration property to `package.json`.
- Expose the setting in the webview settings UI under `Editor > Behavior` with label `Compress Content`.
- Ensure the setting is persisted via `src/editor/SettingsPanel.ts` and loaded by the extension host.
- Make the setting available to the webview through `MarkdownEditorProvider.getWebviewSettings()` and the configuration change watcher.

### Phase 2 — Markdown serialization

- Wire the new setting into the webview editor runtime via `src/webview/editor.ts`.
- Implement a markdown post-processing transformer in `src/webview/utils/markdownSerialization.ts` that:
  - compresses Markdown table rows by removing alignment padding and unnecessary spaces around pipe delimiters,
  - trims redundant blank lines outside fenced code blocks,
  - preserves code fences, indented code, and literal text exactly.
- Apply the transformer only when `Compress Content` is enabled.

### Phase 3 — Tests and validation

- Add unit tests for the compression transformer, including table formatting, blank-line trimming, and fenced code preservation.
- Add extension-level tests for the new setting key and settings persistence.
- Add settings UI coverage to ensure the option appears on the Editor page and defaults to OFF.

## Files


| File                                                  | Action | Purpose                                                                                                     |
| ----------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------- |
| `package.json`                                        | MODIFY | Add `gptAiMarkdownEditor.compressContent` configuration schema so VS Code persists the toggle.              |
| `src/webview/settings/settingsPanel.ts`               | MODIFY | Add the `Compress Content` setting under `Editor > Behavior`.                                               |
| `src/editor/SettingsPanel.ts`                         | MODIFY | Add `compressContent` to `SETTING_KEYS` so the settings panel reads/writes it.                              |
| `src/editor/MarkdownEditorProvider.ts`                | MODIFY | Add the new setting to `getWebviewSettings()` and config change watch list so the webview receives updates. |
| `src/webview/editor.ts`                               | MODIFY | Apply the new setting into webview runtime state and expose it to serialization logic.                      |
| `src/webview/utils/markdownSerialization.ts`          | MODIFY | Implement conditional markdown compression and route output through the new transformer.                    |
| `src/__tests__/webview/markdownSerialization.test.ts` | CREATE | Validate table compression, blank-line trimming, and fenced block preservation.                             |
| `src/__tests__/extension/settingsPersistence.test.ts` | MODIFY | Verify `gptAiMarkdownEditor.compressContent` persistence and update flow.                                   |
| `src/__tests__/webview/settingsPanel.test.ts`         | CREATE | Verify the Editor Behavior UI includes the new toggle and defaults to OFF.                                  |


## Key Risks


| Risk                            | Cause                                                                  | Mitigation                                                                                                           |
| ------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Markdown rendering diverges     | Over-aggressive whitespace compression can alter table or list parsing | Restrict compression to non-visible whitespace and preserve fenced/literal blocks; validate with Markdown renderers. |
| Setting not persisted           | Config key missing from package schema or settings router              | Add the key to `package.json`, `SETTING_KEYS`, provider settings, and config watcher.                                |
| Webview state mismatch          | `Compress Content` not sent to webview after config change             | Include it in `getWebviewSettings()` and the `onDidChangeConfiguration` watched keys list.                           |
| Unexpected editor save behavior | Serialized markdown changes while editing due to real-time compression | Keep the feature OFF by default and only enable compression after user opt-in.                                       |


## Implementation Decisions

**Decision 1 — Runtime Scope:**

- [ ] **A**: Apply compression to every editor markdown serialization path (saving/exporting content compressed when enabled).
- [ ] **B**: Only compress on explicit export actions.

- Recommendation: **A** — Keeps the saved document consistent with the enabled setting and reduces token usage for all persisted Markdown.

**Decision 2 — Compression method:**

- [ ] **A**: Modify the TipTap markdown serializer/AST directly.
- [ ] **B**: Post-process the serialized markdown string after `getEditorMarkdownForSync()`.

- Recommendation: **B** — Safer integration point in this codebase and easier to preserve fences and literal blocks.

**Decision 3 — Compression scope:**

- [ ] **A**: Compress only table padding and alignment.
- [ ] **B**: Compress tables plus redundant blank lines and delimiter whitespace, without changing visible rendering.

- Recommendation: **B** — Matches the clarified feature scope and delivers broader LLM token savings.