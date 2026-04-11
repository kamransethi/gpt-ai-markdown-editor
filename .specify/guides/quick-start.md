# Quick Start: Creating a Bug/Feature Spec

> **Read this first**: `.specify/guides/workflow.md` (full guide)  
> **Prompts to copy-paste**: `.specify/guides/llm-prompts.md`

---

## 30-Second Overview

1. **Create folder**: `specs/006-BUG-title/` (increment NNN)
2. **Create spec.md** from template (quick-bug.md for bugs, medium-feature.md for features)
3. **Commit**: `git commit -m "spec(006-BUG-title): problem definition"`
4. **Get LLM to generate implementation_plan.md** (see llm-prompts.md Stage 1)
5. **Review plan, approve**
6. **Get LLM to code** (see llm-prompts.md Stage 2)
7. **Run `npm test`** — all 828 must pass
8. **Review code, approve**
9. **Commit & merge**

---

## Which Template?

```
Is it a bug or <1 day of work?
  → quick-bug.md

Is it 2-3 days with clear scope?
  → medium-feature.md

Is it >1 week or architecture change?
  → spec-template.md (existing)
```

---

## Folder Naming

- `006-BUG-ai-refine-code-blocks` (bug)
- `007-FEATURE-dark-mode` (feature)
- `008-MAJOR-plugin-system` (major feature)

---

## What You Write

**spec.md only** — problem statement.

Don't write:
- ❌ Code
- ❌ Implementation details
- ❌ implementation_plan.md (LLM generates this)

---

## What LLM Generates

**LLM generates** (you review + approve):
1. implementation_plan.md (design)
2. Code + tests (from plan)
3. IMPLEMENTATION.md (summary)

---

## Two Review Points

**Review 1**: spec.md + implementation_plan.md
- "Does the plan solve the spec?"
- Approve before LLM codes

**Review 2**: Final code
- "Does it work? Tests pass?"
- Approve before merge

---

## Files to Commit

```
specs/006-BUG-title/
├── spec.md (you)
├── implementation_plan.md (LLM, you approved)
├── test.ts (LLM generated)
└── IMPLEMENTATION.md (LLM generated)

src/...
└── [modified files from LLM]
```

---

## Copy-Paste Checklist

```
[ ] 1. mkdir specs/006-BUG-title
[ ] 2. Copy template to spec.md (quick-bug.md or medium-feature.md)
[ ] 3. Fill in spec.md
[ ] 4. git add + commit spec.md
[ ] 5. Ask LLM to generate implementation_plan.md (use llm-prompts.md Stage 1)
[ ] 6. Review + approve plan
[ ] 7. Ask LLM to code (use llm-prompts.md Stage 2)
[ ] 8. Review code
[ ] 9. Run npm test (expect all 828 to pass)
[ ] 10. Final approval
[ ] 11. git commit + push
```

---

## Quick Examples

### Example 1: Bug - "Code block corruption"

```
specs/006-BUG-ai-refine-code-blocks/
├── spec.md (1 page: problem, repro, acceptance criteria)
├── implementation_plan.md (half page: files + tests)
└── (LLM generates test + code + IMPLEMENTATION.md)
```

Timeline: ~2 hours (30 min review + 1 hr LLM coding + 30 min testing)

### Example 2: Feature - "Dark mode toggle"

```
specs/007-FEATURE-dark-mode/
├── spec.md (2-3 pages: scenarios, requirements)
├── implementation_plan.md (1 page: approach, files, tests)
└── (LLM generates test + code + IMPLEMENTATION.md)
```

Timeline: ~4-6 hours (1-2 hrs review + 2 hrs LLM coding + 1 hr testing)

---

## Escape Hatches

**I don't like the plan**:
- Comment on implementation_plan.md (ask for specific revisions)
- Don't approve
- Ask LLM to revise
- Approve when satisfied

**Code doesn't work**:
- Ask LLM to debug and fix
- Re-run tests
- Review fixed version

**Spec too vague**:
- Use `/speckit.clarify` to improve it before proceeding
- Update spec.md
- Then proceed with plan generation

---

## Reference

- **Full workflow**: `.specify/guides/workflow.md`
- **LLM prompts**: `.specify/guides/llm-prompts.md`
- **Constitution**: `.specify/memory/constitution.md` § XIII
- **AGENTS.md**: `AGENTS.md` (quick links)
