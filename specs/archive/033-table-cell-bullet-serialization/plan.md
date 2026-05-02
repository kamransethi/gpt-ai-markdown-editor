# Implementation Plan: Table Cell Bullet Serialization Fix

**Folder**: `specs/033-table-cell-bullet-serialization/` | **Date**: 2026-05-02 | **Spec**: [spec.md](./spec.md)
**Status**: Completed

## Summary

Fix bullet and ordered list serialization inside GFM table cells, and add a smart bullet toggle that works correctly within the single-paragraph, `hardBreak`-delimited cell model. GFM table cells cannot contain raw newlines — all multi-line content must use `<br>`. The previous implementation used `\n` joins when serializing list nodes inside cells, which broke table structure entirely.

Additionally, implement:
- A text-manipulation bullet toggle (`toggleBulletListSmart`) that inserts/removes `- ` prefixes on hard-break-separated lines instead of wrapping the paragraph in a ProseMirror `bulletList` node.
- TAB / SHIFT+TAB indent cycling for table cell bullets.
- An `isTableBulletActive` command so the toolbar bullet button highlights correctly when the cursor is on a table bullet line.

## Stack

- Language/Runtime: TypeScript, Node.js
- VS Code extension host + Webview-based TipTap editor
- Key deps: `@tiptap/core`, `@tiptap/pm`, `@tiptap/extension-table`
- Testing: Jest + jsdom (`@jest-environment jsdom`)

## Phases

### Phase 1 — Serializer fix

Fix `tableMarkdownSerializer.ts` so that `bulletList`, `orderedList`, `blockquote`, `githubAlert`, and the generic fallback all join their child items with `<br>` instead of ` \n` when rendering content that will be placed inside a table cell. Add `renderBlockNode(node, h, depth)` to support depth-aware nested list serialization with alternating markers (`-`, `+`, `*`) and 2-space indentation per level.

### Phase 2 — Restore `tableSelectionUtils.ts`

Re-create `src/webview/utils/tableSelectionUtils.ts` (deleted in spec 031). Export `getSelectedTableLines(state, selection)` which walks the first paragraph of the current table cell, splits at `hardBreak` nodes to identify line boundaries, and returns the subset of lines overlapping the selection along with a fresh `Transaction`.

### Phase 3 — Smart bullet toggle extension

Create `src/webview/extensions/tableBulletListSmart.ts` as a TipTap `Extension` with:

- **`toggleBulletListSmart`** — If in a table cell: check whether all selected lines already have a `[-+*] ` prefix. If all do, remove the prefixes. Otherwise, add `- ` to lines that don't have one. Outside a table cell, fall through to `chain().toggleBulletList()`.
- **`isTableBulletActive`** — Returns `true` when the cursor's line in a table cell begins with a bullet marker (`-`, `+`, or `*`).
- **`addKeyboardShortcuts`** — Handles `Tab` and `Shift-Tab`:
  - **Tab** on a bullet line: increases indent depth by one level (add 2 spaces, cycle marker `-` → `+` → `*`). Returns `false` on non-bullet lines to let default Tab behaviour fire.
  - **Shift-Tab** on a bullet line: decreases indent depth by one level (remove 2 spaces, reverse-cycle marker). Does nothing at depth 0.

### Phase 4 — Toolbar integration

Register `TableBulletListSmart` in `src/webview/editor.ts` extensions list. Update the bullet button `isActive` in `BubbleMenuView.ts` to `editor.isActive('bulletList') || editor.commands?.isTableBulletActive?.() === true`.

### Phase 5 — Regression tests

Add `src/__tests__/webview/tableCellBullets.test.ts` covering:
- Bullet list serialization with `<br>` separator inside a table cell.
- Nested bullet list serialization with depth-aware markers and indentation.
- Ordered list serialization with `<br>` separator inside a table cell.
- `toggleBulletListSmart`: add prefix, remove prefix, round-trip anti-regression, fallback outside table.
- `isTableBulletActive`: true on bullet line, false on plain line.
- Tab/Shift-Tab: indent to `+`, indent to `*`, dedent to `-`, no-op at depth 0.

## Files

| File | Action | Purpose |
| --- | --- | --- |
| `src/webview/utils/tableMarkdownSerializer.ts` | MODIFY | Fix `bulletList`/`orderedList`/`blockquote`/`githubAlert`/fallback to join items with `<br>` inside table cells; add depth-aware nested list rendering. |
| `src/webview/utils/tableSelectionUtils.ts` | CREATE | `getSelectedTableLines()` — returns hard-break-separated line boundaries overlapping the current selection, plus a fresh transaction. |
| `src/webview/extensions/tableBulletListSmart.ts` | CREATE | TipTap extension with `toggleBulletListSmart`, `isTableBulletActive`, and Tab/Shift-Tab keyboard shortcuts for table cell bullet management. |
| `src/webview/editor.ts` | MODIFY | Register `TableBulletListSmart` in the editor extensions list. |
| `src/webview/BubbleMenuView.ts` | MODIFY | Update bullet button `action` to `toggleBulletListSmart` and `isActive` to check `isTableBulletActive`. |
| `src/__tests__/webview/tableCellBullets.test.ts` | CREATE | 15 regression tests covering serialization, toggle, active state, and Tab/Shift-Tab indent cycling. |

## Key Risks

| Risk | Cause | Mitigation |
| --- | --- | --- |
| Double-dash on round-trip | Serializer emits `- ` prefix on a text node that already stores `- Bullet` → reload adds another `- ` | Use text-manipulation (plain prefix) approach, not ProseMirror `bulletList` nodes, inside table cells |
| Tab consumed in wrong context | Tab handler fires on non-bullet table lines, stealing focus navigation | Return `false` immediately when line has no bullet marker so TipTap's default Tab runs |
| `isTableBulletActive` crash when extension absent | Test editors or other contexts don't register the extension | Use `?.` optional chaining: `editor.commands?.isTableBulletActive?.()` |

## Implementation Decisions

**Decision 1 — Storage format for table cell bullets**:
- **A**: Use ProseMirror `bulletList` / `listItem` nodes inside table cells (native TipTap lists).
- **B**: Store bullets as plain text prefixes (`- `, `  + `) on hard-break-separated lines (text-manipulation approach).
- **Chosen: B** — Native list nodes inside table cells caused double-dash on round-trip because both the serializer and the stored text contributed a prefix. Text-manipulation is invisible to the serializer and survives save → reload with zero transformation.

**Decision 2 — Keyboard handling**:
- **A**: Handle Tab/Shift-Tab in `keyboardShortcuts.ts` (the global keydown handler).
- **B**: Handle via `addKeyboardShortcuts()` in the TipTap extension.
- **Chosen: B** — TipTap's extension keyboard shortcuts run before the ProseMirror default handlers and integrate cleanly with `return false` to fall through.
