# Frontmatter

<!-- prd-last-spec: 008 -->

## Overview

The frontmatter domain describes how YAML metadata is surfaced and edited inside Flux Flow documents. It focuses on making frontmatter visible, easy to inspect, and safe to modify without disrupting the rest of the markdown content.

## User Scenarios

1. **View frontmatter quickly**: Given a document with YAML frontmatter, when the user opens the editor, then a visible entry point is available to inspect frontmatter details.
2. **Edit frontmatter safely**: Given a user chooses to view frontmatter, when they edit the YAML, then validation feedback is provided and frontmatter changes are integrated safely into the document.
3. **Avoid accidental changes**: Given a document without frontmatter, when the user works in the main editor, then frontmatter controls are not displayed unnecessarily.

## Functional Requirements

- **FM-001**: The system MUST provide a clear entry point for viewing frontmatter when YAML metadata is present.
- **FM-002**: The system MUST allow users to open and inspect the full frontmatter block in a dedicated view.
- **FM-003**: The system SHOULD provide validation feedback for frontmatter syntax to prevent malformed YAML.
- **FM-004**: The system SHOULD preserve frontmatter content exactly when switching between the frontmatter view and the main editor.

## Business Rules

- Frontmatter display MUST be hidden for documents without YAML metadata.
- The frontmatter view SHALL not alter document content unless the user explicitly saves changes.
- Validation feedback MUST be clear and not block users from making changes when the YAML is syntactically valid.
- Frontmatter interaction SHALL be lightweight and non-disruptive to normal editing tasks.

## Out of Scope

- Arbitrary metadata editing outside the frontmatter section.
- Advanced YAML schema enforcement beyond syntax validation.
- Frontmatter-related export policies outside of basic editing and preservation.

## Spec History

<!-- AUTO-GENERATED: do not edit manually -->
| Spec | Summary | Date |
|------|---------|------|
| [007-add-frontmatter-details](../../specs/archive/007-add-frontmatter-details/) | Add detailed frontmatter panel and inline YAML inspection | — |
| [008-view-frontmatter-button](../../specs/archive/008-view-frontmatter-button/) | Provide a dedicated VIEW FRONTMATTER button for quick access | — |

## Pending Review

<!-- Items here need a human to update prose sections above -->
- [ ] Check if frontmatter validation should be listed as a required capability rather than a SHOULD.
