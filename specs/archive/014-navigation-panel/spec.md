# Feature Specification: Navigation Panel Search & Filter

**Folder**: `specs/014-navigation-panel/`  
**Created**: 2026-04-12  
**Status**: Draft  
**Input**: User description: "Add search for headings in the navigation panel via a small search textbox next to the word CONTENTS"

## User Scenarios & Testing

### User Story 1 — Filter Headings by Keyword (Priority: P1)

A user with a long document (50+ headings) opens the TOC pane and wants to jump to a heading they partially remember. They type a few characters into the filter field. The list narrows in real-time to show only matching headings.

**Why this priority**: Core value — without filtering, users must scroll through the entire TOC list manually.

**Independent Test**: Open a document with many headings, type a substring, verify only matching headings appear.

**Acceptance Scenarios**:

1. **Given** the TOC pane is open with 20+ headings, **When** user types "deploy" in the filter field, **Then** only headings containing "deploy" (case-insensitive) are displayed.
2. **Given** the filter field contains text, **When** user clears the field (backspace or clear button), **Then** all headings are shown again.
3. **Given** the filter field contains text with no matches, **When** user looks at the list, **Then** a "No matching headings" empty state is shown.

---

### User Story 2 — Keyboard-Driven Navigation (Priority: P1)

A user activates the filter field, types a query, then uses keyboard shortcuts to navigate results and jump to the selected heading without touching the mouse.

**Why this priority**: Same priority as filtering — keyboard users need to navigate results, not just see them.

**Independent Test**: Focus filter, type query, press ArrowDown/ArrowUp to select, press Enter to navigate.

**Acceptance Scenarios**:

1. **Given** the filter shows 3 matching headings, **When** user presses ArrowDown, **Then** the first result is highlighted/focused.
2. **Given** a heading is focused in the list, **When** user presses Enter, **Then** the editor scrolls to that heading.
3. **Given** the filter is focused, **When** user presses Escape, **Then** the filter is cleared and focus returns to the editor.

---

### User Story 3 — Filter Persists During Scroll (Priority: P2)

While the user scrolls through the document, the active heading highlight updates in the filtered list. The filter text remains stable and is not disrupted by scroll-driven TOC updates.

**Why this priority**: Without this, scroll updates would reset the filter — frustrating UX.

**Independent Test**: Type a filter, scroll the document, verify the filter text stays and the active highlight updates among visible (filtered) items only.

**Acceptance Scenarios**:

1. **Given** a filter is active showing 5 headings, **When** user scrolls the document, **Then** the active heading highlight updates among the 5 visible headings.
2. **Given** a filter is active, **When** the TOC list re-renders due to scroll, **Then** the filter input text is preserved.

---

### Edge Cases

- What happens when the user types only whitespace? Treat as empty — show all headings.
- What happens when headings contain special characters (e.g., `## C++ Templates`)? Match literally, no regex interpretation.
- What happens when the filter field is focused while the pane is collapsed? Filter state is cleared on collapse.

## Requirements

### Functional Requirements

- **FR-001**: The TOC pane header MUST contain a filter input that allows typing to filter headings.
- **FR-002**: Filtering MUST be case-insensitive substring matching against heading text.
- **FR-003**: The filter MUST update results in real-time as the user types (no submit button).
- **FR-004**: The filter input MUST show a clear (×) button when text is present.
- **FR-005**: Pressing Escape in the filter MUST clear the filter text and return focus to the editor.
- **FR-006**: The filter input MUST NOT steal focus from the editor on initial panel open.
- **FR-007**: The filter state MUST be cleared when the TOC pane is hidden.
- **FR-008**: Active heading tracking MUST work within the filtered subset of headings.
- **FR-009**: The "No matching headings" empty state MUST appear when filter produces zero results.
- **FR-010**: ArrowDown/ArrowUp in the filter input MUST move focus to list items; Enter on a focused item MUST navigate.

### Non-Functional Requirements

- **NFR-001**: Filtering must feel instant — no perceptible delay for up to 500 headings.
- **NFR-002**: Filter input must match the existing TOC pane visual design language (muted, compact, uppercase label style).
- **NFR-003**: No additional dependencies — pure DOM manipulation consistent with existing tocPane.ts.
