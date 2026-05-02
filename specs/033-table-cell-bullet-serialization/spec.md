# Feature Specification: Fix Bullet List Serialization Inside Table Cells

**Folder**: `specs/033-table-cell-bullet-serialization/`
**Created**: 2026-05-02
**Status**: Draft

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Bullets inside table cell serialize without breaking the table (Priority: P1)

A user has a table cell containing multi-line content separated by `<br>`. They select two of those lines, click the bullet button in the toolbar, and the document saves correctly — the table structure is preserved and the bullets appear as `- item<br>- item` within the cell.

**Why this priority**: The table breaks entirely (becomes invalid markdown) when bullets are applied to table cell content — a data-loss bug.

**Independent Test**: Open any table with multi-line cell content → select two lines → click the Bullet list button → save → the saved markdown still has a valid table with `- Bullet 1<br>- Bullet 2` inside the cell.

**Acceptance Scenarios**:

1. **Given** a table cell with `Row 1<br>Row 2<br><br>Bullet 1<br>Bullet 2`, **When** the user selects "Bullet 1" and "Bullet 2" and clicks the bullet toolbar button, **Then** the serialized markdown contains `- Bullet 1<br>- Bullet 2` inside the cell and the table structure is valid.
2. **Given** a table cell with bullet list items already applied, **When** the document is saved and reloaded, **Then** the bullet prefixes are preserved and the table is intact.
3. **Given** a table cell with bullets, **When** the user clicks the bullet button again (toggle off), **Then** the `- ` prefixes are removed and the table structure remains valid.

---

### User Story 2 — Ordered list inside table cell serializes correctly (Priority: P2)

When a user applies a numbered list inside a table cell, the serialized output uses `<br>`-separated items (`1. First<br>2. Second`) rather than newlines that would break the table.

**Why this priority**: Same root cause as P1 — `orderedList` uses the same broken `\n` join.

**Independent Test**: Apply ordered list in a table cell → save → table is still valid with `1. Item<br>2. Item` in the cell.

**Acceptance Scenarios**:

1. **Given** a table cell, **When** an ordered list is applied and the document saved, **Then** items are joined with `<br>` and the table is valid.

---

### Edge Cases

- Cell with a single bullet item — no `<br>` needed, serializes as `- Item`.
- Cell with bullets AND other `<br>`-separated plain text above the list — the join separator must only apply between list items, not between the list and the preceding text.
- Nested list items (if any) — must not introduce raw newlines.

## Requirements *(mandatory)*

### Functional Requirements

**FR-001**: When a `bulletList` node appears inside a table cell, its serialized items MUST be joined with `<br>` (not ` \n`) so they remain within a single GFM table cell.

**FR-002**: When an `orderedList` node appears inside a table cell, its serialized items MUST be joined with `<br>` (not ` \n`).

**FR-003**: The fix must not affect list rendering outside of table cells — bullet and ordered lists in normal document flow must continue to use standard newline-separated output.

**FR-004**: Round-trip fidelity: a document containing bullets inside table cells must survive save → reload with the same bullet content and valid table structure.

## Success Criteria *(mandatory)*

- **SC-001**: A table containing a cell with a bullet list saves and reloads with zero change to the table structure and correct bullet prefixes.
- **SC-002**: The serialized markdown for a bullet list inside a table cell contains `<br>` between items and no raw newlines within the cell value.
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
