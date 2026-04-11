# Workflow Details

See [QUICK_REFERENCE.md](QUICK_REFERENCE.md) for the visual guide.

## Phase 1 — Spec (10-30 min)

1. You describe: `"I need dark mode toggle"`
2. I generate `spec.md` with **Open Questions** section
3. You answer the questions in spec.md
4. `git commit -m "spec(NNN): ..."` 

**Output**: `spec.md` ✅

## Phase 2 — Plan (20-40 min)

1. You say: `"Ready for plan.md"`
2. I generate `plan.md` with **Implementation Decisions** section
3. You review and approve the decisions (or ask to change)
4. `git commit -m "plan(NNN): ..."` 

**Output**: `plan.md` ✅

## Phase 3 — Code (1-4 hours)

1. I write failing tests (RED) 
2. I write code to pass tests (GREEN)
3. I run `npm test` → all 828+ pass
4. `git commit -m "feat(NNN): ..."` 

**Output**: Code + tests ✅

## Phase 4 — Testing (varies)

1. You test in VS Code
2. You find bugs/issues 
3. You tell me what's wrong
4. I fix + add regression test
5. I run `npm test` → all 828+ pass
6. `git commit -m "fix(NNN): ..."` 
7. Repeat until done

**Output**: Feature ready to merge ✅

## Principles

- No implementation details in spec.md (business-only)
- All tech in plan.md (tech-only)
- Test RED → GREEN before submitting
- All 828 tests pass = merge-ready
- Update spec/plan when you find new requirements

## When Stuck

- Need more spec questions? `/speckit.clarify "your question"`
- Need different plan? Ask, I'll revise
- Found edge case? Create test, I'll fix
- Want to add requirement? Update spec.md, I'll code it

That's it. Go build.
