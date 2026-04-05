# Implementation Progress Checklist: Default Markdown Viewer Setup

**Feature Branch**: `001-default-markdown-viewer`  
**Start Date**: April 5, 2026  
**Last Updated**: Today  
**Total Estimated Duration**: 8-10 hours

---

## PHASE 1: RED — Test-First Development (Est. 4.0 hrs)

_Goal: Write all failing tests covering user stories, edge cases, and acceptance criteria._

### Task 1.1: Create Test File Structure
- [ ] T001 Create directory: `src/__tests__/extension/`
- [ ] T002 Create file: `src/__tests__/extension/defaultViewerPrompt.test.ts`
- [ ] T003 Add imports (vscode, extension, Jest mocks)
- [ ] T004 Set up Jest describe() block with beforeEach/afterEach
- [ ] T005 File compiles without syntax errors
- [ ] T006 Jest discovers test file in test discovery

**Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

### Task 1.2: Write Test Cases for First Activation
- [ ] T101 Write test: First activation shows modal dialog
- [ ] T102 Write test: Dialog text is user-friendly
- [ ] T103 Write test: Modal flag is set to true (blocking)
- [ ] T104 Write test: Completes within performance budget

**Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

### Task 1.3: Write Test Cases for "Yes" Response
- [ ] T201 Write test: Config updated on "Yes"
- [ ] T202 Write test: globalState stores "yes" decision
- [ ] T203 Write test: Config updated BEFORE globalState
- [ ] T204 Write test: Config update scope is Workspace
- [ ] T205 Write test: Error handling (config update failure)

**Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

### Task 1.4: Write Test Cases for "No" Response
- [ ] T301 Write test: No config changes on "No"
- [ ] T302 Write test: globalState stores "no" decision
- [ ] T303 Write test: No side effects on "No"

**Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

### Task 1.5: Write Test Cases for Modal Dismissal
- [ ] T401 Write test: Dismissal not persisted to globalState
- [ ] T402 Write test: No side effects on dismissal
- [ ] T403 Write test: Dismissal allows re-prompting on next activation

**Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

### Task 1.6: Write Test Cases for Prior Decision Memoization
- [ ] T501 Write test: Skip prompt if globalState has "yes"
- [ ] T502 Write test: Skip prompt if globalState has "no"
- [ ] T503 Write test: Persists across extension updates
- [ ] T504 Write test: No redundant config updates

**Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

### Task 1.7: Write Test Cases for Edge Cases
- [ ] T601 Write test: Config already set (idempotent)
- [ ] T602 Write test: Overwrite existing default viewer config
- [ ] T603 Write test: Function is async and non-blocking
- [ ] T604 Write test: Extension ID constant is correct
- [ ] T605 Write test: Handle missing globalState gracefully
- [ ] T606 Write test: Handle multiple rapid activations

**Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

### Phase 1 Completion Gate
- [ ] Run `npm test -- defaultViewerPrompt` → All tests FAIL
- [ ] No compile errors in test file
- [ ] Jest discovers all test cases (20+ tests visible)
- [ ] Mocks set up correctly (no mock initialization errors)

**Phase 1 Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

---

## PHASE 2: GREEN — Implementation (Est. 2.5 hrs)

_Goal: Implement the simplest code to make all tests pass without refactoring._

### Task 2.1: Create Function Signature in extension.ts
- [ ] T701 Open `src/extension.ts` and locate `activate()` function
- [ ] T702 Add function export: `showDefaultViewerPrompt(context)`
- [ ] T703 Add JSDoc comment with basic description
- [ ] T704 Add call to `showDefaultViewerPrompt(context)` at end of `activate()`
- [ ] T705 Wrap call in `.catch()` for error handling (fire-and-forget pattern)
- [ ] T706 Function signature compiles without TypeScript errors

**Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

### Task 2.2: Implement globalState Check Logic
- [ ] T801 Implement early return check for prior decision
- [ ] T802 Check `context.globalState.get("defaultViewerPromptDecision")`
- [ ] T803 Return early if value is "yes" or "no"
- [ ] T804 Tests 1.6.1-1.6.4 start to PASS
- [ ] T805 No other tests affected

**Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

### Task 2.3: Implement Modal Dialog Display
- [ ] T901 Call `vscode.window.showInformationMessage()`
- [ ] T902 Message text: "Would you like to set Visual Markdown Editor as your default markdown viewer?"
- [ ] T903 Set `{ modal: true }` option
- [ ] T904 Buttons: `["Yes", "No"]`
- [ ] T905 Capture response (string or undefined)
- [ ] T906 Tests 1.2.1-1.2.3 and 1.5.1-1.5.2 start to PASS

**Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

### Task 2.4: Implement "Yes" Response Handler
- [ ] T1001 If response === "Yes", update config
- [ ] T1002 Update `markdown.preview.defaultPreviewPane` to `"kamransethi.gpt-ai-markdown-editor"`
- [ ] T1003 Use `ConfigurationTarget.Workspace`
- [ ] T1004 Store "yes" in globalState (`update()`)
- [ ] T1005 Wrap in try/catch for error handling
- [ ] T1006 Log errors to console (non-fatal)
- [ ] T1007 Tests 1.3.* start to PASS

**Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

### Task 2.5: Implement "No" Response Handler
- [ ] T1101 If response === "No", store decision only
- [ ] T1102 Call `globalState.update("defaultViewerPromptDecision", "no")`
- [ ] T1103 Do NOT update any configuration
- [ ] T1104 Wrap in try/catch for error handling
- [ ] T1105 If response === undefined (dismissed), do nothing
- [ ] T1106 Tests 1.4.* and 1.5.* start to PASS

**Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

### Task 2.6: Run Full Test Suite (RED → GREEN Verification)
- [ ] T1201 Run `npm test -- defaultViewerPrompt` 
- [ ] T1202 All 20+ tests PASS (green phase)
- [ ] T1203 Run full `npm test` — no regressions
- [ ] T1204 Run `npx tsc --noEmit` — TypeScript passes
- [ ] T1205 Code coverage for `showDefaultViewerPrompt()` is 100%

**Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

### Phase 2 Completion Gate
- [ ] All 20+ defaultViewerPrompt tests PASS
- [ ] No regressions in existing test suite
- [ ] TypeScript strict mode passes
- [ ] Extension activates without errors

**Phase 2 Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

---

## PHASE 3: REFACTOR & POLISH (Est. 1.5 hrs)

_Goal: Improve code clarity, add documentation, extract constants, optimize performance._

### Task 3.1: Extract Magic String Constants
- [ ] T1301 Add constant: `DEFAULT_VIEWER_PROMPT_KEY`
- [ ] T1302 Add constant: `DEFAULT_VIEWER_EXTENSION_ID`
- [ ] T1303 Add constant: `DEFAULT_VIEWER_CONFIG_KEY`
- [ ] T1304 Update `showDefaultViewerPrompt()` to use constants
- [ ] T1305 All tests still PASS (no functional changes)

**Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

### Task 3.2: Add Comprehensive JSDoc Comments
- [ ] T1401 Expand JSDoc for `showDefaultViewerPrompt()`
- [ ] T1402 Document globalState key and possible values
- [ ] T1403 Document config updates and scope
- [ ] T1404 Document error handling and non-fatal behavior
- [ ] T1405 Add performance budget notes
- [ ] T1406 Add usage example in comments
- [ ] T1407 Add inline comments explaining logic flow
- [ ] T1408 All tests still PASS

**Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

### Task 3.3: Verify Performance & Activation Integration
- [ ] T1501 Review call in `activate()` — using `.catch()` (fire-and-forget)
- [ ] T1502 Verify not using `.await` (non-blocking)
- [ ] T1503 Add performance test or manual measurement
- [ ] T1504 Activation time impact < 50ms
- [ ] T1505 Verify no blocking operations

**Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

### Task 3.4: Run Full Linting & Type Checking
- [ ] T1601 Run `npx eslint src/extension.ts --fix`
- [ ] T1602 Run `npx tsc --noEmit`
- [ ] T1603 Run `npx prettier --write src/extension.ts`
- [ ] T1604 Run `npm run build:debug`
- [ ] T1605 All tests still PASS
- [ ] T1606 No TypeScript errors
- [ ] T1607 No ESLint warnings

**Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

### Task 3.5: Update Test File Comments & Documentation
- [ ] T1701 Add file-level JSDoc to test file
- [ ] T1702 Add section comments organizing tests
- [ ] T1703 Add descriptive comments to mock setup
- [ ] T1704 All tests still PASS (documentation only)

**Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

### Task 3.6: Final Sanity Check (Full Test Suite + Build)
- [ ] T1801 Run `npm test` — ALL tests PASS
- [ ] T1802 Run `npm run build:debug` — Build succeeds
- [ ] T1803 Run `npx tsc --noEmit` — No TypeScript errors
- [ ] T1804 Git status shows only expected file changes
- [ ] T1805 No console errors on activation

**Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

### Phase 3 Completion Gate
- [ ] All code refactored and polished
- [ ] Magic strings extracted, constants defined
- [ ] JSDoc comprehensive and helpful
- [ ] Performance verified (<50ms impact)
- [ ] All tests passing, no regressions
- [ ] Ready for code review

**Phase 3 Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

---

## PHASE 4: VERIFY & VALIDATION (Est. 2.5 hrs)

_Goal: Integration testing, manual testing, and acceptance verification._

### Task 4.1: Write Integration Test (Extension Lifecycle)
- [ ] T1901 Create `src/__tests__/integration/activation.test.ts`
- [ ] T1902 Write test: Fresh install first activation
- [ ] T1903 Write test: Show prompt on first activation
- [ ] T1904 Write test: Don't re-prompt after update (Yes decision)
- [ ] T1905 Write test: Don't re-prompt after update (No decision)
- [ ] T1906 Write test: Persist decision across VS Code reloads
- [ ] T1907 Write test: Activation performance budget
- [ ] T1908 Write test: Error recovery on config update failure
- [ ] T1909 Write test: Error recovery on globalState failure
- [ ] T1910 Run `npm test -- activation` — all integration tests PASS

**Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

### Task 4.2: Document Manual Test Plan
- [ ] T2001 Create `specs/001-default-markdown-viewer/MANUAL_TESTING.md`
- [ ] T2002 Document test environment setup
- [ ] T2003 Document Scenario 1: Fresh Installation (3 test cases)
- [ ] T2004 Document Scenario 2: Extension Update
- [ ] T2005 Document Scenario 3: Configuration Already Set
- [ ] T2006 Document Scenario 4: Edge Cases (4 sub-cases)
- [ ] T2007 Add acceptance criteria checklist (SC-001 through SC-005)

**Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

### Task 4.3: Execute Manual Tests on macOS
- [ ] T2101 Fresh installation: Test Case 1.1 (Click "Yes") - PASS / FAIL
  - Modal appears within 2 seconds
  - Modal has "Yes" and "No" buttons
  - Config updated to extension ID after clicking "Yes"
  - globalState persists decision
  - No re-prompt on restart
- [ ] T2102 Fresh installation: Test Case 1.2 (Click "No") - PASS / FAIL
  - Modal appears
  - Config NOT changed after "No"
  - globalState persists "no" decision
  - No re-prompt on restart
- [ ] T2103 Fresh installation: Test Case 1.3 (Dismiss modal) - PASS / FAIL
  - Modal appears
  - Closing modal without clicking → no state change
  - Modal appears AGAIN on next activation (pending decision)
  - Click "Yes" to finalize decision
- [ ] T2104 Extension update scenario - PASS / FAIL
  - Prior "Yes" decision is remembered
  - No re-prompt on update
  - Config remains set
- [ ] T2105 Configuration already set scenario - PASS / FAIL
  - Fresh install with modal
  - Click "Yes" → config updated (overwrite existing value)
  - No errors or warnings
- [ ] T2106 Edge cases - PASS / FAIL
  - Rapid activations (window reloads)
  - Manual config change after decision
  - User changes decision via settings
- [ ] T2107 All acceptance criteria verified (SC-001 through SC-005)

**Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

### Task 4.4: Code Review Gate (User Review)
- [ ] T2201 Function is clear and follows simplicity principle
- [ ] T2202 All test cases are comprehensive (20+ tests)
- [ ] T2203 TDD flow verified (RED → GREEN → REFACTOR)
- [ ] T2204 globalState key and config target are correct
- [ ] T2205 Error handling follows Constitution (try/catch, non-fatal)
- [ ] T2206 No over-engineering; code is minimal but complete
- [ ] T2207 JSDoc accurate and helpful
- [ ] T2208 No hardcoded strings (all extracted to constants)
- [ ] T2209 Fire-and-forget pattern verified in activation
- [ ] T2210 Performance budget respected (<50ms)
- [ ] T2211 Code review checklist completed
- [ ] T2212 All FR-* and SC-* requirements met
- [ ] T2213 Reviewer approval from user

**Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

### Task 4.5: Merge to Main Branch
- [ ] T2301 Verify all tasks complete and tests passing
- [ ] T2302 Verify branch up-to-date with main
- [ ] T2303 Merge feature branch to main
- [ ] T2304 Push to remote (git push origin main)
- [ ] T2305 Verify CI/CD passes on main (if applicable)
- [ ] T2306 Delete feature branch (optional)

**Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

### Phase 4 Completion Gate
- [ ] Integration tests passing
- [ ] Manual testing completed on macOS
- [ ] Code review approved
- [ ] Merged to main branch
- [ ] Ready for release build

**Phase 4 Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

---

## Summary by Phase

| Phase | Status | Completion | Est. Time |
|-------|--------|-----------|-----------|
| **1: RED** | ⬜ Not Started | 0% | 4.0 hrs |
| **2: GREEN** | ⬜ Not Started | 0% | 2.5 hrs |
| **3: REFACTOR** | ⬜ Not Started | 0% | 1.5 hrs |
| **4: VERIFY** | ⬜ Not Started | 0% | 2.5 hrs |
| **TOTAL** | ⬜ Not Started | 0% | **10.5 hrs** |

---

## Key Metrics

|Metric | Target | Status |
|--------|--------|---------|
| Test Cases | 20+ | ⬜ Not yet |
| Code Coverage | 100% | ⬜ Not yet |
| Test Passing Rate | 100% | ⬜ Not yet |
| Activation Impact | < 50ms | ⬜ Not yet |
| FR Coverage | 8/8 (FR-001 through FR-008) | ⬜ Not yet |
| SC Coverage | 5/5 (SC-001 through SC-005) | ⬜ Not yet |
| Code Review | Approved | ⬜ Pending |
| Manual Test (macOS) | All PASS | ⬜ Pending |

---

## Quick Start

To begin implementation:

1. **Start Phase 1 (RED)**: Follow tasks 1.1 through 1.7 to write all failing tests
2. **Verify Tests Fail**: Run `npm test -- defaultViewerPrompt` — all tests should FAIL
3. **Proceed to Phase 2**: Once all tests are written and failing, implement the function
4. **Continue Phases 3 & 4**: Polish, verify, and merge when complete

---

**Feature Branch**: `001-default-markdown-viewer`  
**Created**: April 5, 2026  
**TDD Approach**: RED → GREEN → REFACTOR → VERIFY
