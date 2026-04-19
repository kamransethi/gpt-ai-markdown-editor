# Specs: Issue Fixes & Regression Prevention

Two resolved issues are now documented with separated concerns:

## Issue 1: H1-H3 Scroll Regression
**Directory**: `specs/004-scroll-regression-fix/`

### Files
- **[spec.md](004-scroll-regression-fix/spec.md)** - The problem: scroll jiggle with H1-H3 headings
- **[IMPLEMENTATION.md](004-scroll-regression-fix/IMPLEMENTATION.md)** - How it was fixed (removed `scrollIntoView()`)
- **[TESTS.md](004-scroll-regression-fix/TESTS.md)** - Test suite preventing regression

### Quick Summary
- **Problem**: Document snaps back to top when H1-H3 headings present
- **Root Cause**: TOC pane `scrollIntoView()` caused layout thrashing
- **Fix**: Removed problematic call from `renderTocItems()`
- **Tests**: 8 CSS guards + manual verification steps

---

## Issue 2: Copilot Integration & AI Refine
**Directory**: `specs/005-copilot-integration-and-ai-refine/`

### Files
- **[spec.md](005-copilot-integration-and-ai-refine/spec.md)** - 5 issues (1 bug + 4 features)
- **[IMPLEMENTATION.md](005-copilot-integration-and-ai-refine/IMPLEMENTATION.md)** - How each was fixed
- **[TESTS.md](005-copilot-integration-and-ai-refine/TESTS.md)** - Test suite for all 5 tickets

### Quick Summary

| ID    | Title | Status | Files Changed |
|-------|-------|--------|---|
| BUG-I | File not exposed to Copilot | ✅ Fixed | activeWebview.ts, MarkdownEditorProvider.ts, extension.ts |
| FR-1  | AI Refine preserves blockquotes | ✅ Fixed | aiRefine.ts (both), wrapper detection added |
| FR-2  | Remember last command | ✅ Fixed | aiRefine.ts (webview), module state added |
| FR-3  | Better keyboard shortcuts | ✅ Fixed | aiRefine.ts (webview), textarea listener |
| FR-4  | Selected text context | ✅ Partial | activeWebview.ts, MarkdownEditorProvider.ts |

---

## How to Use These Specs

### For Developers Adding Features
1. Read **spec.md** - Understand the problem
2. Read **IMPLEMENTATION.md** - See how it was solved
3. Follow same pattern for new features

### For Testing/QA
1. Read **spec.md** - Understand requirements
2. Read **TESTS.md** - See what's covered
3. Use test cases as manual verification steps

### For Code Review
1. Compare code to **IMPLEMENTATION.md** steps
2. Verify tests match **TESTS.md** checklist
3. Ensure no regressions by running test suite

### For Regression Investigation
If a bug comes back:
1. Check which spec matches the symptom
2. Read **TESTS.md** for that spec
3. Run the relevant test suite (e.g., `npm test -- scrollStability.test.ts`)

---

## Document Organization

**Each spec folder contains:**

```
specs/NNN-issue-name/
├── spec.md           ← Problem statement & requirements
├── IMPLEMENTATION.md ← Detailed solution & code changes
└── TESTS.md          ← Test suite & regression prevention
```

**Related to old projects? Check:**
- `specs/001-default-markdown-viewer/` - User-facing Markdown features
- `specs/002-lossless-load-save-check/` - Save/load integrity
- `specs/003-plugin-system/` - Plugin architecture

---

## Key Stats

### Test Coverage
- **Total Tests**: 828 passing
- **Scroll Regression Guards**: 8 CSS tests
- **Copilot Integration**: 25+ tests
- **Build Status**: ✅ All passing

### Files Modified
- **Scroll fix**: 2 files (tocPane.ts, editor.ts)
- **Copilot/AI**: 5 files (activeWebview.ts, MarkdownEditorProvider.ts, extension.ts, 2× aiRefine.ts)

### Deployment Status
- ✅ No breaking changes
- ✅ Backward compatible
- ✅ Ready for immediate release

---

**Navigation**: Click on spec folder names above to read detailed docs.
