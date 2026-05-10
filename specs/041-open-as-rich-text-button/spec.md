# Feature Specification: Open as Rich Text Button

**Folder**: `specs/041-open-as-rich-text-button/`
**Created**: 2026-05-09
**Status**: Cannot be implemented  
**PRD Domains**: `editor-core`, `navigation`
**Input**: User request to add an escape-hatch toolbar button so users can switch from VS Code's native text/diff editor to TipTap in one click, without disrupting the native diff workflow.

---

## Context

VS Code opens `.md` files in TipTap by default (when the user has configured it), but the native text editor is intentionally used for Git diffs and Copilot change review — tasks where VS Code's built-in diff tools (hunk accept/reject, inline change review) are superior and should not be replaced. Once the user finishes reviewing changes, they want a single-click path back to TipTap for comfortable reading and editing.

## User Scenarios &amp; Testing *(mandatory)*

### User Story 1 — Switch to Rich Text from Plain Text Editor (Priority: P1)

When VS Code opens a `.md` file in the plain text editor (e.g. opened from a Git diff, or opened programmatically with the text editor), a toolbar icon appears in the top-right of the editor title bar. Clicking it reopens the same file in TipTap immediately.

**Acceptance Scenarios**:

1. **Given** a `.md` file is open in VS Code's plain text editor, **When** the user looks at the editor toolbar, **Then** a "Open with Flux Flow Markdown Editor" icon button is visible in the top-right.
2. **Given** the toolbar button is visible, **When** the user clicks it, **Then** the file reopens in TipTap and the original text editor tab is replaced.
3. **Given** a non-markdown file is open in the text editor, **When** the user looks at the toolbar, **Then** the button is NOT visible.
4. **Given** a `.md` file is already open in TipTap, **When** the user looks at the toolbar, **Then** the button is NOT visible (no redundant action).

### User Story 2 — Open as Rich Text from Explorer Context Menu (Priority: P2)

When a user right-clicks any `.md` file in the VS Code Explorer, an "Open with Flux Flow Markdown Editor" option appears in the context menu.

**Acceptance Scenarios**:

1. **Given** a user right-clicks a `.md` file in the Explorer, **When** the context menu opens, **Then** "Open with Flux Flow Markdown Editor" is listed.
2. **Given** the user selects the context menu item, **Then** the file opens in TipTap.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: An `editor/title` button MUST appear when a `.md` file with `file://` scheme is active in VS Code's built-in text file editor (`workbench.editors.files.textFileEditor`).
- **FR-002**: The button MUST NOT appear when the active editor is TipTap or any non-text editor for `.md` files.
- **FR-003**: The button MUST NOT appear for non-`.md` files.
- **FR-004**: Clicking the button MUST invoke `vscode.openWith` using the `gptAiMarkdownEditor.editor` view type for the active file URI.
- **FR-005**: The `explorer/context` menu MUST include an "Open with Flux Flow Markdown Editor" entry for `.md` files.
- **FR-006**: The toolbar button MUST use a recognizable icon (`$(layout-panel-justify)`) consistent with "rich text / layout" iconography.

### Key Entities

- `**gptAiMarkdownEditor.openFile**`: Existing command that resolves a URI (from argument or active text editor) and calls `vscode.openWith` to open it in TipTap.
- `**editor/title**`: VS Code menu contribution point for editor toolbar icon buttons.
- `**explorer/context**`: VS Code menu contribution point for right-click context menus in the file Explorer.

## Success Criteria *(mandatory)*

- **SC-001**: The toolbar button appears within the editor title bar when a `.md` text file is active, verified by loading the Extension Development Host.
- **SC-002**: Clicking the button transitions the file to TipTap without requiring any additional user steps.
- **SC-003**: The button is absent when TipTap is the active editor for the same file.
- **SC-004**: The Explorer context menu entry appears for `.md` files and opens TipTap on selection.

## Assumptions

- The `gptAiMarkdownEditor.openFile` command is already registered in `extension.ts` and handles URI resolution from the active text editor when no explicit URI argument is passed.
- `priority: "option"` remains on the `customEditors` contribution — this feature does not change default editor routing.
- The feature targets desktop VS Code only; VS Code for the Web is out of scope.