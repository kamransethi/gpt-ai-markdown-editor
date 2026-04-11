# 🚀 Quick Reference: Spec → Plan → Code → Test Cycle

**Print this and keep it visible while working on features.**

---

## The 4-Phase Cycle

```
PHASE 1        PHASE 2         PHASE 3        PHASE 4
─────────      ─────────        ─────────      ─────────
I CREATE       YOU CLARIFY      I CODE+TEST    YOU TEST
spec.md        (with options)   (TDD: tests    (run in
(BUSINESS      Ask questions    first)         editor)
FOCUSED)       if needed        (TECH FOCUSED) ↓ Find
↓              ✅ APPROVE       ✅ APPROVE     bugs/
Ask 3-5        ↓               ↓              edge cases
questions      I CREATE        All 828+       ↓
with options   plan.md         tests pass     I FIX
               ✅ REVIEWS
```

---

## Phase 1: Spec Creation (10-30 min)

```bash
# YOU: Describe the feature
"I need a dark mode toggle in the toolbar"

# I: Generate spec.md with
- Business problem (no tech)
- User scenarios with acceptance criteria
- Success criteria (measurable)
- 🔴 OPEN QUESTIONS (3-5 clarification questions with options)

# YOU: Fill in answers to open questions
- [x] Option A
- [x] Option C
- Add notes: "Because we need..."

# YOU: Commit when ready
git add specs/NNN-TYPE-title/spec.md
git commit -m "spec(NNN-TYPE-title): user requirements and acceptance criteria"
```

**Templates**:
- Quick Bug: `.specify/templates/quick-bug.md`
- Medium Feature: `.specify/templates/medium-feature.md`
- Major Feature: `.specify/templates/spec-template.md`
- **Interactive Mode**: `.specify/templates/spec-interactive.md` ← USE THIS

---

## Phase 2: Plan Generation (20-40 min)

```bash
# YOU: Request plan
"Ready for plan.md"

# I: Generate plan.md with
- Technical stack (what tools/languages)
- Architecture (how it works)
- Phases (phases 1, 2, 3... each with files & tests)
- 🔴 IMPLEMENTATION DECISIONS (3-5 architecture questions with options)
- Files to modify/create (exact paths)
- Test strategy (how many tests, what kind)
- Risks & mitigations

# YOU: Approve or question approach
- Review architecture decisions
- Check files to modify
- Validate test count
- Reply: "Plan approved" or ask questions

# YOU: Commit when ready
git add specs/NNN-TYPE-title/plan.md
git commit -m "spec(NNN-TYPE-title): implementation plan approved"
```

**Templates**:
- Interactive Mode: `.specify/templates/plan-interactive.md` ← USE THIS
- Existing: `.specify/templates/plan-template.md`

---

## Phase 3: Code + Tests (1-4 hours)

```bash
# I: Write code (TDD pattern)
# 1. Write test (RED) — test fails ❌
# 2. Write code (GREEN) — test passes ✅
# 3. Run full suite: npm test
#    → All 828+ tests must pass
# 4. Generate IMPLEMENTATION.md

# Output:
# - Modified/created files
# - All tests green ✅
# - IMPLEMENTATION.md with what changed

# YOU: Code review
- Check code solves spec
- Check tests pass
- Request changes if needed

# YOU: Approve & commit
git add -A
git commit -m "feat(NNN-TYPE-title): implement feature

- Created: src/file1.ts
- Modified: src/file2.ts
- Tests: 12 new tests, all passing
- All 828 tests pass (zero regressions)"
```

**Key**: NO HOT FIXES. All tests must pass before merge.

---

## Phase 4: Testing & Iteration (varies)

```bash
# YOU: Test in VS Code editor
# 1. Open markdown document
# 2. Test scenarios from spec.md
# 3. Try edge cases
# 4. Check performance
# 5. Test in light/dark/high-contrast themes

# YOU: Report issues
"Found bug: when I click X, Y doesn't happen"
OR
"Found new requirement: need to handle Z"

# I: Analyze → Fix → Update docs
# 1. Root cause analysis
# 2. Write regression test
# 3. Fix code
# 4. Update spec.md/plan.md with findings
# 5. Run: npm test ← All must pass
# 6. Commit fix

git commit -m "fix(NNN-TYPE-title): handle edge case

Root cause: [issue]
Fix: [solution]
Tests: added regression test for X"

# Repeat until done ✅
```

**Templates**:
- Post-testing findings: `.specify/templates/post-testing-findings.md`

---

## File Structure for New Feature

```
specs/NNN-TYPE-title/
├── spec.md                    # ← Phase 1 (BUSINESS)
├── plan.md                    # ← Phase 2 (TECH)
├── IMPLEMENTATION.md          # ← Phase 3 (WHAT CHANGED)
└── test-findings.md           # ← Phase 4 (ISSUES FOUND & FIXED)
```

---

## When to Use Special Commands

### Use `/speckit.clarify` to Ask More Questions

```
/speckit.clarify "What YAML formats need to be supported?"
```

I'll generate 3-5 targeted clarification questions specific to your feature.

---

## Git Commands Reference

```bash
# Create branch
git checkout -b NNN-TYPE-title

# After spec done
git add specs/NNN-TYPE-title/spec.md
git commit -m "spec(NNN-TYPE-title): user requirements and acceptance criteria"

# After plan done
git add specs/NNN-TYPE-title/plan.md
git commit -m "plan(NNN-TYPE-title): implementation plan approved"

# After code done
git add -A
git commit -m "feat(NNN-TYPE-title): implement feature

[Details]"

# After testing & fixes
git add -A
git commit -m "fix(NNN-TYPE-title): edge case + update docs"

# Before merge - final check
npm test                          # All 828+ tests pass?
git log --oneline -n 5           # Review commits
git push origin NNN-TYPE-title    # Push for review
```

---

## Success Checklist

- [ ] Spec phase: All open questions answered → Committed
- [ ] Plan phase: All architecture decisions approved → Committed
- [ ] Code phase: All 828+ tests pass → Code reviewed → Committed
- [ ] Test phase: No critical issues found → Ready to merge
- [ ] Documentation: spec.md & plan.md updated with findings
- [ ] Git: All commits reference the feature number `NNN-TYPE-title`

---

## Performance Budgets (Always Check)

| Metric | Budget | Constraint |
|--------|--------|-----------|
| Editor init | <500ms | Never sacrifice this |
| Typing latency | <16ms | Critical for UX |
| Features/interactions | <50ms | Toggle, menu, buttons |
| Document size | 10,000+ lines | Must handle large docs |

---

## Helpful Links

| Resource | Path |
|----------|------|
| Workflow details | `.specify/guides/workflow.md` |
| Automation guide | `.specify/guides/WORKFLOW_AUTOMATION.md` |
| Constitution | `.specify/memory/constitution.md` |
| Spec templates | `.specify/templates/*.md` |
| Project guidelines | `AGENTS.md` |

---

**Status**: Ready to start feature work! 🚀

