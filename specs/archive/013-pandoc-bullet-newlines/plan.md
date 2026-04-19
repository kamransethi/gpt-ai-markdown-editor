# Implementation Plan: Pandoc Bullet List Newline Handling

**Folder**: `specs/013-pandoc-bullet-newlines/plan.md` | **Date**: April 12, 2026 | **Spec**: [spec.md](./spec.md)  
**Status**: ✅ Approved & Implemented

## Summary

Fix Pandoc DOCX export to properly render bullet lists on separate lines instead of collapsing them onto one line. The fix addresses two issues: (1) standalone bullet lists where a regex removes necessary newlines before list items, and (2) bullet lists in table cells where `<br>` tags need context to signal list item boundaries. Solution involves refining the markdown normalization regex and enhancing the `table_formatting.lua` Lua filter.

## Stack

**Language/Runtime**: TypeScript 5.3+, Lua (for Pandoc filters)  
**Key deps**: Pandoc 5.0+ (already integrated), existing Lua filter infrastructure  
**Testing**: Jest + existing test framework (STRESS_TEST_DOC.md included in test exports)  
**Pandoc version**: Compatible with existing implementation (5.0+)

## Phases

**Phase 1 — Regex Fix**: Adjust markdown normalization to preserve list item boundaries
- Files: MODIFY `src/features/documentExport.ts`
- Tests: 2 unit tests — verify regex preserves single blank lines between list items but collapses 3+ newlines

**Phase 2 — Table Cell Bullets**: Enhance Lua filter to handle `<br>` before bullets
- Files: MODIFY `src/features/pandoc/lua/table_formatting.lua`
- Tests: 3 unit tests — verify `<br>` + bullet marker conversion, ordered list markers, mixed content

**Phase 3 — Integration & Validation**: Export full test document and verify bullets render correctly
- Files: No code changes (validation only)
- Tests: 1 integration test — export STRESS_TEST_DOC.md and verify bullet lists render correctly in DOCX

## Files

| File | Action | Purpose |
|------|--------|---------|
| `src/features/documentExport.ts` | MODIFY | Adjust regex to preserve necessary newlines before list items |
| `src/features/pandoc/lua/table_formatting.lua` | MODIFY | Enhance to detect `<br>` + bullet/list markers and convert to markdown newlines |
| `src/__tests__/features/documentExport.test.ts` | MODIFY | Add tests for regex behavior and list item boundary preservation |

## Key Risks

| Risk | Cause | Mitigation |
|------|-------|-----------|
| Regex change breaks valid spacing normalization | Changing regex without full context of why 2+ newlines were originally collapsed | Keep it minimal: only change behavior for patterns with 2-newline runs directly before bullet markers; test with production markdown files |
| Table filter breaks non-bullet `<br>` usage | Overly broad pattern matching in Lua filter | Use strict pattern matching: only convert `<br>` + exact bullet marker or ordered list marker (e.g., `^-\s`, `^1\.\s`) |
| Performance regression in large documents | Regex or Lua filter inefficiency | Profile with STRESS_TEST_DOC.md and large test files; rely on Pandoc's native AST processing |
| Regression in existing features | Changes to lua filter or regex affect tables, colors, alerts | Verify all 4 existing Lua filters still apply; test STRESS_TEST_DOC.md which exercises text color, tables, and formatting |

## Implementation Decisions

*Confirm these before coding starts. Reply with your choices or say "all good".*

**Decision 1 — Regex Preservation Strategy**: Should we preserve all double newlines or only those directly before bullet markers?
- [ ] **A**: Change regex to only collapse 3+ newlines (preserve all 2-newline runs) — simpler, less targeted
- [ ] **B**: Keep existing regex but explicitly check for bullet marker in adjacent context — more targeted, safer for other content
- Recommendation: **B** — Only apply the change when a 2+ newline run directly precedes a bullet marker pattern. This minimizes side effects on other markdown structures that may rely on the current behavior.

**Decision 2 — Lua Filter Approach for Table Bullets**: How strict should the `<br>` + bullet detection be?
- [ ] **A**: Simple pattern: replace any `<br>` followed by text starting with `-`, `*`, `+`, or digit+`.` with a newline
- [ ] **B**: Strict pattern: use precise regex to ensure it's actually a bullet (`^\s*[-*+]\s+` or `^\s*\d+\.\s+`) before converting `<br>`
- Recommendation: **B** — Use precise regex matching. Table cells can contain many structures; we should only convert `<br>` + bullet in contexts where it's clearly intended as a list item.

**Decision 3 — Table Filter Scope**: Should we add a new separate filter or enhance the existing `table_formatting.lua`?
- [ ] **A**: Enhance `table_formatting.lua` — keeps all table-related logic in one file
- [ ] **B**: Create new filter `bullet_list_formatting.lua` — separates concerns, but increases filter count
- Recommendation: **A** — Enhance existing `table_formatting.lua` since the issue is specific to bullets *in* tables (not standalone lists). This keeps related logic together and reuses the existing infrastructure.
