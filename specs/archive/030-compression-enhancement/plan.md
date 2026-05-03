# Implementation Plan: Compression Enhancement

**Folder**: `specs/030-compression-enhancement/plan.md` | **Date**: 2026-04-26 | **Spec**: [spec.md](file:///c:/Apps/GitHub/gpt-ai-markdown-editor/specs/030-compression-enhancement/spec.md)
**Status**: Draft → Approved ✅

## Summary

Enhance the existing markdown compression feature by providing granular control over different compression techniques. We will introduce a new "COMPRESSION" group in settings and add toggles for table minification and blank line collapsing. The implementation will ensure that code blocks and literal text are strictly preserved.

## Stack

**Language/Runtime**: TypeScript 5.9, Node.js 25+
**Key deps**: @tiptap/core
**Testing**: Jest + ts-jest

## Phases

**Phase 1 — Schema & Configuration**: Add new settings to `package.json` and synchronize them through the extension host to the webview.
- Files:
  - `package.json`: Add `compressTables` and `trimBlankLines` settings; deprecate `compressContent`.
  - `src/editor/SettingsPanel.ts`: Update `SETTING_KEYS`.
  - `src/editor/MarkdownEditorProvider.ts`: Update `getWebviewSettings` and config change watcher.
- Tests: Update `__tests__/extension/settingsPersistence.test.ts`.

**Phase 2 — UI Updates**: Reorganize the settings panel to show the new "COMPRESSION" heading and granular toggles.
- Files:
  - `src/webview/settings/settingsPanel.ts`: Add "COMPRESSION" group to the `editor` page definition.
- Tests: Update `src/__tests__/webview/settingsPanel.test.ts` (if exists).

**Phase 3 — Compression Logic Refinement**: Update the compression transformer to handle granular flags and improve blank line collapsing.
- Files:
  - `src/webview/utils/markdownSerialization.ts`: Refactor `compressMarkdown` and `getEditorMarkdownForSync` to accept granular flags.
  - `src/webview/editor.ts`: Update calls to `getEditorMarkdownForSync`.
- Tests: Add unit tests in `src/__tests__/webview/markdownSerialization.test.ts` for granular compression.

## Files

| File | Action | Purpose |
|------|--------|---------|
| `package.json` | MODIFY | Define new granular compression settings. |
| `src/editor/SettingsPanel.ts` | MODIFY | Register new setting keys for sync. |
| `src/editor/MarkdownEditorProvider.ts` | MODIFY | Pass new settings to webview. |
| `src/webview/settings/settingsPanel.ts` | MODIFY | Add "COMPRESSION" group to UI. |
| `src/webview/utils/markdownSerialization.ts` | MODIFY | Implement granular compression logic. |
| `src/webview/editor.ts` | MODIFY | Pass granular settings to serializer. |
| `src/__tests__/webview/markdownSerialization.test.ts` | MODIFY | Add tests for new compression features. |

## Key Risks

| Risk | Cause | Mitigation |
|------|-------|-----------|
| Data Corruption in Code Blocks | Regex-based compression accidentally matching code content. | Use the existing segmenting logic that splits by fences and skips odd-indexed segments. |
| Breaking Table Syntax | Aggressive trimming removing necessary pipes. | Use cell-based splitting and joining to ensure pipe integrity. |
| Setting Sync Lag | New settings not immediately updating the webview. | Ensure `onDidChangeConfiguration` in `MarkdownEditorProvider` includes all new keys. |

## Implementation Decisions

**Decision 1 — Master Toggle**: Should we keep a "Master" toggle?
- **A**: Keep `compressContent` as a master toggle that must be ON for others to work.
- **B**: Replace it entirely with granular toggles (each works independently).
- Recommendation: **B** — Users want direct control. We can keep `compressContent` as a legacy alias or just migrate to the new ones. I'll implement them as independent toggles under the "COMPRESSION" heading.

**Decision 2 — Blank Line Normalization**: What is the "redundant" threshold?
- **A**: Collapse 3+ to 2 (`\n\n\n` -> `\n\n`).
- **B**: Collapse 2+ to 1 (`\n\n` -> `\n`). This is too aggressive and breaks Markdown paragraph separation.
- Recommendation: **A** — Collapse multiple blank lines to a single blank line (which is `\n\n` in the output string).
