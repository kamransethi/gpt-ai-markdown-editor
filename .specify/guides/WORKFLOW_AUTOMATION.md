# Automation Workflow: Spec → Plan → Code → Test → Fix

**Date**: April 11, 2026  
**Purpose**: AI-assisted spec/plan/code cycle with user validation at each gate

---

## Overview

```
YOUR INTENT
    ↓
I CREATE spec.md (with "Open Questions" section)
    ↓ 
YOU CLARIFY in Open Questions (or use /speckit.clarify)
    ↓
REPEAT until spec.md approved ✅
    ↓
I GENERATE plan.md (with "Implementation Decisions" section)
    ↓
YOU REVIEW/CLARIFY plan.md
    ↓
REPEAT until plan.md approved ✅
    ↓
I CODE (test-first) + RUN TESTS
    ↓
YOU TEST in editor + REPORT ISSUES
    ↓
I FIX + UPDATE spec.md/plan.md with findings
    ↓
DONE or REPEAT if needed
```

---

## Phase 1: Spec Creation (Interactive)

### Step 1a: You Describe Intent
```
"I need a collapsible YAML front matter panel in the editor"
```

### Step 1b: I Generate spec.md
- Business-focused (no tech details)
- User scenarios with acceptance criteria
- Success criteria that are measurable
- **NEW: "Open Questions" section** with options/checkboxes for you to clarify

Example:
```markdown
## Open Questions for User

These need clarification before coding starts:

- [ ] Should panel be collapsed by default?
  - Option A: Yes, panel starts collapsed (current thinking)
  - Option B: No, panel starts expanded
  - Option C: Remember last state (user preference)

- [ ] Can users edit YAML in v1?
  - Option A: Read-only (no editing, just display)
  - Option B: Allow editing with validation
```

### Step 1c: You Provide Answers
Update the "Open Questions" section with your selections:
```markdown
- [x] Should panel be collapsed by default?
  - Selected: Option A (current thinking)
```

**Repeat**: Ask follow-up questions until spec.md is complete.

### Step 1d: Commit Spec
```bash
cd specs/NNN-TYPE-title
git add spec.md
git commit -m "spec(NNN-TYPE-title): user requirements and acceptance criteria"
```

---

## Phase 2: Plan Generation (Interactive)

### Step 2a: You Request Plan
```
"I'm ready for plan.md"
```

### Step 2b: I Analyze Spec + Generate plan.md
- Tech-focused (stack, architecture, phases)
- Files to modify/create (exact paths)
- Test structure (how many, what kind)
- Risks and mitigations
- **NEW: "Implementation Decisions" section** with questions about approach

Example:
```markdown
## Implementation Decisions

- [ ] Store YAML in node attributes or as child nodes?
  - Decision Recommended: node attributes (cleaner schema)
  
- [ ] Use TipTap atom node or content node?
  - Decision Recommended: atom node (no children, simpler toggle)

- [ ] Syntax highlight with highlight.js or CodeMirror?
  - Decision Recommended: highlight.js (smaller bundle)
```

### Step 2c: You Approve or Challenge
- Approve: ✅ Confirms implementation direction
- Challenge: "Why not use approach X instead?" → I explain tradeoffs → we iterate

### Step 2d: Commit Plan
```bash
git add plan.md
git commit -m "spec(NNN-TYPE-title): implementation plan approved"
```

---

## Phase 3: Code + Tests (Auto)

### Step 3a: I Write Tests First (RED)
- Create test file in `src/__tests__/[category]/...test.ts`
- Tests fail (reproduce spec requirements)
- Run: `npm test -- test-file.test.ts` → RED ✅

### Step 3b: I Write Code to Pass Tests (GREEN)
- Modify files listed in plan.md
- Keep code minimal and clean
- Run: `npm test` → ALL TESTS PASS ✅

### Step 3c: Run Full Regression
```bash
npm test
```
Output:
```
Test Suites: 1 passed
Tests: 828 passed
Time: 45s
```

### Step 3d: Generate IMPLEMENTATION.md
Document what changed:
```markdown
# Implementation: NNN-TYPE-title

## What Changed
- Created: src/webview/extensions/[feature].ts (50 lines)
- Modified: src/webview/editor.ts (+20 lines)
- Tests: 8 new tests in src/__tests__/webview/[feature].test.ts

## Testing Results
✅ Test Suites: 1 passed, 72 of 73 passed
✅ Tests: 992 passed, 1116 total
✅ No regressions

## Performance Impact
- Editor init: <500ms (no change)
- Typing latency: <16ms (no change)
- Feature toggle: <50ms

## Known Limitations
- [If any]
```

### Step 3e: Commit Code
```bash
git add -A
git commit -m "feat(NNN-TYPE-title): implement feature with tests

- Created frontmatterPanel.ts with TipTap atom node
- Added 8 tests for node schema, DOM, toggle
- All 992 tests passing, zero regressions"
```

---

## Phase 4: Testing + Fixes (Interactive)

### Step 4a: You Test in VS Code
1. Open the editor
2. Test scenarios from spec.md
3. Report issues/edge cases discovered

### Step 4b: I Fix + Update Docs
**If bug found**:
```bash
# Fix code
# Add regression test
npm test ✅

# Update spec.md/plan.md with finding
# Git commit with "fix:" prefix
git commit -m "fix(NNN-TYPE-title): handle edge case X

Root cause: [why it happened]
Fix: [what changed]
Tests: added regression test for case X"
```

**If new requirement discovered**:
```bash
# Update spec.md with new requirement
# Update plan.md with implementation
# Code fix
npm test ✅

# Git commit
git commit -m "spec(NNN-TYPE-title): add requirement Y (discovered during testing)"
```

### Step 4c: Repeat Until DONE

---

## Git Command Reference

```bash
# Create feature branch
git checkout -b NNN-TYPE-title

# After each phase
git add -A
git commit -m "TYPE(NNN-TYPE-title): description"

# Where TYPE ∈ {spec, plan, feat, fix, test, docs}

# Before merging
git log --oneline origin/main..HEAD  # Review all commits
npm test                             # Final regression check
git push origin NNN-TYPE-title       # Push for review
```

---

## File Structure Reference

```
specs/NNN-TYPE-title/
├── spec.md              # ← Phase 1 output (BUSINESS)
├── plan.md              # ← Phase 2 output (TECH)
├── IMPLEMENTATION.md    # ← Phase 3 output (WHAT CHANGED)
└── test-cases.md        # ← Phase 4 notes (EDGE CASES FOUND)
```

---

## When to Use `/speckit.clarify`

If you need me to ask MORE questions about spec.md:
```
/speckit.clarify "Are there specific YAML formats we need to support?"
```

I'll generate 3-5 targeted clarification questions with options. Update spec.md based on answers.

---

## Continuous Improvement

After each feature:
1. Did spec.md capture all requirements? Update `.specify/templates/` if pattern emerges
2. Did plan.md help avoid issues? Add to `.specify/memory/constitution.md` if architectural decision
3. Did tests catch bugs early? Add new test patterns to `.specify/templates/tasks-template.md`

