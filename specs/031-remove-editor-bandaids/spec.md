# Feature Specification: Remove Editor Bandaids

**Folder**: `specs/031-remove-editor-bandaids/`  
**Created**: 2026-04-26  
**Status**: Draft  
**Input**: User description: "OK, create a new 'feature' to deal with these bandaids one by one. Do a NEW deep code scan of the extension files focus starting with large files - looking for bandaids and non-standard code which should rather be handled via TipTap natively instead, or with simpler means instead. The feature should be written in a way that we can implement it in steps."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Native Image Navigation (Priority: P1)

As a user, I want images to respond immediately to keyboard selection and deletion without lag or "two-step" processes, so that editing feels snappy and natural.

**Why this priority**: The `imageEnterSpacing.ts` extension (894 lines) introduces a two-step deletion process and custom cursor decorations that conflict with native improvements. Fixing this resolves the most noticeable editor lag and removes the largest block of custom code.

**Independent Test**: Can be fully tested by selecting an image with arrow keys and pressing Backspace/Delete. The image should delete immediately on the first keypress without requiring prior selection highlight.

**Acceptance Scenarios**:

1. **Given** an image in the editor, **When** I press the Backspace key right after the image, **Then** the image is deleted immediately.
2. **Given** an image in the editor, **When** I navigate to it using arrow keys, **Then** the standard editor cursor or selection outline is used without custom lagging highlights.

---

### User Story 2 - Fix Greedy Selection in Tables (Priority: P2)

As a user, I want to be able to drag-select rows within a table and move my mouse outside the table without the selection getting trapped, so that I can easily copy or format table data.

**Why this priority**: The global drag handle explicitly excludes tables (`draggableBlocks.ts`), which may be causing event listener conflicts that trap mouse selections inside table boundaries. 

**Independent Test**: Can be fully tested by clicking inside a table cell, dragging the mouse to select multiple rows, and moving the cursor outside the table bounds. The selection should follow the cursor smoothly.

**Acceptance Scenarios**:

1. **Given** a populated table, **When** I click and drag to select text across multiple cells and out of the table, **Then** the native selection expands naturally without getting stuck at the table border.

---

### User Story 3 - Fix Link "Absorption" (Priority: P3)

As a user, I want to type immediately after a link without my new text being accidentally absorbed into the link's URL/formatting, while still being able to edit the link text if I click inside it.

**Why this priority**: The current bandaid globally forces the Link extension to be `inclusive: false` (`editor.ts`), which is a blunt fix for a common TipTap issue.

**Independent Test**: Can be fully tested by placing the cursor at the exact end of a linked text and typing. The new text should be plain text, not linked.

**Acceptance Scenarios**:

1. **Given** a text link, **When** I place the caret at the very end of the link and type " hello", **Then** the word "hello" is inserted as plain text.

---

### User Story 4 - Standardize Blank Line Handling (Priority: P4)

As a user, I want the editor to accurately preserve the exact number of blank lines I type without invisible "ghost paragraphs" or regex correctors altering my spacing when I save.

**Why this priority**: The combination of `MarkdownParagraph` (with hidden `data-blank-line` attributes) and the post-processing regex in `markdownSerialization.ts` creates unpredictable spacing when saving files.

**Independent Test**: Can be fully tested by inserting exactly 3 blank lines between two paragraphs, saving the file, and verifying the raw markdown contains exactly the expected number of newlines.

**Acceptance Scenarios**:

1. **Given** a document with intentional blank lines, **When** I save and view the raw markdown, **Then** the exact number of newlines is preserved without aggressive regex reduction.

---

### User Story 5 - Remove Table Unwrapping DOM Hacks (Priority: P5)

As a developer, I want the table parsing logic to natively handle HTML table structures (like `<tbody>`) using proper schema rules rather than manual DOM manipulation, so the codebase is cleaner and less error-prone.

**Why this priority**: `editor.ts` manually removes `<tbody>` and `<thead>` tags during paste parsing. Proper TipTap schema configuration can handle this automatically.

**Independent Test**: Can be fully tested by pasting an HTML table from an external source (like Excel) and verifying it renders perfectly without manual DOM stripping.

**Acceptance Scenarios**:

1. **Given** an HTML table on the clipboard, **When** I paste it into the editor, **Then** the table is parsed and rendered correctly using native TipTap table rules.

---

### User Story 6 - Standardize Bullet Lists in Tables (Priority: P3)

As a user, I want to create bulleted lists inside table cells using standard Markdown list syntax, so that they format consistently with lists outside of tables and serialize properly.

**Why this priority**: The codebase currently uses `applyTableBulletHack` and `removeTableBulletHack` (`tableBulletUtils.ts`) which manually intercept text and insert literal `- ` strings instead of utilizing TipTap's native `BulletList` and `ListItem` extensions inside tables. This is a massive bandaid that breaks standard list behavior (like pressing Enter to continue the list).

**Independent Test**: Can be fully tested by placing the cursor inside a table cell, typing `- ` and pressing space. It should transform into a proper TipTap bullet list node rather than just remaining text.

**Acceptance Scenarios**:

1. **Given** a table cell, **When** I type "- " (hyphen and space), **Then** a native bullet list is created within the cell.
2. **Given** a native bullet list in a table cell, **When** I press Enter, **Then** a new bullet list item is created.

### Edge Cases

- What happens when an image is the very first or very last node in the document and the user presses Enter/Delete? - When pressing Enter near a boundary image, an empty paragraph is inserted above/below it so the user can easily type text.
- How does system handle deeply nested lists with blank lines under the new standardized newline handling? - Multiple empty lines inside list items are serialized using HTML `<br>` tags rather than raw Markdown newlines to prevent Markdown parser breakage.
- What happens when a user pastes a table that has nested tables inside it (regarding the schema changes)? - Provide a warning/alert to the user that nested tables are not fully supported in standard Markdown, and offer them the choice to either flatten the table into plain text or preserve it as raw HTML.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The editor MUST handle image cursor navigation and deletion using native ProseMirror/TipTap configurations, deprecating `imageEnterSpacing.ts`.
- **FR-002**: The editor MUST allow seamless text selection across table boundaries without interference from drag-handle extensions.
- **FR-003**: The editor MUST handle cursor placement at the boundary of Link nodes correctly, preventing unwanted text absorption.
- **FR-004**: The editor MUST serialize and parse consecutive empty paragraphs natively, without relying on post-save regex replacements (`normalizeBlankLines`).
- **FR-005**: The editor MUST parse incoming HTML tables natively via schema `parseHTML` rules, deprecating manual DOM tree manipulation.
- **FR-006**: The editor MUST support native `BulletList` and `ListItem` nodes inside `TableCell` nodes, deprecating `tableBulletUtils.ts` string manipulation hacks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Deletion of the `imageEnterSpacing.ts` file, reducing codebase size by ~890 lines.
- **SC-002**: Users can select and delete images with a single Backspace keypress.
- **SC-003**: Mouse selection within and outside of tables behaves identically to native browser text areas.
- **SC-004**: Markdown serialization produces exact 1:1 round-trips for empty paragraphs without regex post-processing.
- **SC-005**: Deletion of `tableBulletUtils.ts` and `tableSelectionUtils.ts`, with bullet lists rendering natively inside tables.

## Assumptions

- TipTap v3 provides sufficient native configuration options (like `inclusive` marks, `parseHTML` priorities, and `NodeView` behaviors) to replicate the necessary functionality without the existing bandaids.
- Removing `data-blank-line` will not break backward compatibility with existing saved markdown files, as the standard parser handles empty lines.
