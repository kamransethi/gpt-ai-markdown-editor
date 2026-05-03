# Feature Specification: File & Image Slash Commands

**Folder**: `specs/034-file-image-slash-cmd/`  
**Created**: 2026-05-02  
**Status**: Implemented ✅  
**Input**: Bug report — the `/image` slash command dispatched a dead `slashCommandInsertImage` CustomEvent with no listener, doing nothing. Required fix and UX parity with `/file` command. Also added Obsidian-style active link preview.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Insert Image via Slash Command (Priority: P1)

As a user, I want to type `/image` in the editor and pick a file from my workspace to embed as an image, so that I can quickly insert images without leaving the editor.

**Why this priority**: The `/image` slash command existed visually but was completely non-functional — clicking it dispatched a `CustomEvent` with no handler, silently doing nothing.

**Independent Test**: Type `/image`, select an image file from the picker, verify a `![filename](path)` node appears in the editor.

**Acceptance Scenarios**:

1. **Given** I type `/image` in the editor, **When** the slash suggestion menu appears and I select "Image", **Then** an inline file-search picker opens.
2. **Given** the file picker is open, **When** I type a search query, **Then** the list filters files from the workspace cache in real time.
3. **Given** a file is selected from the picker, **When** I press Enter or click it, **Then** a TipTap image node is inserted at the cursor position with `src` = file path and `alt` = filename.
4. **Given** I type `/img` (alias), **When** the slash suggestion menu appears, **Then** Image is highlighted and the same picker behavior applies.

---

### User Story 2 — Insert File Link via Slash Command (Priority: P1)

As a user, I want to type `/link` or `/file` and pick a workspace file to insert as a clickable markdown link, so that I can cross-reference other documents.

**Why this priority**: File Link was already functional but used its own inline `openFilePicker` function. Parity with the Image command requires both to use the same shared picker.

**Independent Test**: Type `/link`, pick a `.md` file, verify a `[filename](path)` text-with-link-mark node appears in the editor.

**Acceptance Scenarios**:

1. **Given** I type `/link` or `/file` in the editor, **When** I select "File Link" from the menu, **Then** an inline file-search picker opens using the same UI as the Image picker.
2. **Given** a file is selected, **When** I press Enter or click it, **Then** a text node with a `link` mark is inserted: display text = filename, href = file path.
3. **Given** I type `/link some-doc`, **When** the slash menu is open, **Then** the picker pre-filters on `some-doc`.

---

### User Story 3 — Active File Link Preview (Priority: P2)

As a user, I want to see the file path of a link I am currently editing inline next to the link text (Obsidian-style), so that I know where the link points without opening a separate dialog.

**Why this priority**: File links become opaque once named. Showing the href inline while the cursor is inside the link provides immediate context.

**Independent Test**: Place cursor inside a `[display text](./some-file.md)` link and verify the href appears visually next to the link text without modifying the document.

**Acceptance Scenarios**:

1. **Given** the cursor is positioned inside a file link (local path, not `http://`, `mailto:`, or `#anchor`), **When** `onSelectionUpdate` fires, **Then** the anchor DOM element gets class `link-edit-preview` and `data-link-href` = the file path.
2. **Given** the `.link-edit-preview` class is on an anchor, **When** rendered, **Then** a CSS `::after` pseudo-element displays `(href)` in a muted color after the link text.
3. **Given** the cursor moves away from the link, **When** `onSelectionUpdate` fires, **Then** the `link-edit-preview` class and `data-link-href` attribute are removed — the document markdown is unchanged.
4. **Given** the link href is an external URL (`https://...`), **When** the cursor is inside it, **Then** no preview is shown (only local file paths get preview).

---

## Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-001 | `/image` and `/img` slash commands must open an inline workspace file picker and insert a TipTap image node on selection |
| FR-002 | `/link` and `/file` slash commands must open the same inline workspace file picker and insert a text node with a `link` mark on selection |
| FR-003 | Both pickers must share a single `openWorkspacePicker(editor, insertFrom, mode)` implementation — no duplication |
| FR-004 | The picker must query `fileCache.search(query, maxResults)` with the user's typed search term to filter results |
| FR-005 | The picker must support keyboard navigation (ArrowUp/ArrowDown to move, Enter to select, Escape to cancel) |
| FR-006 | When cursor is inside a local file link, the editor must show the file path inline via CSS `::after` without modifying stored markdown |
| FR-007 | Link preview must only activate for local file paths — not for `http://`, `https://`, `mailto:`, or `#` links |

---

## Success Criteria

| ID | Criterion |
|----|-----------|
| SC-001 | `/image` command opens picker and inserts a valid image node — previously broken, now functional |
| SC-002 | `/img` (alias) exhibits identical behavior to `/image` |
| SC-003 | `/link` and `/file` commands work via the same shared `openWorkspacePicker` (no duplicate code paths) |
| SC-004 | Active cursor in a local file link shows path preview without any markdown content change |
| SC-005 | All existing tests pass — no regressions in CommandRegistry behavior |

---

## Out of Scope

- Remote URL input for images (only workspace files)
- Image resizing or caption editing
- Editing an existing link's href via the preview (read-only preview only)
- Custom link picker styling beyond the shared picker UX
