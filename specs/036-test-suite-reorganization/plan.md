# Implementation Plan: Test Suite Reorganization

**Folder**: `specs/036-test-suite-reorganization/plan.md` | **Date**: 2026-05-02 | **Spec**: [spec.md](spec.md)  
**Status**: Draft → Approved ✅

## Summary

We are reorganizing the unstructured `src/__tests__/webview` directory into a grouped structure: `smoke`, `integration`, `extensions`, and `e2e`. We will also implement missing E2E tests for automated editor data entry, new tests for inline formatting (bold/italic) including inside list items, and tests for the Knowledge Graph and Ollama integrations.

## Stack

**Language/Runtime**: TypeScript, Node.js  
**Key deps**: Jest, jsdom, TipTap
**Testing**: Jest + jsdom

## Phases

**Phase 1 — Reorganization**: Move existing test files into domain-specific folders.
- Files: MODIFY `jest.config.js` if necessary, MOVE all files in `src/__tests__/webview/*` to `src/__tests__/extensions/*`, `src/__tests__/integration/*`, and `src/__tests__/smoke/*`.
- Tests: Ensure all existing tests run successfully post-move.

**Phase 2 — E2E Robot Tests**: Create tests for automated text entry and table generation.
- Files: CREATE `src/__tests__/e2e/robotDataEntry.test.ts`.
- Tests: 1 E2E workflow test generating tables, adding bullets, typing text, and validating roundtrip markdown.

**Phase 3 — Formatting & Search Tests**: Create tests for formatting and Ollama/Search components.
- Files: CREATE `src/__tests__/extensions/formatting/inlineFormatting.test.ts`, CREATE `src/__tests__/features/searchIntegration.test.ts`.
- Tests: Bold text, bold in lists, mock Ollama endpoint search.

## Files

| File | Action | Purpose |
|------|--------|---------|
| `src/__tests__/*` | MOVE | Move all test files from `webview/` to appropriate subdirectories (`smoke/`, `integration/`, `extensions/`) |
| `src/__tests__/e2e/robotDataEntry.test.ts` | CREATE | E2E simulation for table creation and typing |
| `src/__tests__/extensions/formatting/inlineFormatting.test.ts` | CREATE | Tests for highlighting and applying bold/italics, especially inside lists |
| `src/__tests__/features/searchIntegration.test.ts` | CREATE | Tests for search index config and mock Ollama integrations |

## Key Risks

| Risk | Cause | Mitigation |
|------|-------|-----------|
| Broken Test Imports | Moving deep test files | Run `jest` after phase 1 to ensure paths are fixed and correctly resolved. VSCode TS server usually auto-updates imports. |
| Flaky E2E Tests | Simulating complex DOM events | Use robust helper methods for typing and focus. Verify the Prosemirror DOM state reliably updates. |

## Implementation Decisions

*Confirm these before coding starts. Reply with your choices or say "all good".*

**Decision 1 — E2E Test Execution**: How should the Robot Data Entry tests run?
- [x] **A**: Run in the standard jsdom Jest environment by simulating DOM events.
- [ ] **B**: Run via VS Code's extension integration test runner.
- Recommendation: **A** — It is much faster and seamlessly integrates with the rest of the webview tests.

**Decision 2 — Test Directory Layout**: 
- [x] **A**: `src/__tests__/{smoke, e2e, integration, extensions}`
- [ ] **B**: `src/webview/__tests__`, `src/features/__tests__`, etc.
- Recommendation: **A** — Keeps the tests separated by execution strategy as requested by the user.
