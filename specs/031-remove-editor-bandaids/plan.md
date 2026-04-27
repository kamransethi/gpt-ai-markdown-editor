# Implementation Plan: Remove Editor Bandaids

**Folder**: `specs/031-remove-editor-bandaids/plan.md` | **Date**: 2026-04-26 | **Spec**: [spec.md](./spec.md)
**Status**: Approved ✅

## Summary

This plan outlines the systematic removal of five major "bandaid" implementations that fight native TipTap behavior. By deleting custom regex replacements, massive manual selection handlers, and DOM-walking hacks, we will rely on native TipTap schemas and extensions. This simplifies the codebase significantly and fixes core bugs related to image deletion lag, table formatting, and unexpected copy-paste behavior.

## Stack

**Language/Runtime**: TypeScript 5.3, Node.js 18+  
**Key deps**: `@tiptap/core`, `@tiptap/extension-table`, `@tiptap/extension-table-cell`, `@tiptap/pm`
**Testing**: Jest + jsdom

## Phases

**Phase 1 — [Table Native Rendering]**: Fix Table Bullet Hacks and DOM parsing
- Files: `src/webview/utils/tableBulletUtils.ts` (DELETE), `src/webview/utils/tableSelectionUtils.ts` (DELETE), `src/webview/editor.ts` (MODIFY), `src/webview/extensions/tableCell.ts` (MODIFY - if exists, or update registry).
- Tests: Add tests verifying native bullet lists inside tables and copy-pasting tables without `<tbody>` unwrapping.

**Phase 2 — [Selection & Link Fixes]**: Fix Link Absorption and Greedy Table Selection
- Files: `src/webview/editor.ts` (MODIFY - remove link `inclusive: false`), `src/webview/extensions/draggableBlocks.ts` (MODIFY - fix table exclusion logic).
- Tests: Add tests verifying typing after links and drag-selecting rows outside of tables.

**Phase 3 — [Image Navigation & Blank Lines]**: Remove custom image cursor logic and invisible paragraph attributes
- Files: `src/webview/extensions/imageEnterSpacing.ts` (DELETE), `src/webview/extensions/imageBoundaryNav.ts` (CREATE - lightweight paragraph inserter), `src/webview/editor.ts` (MODIFY), `src/webview/extensions/markdownParagraph.ts` (MODIFY/DELETE), `src/webview/utils/markdownSerialization.ts` (MODIFY), `src/webview/extensions/customListItem.ts` (MODIFY - if exists).
- Tests: Add tests verifying single-keystroke image deletion, inserting paragraphs at boundaries, list item `<br>` serialization, and 1:1 round-trips for multiple consecutive blank lines.

## Files

| File | Action | Purpose |
|------|--------|---------|
| `src/webview/utils/tableBulletUtils.ts` | DELETE | Remove hacky string-based bullet list manipulation. |
| `src/webview/utils/tableSelectionUtils.ts` | DELETE | Remove brittle `<br>` counting for table selections. |
| `src/webview/extensions/imageEnterSpacing.ts` | DELETE | Remove 894 lines of custom image selection/deletion lag logic. |
| `src/webview/extensions/imageBoundaryNav.ts` | CREATE | Lightweight extension to insert empty paragraphs when pressing Enter at document boundaries near images. |
| `src/webview/editor.ts` | MODIFY | Unregister deleted extensions, register `imageBoundaryNav`, remove manual `<tbody>` stripping, remove `inclusive: false` link hack. |
| `src/webview/extensions/draggableBlocks.ts` | MODIFY | Remove explicit exclusion of `table` from global selection handle to stop trapped selections. |
| `src/webview/extensions/markdownParagraph.ts` | MODIFY | Remove `data-blank-line` custom attributes. |
| `src/webview/utils/markdownSerialization.ts` | MODIFY | Remove aggressive regex post-processing for blank lines. |
| `src/webview/extensions/customListItem.ts` | MODIFY | Ensure multiple empty lines serialize as `<br>` to prevent breaking Markdown parsers. |
| `src/webview/utils/pasteHandler.ts` | MODIFY | Detect nested tables during paste and show VS Code warning dialog with options to flatten or keep raw HTML. |
| `src/webview/BubbleMenuView.ts` | MODIFY | Remove imports and usages of `toggleTableBulletHack`. |
| `src/__tests__/webview/editor-bandaids.test.ts` | CREATE | Tests verifying native TipTap behaviors are active instead of bandaids. |

## Key Risks

| Risk | Cause | Mitigation |
|------|-------|-----------|
| Broken Table Copy-Paste | Deleting `<tbody>` stripping might cause HTML paste from Word/Excel to fail parsing. | Ensure the TipTap Table schema (`parseHTML`) is robust enough to handle `<tbody>` and `<thead>` natively. |
| Image Selection Regressions | Removing `imageEnterSpacing.ts` might make it harder to place the cursor around images. | Use native ProseMirror NodeViews or TipTap GapCursor (already implemented) for image boundaries. |
| Markdown Formatting Changes | Removing `normalizeBlankLines` regex might result in more or fewer `\n` in saved markdown. | Run the `stressTestRoundTrip` to ensure exactly 1:1 serialization of blank lines. |

## Implementation Decisions

**Decision 1 — Table Bullet Lists**: Native TipTap TableCell does not allow block content by default.
- [x] **A**: Override TipTap `TableCell` extension to set `content: 'block+'` instead of `inline*`.
- [ ] **B**: Keep the text-based bullet list hack.
- Recommendation: **A** — Standardizes list behaviors natively and eliminates 2 files.

**Decision 2 — Image Deletion**: Image navigation currently requires two keystrokes (select, then delete).
- [x] **A**: Delete `imageEnterSpacing.ts` entirely and rely on native `Image` node behavior + GapCursor. Also implement lightweight `imageBoundaryNav.ts` for boundary paragraph insertion.
- [ ] **B**: Refactor `imageEnterSpacing.ts` to be faster.
- Recommendation: **A** — ProseMirror handles atomic node deletion natively on backspace. Custom logic is unnecessary overhead.

**Decision 3 — Nested Tables**: Standard Markdown doesn't support nested tables natively.
- [x] **A**: Provide user warning on paste with choice to flatten or keep raw HTML.
- [ ] **B**: Silently drop nested tables.
- Recommendation: **A** — Preserves data while educating user on Markdown limitations.
