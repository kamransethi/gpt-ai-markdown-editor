# Feature Specification: Pandoc Bullet List Newline Handling

**Folder**: `specs/013-pandoc-bullet-newlines/`  
**Created**: April 12, 2026  
**Status**: Draft  
**PRD Domains**: `tables`, `export`  
**Input**: Bug report: "Pandoc exports often do not have newline characters for bullets"

## User Scenarios & Testing

### User Story 1 - Export Bullet Lists to DOCX (Priority: P1)

User attempts to export a markdown document containing bullet lists to `.docx` format. They expect each bullet point to appear on a separate line in the Word document, maintaining the same formatting as the source markdown.

**Why this priority**: Essential functionality - Word exports are a primary use case and users rely on bullet lists rendering correctly with proper line breaks.

**Independent Test**: Export a document containing a bulleted list section with multiple items. Verify each bullet appears on its own line in the resulting `.docx` file (not collapsed onto one line).

**Acceptance Scenarios**:

1. **Given** a markdown document with a bulleted list section containing 3+ items, **When** user exports to DOCX, **Then** each bullet item appears on a separate line in the Word document
2. **Given** a bulleted list with long text content in each item, **When** user exports to DOCX, **Then** line breaks between items are preserved (not collapsed)
3. **Given** nested or mixed list structures (bullets and numbers), **When** user exports to DOCX, **Then** visual hierarchy and line separation are maintained

---

### User Story 2 - Export Bullet Lists in Table Cells to DOCX (Priority: P1)

User creates a table where individual cells contain bullet lists separated by `<br>` tags (e.g., `- Item 1<br>- Item 2<br>- Item 3`). When exporting to DOCX, each bullet should appear on its own line within the cell, not collapsed onto one line.

**Why this priority**: Tables with bullet items are a documented use case (see STRESS_TEST_DOC.md). Users expect the same formatting preservation in tables as in regular content.

**Independent Test**: Export a document containing a table with cells that have bullets separated by `<br>` tags. Verify each bullet appears on its own line within the table cell in the resulting `.docx` file.

**Acceptance Scenarios**:

1. **Given** a table cell containing bullets like `- Item 1<br>- Item 2<br>- Item 3`, **When** user exports to DOCX, **Then** each item appears on a separate line within that table cell
2. **Given** a table with multiple cells containing `<br>` separated bullets, **When** user exports to DOCX, **Then** all cells render with proper line breaks (not collapsed)
3. **Given** table cells with `<br>` followed by bullet markers or other content, **When** user exports to DOCX, **Then** structure is correctly preserved

---

### Edge Cases

- What happens when bullet lists contain inline formatting (bold, italic, links)?
- How does the system handle bullet lists with code blocks or nested elements?
- What if the markdown has inconsistent spacing between bullet items?
- Does the fix work correctly with ordered lists (`1.`, `2.`) in addition to unordered lists (`-`, `*`, `+`)?
- How are `<br>` tags inside table cells currently being handled? Are they being converted to line breaks?
- Do bullets in table cells have a different structure than standalone bullets?

## Requirements

### Functional Requirements

- **FR-001**: System MUST preserve newline characters between bullet list items during Pandoc markdown-to-DOCX conversion
- **FR-002**: System MUST ensure each bullet list item renders on a separate line in the exported Word document (not collapsed)
- **FR-003**: System MUST handle various bullet markers (`-`, `*`, `+`) and ordered list markers (`1.`, `2.`, etc.)
- **FR-004**: System MUST prevent the existing markdown normalization regex from removing necessary newlines between list items
- **FR-005**: System MUST convert `<br>` tags in table cells that precede bullet markers to proper markdown newlines so bullets are recognized as separate items
- **FR-006**: System SHOULD apply any new Lua filter changes consistently across DOCX exports
- **FR-007**: System MUST maintain backward compatibility with existing Pandoc export features (tables, colors, alerts, mermaid diagrams)

### Current Root Cause Analysis

**Issue 1: Standalone Bullet Lists**

The issue appears to be in [documentExport.ts](src/features/documentExport.ts#L381) where a regex pattern:

```
/\n{2,}(\s*([-*+]|\d+\.)\s+)/g
```

removes multiple newlines before list items, collapsing them. While this may be intended to normalize spacing, it inadvertently prevents Pandoc from properly parsing list item boundaries, causing bullets to collapse onto a single line in the Word output.

**Issue 2: Bullets in Table Cells**

When table cells contain bullet points separated by `<br>` tags (e.g., `- Item 1<br>- Item 2`), the current [table_formatting.lua](src/features/pandoc/lua/table_formatting.lua) converts HTML `<br>` to `pandoc.LineBreak()`, but this doesn't give Pandoc enough context to recognize subsequent bullets as separate list items. The bullets remain within a single paragraph in the table cell, causing them to collapse onto one line.

**Solution Approach:**

Update `table_formatting.lua` to detect `<br>` followed by a bullet marker (or ordered list marker) and convert it to a proper markdown structure that Pandoc's parser can recognize as a list item boundary.

### Existing Lua Filters (Reference)

The following Lua filters are already applied during DOCX export:
- **table_formatting.lua** — Normalizes HTML line breaks in table cells and applies table borders
- **text_color.lua** — Processes text color attributes from spans for Word output
- **github_alerts.lua** — Converts GitHub callout blockquotes into styled alerts
- **mermaid_images.lua** — Handles mermaid diagram replacements

## Success Criteria

1. **Correct bullet rendering**: Standalone bullet lists with 3+ items export to DOCX with each item on a separate line (verifiable by opening the `.docx` file in Word or PDF reader)
2. **Correct table cell bullets**: Bullet lists within table cells (separated by `<br>` tags) render with each item on a separate line within the cell
3. **No regression**: Existing export features (table borders, text colors, GitHub alerts, mermaid diagrams) continue to work as expected
4. **All list types supported**: Both unordered lists (`-`, `*`, `+`) and ordered lists (`1.`, `2.`) render correctly in both standalone and table contexts
5. **Performance**: Export process completes in the same or faster time as before the fix
6. **Test coverage**: Test document (STRESS_TEST_DOC.md) exports without issues, with all bullet list scenarios rendering correctly

## Assumptions

- Pandoc version in use supports Lua filters (5.0+)
- The root cause is the combination of regex normalization (for standalone lists) and inadequate `<br>` handling in table cells
- Users have Word or compatible software to validate `.docx` exports
- Fix applies to DOCX exports; PDF exports already work correctly
- Table cells use `<br>` tags to separate bullet items (as seen in STRESS_TEST_DOC.md)

## Implementation Strategy

**Phase 1: Fix Regex Normalization (documentExport.ts)**
- Adjust the markdown normalization regex to preserve single blank lines between list items
- Only collapse 3+ consecutive newlines, not 2+

**Phase 2: Enhanced Table Cell Processing (table_formatting.lua)**
- Enhance the `RawInline` function to detect `<br>` followed by bullet markers
- Convert such patterns to proper markdown structure with actual newlines
- Ensure ordered list markers (`1.`, `2.`, etc.) are also handled
- Test with mixed content (bullets, text, formatting)

**Phase 3: Testing & Verification**
- Test with STRESS_TEST_DOC.md
- Create test cases for edge cases
- Verify no regressions in table borders, colors, alerts, or mermaid diagrams
