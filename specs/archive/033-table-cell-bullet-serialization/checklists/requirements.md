# Implementation Checklist: Table Cell Bullets (033)

**Purpose**: Verify the implementation is complete and another developer can pick this up.
**Created**: 2026-05-02
**Feature**: [spec.md](../spec.md)

## Constraint Understanding

- [x] GFM cells cannot contain raw newlines — `<br>` must be used as line separator
- [x] TipTap table cells store all content in a single `paragraph` node with `hardBreak` nodes between lines
- [x] Native `toggleBulletList` inside a table cell causes double-dash on round-trip — documented in spec

## Serializer Fix

- [x] `bulletList` joins items with `<br>` not `\n` in `tableMarkdownSerializer.ts`
- [x] `orderedList` joins items with `<br>`
- [x] `blockquote` joins items with `<br>`
- [x] `githubAlert` joins items with `<br>`
- [x] Generic fallback joins items with `<br>`
- [x] Depth-aware nested list rendering: `BULLET_MARKERS[depth % 3]`, `'  '.repeat(depth)` indent, recurse with `depth+1`

## tableSelectionUtils

- [x] `getSelectedTableLines(state, selection)` exported from `tableSelectionUtils.ts`
- [x] Returns `null` when selection is outside a table cell
- [x] Walks `hardBreak` nodes to compute line `{ start, end }` boundaries
- [x] Filters to lines overlapping `[selection.from, selection.to]`
- [x] Falls back to first line when cursor position has no overlap

## TableBulletListSmart Extension

- [x] `toggleBulletListSmart` command registered and works in table cells
- [x] `toggleBulletListSmart` falls back to `chain().toggleBulletList()` outside table cells
- [x] `isTableBulletActive` command returns correct boolean
- [x] Tab keyboard shortcut: indent bullet lines (returns `false` on non-bullet lines)
- [x] Shift-Tab keyboard shortcut: dedent bullet lines (returns `false` at depth 0)
- [x] Marker cycle: `- (0) → + (1) → * (2) → - (3)` via `depth % 3`
- [x] All line operations process in reverse order (last line first) to preserve positions
- [x] Extension registered in `src/webview/editor.ts`

## Toolbar Integration

- [x] Bullet button `action` calls `toggleBulletListSmart`
- [x] Bullet button `isActive` uses `editor.isActive('bulletList') || editor.commands?.isTableBulletActive?.() === true`
- [x] Optional chaining prevents crash when extension absent (e.g. test editors)

## Tests

- [x] 15 tests in `src/__tests__/webview/tableCellBullets.test.ts` — all green
- [x] `@jest-environment jsdom` annotation present
- [x] No regressions in pre-existing test suite (same 10 failing suites as baseline)

## Notes

- Spec documents the hack explicitly — "why native approach fails" and "why text-manipulation works"
- GFM parser strips leading whitespace from cell values on parse — tests cannot use pre-indented `setMd` fixtures; must build indent state via `Tab` operations

