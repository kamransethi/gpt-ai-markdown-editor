# Editor Core

<!-- prd-last-spec: 040 -->

## Overview
The editor core domain describes the primary authoring experience in Flux Flow. It covers how users create, edit, and preserve markdown content in a reliable, responsive editor environment, including document lifecycle behaviors, drag-and-drop media handling, and the visible workspace experience.

## User Scenarios

1. **First-time default viewer prompt**: Given a new installation, when the editor loads, then the user is offered a one-time choice to make Flux Flow the default markdown viewer.
2. **Respect existing settings**: Given an existing markdown viewer preference, when the extension activates, then the editor does not override or repeat the prompt.
3. **Keyboard and document navigation**: Given a longer markdown file, when the user scrolls or navigates via headings, then the editor preserves position and avoids layout-induced jumpiness.
4. **Drag-and-drop files**: Given a non-image file dropped into the editor, when the user releases it, then the file is inserted as a markdown link without breaking the surrounding document.
5. **Rich editor lifecycle**: Given editor changes including HTML tags, tables, and images, when the content is saved or reloaded, then the markdown remains intact and stable.

## Functional Requirements

- **EC-001**: The system MUST allow the editor to be configured as the default markdown viewer at first install, without forcing the choice.
- **EC-002**: The system MUST respect existing user preferences and not re-prompt users who already have a markdown viewer configured.
- **EC-003**: The system MUST prevent scroll and layout regressions caused by document structure or side panels.
- **EC-004**: The system MUST support dropping files into the editor and converting them into markdown references.
- **EC-005**: The system MUST preserve document content accurately during save/load cycles, including advanced markdown constructs.
- **EC-006**: The system SHOULD provide a stable editor experience when webview code is refactored, ensuring visible behavior does not regress.

## Business Rules

- The editor MUST never overwrite an existing markdown viewer preference without explicit user consent.
- File drag-and-drop SHALL insert valid markdown that is consistent with the active document’s media path settings.
- Editor rendering changes SHALL not alter saved markdown semantics.
- User prompts MUST be one-time and dismissable, with remembered state.

## Out of Scope

- Specific plugin extension APIs and third-party plugin behavior.
- Non-editor tooling such as build scripts, release packaging, or test suite structure.
- Export-specific markdown serialization details that are covered in the export domain.

## Spec History

<!-- AUTO-GENERATED: do not edit manually -->
| Spec | Summary | Date |
|------|---------|------|
| [001-default-markdown-viewer](../../specs/archive/001-default-markdown-viewer/) | Prompt new users to set Flux Flow as the default markdown viewer while preserving existing preferences | — |
| [002-lossless-load-save-check](../../specs/archive/002-lossless-load-save-check/) | Ensure markdown survives editor load/save cycles and warn on incompatible transformations | — |
| [004-scroll-regression-fix](../../specs/archive/004-scroll-regression-fix/) | Fix scroll snapping caused by heading layout and TOC interactions | — |
| [005-copilot-integration-and-ai-refine](../../specs/archive/005-copilot-integration-and-ai-refine/) | Improve AI refine behavior and preserve formatting during editor interactions | — |
| [007-add-frontmatter-details](../../specs/archive/007-add-frontmatter-details/) | Add inline frontmatter panel behavior that influences document editing workflows | — |
| [008-view-frontmatter-button](../../specs/archive/008-view-frontmatter-button/) | Add a UI entry point for frontmatter inspection and editing inside the editor | — |
| [020-file-drag-drop](../../specs/archive/020-file-drag-drop/) | Support drag-and-drop insertion of non-image files as markdown links | — |
| [022-premium-editor-features-ai-refinements](../../specs/archive/022-premium-editor-features-ai-refinements/) | Add richer editor drag handles and tie AI prompt behavior to document editing | — |
| [025-tiptap-3.22.3-3.22.4-update](../../specs/archive/025-tiptap-3.22.3-3.22.4-update/) | Upgrade editor framework dependencies and stabilize core editing behavior | — |
| [031-remove-editor-bandaids](../../specs/archive/031-remove-editor-bandaids/) | Remove workarounds in favor of native editor behavior for tables, images, and links | — |
| [032-webview-modernization](../../specs/archive/032-webview-modernization/) | Modernize the webview model while preserving the visible editor experience | — |
| [006-BUG-viewer-prompt-persistence](../../specs/archive/006-BUG-viewer-prompt-persistence/) | Fix persistence bug where viewer prompt reappeared after dismissal | 2026-04-11 |
| [026-slash-command-refactor](../../specs/archive/026-slash-command-refactor/) | Refactor slash command registry for extensibility and performance | — |
| [033-table-cell-bullet-serialization](../../specs/archive/033-table-cell-bullet-serialization/) | Implement bullets in table cells as text prefixes to preserve GFM compatibility | 2026-05-02 |
| [035-image-context-menu](../../specs/035-image-context-menu/) | Move image actions from hover overlay to right-click context menu | 2026-05-02 |
| [039-tiptap-visual-diff](../../specs/039-tiptap-visual-diff/) | Add visual markdown diff view for comparing editor content changes using prosemirror-changeset | 2026-05-03 |
| [040-standalone-editor-bridge](../../specs/040-standalone-editor-bridge/) | Decouple editor from VS Code API to enable standalone browser dev mode and Playwright testing | 2026-05-09 |

## Pending Review

<!-- Items here need a human to update prose sections above -->
- [ ] Verify if spec 005's AI refine behavior also requires updates to EC-005 or user scenario wording.
- [ ] Spec 040 (Standalone Editor Bridge) changes editor initialization via bridge abstraction — verify EC-005 and EC-006 still accurately describe the document lifecycle behavior.
