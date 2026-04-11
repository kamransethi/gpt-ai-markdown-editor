# Workflow: Spec → Plan → Code → Test

**At each phase, copy prompts from [llm-prompts.md](llm-prompts.md)** (your copy-paste reference).

## The 4-Phase Cycle

**Phase 1: Spec** (10-30m)
- You write `spec.md` (business problem, success criteria)
- I generate it with Open Questions for you to answer
- Commit: `git commit -m "spec(NNN): ..."`

**Phase 2: Plan** (20-40m)
- I generate `plan.md` (architecture, files, decisions)
- You review + approve
- Commit: `git commit -m "plan(NNN): ..."`

**Phase 3: Code** (1-4h)
- I write test (RED) → code (GREEN) → run `npm test`
- All 828 tests must pass
- Commit: `git commit -m "feat(NNN): ..."`

**Phase 4: Test & Fix** (varies)
- You test in VS Code, report bugs
- I fix + add regression test + re-run `npm test`
- Repeat until done
- Commit: `git commit -m "fix(NNN): ..."`

## Commands

| What | Command |
|------|---------|
| Create spec | `/speckit.specify "problem"` |
| Create plan | `/speckit.plan` |
| Clarify spec | `/speckit.clarify "question"` |

## Key Rules

- **spec.md** = business only (no tech)
- **plan.md** = tech only (no user stories)
- **Code** = TDD always
- **Tests** = all 828 must pass before merge
- **Bugs** = add regression test when fixing

## Templates

- `quick-bug.md` — bug fixes
- `medium-feature.md` — 2-3 day features
- `spec-template.md` — major features/architecture
