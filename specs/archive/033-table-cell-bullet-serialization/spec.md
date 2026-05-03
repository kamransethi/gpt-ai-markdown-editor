# Spec 033: Table Cell Bullets — Design, Constraints & Implementation

**Folder**: `specs/033-table-cell-bullet-serialization/`
**Created**: 2026-05-02
**Status**: Completed
**PRD Domains**: `tables`, `editor-core`
**See also**: [plan.md](./plan.md) | [tasks.md](./tasks.md)

---

## Why This Is a Hack (Read This First)

GFM (GitHub Flavored Markdown) table cells cannot contain raw newlines. A raw newline inside a cell terminates the row and breaks the table structure. This means **ProseMirror list nodes (`bulletList`, `orderedList`) cannot be stored inside table cells** without special handling — the standard TipTap serializer would render them with `\n` between items, producing invalid markdown.

The solution is a deliberate hack: **bullets inside table cells are stored as plain text prefixes** (`- `, `  + `, `    * `) on the hard-break-separated "lines" within the cell's single paragraph node. They are **not** ProseMirror `bulletList` nodes. The GFM parser treats `<br>` as a visual line break within a cell, so `- Bullet 1<br>  + Nested` renders as a two-line cell with bullet formatting.

A second consequence: `<br>` is the only safe line separator inside a table cell. The custom serializer (`tableMarkdownSerializer.ts`) must join all multi-line content with `<br>`, not `\n`.

---

## The ProseMirror Table Cell Model

TipTap table cells use `@tiptap/extension-table`. Each `tableCell` node contains **exactly one `paragraph`** node. Multi-line content within a cell is stored as a sequence of inline nodes (text, marks, etc.) separated by `hardBreak` nodes — not as multiple block nodes.

```
tableCell
  └── paragraph
        ├── text("Row 1")
        ├── hardBreak
        ├── text("- Bullet 1")
        ├── hardBreak
        └── text("  + Nested")
```

This structure means:
- There is no "second paragraph" in a cell — everything is inline within one paragraph.
- Hard-break nodes (`hardBreak`) are the only way to represent multiple lines.
- ProseMirror `bulletList` / `orderedList` nodes, if they appear in a cell, do so as **children of the paragraph** or as **siblings of the paragraph within the cell**, not as inline content. This is fragile and causes serialization bugs.

---

## Why Native TipTap `toggleBulletList` Fails in Table Cells

When `toggleBulletList` is called with the cursor inside a table cell:

1. TipTap wraps the paragraph (or selected content) in a `bulletList` > `listItem` node.
2. On save, `tableMarkdownSerializer` serializes the `bulletList` node and prepends `- ` to each item.
3. The result is stored in the markdown file as `- Bullet 1<br>- Bullet 2`.
4. On reload, `markdown-it` parses `- Bullet 1` inside the cell as **plain text** (not a list — it's inline cell content). The text node stores `"- Bullet 1"` literally.
5. The cursor is inside a text node that already has `"- Bullet 1"`. Calling `toggleBulletList` again wraps it in a `bulletList` node and the serializer prepends another `- `, producing `"- - Bullet 1"` on disk.

**This is the double-dash bug.** It compounds on every save/reload cycle.

---

## The Text-Manipulation Approach

Instead of using ProseMirror list nodes, bullets in table cells are managed as plain-text prefixes directly in the paragraph's text content. The prefix format follows GFM convention:

| Depth | Indent | Marker | Example |
|-------|--------|--------|---------|
| 0 | (none) | `-` | `- Item` |
| 1 | 2 spaces | `+` | `  + Item` |
| 2 | 4 spaces | `*` | `    * Item` |
| 3 | 6 spaces | `-` | `      - Item` (cycles) |

The marker cycles through `['-', '+', '*']` using `depth % 3`. The indent is `'  '.repeat(depth)`. The full prefix regex is:

```
/^([\t ]*)([-+*]) ?/
```

This regex detects any bullet prefix at any indent level. It is used for:
- Toggle detection (is this line a bullet?)
- Prefix removal (strip leading whitespace + marker + space)
- `isTableBulletActive` (toolbar highlight state)

**Round-trip safety**: Since bullets are plain text in the ProseMirror document, the serializer just outputs them as-is (no transformation). On reload, the parser sees the `- ` prefix as literal text and stores it as-is. There is no double-prefix accumulation.

---

## Architecture

### `src/webview/utils/tableSelectionUtils.ts`

The foundational utility. Given a ProseMirror `EditorState` and `Selection`, it:

1. Walks up the selection's `$anchor` depth to find the enclosing `tableCell` or `tableHeader` node.
2. Iterates the first `paragraph` child's inline nodes, recording the `{ start, end }` position of each logical "line" (split at every `hardBreak` node).
3. Filters to lines that overlap `[selection.from, selection.to]` — if nothing overlaps (cursor position), returns the line containing `from`.
4. Returns `{ selectedLines: TableLineMapping[], tr: state.tr }` or `null` if not in a table cell.

**Key constraint**: line positions are absolute document positions, so all insertions/deletions must be processed in **reverse order** (last line first) to keep earlier positions valid.

### `src/webview/extensions/tableBulletListSmart.ts`

A TipTap `Extension` (not a `Node`) that adds three capabilities:

#### Command: `toggleBulletListSmart()`

- Calls `getSelectedTableLines`. If `null` (not in table cell), falls back to `chain().toggleBulletList().run()`.
- If all selected lines already match `TABLE_BULLET_RE` → removes the prefix from each (toggle off).
- Otherwise → inserts `"- "` at the start of each line that doesn't already have a prefix (toggle on).
- Dispatches the transaction and returns `true`; returns `false` if nothing changed.

#### Command: `isTableBulletActive()`

- Returns `true` if `getSelectedTableLines` is non-null and the first selected line matches `TABLE_BULLET_RE`.
- Used by `BubbleMenuView.ts` for toolbar button highlight state.
- Called as `(editor.commands as any)?.isTableBulletActive?.()` (optional chaining in case the extension is absent in test environments).

#### Keyboard shortcuts: `Tab` and `Shift-Tab`

Both handlers:
1. Call `getSelectedTableLines`. Return `false` immediately if not in a table cell (default TipTap Tab behaviour fires).
2. For each selected line (in reverse order), call `parseBulletLine(text)`:
   - **Tab**: If the line is a bullet, compute `newDepth = indent + 1`, new prefix = `'  '.repeat(newDepth) + markerForDepth(newDepth) + ' '`. Delete old prefix, insert new.
   - **Shift-Tab**: If the line is a bullet **and** `indent > 0`, compute `newDepth = indent - 1`, same prefix logic. If `indent === 0`, skip the line (return `false` — no-op, does not consume the event).
3. Dispatch if any lines changed; return `false` otherwise.

### `src/webview/utils/tableMarkdownSerializer.ts`

The custom table serializer. TipTap's default table serializer calls `collapseWhitespace()` on each cell's rendered text, which destroys `hardBreak` → `<br>` conversions. This custom serializer walks cell content directly via `renderBlockNode(node, h, depth)`.

**Critical fix**: The `bulletList`, `orderedList`, `blockquote`, `githubAlert`, and generic fallback cases all join child items with `'<br>'` instead of `' \n'`. Raw `\n` inside a table cell breaks the GFM table structure.

**Nested list handling**: `bulletList` uses `BULLET_MARKERS[depth % 3]` and `'  '.repeat(depth)` indent. For each list item, the serializer separates the paragraph text from any nested `bulletList`/`orderedList` children and recurses with `depth + 1`. This is only relevant when the document actually contains ProseMirror list nodes (e.g. pasted from outside a table) — in normal table-cell editing, bullets are plain text and pass through the `paragraph` → `renderInline` path without hitting the `bulletList` case.

### `src/webview/BubbleMenuView.ts` (bullet button, line ~643)

```typescript
action: () => editor.chain().focus().toggleBulletListSmart().run(),
isActive: () => editor.isActive('bulletList') || (editor.commands as any)?.isTableBulletActive?.() === true,
```

`editor.isActive('bulletList')` handles the standard (non-table) case. The optional chain handles editors built without `TableBulletListSmart` (e.g. test harnesses).

---

## Files Changed

| File | Change |
|------|--------|
| `src/webview/utils/tableMarkdownSerializer.ts` | Fixed `bulletList`/`orderedList`/`blockquote`/`githubAlert`/fallback to use `<br>` join; added depth-aware nested list rendering |
| `src/webview/utils/tableSelectionUtils.ts` | Created — `getSelectedTableLines()` helper |
| `src/webview/extensions/tableBulletListSmart.ts` | Created — `toggleBulletListSmart`, `isTableBulletActive`, Tab/Shift-Tab shortcuts |
| `src/webview/editor.ts` | Added `TableBulletListSmart` to extension list |
| `src/webview/BubbleMenuView.ts` | Updated bullet button `action` and `isActive` |
| `src/__tests__/webview/tableCellBullets.test.ts` | Created — 15 regression tests |

---

## Constraints & Edge Cases

- **GFM cell content is parsed as inline, not block.** A `- Item` inside a cell is treated as literal text by the parser, never as a list item. The bullet marker exists only to signal "this line is a list item" to the human reader and to allow the toolbar toggle to detect active state.
- **Tab on a non-bullet line does nothing and falls through** — only bullet lines are indented. This avoids swallowing Tab for cell-to-cell navigation.
- **Shift-Tab at depth 0 does nothing and falls through** — avoids consuming Shift-Tab when there is no indent to remove.
- **Selection spanning multiple lines**: all operations process lines in reverse document order so that earlier position offsets remain valid after each insertion/deletion.
- **GFM parser strips leading whitespace from table cell values on parse.** Pre-indented content (`  + Item`) cannot be set directly via `setMd` in tests — it must be built up by applying Tab operations after loading a depth-0 bullet.
- **`isTableBulletActive` checks only the first selected line** — sufficient for toolbar state which reflects the cursor position, not a multi-line selection aggregate.

---

## Test Coverage (`src/__tests__/webview/tableCellBullets.test.ts`)

All 15 tests pass. The file requires `@jest-environment jsdom`.

| # | Suite | Scenario |
|---|-------|----------|
| 1 | Serializer | Bullet list serializes with `<br>`, not `\n` |
| 2 | Serializer | Table structure stays valid (≥2 pipes per row) |
| 3 | Serializer | Round-trip stable (second pass = first pass) |
| 4 | Serializer | Nested bullets use alternating markers and 2-space indent |
| 5 | Serializer | Ordered list serializes with `<br>` |
| 6 | Toggle | Adds `- ` prefix to selected lines only |
| 7 | Toggle | Removes prefix when all selected lines already have one |
| 8 | Toggle | Round-trip: no double-dash accumulation |
| 9 | Toggle | Falls back to standard `toggleBulletList` outside table cells |
| 10 | Active state | `isTableBulletActive` returns `true` on bullet line |
| 11 | Active state | `isTableBulletActive` returns `false` on plain line |
| 12 | Tab | `- Item` → `  + Item` (depth 0 → 1) |
| 13 | Tab | `  + Item` → `    * Item` (depth 1 → 2, via two Tab presses) |
| 14 | Shift-Tab | `  + Item` → `- Item` (depth 1 → 0) |
| 15 | Shift-Tab | No-op at depth 0 (content unchanged) |
- **SC-003**: All existing table-related tests continue to pass (no regressions).
- **SC-004**: New regression test covers the exact scenario: bullets applied to multi-line table cell content → serialized markdown is valid GFM table.

## Scope *(mandatory)*

**In scope**:
- Fix `tableMarkdownSerializer.ts` `bulletList` and `orderedList` join separator (`' \n'` → `'<br>'`)
- Add a regression test

**Out of scope**:
- Restoring the deleted `tableBulletUtils.ts` / `tableSelectionUtils.ts` files
- Changing bullet toolbar behavior (toggle logic, nesting levels)
- Any change to list serialization outside of table cells

## Assumptions *(mandatory)*

- The serializer in `tableMarkdownSerializer.ts` is the only code path that serializes table cell content — no other serializer handles `bulletList` inside cells.
- `<br>` within a GFM table cell is the correct and universally supported way to represent multi-line content.
- The `orderedList` fix (FR-002) uses the same one-line change as `bulletList`.
