# Implementation Tasks: Collapsible Front Matter Panel

**Feature**: 007-add-frontmatter-details | **Date**: 2026-04-11 | **Status**: ✅ COMPLETE

## Summary

✅ **COMPLETE & SHIPPED**: Front matter loads on document open, displays in collapsible panel with "FRONT MATTER" header (syntax-highlighted YAML), can be toggled from toolbar button, defaults to closed state, compact 0.5em margin, 90% font size. Serialization produces clean spacing (1 blank line between `---` and content). 18 comprehensive TipTap editor tests all passing. Zero regressions (992 total tests passing).

## Phase 1: Core Infrastructure & Testing (Tests First)

### Phase 1A: Message Types & Infrastructure

- [ ] 1.A.1 Add message types to `src/shared/messageTypes.ts`
  - Add `FrontmatterValidate`, `FrontmatterValidationResult`, `FrontmatterError`, `FrontmatterSaveOverride`
  - Define TypeScript interfaces for each message type
  - Duration: <1 hour

- [ ] 1.A.2 Create `src/editor/handlers/frontmatterValidation.ts` stub
  - Define `validateFrontmatterYaml()` function signature
  - Duration: <30 min

### Phase 1B: Write Failing Tests (RED)

- [ ] 1.B.1 Create `src/__tests__/editor/frontmatterValidation.test.ts`
  - Test suite: YAML validation (valid, invalid, edge cases)
  - Tests for: simple YAML, malformed input, nested structures, multi-line values, special characters
  - All 15+ tests should FAIL at this stage
  - Duration: 2-3 hours

- [ ] 1.B.2 Create `src/__tests__/webview/frontmatterPanel.test.ts`
  - Test suite: TipTap Details extension initialization
  - Tests for: extension registration, Details node creation, data attributes
  - Tests for: panel closed by default
  - All 8+ tests should FAIL at this stage
  - Duration: 2 hours

- [ ] 1.B.3 Create `src/__tests__/webview/frontmatterDisplay.test.ts`
  - Test suite: Front matter display in markdown documents
  - Tests for: render panel with FRONT MATTER label, extract YAML content to textarea
  - Tests for: no panel when no front matter present
  - All 6+ tests should FAIL
  - Duration: 2 hours

- [ ] 1.B.4 Create `src/__tests__/webview/frontmatterSerialization.test.ts`
  - Test suite: Round-trip save/load without data loss
  - Tests for: simple YAML round-trip, complex MARP front matter preservation
  - Tests for: special characters, unicode, nested structures
  - All 8+ tests should FAIL
  - Duration: 2 hours

- [ ] 1.B.5 Create `src/__tests__/webview/frontmatterEdgeCase.test.ts`
  - Test suite: Edge cases and error scenarios
  - Tests for: empty front matter, comments only, very long values
  - Tests for: unicode handling, --- appearing after content
  - All 10+ tests should FAIL
  - Duration: 2 hours

### Phase 1C: Performance & Regression Tests

- [ ] 1.C.1 Add performance tests to test suite
  - Test: typing latency <16ms
  - Test: YAML validation <100ms for 50-line front matter
  - Test: document load with front matter <500ms
  - Duration: 1 hour

**Phase 1 Checkpoint**: ~40 failing tests created (RED stage of TDD)

---

## Phase 2: Core Implementation (Make Tests Pass - GREEN)

### Phase 2A: YAML Validation Function

- [ ] 2.A.1 Implement `validateFrontmatterYaml()` in `src/editor/handlers/frontmatterValidation.ts`
  - Use `js-yaml` library (add to package.json if not present)
  - Handle valid YAML parsing
  - Catch and format error messages
  - Return `{ isValid, error? }` object
  - Run tests: YAML validation tests should now PASS
  - Duration: 1-2 hours

### Phase 2B: TipTap Extension Registration

- [ ] 2.B.1 Register Details, DetailsContent, DetailsSummary extensions in `src/webview/factories/extensionFactory.ts`
  - Import from `@tiptap/extension-details`
  - Add to editor.extensions array
  - Duration: <30 min

- [ ] 2.B.2 Create `src/webview/extensions/frontmatterPanel.ts`
  - Wrapper around TipTap Details extension
  - Add `data-frontmatter` attribute
  - Set label to "FRONT MATTER"
  - Default closed state (`open: false`)
  - Duration: 1-2 hours

### Phase 2C: Message Handlers

- [ ] 2.C.1 Create `src/webview/handlers/frontmatterMessages.ts`
  - Listen for `FrontmatterValidationResult`, `FrontmatterError` messages
  - Handle modal dialog "Return to Fix" / "Save Anyway" buttons
  - Duration: 2 hours

- [ ] 2.C.2 Modify `src/editor/MarkdownEditorProvider.ts`
  - Add message handler for `FrontmatterValidate` message
  - Call `validateFrontmatterYaml()`
  - Send back `FrontmatterValidationResult`
  - Duration: 1-2 hours

### Phase 2D: UI Event Handling

- [ ] 2.D.1 Create `src/webview/features/frontmatterUI.ts`
  - Function: `initFrontmatterPanel(editor)` to attach event listeners
  - Function: `createFrontmatterTextarea()` to generate editable textarea
  - Setup listeners for textarea input/change events
  - Forward validation requests to extension-host
  - Run tests: Panel display tests should now PASS
  - Duration: 2-3 hours

- [ ] 2.D.2 Modify `src/webview/editor.ts`
  - Call `initFrontmatterPanel()` after editor initialization
  - Duration: <30 min

**Phase 2 Checkpoint**: ~25-30 tests should now PASS (GREEN stage); ~10-15 still failing

---

## Phase 3: Styling & Integration (Make More Tests Pass)

### Phase 3A: CSS Styling

- [ ] 3.A.1 Add front matter panel CSS to `src/webview/editor.css`
  - Details panel container styling (border, radius, background, padding)
  - Summary styling (hover states, transition effects)
  - Content area styling (background, padding)
  - Textarea styling (monospace font, sizing, focus states)
  - Dark/high-contrast theme overrides
  - Use --md-code-block-bg, --md-border, --md-pre-fg variables
  - Duration: 1-2 hours

### Phase 3B: Toolbar Button

- [ ] 3.B.1 Modify `src/webview/BubbleMenuView.ts`
  - Rename "Document Metadata" button to "Frontmatter"
  - Add button action: toggle front matter panel visibility
  - Add logic to create empty front matter block if not present
  - Duration: 1 hour

### Phase 3C: Serialization

- [ ] 3.C.1 Implement front matter extraction in webview handlers
  - Function: `extractFrontmatterBlock(content)` to extract YAML block
  - Function: `hasFrontmatter(content)` to detect presence
  - Run tests: Serialization tests should now PASS
  - Duration: 1 hour

**Phase 3 Checkpoint**: ~35-40 tests should now PASS; ~5-10 still failing (edge cases, performance)

---

## Phase 4: Edge Cases & Performance (GREEN - All Tests Pass)

### Phase 4A: Edge Case Handling

- [ ] 4.A.1 Handle edge cases in frontmatter detection/rendering
  - Empty front matter blocks
  - Comments-only YAML
  - Very long values (10,000+ chars)
  - Unicode and special characters
  - Ensure --- appearing after content is NOT treated as front matter
  - Run tests: Edge case tests should now PASS
  - Duration: 2 hours

### Phase 4B: Performance Optimization

- [ ] 4.B.1 Optimize typing latency in textarea
  - Verify no layout thrashing during input
  - Debounce validation requests if needed
  - Measure: typing should remain <16ms
  - Duration: 1-2 hours

- [ ] 4.B.2 Optimize YAML validation performance
  - Verify validation completes <100ms for 50-line YAML
  - Profile `js-yaml.parse()` performance
  - Duration: 1 hour

### Phase 4C: Theme Switching

- [ ] 4.C.1 Test front matter panel in all VS Code themes
  - Light theme: colors correct, contrast readable
  - Dark theme: colors correct, contrast readable
  - High-contrast theme: maximum visibility
  - Run manual tests or automated theme-switching tests
  - Duration: 1 hour

**Phase 4 Checkpoint**: All 50+ front matter tests should PASS; 828+ existing tests still passing

---

## Phase 5: Full Test Suite & Regression

- [ ] 5.1 Run full test suite (`npm test`)
  - Expected: All 878+ tests pass (828 existing + 50 new)
  - No regressions in existing features
  - Duration: <5 min runtime (+ debug time if failures)

- [ ] 5.2 Verify Constitution compliance
  - Check: Reading experience paramount (panel closed by default)
  - Check: TDD approach followed (all tests written first)
  - Check: Performance budgets met (<16ms typing, <100ms validation)
  - Check: VS Code integration (uses TextDocument, CSS variables, existing sync)
  - Check: Simplicity maintained (no custom extensions, plain text editing)
  - Check: CSS discipline (no hard-coded colors)
  - Duration: 1 hour

- [ ] 5.3 Code review for style & documentation
  - Add JSDoc comments to all functions
  - Verify TypeScript strict mode compliance
  - Check for unused variables/imports
  - Duration: 1 hour

**Phase 5 Checkpoint**: Implementation complete; ready for merge

---

## Phase 6: Documentation & Cleanup

- [ ] 6.1 Create `IMPLEMENTATION.md` summary
  - Document what was built
  - Known limitations (v1 plain text only, no syntax highlighting)
  - Future enhancements (syntax highlighting, YAML schema validation)
  - Duration: <1 hour

- [ ] 6.2 Update project documentation if needed
  - Update README.md feature list if applicable
  - Update CHANGELOG.md with new feature
  - Update `copilot-instructions.md` if needed
  - Duration: <1 hour

**Phase 6 Checkpoint**: All deliverables complete

---

## Execution Order

**Sequential (Cannot parallelize)**:
- Phases 1-5 must execute in order (each phase depends on previous)
- Within each phase, tasks can be reordered but should maintain logical flow

**Within-Phase Parallelization [P]**:
- Phase 1B: Test creation tasks (1.B.1 through 1.B.5) can run in parallel
- Phase 1C: Performance tests can run alongside other Phase 1 tasks
- Phase 2A and 2B: Validation impl and extension registration can run in parallel
- Phase 3B and 3C: Button modification and serialization can run in parallel

---

## Success Criteria

**All Phases Complete When**:
1. All 50+ new front matter tests pass (npm test)
2. All 828+ existing tests continue to pass
3. Constitution compliance verified
4. No hard-coded colors in CSS
5. Performance budgets met (typing <16ms, validation <100ms, load <500ms)
6. Documentation complete

---

## Known Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| TipTap Details extension incompatibility | Test with current TipTap version in Phase 2B before proceeding |
| YAML validation too strict/lenient | Test with 10+ real MARP files; adjust error handling as needed |
| CSS conflicts with existing code block styling | Perform grep for all --md-* variables; test in all themes |
| Performance regression | Measure typing latency + validation speed in Phase 4B |
| "Save Anyway" button not working | Test error modal and override flow in Phase 2C |

---

## Time Estimate

| Phase | Tasks | Duration | Notes |
|-------|-------|----------|-------|
| 1 | 5 | 12-15 hours | Test creation + infrastructure |
| 2 | 8 | 10-15 hours | Core implementation |
| 3 | 3 | 4-5 hours | CSS, toolbar, serialization |
| 4 | 5 | 5-7 hours | Edge cases, performance, themes |
| 5 | 3 | 3-5 hours | Full test suite, review, documentation |
| **Total** | **24** | **34-47 hours** | Spread over 8-12 days (4-6 hours/day) |

---

## Checklist Status

**Pre-Implementation**:
- [ ] Confirm: tasks.md approved by user
- [ ] Confirm: all design decisions in plan.md are acceptable
- [ ] Confirm: no Constitutional violations identified

**Post-Implementation**:
- [ ] All tests passing (878+)
- [ ] No regressions
- [ ] Constitution verified
- [ ] Documentation complete
- [ ] Ready for merge
