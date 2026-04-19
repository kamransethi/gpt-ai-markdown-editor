# Workflow: Spec → Plan → Code → Test

**Work directly on main. No branching. At each phase, copy prompts from [llm-prompts.md](llm-prompts.md)** (your copy-paste reference).

## The 4-Phase Cycle

**Phase 1: Spec** (10-30m)

- Create `specs/NNN-TYPE-title/` folder
- You write `spec.md` (business problem, success criteria)
- I generate it with Open Questions for you to answer
- Commit to main: `git commit -m "spec(NNN): add [feature name] spec"`

**Phase 2: Plan** (20-40m)

- I generate `specs/NNN-TYPE-title/plan.md` (architecture, files, decisions)
- You review + approve
- Commit to main: `git commit -m "plan(NNN): add [feature name] plan"`

**Phase 3: Code** (1-4h)

- I write test (RED) → code (GREEN) → run `npm test`
- All 828 tests must pass
- Changes go to src/, specs/NNN/*, etc.
- Commit to main: `git commit -m "feat(NNN): [feature implementation]"`

**Phase 4: Test &amp; Fix** (varies)

- You test in VS Code, report bugs
- I fix + add regression test + re-run `npm test`
- Repeat until done
- Commit to main: `git commit -m "fix(NNN): [what was fixed]"`

## Commands


| What         | Command                       |
| ------------ | ----------------------------- |
| Create spec  | `/speckit.specify "problem"`  |
| Create plan  | `/speckit.plan`               |
| Clarify spec | `/speckit.clarify "question"` |


## Key Rules

- **Folder structure**: `specs/NNN-TYPE-title/` (e.g., `specs/001-frontmatter-editor/`)
- **spec.md** = business only (no tech)
- **plan.md** = tech only (no user stories) 
- **Code** = TDD always
- **Tests** = all 828 must pass before push to main
- **Bugs** = add regression test when fixing
- **Main branch** = always ready to ship (no WIP)

## Templates

- `quick-bug.md` — bug fixes (&lt; 1 day)
- `spec-template.md` — major features (multi-day)

---

## Spec Kit Workflow Files

**This is the single source of truth for workflow file references.** When updating any workflow file, check this list to ensure consistency across all files listed.


| File                       | Purpose                                 | Updated                                 | Status   |
| -------------------------- | --------------------------------------- | --------------------------------------- | -------- |
| **AGENTS.md**              | AI commands, file locations, principles | Always sync with WORKFLOW_AUTOMATION.md | ✅ Active |
| **WORKFLOW_AUTOMATION.md** | 4-phase cycle (this file)               | Central reference point                 | ✅ Active |
| **llm-prompts.md**         | Copy-paste prompts for each phase       | Align with phase descriptions           | ✅ Active |
| **quick-bug.md**           | Bug spec template                       | Align with workflow naming              | ✅ Active |
| **spec-template.md**       | Feature spec template                   | Use `specs/NNN-TYPE-title/` structure   | ✅ Active |
| **plan-template.md**       | Implementation plan template            | Use `specs/NNN-TYPE-title/` structure   | ✅ Active |


**When you change this file**, verify consistency in:

1. AGENTS.md (commands, file locations, principles)
2. llm-prompts.md (prompt examples match phases)
3. Template files (naming conventions, folder references)