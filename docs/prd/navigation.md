# Navigation

## Overview

The navigation domain describes how users discover and move through headings in their document. It covers the table of contents and heading search capability, helping users find sections quickly in larger markdown files.

## User Scenarios

1. **Search headings**: Given a large document, when the user types a term into the navigation search box, then matching headings are filtered in real time.
2. **Navigate to a section**: Given a heading entry in the filtered list, when the user selects it, then the editor jumps to that heading position.
3. **Responsive navigation**: Given rapid input changes, when the user edits the search filter, then the navigation list updates without lag.

## Functional Requirements

- **NAV-001**: The system MUST provide a navigation panel with a searchable list of document headings.
- **NAV-002**: The system MUST filter navigation results in real time as the user types.
- **NAV-003**: The system MUST allow users to select a heading and navigate directly to that section.
- **NAV-004**: The system SHOULD preserve the current search filter while the panel is open.

## Business Rules

- Navigation results MUST match heading text case-insensitively.
- The navigation panel SHALL not cause document scrolling or selection side effects while filtering.
- Selected headings SHALL reflect the current document structure.
- The navigation search SHALL not require a reload of the document.

## Out of Scope

- Full document outline editing or heading renaming in the navigation panel.
- Non-heading navigation mechanisms such as code symbols or outline trees.
- Search across multiple files.

## Spec History

<!-- AUTO-GENERATED: do not edit manually -->
| Spec | Summary | Date |
|------|---------|------|
| [014-navigation-panel](../../specs/archive/014-navigation-panel/) | Add heading search and filter capabilities to the navigation panel | — |

## Pending Review

<!-- Items here need a human to update prose sections above -->
- [ ] Confirm whether the navigation filter should also support tag or anchor matching in later releases.
