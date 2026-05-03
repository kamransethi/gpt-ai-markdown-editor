# Tables

## Overview

The tables domain covers how users create, edit, and export markdown tables with reliable behavior. It focuses on authoring experience, compatibility with GitHub-flavored markdown, and table-specific content transformations such as bullets inside cells and compression for LLM efficiency.

## User Scenarios

1. **Table creation and editing**: Given a table in the editor, when a user enters content in a cell, then the editor preserves that content and maintains valid markdown structure.
2. **Bullet support inside table cells**: Given a nested list or bullet-like content inside a table cell, when the document is saved, then the content serializes in a way that remains valid in GitHub-flavored markdown.
3. **Export-friendly output**: Given a markdown document with tables, when the content is exported or processed for AI use, then tables are represented in a compact, token-efficient way without breaking display compatibility.
4. **Compression toggle control**: Given a user choosing a compression setting, when table compression is enabled, then padding and alignment are minimized while preserving readability and markdown semantics.

## Functional Requirements

- **TBL-001**: The system MUST preserve table cell content through editing and serialization without corrupting adjacent rows or columns.
- **TBL-002**: The system MUST support bullet-style content in table cells using a markdown-compatible serialization strategy.
- **TBL-003**: The system MUST ensure table cell content remains valid in GitHub-flavored markdown and common markdown renderers.
- **TBL-004**: The system SHOULD offer a compression mode that minimizes table whitespace and alignment for token efficiency.
- **TBL-005**: The system SHOULD preserve code block whitespace and list structure inside table cells when compression is enabled.

## Business Rules

- Table serialization MUST not produce invalid markdown or break table structure.
- Bulleted content inside table cells SHALL be represented using a stable, export-safe encoding strategy.
- Compression changes SHALL apply only to whitespace and padding, not to semantic table content.
- The table editing experience MUST not force users to learn a new syntax beyond standard markdown.

## Out of Scope

- General markdown paragraph or heading behavior outside of tables.
- Non-markdown table formats such as Excel or CSV import/export.
- Rendering-specific table styles beyond the core markdown representation.

## Spec History

<!-- AUTO-GENERATED: do not edit manually -->
| Spec | Summary | Date |
|------|---------|------|
| [013-pandoc-bullet-newlines](../../specs/archive/013-pandoc-bullet-newlines/) | Fix table and bullet line break behavior for Pandoc-compatible markdown export | — |
| [029-minify-tables](../../specs/archive/029-minify-tables/) | Introduce optional table compression to reduce markdown token usage | — |
| [030-compression-enhancement](../../specs/archive/030-compression-enhancement/) | Add granular compression controls for tables and blank-line reduction | — |
| [033-table-cell-bullet-serialization](../../specs/archive/033-table-cell-bullet-serialization/) | Implement bullets in table cells as text prefixes to preserve GFM compatibility | — |
| [038-unified-ai-webview-markdown](../../specs/038-unified-ai-webview-markdown/) | Support markdown table rendering inside AI explanation and image analysis webviews | — |

## Pending Review

<!-- Items here need a human to update prose sections above -->
- [ ] Confirm whether table compression behavior from spec 030 should be split into separate requirements for data fidelity and token efficiency.
