# Feature Specification: TipTap Visual Diff

**Folder**: `specs/039-tiptap-visual-diff/`
**Created**: 2026-05-03
**Status**: Draft - Not implemented  
**Input**: User description: "Visual Markdown Diffing for VS Code Custom Editor using `prosemirror-changeset`"

## User Scenarios &amp; Testing *(mandatory)*

### User Story 1 - View Visual Diff When Opening in Compare Mode (Priority: P1)

When a user opens a Markdown file through VS Code's compare/diff context (e.g., "Compare with HEAD" from source control), the rich text editor automatically switches to visual diff mode. Changed text is highlighted inline: additions appear with a green background, and removed content appears with red strikethrough. No manual action is required — the highlighting is immediate and automatic.

**Why this priority**: This is the core value proposition — eliminating manual eyeballing when comparing file versions.

**Independent Test**: Open a Markdown file with uncommitted changes using VS Code's "Compare with HEAD" command. Verify the TipTap editor renders green highlights for additions and red strikethrough for removals without any user configuration.

**Acceptance Scenarios**:

1. **Given** a Markdown file has changes relative to its most recent committed version, **When** the user opens it via VS Code's compare/diff view, **Then** the editor automatically renders inline green highlights for added content and red strikethrough for removed content.
2. **Given** the diff view is open, **When** the user scrolls through the document, **Then** all diff highlights remain correctly aligned with their corresponding content throughout the scroll.
3. **Given** the file is opened through VS Code's diff context and the document contains table-formatted content, **When** the user views a changed row or cell, **Then** the diff highlights are visible while the document content remains fully readable.

---

### User Story 2 - Unified Single-Pane Comparison View (Priority: P2)

Instead of staring at two separate side-by-side panes, the user sees a single unified rich-text editor view that shows both what was removed and what was added in-place. Removals appear with red strikethrough in context, additions appear highlighted in green — all within one scrollable document.

**Why this priority**: Eliminates cognitive overhead of manually tracing changes across two editor columns; the unified view is the primary UX benefit of the feature.

**Independent Test**: Open a file with multi-section edits through VS Code's "Compare with HEAD". Verify the editor shows a single pane with inline red strikethrough for removed text and green highlights for added text, rather than two separate columns.

**Acceptance Scenarios**:

1. **Given** a file has additions and removals across multiple sections, **When** the user opens it in diff context, **Then** additions and removals are both visible inline in a single document view — not in separate panes.
2. **Given** the unified diff view is open, **When** the user scrolls, **Then** all highlight positions remain correctly aligned with their surrounding content.

---

### User Story 3 - Read-Only Protection in Diff Mode (Priority: P3)

When viewing a file comparison, the editor is locked to read-only mode. The user cannot accidentally type or modify the document while comparing versions.

**Why this priority**: Prevents accidental corruption of a document the user is only reviewing.

**Independent Test**: Open a file in diff mode and attempt to type in the editor. Verify no characters are inserted and the document is unchanged.

**Acceptance Scenarios**:

1. **Given** the editor is in diff mode, **When** the user clicks into the editor and attempts to type, **Then** no input is accepted and the document content remains unchanged.
2. **Given** the editor is in diff mode, **When** the user attempts to paste content, **Then** the paste operation has no effect.

---

### User Story 4 - Clean File Preservation When Saving in Diff Mode (Priority: P4)

Viewing a file diff must never corrupt the underlying Markdown file. If the user triggers a save while diff mode is active, the saved file is identical to the clean, unmodified current working version — no diff annotations, color spans, or comparison artifacts are written.

**Why this priority**: Protects document integrity; the comparison visualization is ephemeral and must not affect stored content.

**Independent Test**: Open a file in diff mode, press Ctrl+S, then open the saved file in a plain text editor. Verify no diff-related HTML tags, CSS classes, or markup are present.

**Acceptance Scenarios**:

1. **Given** the editor is displaying a visual diff, **When** the user saves the file, **Then** the saved Markdown file contains no diff annotations, `<span>` tags, CSS classes, or comparison-related markup.
2. **Given** the user exits diff mode and reopens the file in normal editing mode, **When** they view the file content, **Then** no residual diff artifacts appear in the editor or the file.

---

### Edge Cases

- What happens when the base version of the file does not exist in Git (new untracked file)?
- How does the system handle very large files (2,000+ lines) where diff computation may take longer?
- What happens when the user opens a file whose entire content is new with no committed base version?
- How does the system behave when the Git repository is unavailable or the user is working offline?
- What happens if the file is modified externally while the diff view is open?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The editor MUST automatically activate visual diff mode when a Markdown file is opened in VS Code's compare/diff context, without requiring any user action.
- **FR-002**: The editor MUST retrieve the base (original) version of the file from Git version history when in diff mode.
- **FR-003**: The editor MUST render added content using a green highlight that uses VS Code's built-in diff editor color variables, matching the user's active color theme.
- **FR-004**: The editor MUST render removed content using a red strikethrough style that uses VS Code's built-in diff editor color variables, matching the user's active color theme.
- **FR-005**: The editor MUST be in read-only (non-editable) mode while diff mode is active, rejecting all user keyboard and paste input.
- **FR-006**: When a file is saved while diff mode is active, the saved content MUST be identical to the clean current working version with no diff annotations, span tags, CSS classes, or comparison-related markup.
- **FR-007**: Diff highlights MUST render without obscuring other document formatting so that document content remains fully readable.
- **FR-008**: Diff highlight positions MUST remain correctly aligned with their corresponding content when the user scrolls through the document.
- **FR-009**: The editor MUST handle gracefully the case where no base version exists in Git (e.g., a newly created, uncommitted file), displaying the document in normal read mode without throwing an error.
- **FR-010**: Diff highlight styles MUST use VS Code's theme color variables so they respect the user's current color theme (light, dark, and high-contrast themes).

### Key Entities

- **Base Version**: The original file content from Git history (index or HEAD), used as the reference side of the comparison.
- **Modified Version**: The current working copy of the file, displayed with diff highlights showing what changed.
- **Diff Highlight**: A visual annotation (green background for additions, red strikethrough for removals) applied ephemerally using ProseMirror Decorations to content that differs between base and modified versions; never persisted to disk or into the document state.
- **Unified View**: A single editor pane displaying both the added and removed content in-place, eliminating the need to compare two separate side-by-side editor columns.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Visual diff highlights appear within 200 milliseconds for Markdown documents up to 2,000 lines when opened in VS Code's diff context.
- **SC-002**: 100% of files saved while diff mode is active contain no diff-related markup or annotations in the resulting Markdown file.
- **SC-003**: Users can identify all additions and removals in a document in a single scrollable pane without manually comparing two side-by-side editor columns.
- **SC-006**: Users can complete a full visual comparison of two file versions without performing any manual steps to activate the feature — diff mode activates automatically on diff context open.
- **SC-004**: Diff highlights are visually distinguishable and correctly colored in both VS Code light and dark themes without additional user configuration.
- **SC-005**: Attempting to type or paste content while in diff mode results in zero characters being inserted into the document.

## Assumptions

- The extension already uses TipTap as its rich text editor for Markdown files; this feature extends the existing editor integration.
- Users have Git installed and their workspace is a Git repository for diff functionality to be available; without Git the feature degrades gracefully to normal read mode.
- The feature applies to Markdown files only; other file types opened in diff context are out of scope.
- Desktop VS Code is the target; VS Code for the Web and mobile variants are out of scope for this version.
- The comparison is between the current working copy and the base version sourced from the Git URI provided by VS Code's diff context (typically the index or HEAD version); comparing arbitrary commits or branches through a custom UI is out of scope for this version.
- When Git is unavailable or the file has no commit history, the editor opens in its normal (non-diff) state without displaying an error to the user.