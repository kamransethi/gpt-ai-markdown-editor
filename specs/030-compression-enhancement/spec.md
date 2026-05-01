# Feature Specification: Compression Enhancement

**Folder**: `specs/030-compression-enhancement/`
**Created**: 2026-04-26
**Status**: Draft
**Input**: User description: "Enhance the compression feature to allow choosing types of compression (Tables, Redundant blank lines) under a new COMPRESSION heading in settings. Ensure it preserves code fences, indented code, and literal text exactly."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Granular Table Compression (Priority: P1)

A user wants to compress only tables in their Markdown output to save tokens, but keep the rest of the document formatting exactly as authored.

**Why this priority**: It allows users to benefit from the most effective token-saving technique (table minification) without affecting other parts of their document structure.

**Independent Test**: Enable "Compress Tables" but disable "Trim Redundant Blank Lines". Verify that tables are minified while multiple blank lines between paragraphs are preserved.

**Acceptance Scenarios**:

1. **Given** "Compress Tables" is ON, **When** saving a document with a table, **Then** the table pipes are tightened and padding is removed.
2. **Given** "Compress Tables" is OFF, **When** saving a document with a table, **Then** the table formatting is preserved as aligned in the editor.

---

### User Story 2 - Granular Blank Line Trimming (Priority: P2)

A user wants to remove excessive blank lines from their document to save tokens, but wants to keep their tables aligned for readability in other editors.

**Why this priority**: Provides flexibility for users who care about vertical document length but want to maintain horizontal layout in tables.

**Independent Test**: Enable "Trim Redundant Blank Lines" but disable "Compress Tables". Verify that multiple blank lines are collapsed to a single one, while tables remain aligned.

**Acceptance Scenarios**:

1. **Given** "Trim Redundant Blank Lines" is ON, **When** saving a document with 3 consecutive blank lines outside code blocks, **Then** they are collapsed to a single blank line.
2. **Given** "Trim Redundant Blank Lines" is ON, **When** saving a document, **Then** leading and trailing blank lines in the file are removed.

---

### User Story 3 - Preservation of Code and Literal Text (Priority: P1)

A user wants to ensure that no compression technique ever alters their code blocks or preformatted text, as whitespace is semantically important there.

**Why this priority**: Critical for data integrity. Compression must never break code or literal content.

**Independent Test**: Enable all compression settings. Verify that content inside ` ``` ` blocks, ` ~~~ ` blocks, and indented code blocks remains byte-for-byte identical.

**Acceptance Scenarios**:

1. **Given** all compression settings are ON, **When** a document contains a fenced code block with multiple blank lines, **Then** those blank lines are preserved exactly.
2. **Given** all compression settings are ON, **When** a document contains indented code (4+ spaces), **Then** its indentation and internal spacing are preserved.

---

### User Story 4 - Settings Reorganization (Priority: P3)

A user wants to find all compression-related settings in one dedicated place.

**Why this priority**: Improves discoverability and usability as the number of compression options grows.

**Independent Test**: Open settings and verify that a new "COMPRESSION" section exists with the granular toggles.

**Acceptance Scenarios**:

1. **Given** the user opens settings, **When** navigating to the Editor page, **Then** they see a heading named "COMPRESSION" (all caps as requested) containing the compression toggles.
2. **Given** the new settings are configured, **When** the editor is restarted, **Then** the choices persist.

---

### Edge Cases

- **Mixed Content**: A table inside a blockquote should still be compressed if "Compress Tables" is ON.
- **Nested Blocks**: Compression should correctly identify the boundaries of fenced blocks even if they are nested or contain characters that look like pipes.
- **Very Large Tables**: Compression should perform efficiently without freezing the editor.
- **No Tables/No Blank Lines**: If a document is already "tight", compression should return the same string without unnecessary processing.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The editor MUST expose a new settings group titled "COMPRESSION" in the Editor settings panel.
- **FR-002**: The editor MUST provide a toggle "Compress Tables" that minimizes padding and alignment spacing in Markdown tables.
- **FR-003**: The editor MUST provide a toggle "Trim Redundant Blank Lines" that collapses multiple consecutive blank lines (outside code blocks) into a single blank line.
- **FR-004**: "Trim Redundant Blank Lines" MUST also remove any leading or trailing blank lines from the entire document.
- **FR-005**: The editor MUST ensure that compression (both table and blank line) is NEVER applied inside fenced code blocks (` ``` `, ` ~~~ `).
- **FR-006**: The editor MUST ensure that compression is NEVER applied inside indented code blocks (lines starting with 4+ spaces or a tab, following a blank line).
- **FR-007**: The previous single "Compress Content" setting SHOULD be deprecated or converted into these granular options. (Decision: Replace with granular options for better control).
- **FR-008**: Settings MUST default to OFF to prevent unexpected formatting changes for existing users.

### Key Entities *(include if feature involves data)*

- **Compression Settings**: A set of boolean flags (`compressTables`, `trimBlankLines`) persisted in VS Code configuration.
- **Markdown Transformer**: The logic that processes the serialized Markdown string based on active compression flags.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All compression settings are located under a "COMPRESSION" heading in the settings UI.
- **SC-002**: Enabling "Compress Tables" reduces the byte size of documents containing large tables by at least 10% (depending on alignment padding) without changing visual rendering.
- **SC-003**: Enabling "Trim Redundant Blank Lines" ensures that no more than one consecutive blank line exists in the output (outside code blocks).
- **SC-004**: Documents saved with all compression ON and then reopened show no loss of data or semantic meaning in code blocks.

## Assumptions

- We will replace the existing `compressContent` boolean with the new granular keys in `package.json`.
- "Redundant blank lines" means more than one blank line (i.e., `\n\n\n` becomes `\n\n`).
- The user's request for "COMPRESSION" heading in all caps will be honored literally.
- Indented code detection follows standard GFM rules.
