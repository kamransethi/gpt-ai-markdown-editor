# Feature Specification: Collapsible Front Matter Panel

**Feature Branch**: `007-add-frontmatter-details`  
**Created**: 2026-04-11  
**Status**: Ready for Planning  
**Input**: User description: "Show front matter in the heading in a collapsible TipTap details component. It should load and serialize properly, support complex frontmatter like MARP styling, display in a styled panel following code block design language with day/night themes (light gray/slightly lighter dark), have rounded borders, mono-spaced font, be default closed, and show 'FRONT MATTER' label using editor menu heading/code block design language."

---

## Clarifications

### Session 2026-04-11

- Q1: Edit capability → A: **Option C** - Editable plain text field with validation on save (no syntax highlighting in v1)
- Q2: Toolbar scope → A: **Option B** - Rename existing "Document Metadata" button to "Frontmatter"
- Q3: Malformed YAML handling → A: **Option A with override** - Block save by default with error, but allow "Save Anyway" or "Return to Fix" options
- Q4: CSS color strategy → A: **Option A** - Use existing editor CSS variables for day/night theming; keep simple if more robust
- Q5: Panel implementation → A: **Option B** - Use TipTap Details extension per official code sample (https://tiptap.dev/docs/editor/extensions/nodes/details)

---

## User Scenarios &amp; Testing *(mandatory)*

### User Story 1 - View Document Metadata Without Clutter (Priority: P1)

Writers often need to see document metadata (like title, author, date) without it taking up space or cluttering their writing view.

**Why this priority**: Front matter is essential context, but keeping it visible by default breaks the distraction-free writing experience. P1 because it's the core user value.

**Independent Test**: Writer can open a markdown file with front matter and see/hide metadata with one click, maintaining their writing flow.

**Acceptance Scenarios**:

1. **Given** a markdown file with front matter (YAML metadata block), **When** the file opens, **Then** the front matter appears in a collapsible panel that is default closed
2. **Given** the front matter panel is closed, **When** the user clicks the panel header, **Then** the panel expands showing the full metadata content
3. **Given** the front matter panel is open, **When** the user clicks the panel header, **Then** the panel collapses hiding the metadata
4. **Given** a document without front matter, **When** the file opens, **Then** no front matter panel is displayed

---

### User Story 2 - Verify Complex Presentation Metadata (Priority: P1)

Presentation creators using systems like MARP include complex styling metadata in front matter (colors, layouts, fonts), and need visual confirmation that the metadata is correct before presenting.

**Why this priority**: MARP and similar systems are growing use cases; P1 because these users have specific, important needs for metadata accuracy.

**Independent Test**: Writer can open a MARP-styled document, expand the front matter panel, and verify complex YAML metadata is displayed correctly and completely (no truncation or parsing errors).

**Acceptance Scenarios**:

1. **Given** a markdown file with multi-line, nested, or quoted YAML front matter, **When** the front matter panel is expanded, **Then** all YAML content is displayed accurately with proper formatting
2. **Given** front matter with special characters, unicode, or quoted strings, **When** displayed in the panel, **Then** content is rendered exactly as written (no escaping or modification)
3. **Given** complex MARP front matter with color definitions, style inclusions, or multi-line values, **When** loaded into the editor, **Then** the panel displays the content without parsing or rendering errors

---

### User Story 3 - Focus on Writing Content (Priority: P2)

Writers want a clean, distraction-free editing experience while knowing the document structure and metadata are present and safe.

**Why this priority**: Quality of life enhancement; P2 because it's about aesthetics and user comfort rather than core functionality.

**Independent Test**: Writer can open the editor and see a clean canvas with metadata neatly tucked away in a collapsible, visually integrated panel that doesn't interfere with the writing area.

**Acceptance Scenarios**:

1. **Given** a markdown file with front matter is open, **When** the front matter panel is closed, **Then** the main writing area is uncluttered and full-width
2. **Given** the front matter panel is open, **When** the user scrolls the document, **Then** the front matter panel does not interfere with scroll behavior or editor positioning
3. **Given** the editor is in day mode, **When** the front matter panel is displayed, **Then** the panel uses a light gray background with readable contrast
4. **Given** the editor is in night mode, **When** the front matter panel is displayed, **Then** the panel uses a slightly lighter version of the dark background with readable contrast

---

### Edge Cases & Decisions

- **No front matter present**: No front matter panel is displayed. The toolbar "Frontmatter" button allows users to add a front matter block to the document. Once added, the panel appears with collapsible display.
- **Mixed front matter**: Any YAML block followed by content is treated as front matter + body; robust handling of various YAML structures (nested, quoted, multi-line).
- **Malformed YAML on save**: Save is blocked with error dialog showing parse error. User can choose "Return to Fix" (stay in editor) or "Save Anyway" (bypass validation). File must remain valid to prevent corruption.
- **Front matter editing**: Front matter is editable as plain text in the collapsible panel (no syntax highlighting in v1, plain text field with monospace font). Validation runs on save attempt.
- **Serialization**: Front matter is persisted transparently by existing document sync mechanism; the panel is a display/edit overlay with no additional save logic required.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display front matter in a collapsible `<details>` panel only when present at the beginning of a markdown file
- **FR-002**: Front matter panel (details element) MUST be closed by default; user clicks the `<summary>` header to expand
- **FR-003**: System MUST preserve all front matter content during load, display, and save operations (no data loss or modification)
- **FR-004**: System MUST display the text "FRONT MATTER" in the `<summary>` header using consistent design language with other editor section headers
- **FR-005**: Front matter content MUST be editable as plain text in the panel with monospace font to preserve spacing and YAML structure
- **FR-006**: System MUST support complex YAML front matter including nested structures, multi-line values, and special characters (per MARP and other systems)
- **FR-007**: Panel styling MUST follow code block visual design language using existing editor CSS variables (rounded borders, bordered container, appropriate background color per theme)
- **FR-008**: System MUST validate YAML on save: if malformed, present error dialog with "Return to Fix" or "Save Anyway" options
- **FR-009**: Toolbar MUST include a "Frontmatter" button (rename from existing "Document Metadata") to add front matter block if not present or focus existing panel
- **FR-010**: Front matter content serialization is handled transparently by existing document sync mechanism; panel is display/edit overlay only

### Key Entities

- **Front Matter Block**: YAML metadata at the start of a markdown file, enclosed in `---` delimiters
- **Front Matter Panel**: Visual container displaying the front matter with collapsible header and styled content area
- **Panel Header**: "FRONT MATTER" label with expand/collapse toggle button

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Documents with front matter display a visible, usable front matter panel in the editor
- **SC-002**: 100% of front matter content is preserved and displayed correctly (no truncation, loss, or modification)
- **SC-003**: Complex YAML front matter (3+ levels of nesting, multi-line values, special characters) displays without parsing errors
- **SC-004**: Front matter panel integrates visually with editor UI (matches code block styling and theme colors)
- **SC-005**: Users can toggle front matter visibility with a single click without affecting editor layout or document content
- **SC-006**: All 828+ existing tests continue to pass; no regressions in other editor features

---

## Assumptions & Implementation Decisions

- **UI/UX**: Users interact with the collapsible panel through native `<details>` / `<summary>` interface (no custom keyboard shortcuts required initially)
- **YAML Editing**: Front matter is editable as plain text in the panel (no syntax highlighting); YAML parser validates on save attempt
- **YAML Validation**: Invalid YAML blocks save (user has "Save Anyway" override), but error is shown. Block save by default prevents corruption. Validation uses standard YAML parser.
- **Serialization**: The editor's existing document sync mechanism handles round-trip serialization; the panel is a display/edit overlay with no additional save logic
- **Implementation**: TipTap's Details, DetailsSummary, and DetailsContent extensions will be used as shown in official code sample (https://tiptap.dev/docs/editor/extensions/nodes/details)
- **Styling**: The panel uses existing editor CSS variables for day/night theme colors, with persist=true to remember open/closed state
- **Toolbar Integration**: Rename existing "Document Metadata" toolbar button to "Frontmatter"; clicking it adds front matter block (if absent) or focuses existing panel
- **Scope**: v1 includes display and plain-text editing; syntax highlighting is deferred to v2
- **Performance**: Front matter panels should not impact editor performance or scroll behavior (must measure <16ms impact per spec)
- **Robustness**: Implementation prioritizes simplicity and stability over visual polish; reuse existing CSS/theme infrastructure where possible