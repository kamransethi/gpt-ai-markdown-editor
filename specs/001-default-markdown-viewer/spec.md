# Feature Specification: Default Markdown Viewer Setup

**Feature Branch**: `001-default-markdown-viewer`  
**Created**: April 5, 2026  
**Status**: Draft  
**Input**: User description: "After extension installation, prompt users to set Visual Markdown Editor as the default markdown viewer. Change configuration to make that happen if the user wants it. Do not make any changes otherwise"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - First-Time Installation Prompt (Priority: P1)

When a user installs the Visual AI Markdown Editor extension for the first time, they should be greeted with a simple, non-intrusive prompt asking if they'd like to set it as their default markdown viewer.

**Why this priority**: This is the core feature request. It provides immediate value by offering users a quick setup option right when they install the extension, reducing friction in the onboarding experience.

**Independent Test**: Can be tested by performing a fresh extension installation and verifying that the prompt appears and functions correctly regardless of other features.

**Acceptance Scenarios**:

1. **Given** the extension is installed for the first time, **When** the extension activates, **Then** a prompt appears asking the user if they want to use Visual Markdown Editor as the default markdown viewer
2. **Given** the prompt is displayed, **When** the user clicks "Yes", **Then** the VS Code configuration is updated to set `markdown.preview.defaultPreviewPane` to the extension's ID
3. **Given** the prompt is displayed, **When** the user clicks "No", **Then** no configuration changes are made
4. **Given** the user has responded to the prompt, **When** the extension loads again, **Then** the same prompt does not appear again (the choice is remembered)

---

### User Story 2 - Respect Existing Configuration (Priority: P1)

If the user already has a default markdown viewer configured, or if they've previously declined this prompt, the system should respect that choice and not prompt them again.

**Why this priority**: This is essential to avoid annoying users who have already made a choice or prefer other tools. It demonstrates respect for user intent.

**Independent Test**: Can be tested by artificially setting configuration values and verifying that the prompt behavior respects existing state.

**Acceptance Scenarios**:

1. **Given** the user has already configured a default markdown viewer, **When** the extension activates, **Then** no prompt is displayed
2. **Given** the user has previously dismissed this prompt, **When** the extension activates, **Then** the same prompt does not appear again
3. **Given** the user has accepted the prompt on first install, **When** the extension updates to a new version, **Then** the prompt does not appear again

---

### User Story 3 - Manual Configuration Access (Priority: P2)

Users should be able to change their markdown viewer preference at any time through VS Code's settings, without relying solely on the installation-time prompt.

**Why this priority**: This provides an escape hatch for users who want to change their mind later or make the configuration change manually. It's not critical for initial install but important for flexibility.

**Independent Test**: Can be tested independently by navigating settings and changing the configuration value.

**Acceptance Scenarios**:

1. **Given** the user is in VS Code settings, **When** they search for `markdown.preview.defaultPreviewPane`, **Then** they can see and modify the setting
2. **Given** the user changes the setting manually, **When** they open a markdown file, **Then** the correct viewer is used

---

### Edge Cases

- **Explicit "No" then manual configuration**: User clicks "No", never gets prompted again; can still configure manually via settings
- **Modal dismissed (closed without clicking)**: Treated as "pending decision", user may be prompted again on next activation
- **User reinstalls extension**: Checks `globalState` to see if prior decision exists; if yes (explicit Yes or No), does not prompt
- **User updates to new version**: Does not re-prompt; persisted decision from first install remains

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST detect if this is the first time the extension has been activated ever (not per-update); use `globalState` to track this permanently
- **FR-002**: System MUST display a blocking modal dialog with "Yes" and "No" buttons asking if user wants to set Visual Markdown Editor as the default markdown viewer
- **FR-003**: System MUST accept user's explicit choice via "Yes" or "No" button; if user dismisses the modal without selecting a button, treat as "pending" (not a decision)
- **FR-004**: When user clicks "Yes", system MUST update VS Code's `markdown.preview.defaultPreviewPane` configuration to the string value `kamransethi.gpt-ai-markdown-editor`
- **FR-005**: When user clicks "No" or dismisses the modal, system MUST NOT modify any configuration
- **FR-006**: System MUST check `globalState` to see if user has made an explicit choice (Yes or No); if yes, do not show the prompt again
- **FR-007**: System MUST persist explicit user choices ("Yes" or "No") in extension's `globalState`; modal dismissals are NOT persisted (may be prompted again)
- **FR-008**: System MUST work correctly across extension installation, updates, and reloads; explicit choices (Yes/No) persist permanently across all future activations

### Key Entities

- **User Preference State**: Tracks whether the user has made a choice (yes/no/pending) and what that choice was
- **VS Code Configuration**: The `markdown.preview.defaultPreviewPane` setting that stores the default viewer preference

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Modal dialog appears within 2 seconds of extension activation on first install
- **SC-002**: Configuration `markdown.preview.defaultPreviewPane` is set to `kamransethi.gpt-ai-markdown-editor` when user clicks "Yes"
- **SC-003**: No configuration changes occur when user clicks "No" or dismisses the modal
- **SC-004**: User is never re-prompted after clicking "Yes" or "No" explicitly (even across updates and reloads)
- **SC-005**: User may be re-prompted if they dismiss the modal without clicking a button (subsequent activation will show it again)

## Assumptions

- **Modal dialogs are acceptable UX**: Users are comfortable with blocking modals for one-time setup decisions
- **`globalState` is reliable**: VS Code's extension `globalState` API persists reliably without loss or corruption across sessions, reloads, and updates
- **Extension ID is stable**: The extension ID `kamransethi.gpt-ai-markdown-editor` will be the correct value for the setting
- **Users can close modals**: Users know how to close a modal dialog by clicking a button
- **Target scope**: Feature targets new users installing the extension for the first time; existing users won't be re-prompted

---

## Clarifications

### Session April 5, 2026

**Five clarifying questions resolved before planning:**

- **Q: Prompt UI type?** → A: Blocking modal dialog with "Yes" and "No" buttons (not notification, not quick pick)
- **Q: What if user dismisses?** → A: Dismissing (closing modal) ≠ saying "No" — user may be prompted again on next activation
- **Q: When does prompt show?** → A: Only on very first activation ever, not on every update
- **Q: What value to set?** → A: Set `markdown.preview.defaultPreviewPane` to `kamransethi.gpt-ai-markdown-editor`
- **Q: How to track decisions?** → A: Check `globalState` only; store explicit Yes/No choices permanently, but not dismissals

**Impact on requirements:**
- FR-001: Now clarified to mean "first ever", not "first per version"
- FR-002: Changed from "modal or notification" to specifically "modal dialog"
- FR-003: Clarified that dismiss ≠ decision; only Yes/No are decisions
- FR-004: Now specifies exact config value to set
- FR-007: Clarified that only explicit Yes/No are persisted, not dismissals
