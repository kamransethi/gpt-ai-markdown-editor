# Spec 019: HTML `<br>` Tag Optimization for Token Efficiency

**Status:** Implemented  
**PRD Domains**: `export`  
**Version:** 2.0.37  
**Date:** April 16, 2026

---

## Problem Statement

The editor's markdown serialization and table rendering code uses XHTML-style self-closing `<br />` tags throughout:
- Markdown table cell serialization (tableMarkdownSerializer.ts)
- Hard break node rendering (visibleHardBreak.ts, markdownSerialization.ts)
- Pandoc Lua filter transformations (table_formatting.lua)
- Document content preservation across tables and inline content

While `<br />` is valid XML/XHTML, HTML5 validates both `<br />` and `<br>` identically. Replacing all occurrences with the shorter `<br>` form reduces token usage across the codebase without any functional loss.

**Token Impact:** 50+ tag conversions across source, tests, specs, and release documentation (~1% per-document savings for table-heavy content).

---

## Requirements

1. **Replace all `<br />` with `<br>`** in code generation and serialization
2. **Maintain HTML5 compliance** - both forms are valid; use the shorter form
3. **Auto-convert old documents** - when users edit and save files with `<br />`, they serialize as `<br>` going forward
4. **Preserve table structure** - line breaks within table cells must remain functional
5. **Preserve document hard breaks** - shift+enter and manual hard breaks continue to work

---

## Solution Overview

### In-Code Changes
Replace all hardcoded `<br />` strings with `<br>` in:
- Markdown serialization functions
- Table cell HTML generation
- Pandoc Lua filters
- Hard break node rendering
- Test fixtures and documentation

### Auto-Conversion Behavior
No migration logic needed. The editor's serialization pipeline naturally converts on save:
1. User opens document with `<br />` tags
2. Document renders correctly (HTML5 accepts both)
3. User edits and saves
4. Serialization functions output `<br>` (new format)
5. File saved with `<br>` tags

---

## How It's Used in Tables

### Table Cell Line Breaks
Tables support soft line breaks within cells via `<br>` tags:

```markdown
| Column A | Column B |
|----------|----------|
| Line 1<br>Line 2 | Data |
| Text<br>More text | Value |
```

**Before:** `tableMarkdownSerializer.ts` generated `text += '<br />';`  
**After:** `text += '<br>';`

**Files Affected:**
- `src/webview/utils/tableMarkdownSerializer.ts` - Main table HTML generation (11 occurrences)
- `src/webview/utils/tableClipboard.ts` - Clipboard table handling
- `src/webview/utils/markdownSerialization.ts` - General serialization helper
- `src/features/pandoc/lua/table_formatting.lua` - Lua filter for Pandoc processing

### Table Cell Enter Handler
When users press **Enter** inside table cells, the extension inserts hard breaks instead of creating new rows:

```typescript
// Before: created <br /> nodes
// After: creates <br> nodes (via setHardBreak() command)
editor.commands.setHardBreak();
```

This is invisible to users - the behavior is identical, only the serialized output changes.

**Files Affected:**
- `src/webview/extensions/tableCellEnterHandler.ts` - Intercepts Enter key inside table cells (comments reference `<br>` instead of `<br />`)

---

## How It's Used in Documents

### Hard Break Rendering
Hard breaks (`<br>` tags) appear throughout documents:
- Shift+Enter (explicit hard break)
- Line breaks within block quotes
- Line breaks within list items
- Intentional multi-line content

**Rendering:**
```typescript
// visibleHardBreak.ts - Shows <br> as a visual indicator
['span', { class: 'hard-break-label', contenteditable: 'false' }, '<br>']
```

Users see a subtle `<br>` label indicating the break location. Functionally identical to `<br />`, only token count is reduced.

**Files Affected:**
- `src/webview/extensions/visibleHardBreak.ts` - Visual hard break indicator (1 occurrence)
- `src/webview/editor.ts` - Core markdown editing
- Test fixtures and documentation

### Markdown Serialization
When saving documents, the serialization pipeline converts all hard break nodes to `<br>` tags:

```typescript
// Generic markdown serialization
if (node.type === 'hardBreak' || node.type === 'hard_break') {
  output += '<br>';
}
```

This ensures consistency: all output uses `<br>`, no mixing of formats.

---

## Implementation Details

### Replacement Strategy
**Blind replacement across all files:**
- TypeScript source: `src/**/*.ts`
- Lua filters: `src/features/**/*.lua`
- Test files and documentation
- Specification documents
- Release notes

**Pattern:** Replace all occurrences of `<br />` (with or without spaces) with `<br>`

### Key Files Affected (50+ Changes)

**Core Serialization:**
1. `src/webview/utils/tableMarkdownSerializer.ts` - Primary table HTML generation
2. `src/webview/extensions/visibleHardBreak.ts` - Hard break visual rendering
3. `src/webview/utils/markdownSerialization.ts` - General markdown output
4. `src/webview/utils/tableClipboard.ts` - Copy/paste handling
5. `src/webview/utils/tableSelectionUtils.ts` - Table utilities

**Pandoc Integration:**
6. `src/features/pandoc/lua/table_formatting.lua` - Lua filter for Pandoc (2 occurrences)

**Editor & UI:**
7. `src/webview/editor.ts` - Main editor file
8. `src/webview/extensions/tableCellEnterHandler.ts` - Hard break command

**Tests & Documentation:**
9. `src/__tests__/webview/preprocessor.test.ts` - Test fixtures
10. `src/__tests__/webview/debug.test.ts` - Debug utilities
11. `src/__tests__/STRESS_TEST_DOC.md` - Stress test document
12. `specs/013-pandoc-bullet-newlines/spec.md` - Referenced in other specs
13. `specs/013-pandoc-bullet-newlines/plan.md` - Implementation notes
14. `releases/v2.0.36/RELEASE_NOTES.md` - Historical release notes

### Build Impact
- **No build changes** - `<br>` is valid HTML5
- **No dependency changes** - Pure string replacement
- **No API changes** - Serialization logic unchanged
- **ESLint:** Passes all checks after replacement

---

## Auto-Conversion Behavior

### Scenario 1: Opening Old Document with `<br />`
```
1. Document contains: "Line 1<br />Line 2"
2. Editor loads document
3. HTML parser accepts <br /> (valid HTML5)
4. Document renders correctly
5. Cursor position and selection work normally
6. User edits and saves
7. Serialization outputs: "Line 1<br>Line 2"
8. File saved with new format
```

**Result:** Automatic conversion without user action.

### Scenario 2: Creating New Content
```
1. User presses Shift+Enter for hard break
2. setHardBreak() command creates hard_break node
3. Serialization outputs: <br> (new format)
4. Document saved with <br> tags
```

**Result:** New content always uses `<br>` (never `<br />`).

### No Migration Script Needed
The serialization layer handles conversion automatically. No migration tasks or manual conversion required.

---

## Testing Strategy

### Unit Tests
- **tableMarkdownSerializer tests:** Verify `<br>` appears in output
- **visibleHardBreak tests:** Confirm hard break nodes serialize correctly
- **Clipboard tests:** Verify table copy/paste uses `<br>`
- **Markdown serialization tests:** Check all hard breaks use new format

### Integration Tests
- **Table editing:** Enter key in cells produces correct `<br>` in output
- **Document serialization:** Full documents save with `<br>` tags
- **Pandoc processing:** Lua filter handles both old and new formats
- **Round-trip:** Document → edit → save → load produces expected format

### Regression Testing
All existing 1023 tests pass after replacement. No functional changes, only token savings.

### Manual Testing
1. Create table with multi-line cells → Enter key works, output uses `<br>`
2. Open file with `<br />` → Edit and save → Verify conversion to `<br>`
3. Copy table from web → Paste in editor → Verify correct formatting
4. Export to various formats (DOCX, PDF) → Verify line breaks preserved

---

## Success Criteria

✅ **Functional Equivalence:** `<br>` produces identical output to `<br />`  
✅ **Token Savings:** 50+ tags reduced across codebase  
✅ **HTML5 Compliance:** All documents validate against HTML5 spec  
✅ **Auto-Conversion:** Old documents convert on save (no user action)  
✅ **Table Integrity:** Multi-line cells in tables function identically  
✅ **Test Coverage:** All 1023 tests pass; no regressions  
✅ **Documentation:** Spec documents updated to reflect new format  
✅ **Build Success:** Debug and release builds complete without errors  

---

## Technical Notes

### Why `<br>` Over `<br />`?
| Aspect | `<br>` | `<br />` |
|--------|--------|---------|
| HTML5 Valid | ✓ | ✓ |
| XHTML Valid | × | ✓ |
| Token Count | Shorter | Longer |
| Parser Support | Universal | Universal |
| Semantic Meaning | Identical | Identical |

Since the editor targets HTML5 output for GitHub/Markdown rendering (not XHTML), `<br>` is the logical choice.

### Performance Impact
- **Runtime:** Zero change (both are equally fast in browsers)
- **Network:** Negligible savings (~1% per table-heavy document)
- **Parsing:** Zero change (HTML5 parser treats identically)
- **Serialization:** Marginal efficiency (shorter string to write)

### Compatibility
- **GitHub Markdown:** Both formats render identically
- **Markdown Processors:** All major processors support both
- **Web Browsers:** Universal support for both
- **VS Code:** No issues with either format

---

## Future Enhancements

1. **Normalize all HTML tags** - Apply similar optimization to other self-closing tags if needed
2. **Token efficiency audit** - Review other areas for similar savings opportunities
3. **Format consistency** - Ensure all serialized output uses minimal valid HTML5

---

## Related Specifications

- **Spec 001:** Default Markdown Viewer - Initial markdown rendering
- **Spec 007:** Frontmatter Details - Document metadata handling
- **Spec 013:** Pandoc Bullet Newlines - Table and list formatting
- **Spec 018:** Save and Open Dropdown - Document file navigation

---

## Commit Reference

**Commit:** `chore: Replace <br /> with <br> to reduce token usage`  
**Files Changed:** 15  
**Insertions/Deletions:** 102/126  
**Tests:** 1023 passing (no regressions)

---

## Sign-Off

| Role | Name | Date | Status |
|------|------|------|--------|
| Developer | System | April 16, 2026 | ✅ Complete |
| QA | Auto-tests | April 16, 2026 | ✅ Pass |
| Integration | Build System | April 16, 2026 | ✅ Success |
