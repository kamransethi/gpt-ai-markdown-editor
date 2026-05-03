# Tasks: Table Cell Bullet Serialization Fix

**Input**: `spec.md`, `plan.md`

## Phase 1: Serializer Fix

**Purpose**: Fix `tableMarkdownSerializer.ts` so list nodes inside table cells never emit raw newlines.

- [x] T001 Fix `bulletList` case in `renderBlockNode` to join items with `<br>` instead of ` \n`.
- [x] T002 [P] Fix `orderedList` case in `renderBlockNode` to join items with `<br>` instead of ` \n`.
- [x] T003 [P] Fix `blockquote` and `githubAlert` cases in `renderBlockNode` to join items with `<br>`.
- [x] T004 [P] Fix the generic fallback case in `renderBlockNode` to join items with `<br>`.
- [x] T005 [P] Add depth-aware nested list rendering: `BULLET_MARKERS = ['-', '+', '*']`, `'  '.repeat(depth)` indent, `depth+1` recursion for nested lists.

---

## Phase 2: Restore tableSelectionUtils

**Purpose**: Provide a helper to identify hard-break-separated lines in the selected table cell, needed by the smart toggle and Tab/Shift-Tab handlers.

- [x] T006 Create `src/webview/utils/tableSelectionUtils.ts` exporting `getSelectedTableLines(state, selection)`.
- [x] T007 [P] Walk the first paragraph of the table cell, split at `hardBreak` nodes to compute line `{ start, end }` boundaries.
- [x] T008 [P] Filter to lines overlapping the selection `[from, to]` and return them along with a fresh `Transaction`.
- [x] T009 [P] Return `null` when the selection is not inside a table cell.

---

## Phase 3: Smart Bullet Toggle Extension

**Purpose**: Implement the `TableBulletListSmart` TipTap extension that manages bullet state via text-manipulation inside table cells.

- [x] T010 Create `src/webview/extensions/tableBulletListSmart.ts` as a TipTap `Extension`.
- [x] T011 [P] Implement `toggleBulletListSmart` command: detect table cell via `getSelectedTableLines`; if all selected lines have bullet prefix → remove; else add `- ` to lines without prefix; fall back to `toggleBulletList` outside table cells.
- [x] T012 [P] Process lines in reverse order when inserting/removing prefixes to keep document offsets valid.
- [x] T013 Implement `isTableBulletActive` command: return `true` when cursor's line in a table cell starts with `TABLE_BULLET_RE` (`/^([\t ]*)([-+*]) ?/`).
- [x] T014 Implement `addKeyboardShortcuts` for `Tab`: on a bullet line, increase indent depth by one level (add 2 spaces + cycle marker `-`→`+`→`*`); return `false` on non-bullet lines.
- [x] T015 [P] Implement `addKeyboardShortcuts` for `Shift-Tab`: on a bullet line with depth > 0, decrease indent depth (remove 2 spaces + reverse-cycle marker); do nothing at depth 0 (return `false`).
- [x] T016 [P] Add `parseBulletLine(text)` helper to extract indent depth and marker from a line.
- [x] T017 [P] Add `markerForDepth(depth)` helper using `MARKERS = ['-', '+', '*']` cycling with modulo 3.

---

## Phase 4: Toolbar Integration

**Purpose**: Wire the extension into the editor and update the toolbar button.

- [x] T018 Register `TableBulletListSmart` in the extensions list in `src/webview/editor.ts`.
- [x] T019 Update bullet button `action` in `BubbleMenuView.ts` to call `editor.chain().focus().toggleBulletListSmart().run()`.
- [x] T020 [P] Update bullet button `isActive` in `BubbleMenuView.ts` to `editor.isActive('bulletList') || editor.commands?.isTableBulletActive?.() === true` (with optional chaining to handle editors without the extension).

---

## Phase 5: Regression Tests

**Purpose**: Add a comprehensive test file to prevent regressions.

**Independent Test**: Run `npx jest src/__tests__/webview/tableCellBullets.test.ts` — all 15 tests must pass.

- [x] T021 Create `src/__tests__/webview/tableCellBullets.test.ts` with `@jest-environment jsdom` and helper functions `makeEditor`, `setMd`, `getMd`.
- [x] T022 [P] Add test: bullet list inside table cell serializes with `<br>` separator (SC-001/SC-002).
- [x] T023 [P] Add test: nested bullet list serializes with depth-aware markers and 2-space indent.
- [x] T024 [P] Add test: single-item bullet list in table cell serializes without `<br>`.
- [x] T025 [P] Add test: ordered list inside table cell serializes with `<br>` separator.
- [x] T026 [P] Add test: `toggleBulletListSmart` adds `- ` prefix to selected lines in a table cell.
- [x] T027 [P] Add test: `toggleBulletListSmart` removes `- ` prefix when all selected lines already have a bullet.
- [x] T028 [P] Add test: round-trip anti-regression — save then reload shows same bullet text without doubling the dash.
- [x] T029 [P] Add test: `toggleBulletListSmart` falls back to standard toggle when not in a table cell.
- [x] T030 [P] Add test: `isTableBulletActive` returns `true` when cursor is on a bullet line in a table cell.
- [x] T031 [P] Add test: `isTableBulletActive` returns `false` when cursor is on a plain line in a table cell.
- [x] T032 [P] Add test: Tab increases indent depth and cycles marker `-` → `+`.
- [x] T033 [P] Add test: Tab again increases to level 2 with `*` marker.
- [x] T034 [P] Add test: Shift-Tab decreases indent depth and cycles marker `+` → `-`.
- [x] T035 [P] Add test: Shift-Tab at depth 0 is a no-op (content unchanged).

---

## Dependencies & Execution Order

- Phase 1 is independent and can start immediately.
- Phase 2 must complete before Phase 3 (T006–T009 before T010+).
- Phase 3 must complete before Phase 4.
- Phase 5 can be written in parallel with Phases 3–4 but must be green before closing.

---

## Completion Summary

All tasks completed in commit history on `main`:

| Commit | Description |
| --- | --- |
| `fix(033): fix bullet list serialization in table cells` | T001–T005: serializer `<br>` fix |
| `feat(033): add TableBulletListSmart extension and restore tableSelectionUtils` | T006–T019: extension + toolbar action |
| `fix(033): revert table cell bullet toggle to text-manipulation; restore tableSelectionUtils.ts` | T009–T017 refined: text-manipulation approach to prevent double-dash |
| `feat(033): add TAB/SHIFT+TAB indent cycling and isTableBulletActive for table cell bullets` | T013–T020, T030–T035 |
