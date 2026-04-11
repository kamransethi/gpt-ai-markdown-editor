# Specs & Development Workflow Guide

> **Source of Truth**: `.specify/memory/constitution.md` § XIII  
> **Updated**: April 11, 2026  
> **For**: Creating specs, implementation plans, and handing off to LLM for development

---

## TL;DR

**Workflow**: `spec.md` (you) → ANALYSIS (LLM, behind scenes) → `implementation_plan.md` (LLM generates, you review) → Code (LLM) → Tests → Merge

**Folder naming**: `specs/NNN-TYPE-title/` where TYPE ∈ {BUG, FEATURE, MAJOR}

**Choose level**:
- **Bug or <1 day?** → Level 1 (BUG)
- **2-3 days, clear scope?** → Level 2 (FEATURE)
- **>1 week, big changes?** → Level 3 (MAJOR)

---

## Step-by-Step Workflow

### 1. Create Folder and Spec

```bash
# Create specs/NNN-TYPE-title/ where NNN = next number
mkdir -p specs/006-BUG-ai-refine-code-blocks
cd specs/006-BUG-ai-refine-code-blocks
```

Choose template based on level:
- **Level 1 (Quick Bug)**: Use `.specify/templates/quick-bug.md`
- **Level 2 (Medium Feature)**: Use `.specify/templates/medium-feature.md`
- **Level 3 (Major Feature)**: Use `.specify/templates/spec-template.md` (existing)

Write `spec.md` from template.

### 2. Clarify with /speckit.specify (Optional but Recommended)

```bash
/speckit.specify "Your problem description here"
```

This helps:
- Extract user stories from your description
- Identify requirements
- Strengthen acceptance criteria

Copy output into `spec.md` or use as reference to improve your spec.

### 3. Commit Spec

```bash
git add specs/006-BUG-*/spec.md
git commit -m "spec(006-BUG-title): problem definition and acceptance criteria"
```

**No code yet** — just the problem definition.

### 4. Trigger LLM ANALYSIS → Implementation Plan

Give LLM this prompt:

```markdown
Role: Implementation Planner  
Input: Spec file: specs/006-BUG-title/spec.md  
Task:
1. Read the spec.md carefully
2. Analyze what needs to be built (LLM internal reasoning - no file output)
3. Generate implementation_plan.md with:
   - Files to change (exact paths)
   - Functions/components to modify or create
   - Test cases to write (list)
   - Architecture/approach
   - Why this approach over others

Output format for implementation_plan.md:
# Implementation Plan: [Title]

## Summary
[2-3 sentences of what needs to change]

## Files to Change
- src/file1.ts: [what, why]
- src/file2.ts: [what, why]

## Functions/Components
- [Component1]: [change]
- [Function1]: [change]

## Test Cases (to write)
- Test case 1: [description]
- Test case 2: [description]

## Architecture/Approach
[Why this approach? Any alternatives considered?]

## Estimated Complexity
[Low / Medium / High]
```

Wait for LLM output. It generates `implementation_plan.md` (no ANALYSIS file is created).

### 5. Review Implementation Plan (Review 1)

**You review**:
- [ ] Does the plan solve the spec requirements?
- [ ] Are the files identified correctly?
- [ ] Are all acceptance criteria coverable with proposed tests?
- [ ] Any concerns about approach?

**If approved**: Commit the plan

```bash
git add implementation_plan.md
git commit -m "spec(006-BUG-title): implementation plan approved"
```

**If rejected**: Comment on LLM output, ask for revisions, then commit when approved.

### 6. LLM Writes Code (Test-Driven)

Give LLM this prompt:

```markdown
Role: Test-Driven Developer  
Input specs:
- Spec: specs/006-BUG-title/spec.md
- Plan: specs/006-BUG-title/implementation_plan.md

Task:
1. Write a failing test (RED) that reproduces the spec requirement
   - Test should fail before your code changes
   - Put in: specs/006-BUG-title/test.ts or src/__tests__/[appropriate-category].test.ts
   - Follow jest/vitest patterns used in this project

2. Implement code to make test pass (GREEN)
   - Change files listed in implementation_plan.md
   - Write minimal, clean code
   - No premature optimization

3. Run tests:
   - Run just the new test: npm test -- test-file.test.ts
   - Run relevant category: npm test -- --testPathPattern=features (or similar)
   - If all 828 tests not required, run these + new tests

4. Write IMPLEMENTATION.md summary (after code works):
   # IMPLEMENTATION.md
   
   ## What Changed
   - src/file1.ts: [change, why] (1 sentence)
   - src/file2.ts: [change, why] (1 sentence)
   
   ## Why It Matters (User-Facing)
   [1-2 sentences for end user in release notes]
   
   ## How It Works (Technical)
   [Brief technical notes for developers]

Output:
- Modified files
- New test file (+ relative path)
- Test output (proof tests pass)
- IMPLEMENTATION.md
```

LLM delivers code + tests + IMPLEMENTATION.md

### 7. Run Full Regression Suite

```bash
npm test
```

All 828 tests must pass. If any fail:
- If unrelated to your change: debug
- If related: fix + re-run
- No exceptions

### 8. Code Review (Review 2)

**You review**:
- [ ] Code solves the problem
- [ ] Acceptance criteria met
- [ ] Tests pass (all 828)
- [ ] No new bugs introduced
- [ ] Code quality acceptable
- [ ] Follows project conventions

**Ask for changes if needed** — LLM revises + re-runs tests.

Once approved:

```bash
git add -A
git commit -m "fix(scope): title - Fixes specs/006-BUG-title

[Details from implementation plan]
Test coverage: [X new tests added]
All 828 tests pass."
```

### 9. Merge

Push branch → Create PR → Merge once approved.

---

## Level Comparison

| Aspect | Level 1 (Bug) | Level 2 (Feature) | Level 3 (Major) |
|--------|---|---|---|
| **spec.md** | 1 page | 2-3 pages | 4-6 pages |
| **implementation_plan.md** | Half page | 1-2 pages | 2-4 pages |
| **Review checkpoints** | 1 (spec+plan) | 1-2 (spec; then plan) | 2-3 (spec; plan; per-task reviews) |
| **Effort (review)** | ~30 min | ~1-2 hours | ~4-8 hours |
| **LLM step** | Single pass | Single or phased | Phased per task |
| **Folder name** | `006-BUG-title` | `007-FEATURE-title` | `008-MAJOR-title` |

---

## Git Commit Pattern

Always reference spec in body:

```
type(scope): short description

Related specs: 006-BUG-title
or
Fixes specs/007-FEATURE-title

[Detailed description if needed]
```

Helps:
- Trace code to requirements
- Generate release notes (query with `Fixes specs/`)
- Track coverage

---

## Release Notes Generation

After merging all specs for a release:

```bash
# Extract all IMPLEMENTATION.md files from merged specs
grep -r "## Why It Matters" specs/*/IMPLEMENTATION.md

# Output goes into CHANGELOG.md or release notes
```

Each merged spec contributes a line item to release notes (see IMPLEMENTATION.md format).

---

## Common Patterns

### "I found a bug"
1. Create `NNN-BUG-title/spec.md` (1 page)
2. get LLM to generate `implementation_plan.md`
3. Review both
4. LLM codes + tests
5. Done

### "I have a feature idea"
1. Create `NNN-FEATURE-title/spec.md` (2-3 pages with scenarios)
2. Get LLM to generate `implementation_plan.md`
3. Review both
4. LLM codes + tests
5. Done

### "This is a major architectural change"
1. Create `NNN-MAJOR-title/spec.md` with full requirements
2. Use `/speckit.specify` + `/speckit.plan` for research phase
3. Get LLM to generate `implementation_plan.md`
4. Review spec + plan (may take hours)
5. Use `/speckit.tasks` to break into tasks
6. LLM codes per-task
7. Review per-phase
8. Done

---

## Troubleshooting

**Q: Do I commit ANALYSIS?**  
A: No. ANALYSIS is LLM internal reasoning. It stays in context, not a file.

**Q: Do I commit implementation_plan.md?**  
A: Yes. It's a review checkpoint. Needed to trace requirements → design → code.

**Q: Tests fail after LLM codes?**  
A: Ask LLM to debug. It reads the error and fixes code. Re-run tests.

**Q: All 828 tests fail?**  
A: Usually means LLM broke something critical. Ask LLM to revert to code from before, find the issue incrementally, then re-apply.

**Q: I don't like the implementation_plan?**  
A: Comment on it (ask for specific changes), LLM revises. Don't approve until you're happy.

**Q: Spec too vague?**  
A: Use `/speckit.specify` or `/speckit.clarify` to improve it. Update spec.md. Then proceed.

---

## Integration with /speckit Commands

- `/speckit.specify` — create spec from description
- `/speckit.clarify` — improve existing spec with Q&A
- `/speckit.plan` — generate implementation_plan.md (Phase 1 research/design)
- `/speckit.tasks` — break plan into tasks (Phase 2)
- `/speckit.implement` — execute tasks (Phase 3, LLM coding)

**This workflow** sits at the intersection of `/speckit` and direct LLM handoff.  
Use `/speckit` commands when helpful, but not required for Levels 1-2.
