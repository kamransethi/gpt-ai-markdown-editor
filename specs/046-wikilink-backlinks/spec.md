# Feature Specification: WikiLink Autocomplete & Backlinks

**Folder**: `specs/046-wikilink-backlinks/`  
**Created**: 2026-05-16  
**Status**: Draft  
**Input**: WikiLink `[[]]` autocomplete list not appearing; Backlinks section always empty; no reindex capability

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — WikiLink Autocomplete When Typing `[[` (Priority: P1)

When the user types `[[` anywhere in the editor, a suggestion dropdown immediately appears listing all markdown notes in the workspace. The user can type to filter the list, then press Enter or click to insert a complete wikilink (`[[Note Title]]`). Pressing Escape dismisses the popup without inserting anything.

**Why this priority**: The autocomplete is the primary entry point for all wikilink creation. Without it, users cannot discover or link to other notes, making the entire wikilink feature unusable.

**Independent Test**: Open any markdown file, type `[[`, verify the dropdown appears with workspace note titles, select one, and confirm the text `[[Note Title]]` is inserted and the dropdown closes.

**Acceptance Scenarios**:

1. **Given** the editor is open with a markdown file, **When** the user types `[[`, **Then** a suggestion dropdown appears within 300 ms listing workspace note titles
2. **Given** the suggestion dropdown is visible and the user types additional characters, **When** the typed characters match a subset of note titles, **Then** the dropdown filters in real time to show only matching notes
3. **Given** the suggestion dropdown is open, **When** the user presses Enter or clicks a note title, **Then** the dropdown closes and `[[NoteTitle]]` is inserted at the cursor
4. **Given** the suggestion dropdown is open, **When** the user presses Escape, **Then** the dropdown closes and no text is inserted beyond the `[[` already typed
5. **Given** no workspace notes exist or no notes match the typed filter, **When** the dropdown would otherwise appear, **Then** the dropdown shows an empty state message such as "No notes found"

---

### User Story 2 — WikiLinks Render as Clickable Links (Priority: P1)

Existing `[[Note Title]]` and `[[Note Title|Display Text]]` syntax in a document renders as styled, clickable links inside the editor. Clicking a wikilink opens the target note in the editor.

**Why this priority**: Without rendering, wikilinks are invisible raw text — all downstream features (backlinks, navigation) depend on correct rendering.

**Independent Test**: Open a markdown file containing `[[Some Note]]`. The text must render as a styled anchor (distinct from plain text and from external hyperlinks), and clicking it must navigate to that note.

**Acceptance Scenarios**:

1. **Given** a markdown document containing `[[Target Note]]`, **When** the editor loads the document, **Then** the wikilink renders as a styled inline link with the text `[[Target Note]]`
2. **Given** a wikilink with display text `[[Target Note|Custom Label]]`, **When** the editor renders it, **Then** the visible text is `[[Custom Label]]` and the link target is `Target Note`
3. **Given** a rendered wikilink in the editor, **When** the user clicks it, **Then** the target note opens in the editor
4. **Given** a document with wikilinks, **When** the user saves the document, **Then** the saved file contains the original `[[...]]` markdown syntax unchanged (round-trip safe)

---

### User Story 3 — Backlinks Panel Shows Incoming Links (Priority: P2)

The Inspector panel's Backlinks section lists all other notes in the workspace that contain a `[[CurrentNote]]` reference. Each entry shows the source note's title and is clickable to navigate to it.

**Why this priority**: Backlinks are valuable for knowledge-graph navigation but depend on P1 rendering working correctly. They surface connections the user may not remember.

**Independent Test**: With two notes where Note B contains `[[Note A]]`, open Note A in the editor, open the Inspector panel, and verify Note B appears in the Backlinks section.

**Acceptance Scenarios**:

1. **Given** Note B contains `[[Note A]]`, **When** Note A is open in the editor and the Inspector panel is visible, **Then** the Backlinks section shows Note B in its list
2. **Given** no other notes link to the current file, **When** the Inspector panel is open, **Then** the Backlinks section shows the message "No backlinks yet"
3. **Given** the Backlinks section shows entries, **When** the user clicks a backlink entry, **Then** the source note opens in the editor
4. **Given** a note is open, **When** the editor first loads (without requiring the user to switch tabs), **Then** backlinks are already populated in the Inspector panel

---

### User Story 4 — Reindex Workspace Notes (Priority: P2)

The user can trigger a manual re-scan of the workspace to refresh the note index (autocomplete list and backlinks). This is needed when files are created, renamed, or deleted outside VS Code.

**Why this priority**: The file watcher handles most cases, but external file operations (e.g., git checkout, bulk file moves) require a manual trigger.

**Independent Test**: Add a new markdown file to the workspace via the terminal (outside VS Code), trigger reindex, then type `[[` in the editor and verify the new file appears in the autocomplete list.

**Acceptance Scenarios**:

1. **Given** a new note was created outside VS Code, **When** the user runs the "Reindex Workspace" command, **Then** the new note appears in the `[[` autocomplete dropdown
2. **Given** the user triggers reindex, **When** the indexing completes, **Then** the backlinks panel updates to reflect the current state of all notes
3. **Given** the user triggers reindex, **When** indexing is in progress, **Then** the command is not triggered a second time (debounced/locked)

---

### Edge Cases

- What happens when two notes have the same filename stem? Both appear in the dropdown with full paths to disambiguate.
- What if a `[[Target]]` link points to a note that does not exist? The wikilink still renders (as an unresolved link with distinct styling if desired) but clicking it does nothing or shows an error.
- What if the editor is open when a file is deleted? The backlinks entry for the deleted file disappears on next index update.
- What happens with circular wikilinks (A links to B, B links to A)? Both appear in each other's backlinks — no infinite loop.
- What if the workspace has hundreds of notes? The autocomplete dropdown must still appear within 300 ms (it queries a pre-built in-memory index, not the file system).

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Typing `[[` in the editor MUST trigger a suggestion dropdown listing all indexed workspace markdown notes
- **FR-002**: The suggestion dropdown MUST filter notes in real time as the user types characters after `[[`
- **FR-003**: Selecting a note from the dropdown MUST insert `[[NoteTitle]]` syntax at the cursor and close the dropdown
- **FR-004**: Pressing Escape MUST dismiss the dropdown without inserting a complete wikilink
- **FR-005**: The editor MUST render `[[Target]]` and `[[Target|Label]]` markdown syntax as styled inline links
- **FR-006**: Clicking a rendered wikilink MUST send a message to the extension host to open the target note
- **FR-007**: Saving a document containing wikilinks MUST preserve the original `[[...]]` markdown syntax (no data loss)
- **FR-008**: The Inspector Backlinks section MUST be populated when a note is opened, without requiring the user to switch editor tabs
- **FR-009**: The Backlinks section MUST update when another note that links to the current file is modified
- **FR-010**: A "Reindex Workspace" command MUST be available to manually refresh the note index
- **FR-011**: The file watcher MUST automatically update the index when markdown files are created, modified, or deleted within VS Code

### Key Entities

- **Note**: A markdown file in the workspace with a path, title (from H1 or frontmatter), filename stem, and optional aliases
- **WikiLink**: An inline `[[Target]]` or `[[Target|Label]]` reference connecting two notes
- **BacklinkEntry**: A record of a source note that contains a wikilink to the current note
- **NoteIndex**: The in-memory set of all indexed Notes, used for autocomplete lookup and backlink computation

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The `[[` autocomplete dropdown appears within 300 ms of the second `[` being typed
- **SC-002**: Wikilinks in an existing document render correctly on first editor load with no additional user action
- **SC-003**: Backlinks are visible in the Inspector panel immediately when a note is opened (no tab-switching required)
- **SC-004**: Saving a file containing wikilinks produces a file byte-for-byte identical in its `[[...]]` syntax (round-trip lossless)
- **SC-005**: All Playwright smoke tests for wikilink autocomplete, rendering, and backlinks pass in CI
- **SC-006**: Manual reindex completes and updates the autocomplete list within 5 seconds for a workspace of up to 500 notes

---

## Assumptions

- The workspace uses standard markdown files (`.md`) — no other file types are indexed for wikilinks
- The Foam adapter (`foamAdapter.ts`) is already initialized when the extension activates — this spec does not change initialization
- The Inspector panel is already present in the UI (from a prior implementation); this spec wires it up with real data
- The `@tiptap/suggestion` package is already installed (`^3.23.2`) and compatible with TipTap 3.x
- Wikilink autocomplete does not need to work in code blocks or frontmatter — only in normal prose
- The extension host is responsible for resolving note paths; the webview only sends the title/name string
- Mobile/touch interactions are out of scope
