# Export

## Overview

The export domain describes the quality and compatibility expectations for Markdown output. It covers how tables, line breaks, and special formatting should be represented when the document is exported, especially for external tools and AI consumption.

## User Scenarios

1. **Pandoc-friendly export**: Given a document with tables and bullets, when the content is exported, then the output remains compatible with Pandoc and GitHub-flavored markdown.
2. **Token-efficient export**: Given a user preparing content for AI processing, when compression settings are enabled, then the markdown output is shorter without sacrificing structural correctness.
3. **Stable exported markup**: Given a document with advanced markdown constructs, when the user exports it, then the output does not introduce unnecessary HTML or break existing document semantics.

## Functional Requirements

- **EXP-001**: The system MUST export markdown in a way that remains compatible with common markdown processors.
- **EXP-002**: The system MUST preserve the meaning of table content, line breaks, and nested lists during export.
- **EXP-003**: The system SHOULD support a compression mode that minimizes whitespace and markup size.
- **EXP-004**: The system SHOULD avoid emitting unnecessary HTML tags when markdown-native constructs are sufficient.

## Business Rules

- Export output MUST be valid markdown and preserve document semantics.
- Token compression SHALL not modify content meaning or list structure.
- Export behavior SHALL be consistent across editor save/load cycles.
- HTML output SHALL be used only when necessary for correct visualization and compatibility.

## Out of Scope

- Export to formats other than markdown.
- Full Pandoc filter or extension support beyond standard markdown compatibility.
- Detailed tokenization or AI prompt tuning strategies.

## Spec History

<!-- AUTO-GENERATED: do not edit manually -->
| Spec | Summary | Date |
|------|---------|------|
| [013-pandoc-bullet-newlines](../../specs/archive/013-pandoc-bullet-newlines/) | Fix markdown bullets and line breaks for Pandoc-aware export | — |
| [019-html-br-optimization](../../specs/archive/019-html-br-optimization/) | Replace verbose HTML line breaks with compact alternatives for token efficiency | — |
| [029-minify-tables](../../specs/archive/029-minify-tables/) | Add optional table compression to reduce export size | — |
| [030-compression-enhancement](../../specs/archive/030-compression-enhancement/) | Add granular compression controls and blank-line reduction for export | — |

## Pending Review

<!-- Items here need a human to update prose sections above -->
- [ ] Confirm whether export compression should be described as an optimization feature rather than a core compatibility requirement.
