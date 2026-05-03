# Feature Specification: Minify Markdown

**Folder**: `specs/029-minify-tables/`
**Created**: 2026-04-25
**Status**: Draft**PRD Domains**: `tables`, `export`**Input**: User description: "Create a new feature specification for the Markdown editor called Minify Markdown. The feature should be default OFF in settings under Editor &gt; Behavior with a setting labeled Compress Content. When enabled, Markdown output should compress formatting to save LLM token usage by minimizing padding and avoiding aligned columns, while preserving the exact visual style and arrangement of the table content. Also include other token-saving techniques for LLM consumption without changing visual rendering. Ask any clarification questions if needed."
## Clarifications

### Session 2026-04-25

- Q: Should the feature include only compressed table columns, or also trim redundant blank lines and tighten non-visible delimiters for broader LLM token savings? → A: Option B (compress table spacing plus trim redundant blank lines and tighten non-visible delimiters)
## User Scenarios &amp; Testing *(mandatory)*

### User Story 1 - Enable compressed table formatting (Priority: P1)

A Markdown editor user wants to reduce LLM token usage for documents containing tables without changing how the table renders visually.

**Why this priority**: This delivers the primary value of the feature by reducing token cost for table-heavy content while keeping output rendering identical.

**Independent Test**: Enable the setting, export or preview Markdown output for a table, and verify that the rendered table appearance remains unchanged while the source Markdown uses minimal padding and non-aligned table syntax.

**Acceptance Scenarios**:

1. **Given** the setting is OFF and a Markdown table is present, **When** the user views or exports the document, **Then** the table output retains the editor's existing table formatting.
2. **Given** the setting is enabled and a Markdown table is present, **When** the user views or exports the document, **Then** the table output uses minimal filler spaces and non-aligned columns while rendering identically to the original table.
3. **Given** the setting is enabled, **When** a table output is parsed by a standard Markdown renderer, **Then** the rendered visual arrangement and cell content are unchanged.

---

### User Story 2 - Preserve non-table visual rendering (Priority: P2)

A user wants the feature to save tokens in Markdown output beyond tables without changing the visible document structure.

**Why this priority**: It ensures that the setting provides broader token efficiency without introducing rendering differences outside tables.

**Independent Test**: Enable the setting and verify that the editor preserves the same visible output while trimming non-rendered formatting such as redundant blank lines or unnecessary padding outside whitespace-sensitive blocks.

**Acceptance Scenarios**:

1. **Given** the setting is enabled and the document includes headings, lists, and paragraphs, **When** the document is serialized to Markdown output, **Then** the visible structure remains identical and only non-visible formatting is compressed.
2. **Given** the document includes code blocks or preformatted text, **When** the setting is enabled, **Then** spacing and indentation inside those blocks remain unchanged.

---

### User Story 3 - Configure behavior from Editor &gt; Behavior (Priority: P3)

A user wants a clear setting location and label for this token-saving feature.

**Why this priority**: Good discoverability and configuration reduce friction and prevent surprise formatting changes.

**Independent Test**: Open editor preferences, locate the new setting, and confirm it defaults to OFF and can be toggled.

**Acceptance Scenarios**:

1. **Given** the user opens the editor settings, **When** they navigate to Editor &gt; Behavior, **Then** they see a setting labeled "Compress Content" with an OFF default state.
2. **Given** the user enables "Compress Content", **When** they save settings, **Then** the feature remains enabled for subsequent Markdown output sessions.

---

### Edge Cases

- When a document contains a table inside a fenced code block, the feature must not alter the code block content or its spacing.
- When a table has embedded Markdown formatting inside cells, the output must preserve the exact rendered arrangement and cell content.
- When a document mixes tables and whitespace-sensitive literal blocks, compression must only affect formatting outside literal blocks.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The editor MUST add a new setting labeled "Compress Content" under `Editor > Behavior`.
- **FR-002**: The "Compress Content" setting MUST be OFF by default.
- **FR-003**: When enabled, the editor MUST compress Markdown table output by minimizing cell padding and avoiding aligned columns while preserving the exact rendered table appearance.
- **FR-004**: When enabled, the editor MUST apply additional token-saving output transformations for LLM consumption without changing visible rendering.
- **FR-005**: When disabled, the editor MUST preserve the existing Markdown output formatting for tables and other content.
- **FR-006**: The editor MUST not alter content inside code blocks, fenced blocks, or preformatted text where spacing is semantically meaningful.
- **FR-007**: The feature MUST preserve the exact textual content, row order, column order, and visual arrangement of tables.
- **FR-008**: The feature MUST keep visible Markdown rendering identical for standard Markdown renderers.

### Key Entities *(include if feature involves data)*

- **Editor Behavior Setting**: Represents the user preference for enabling token-saving Markdown output.
- **Markdown Output Transformer**: The mechanism responsible for converting document content into compressed Markdown while preserving rendering.
- **Table Formatting Rules**: The rules that determine how table rows, pipes, separators, and padding are emitted.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The feature is discoverable in `Editor > Behavior` with a "Compress Content" toggle that defaults to OFF.
- **SC-002**: When enabled, table Markdown output must use minimal padding and avoid aligned columns while rendering visually identical to the original table.
- **SC-003**: When enabled, Markdown output must apply other non-visible token-saving formatting techniques without changing visible rendering outside of tables.
- **SC-004**: For documents containing tables, the compressed Markdown output size must be measurably smaller than the original aligned-table output, indicating token savings.
- **SC-005**: Standard Markdown renderers must display the same table arrangement and content for both compressed and uncompressed output.
- **SC-006**: The setting must persist across editor sessions and affect subsequent Markdown output generation.

## Assumptions

- The feature only changes Markdown serialization and does not alter editor display, editing behavior, or underlying document semantics.
- Compression applies only where formatting is non-visible, such as table padding, redundant blank lines, and unnecessary spacing around Markdown delimiters.
- The feature avoids changing whitespace inside code blocks, fenced blocks, and other literal text sections.
- Users who prefer readable Markdown formatting may leave this setting OFF, so the default should preserve current output style.
- Standard Markdown rendering behavior is the baseline for determining whether compressed output preserves visual appearance.