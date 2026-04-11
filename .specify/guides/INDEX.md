# 📚 .specify Workflow Index

**Last updated**: April 11, 2026  
**Purpose**: Central guide to all spec kit workflows and templates

---

## 🎯 Choose Your Workflow

### Interactive AI-Assisted Workflow (RECOMMENDED)

**When to use**: You want me (AI) to generate spec/plan with clarification questions

**Files to use**:
1. **For spec generation**: `.specify/templates/spec-interactive.md`
2. **For plan generation**: `.specify/templates/plan-interactive.md`
3. **For post-testing**: `.specify/templates/post-testing-findings.md`

**Reference guide**: `.specify/guides/WORKFLOW_AUTOMATION.md`

**Quick cheat sheet**: `.specify/guides/QUICK_REFERENCE.md`

**Flow**:
```
You describe problem
    ↓
I generate spec.md (with "Open Questions")
    ↓
You answer questions
    ↓
I generate plan.md (with "Implementation Decisions")
    ↓
You approve architecture
    ↓
I code + test (all 828+ tests pass)
    ↓
You test in editor
    ↓
I fix issues + update spec/plan
```

---

### Traditional Workflow (For Reference)

**When to use**: You follow the original spec kit pattern

**Files to use**:
1. **For quick bugs**: `.specify/templates/quick-bug.md`
2. **For features**: `.specify/templates/medium-feature.md`
3. **For major work**: `.specify/templates/spec-template.md`

**Reference guide**: `.specify/guides/workflow.md`

---

## 📋 All Templates

### Specification Templates

| Template | Use Case | Location | Size |
|----------|----------|----------|------|
| **spec-interactive.md** | AI generates spec from intent (with questions) | `.specify/templates/` | 150 lines |
| quick-bug.md | 1-page quick bug spec | `.specify/templates/` | 40 lines |
| medium-feature.md | 2-3 day feature spec | `.specify/templates/` | 80 lines |
| spec-template.md | Full major feature spec (Level 3) | `.specify/templates/` | 200 lines |

### Implementation Templates

| Template | Use Case | Location | Size |
|----------|----------|----------|------|
| **plan-interactive.md** | AI generates plan with decisions | `.specify/templates/` | 200 lines |
| plan-template.md | Traditional implementation plan | `.specify/templates/` | 150 lines |
| **post-testing-findings.md** | Document bugs found & fixes applied | `.specify/templates/` | 180 lines |

### Meta Templates

| Template | Use Case | Location |
|----------|----------|----------|
| tasks-template.md | Convert spec → actionable tasks | `.specify/templates/` |
| checklist-template.md | Quality assurance checklist | `.specify/templates/` |
| constitution-template.md | Project principles document | `.specify/templates/` |

---

## 📖 All Guides

### Main Guides

| Guide | Purpose | When to Read |
|-------|---------|--------------|
| **WORKFLOW_AUTOMATION.md** | Complete AI-assisted cycle (spec → plan → code → test → fix) | Before starting any AI-assisted feature |
| **QUICK_REFERENCE.md** | 1-page printable cheat sheet | Print and keep on desk |
| workflow.md | Traditional spec kit workflow | If not using AI assistance |
| llm-prompts.md | Copy-paste prompts for LLM handoffs | [DEPRECATED: use automation guide instead] |
| quick-start.md | 30-second overview | Fast refresh on process |

---

## 🎓 Decision Tree: Which Template/Guide?

```
Question 1: Am I using AI to generate specs/plans?
├─ YES → Use INTERACTIVE workflow (spec-interactive.md + plan-interactive.md)
│        Reference: WORKFLOW_AUTOMATION.md
│        Cheat sheet: QUICK_REFERENCE.md
│
└─ NO → Use TRADITIONAL workflow
         ├─ Is it a quick bug (< 1 day)?
         │  └─ YES → Use quick-bug.md, reference workflow.md
         │
         ├─ Is it a medium feature (2-3 days)?
         │  └─ YES → Use medium-feature.md, reference workflow.md
         │
         └─ Is it a major feature (> 1 week)?
            └─ YES → Use spec-template.md, reference workflow.md
```

---

## ✅ Workflow Checklist: Interactive Mode

### Phase 1: Spec Creation (10-30 min)

```
[ ] I create spec.md from spec-interactive.md template
[ ] spec.md has "Open Questions" section with 3-5 clarification questions
[ ] You select options and answer questions
[ ] spec.md is reviewed and approved
[ ] Commit: git commit -m "spec(NNN): user requirements"
```

### Phase 2: Plan Generation (20-40 min)

```
[ ] I create plan.md from plan-interactive.md template
[ ] plan.md has "Implementation Decisions" section
[ ] You review architecture choices
[ ] plan.md is reviewed and approved
[ ] Commit: git commit -m "plan(NNN): implementation plan approved"
```

### Phase 3: Code + Testing (1-4 hours)

```
[ ] I write tests (RED) - all fail initially
[ ] I write code (GREEN) - tests pass
[ ] I run: npm test → All 828+ tests pass ✅
[ ] I create IMPLEMENTATION.md summary
[ ] Code is reviewed
[ ] Commit: git commit -m "feat(NNN): implement feature"
```

### Phase 4: User Testing + Iteration (varies)

```
[ ] You test in VS Code with acceptance scenarios
[ ] You report bugs/issues/new requirements
[ ] I do root cause analysis
[ ] I add regression test
[ ] I fix code + update spec/plan docs
[ ] I run: npm test → All 828+ tests pass ✅
[ ] Repeat until done
[ ] Create/update: post-testing-findings.md
```

---

## 📝 File Naming Convention for Specs

```
specs/NNN-TYPE-title/
└── spec.md          # What needs to be built (BUSINESS)
└── plan.md          # How to build it (TECH)
└── IMPLEMENTATION.md # What actually changed (RESULTS)
└── post-findings.md # Bugs fixed, learnings (ITERATION)
```

**Where**:
- `NNN` = Sequential number (001, 002, ..., 007, 008, ...)
- `TYPE` = Feature type: BUG, FEATURE, or MAJOR
- `title` = Kebab-case title (e.g., `add-frontmatter-panel`)

**Example**:
```
specs/008-FEATURE-dark-mode-toggle/
├── spec.md
├── plan.md
├── IMPLEMENTATION.md
└── post-testing-findings.md
```

---

## 🔧 Key Git Commands

```bash
# Start new feature
git checkout -b NNN-TYPE-title

# After spec.md complete and reviewed
git add specs/NNN-TYPE-title/spec.md
git commit -m "spec(NNN-TYPE-title): user requirements and acceptance criteria"

# After plan.md complete and reviewed
git add specs/NNN-TYPE-title/plan.md
git commit -m "plan(NNN-TYPE-title): implementation plan approved"

# After code complete (tests pass, code reviewed)
git add -A
git commit -m "feat(NNN-TYPE-title): implement feature with tests

- Created: [files]
- Modified: [files]
- Tests: [X new tests]
- All 828 tests passing"

# After testing cycle (bugs fixed, docs updated)
git add -A
git commit -m "fix(NNN-TYPE-title): apply post-testing fixes and update docs

Root cause: [issue]
Fix: [solution]
Tests: [regression test added]"

# Final check before merge
npm test                                    # All 828+ tests pass
git log --oneline origin/main..HEAD         # Review all commits
git push origin NNN-TYPE-title              # Push for review/merge
```

---

## 📚 Key Reading Order

### First Time Using Interactive Workflow

1. Start here: **QUICK_REFERENCE.md** (5 min read)
2. Then read: **WORKFLOW_AUTOMATION.md** (15 min read)
3. Keep link: **spec-interactive.md** (when generating spec)
4. Keep link: **plan-interactive.md** (when generating plan)
5. Reference: **.specify/memory/constitution.md** (project principles)

### If You Get Stuck

- Issue with spec questions? Read `WORKFLOW_AUTOMATION.md` § Phase 1
- Issue with plan decisions? Read `WORKFLOW_AUTOMATION.md` § Phase 2
- Issue with test cycle? Read `WORKFLOW_AUTOMATION.md` § Phase 3
- Issue with testing? Read `post-testing-findings.md` structure + `WORKFLOW_AUTOMATION.md` § Phase 4

---

## 🎯 Success Metrics

✅ Workflow is working when:

- [ ] spec.md captures business requirements (no tech details)
- [ ] plan.md answers all architectural questions (with tech details)
- [ ] Code is written test-first (RED → GREEN)
- [ ] All 828+ tests pass on first submission
- [ ] User testing finds < 3 critical issues (acceptable for v1)
- [ ] post-testing-findings.md documents all fixes applied
- [ ] spec.md and plan.md are updated with learnings
- [ ] Feature is ready to merge after testing cycle

---

## 🚀 Ready to Use

Choose your workflow → Start with QUICK_REFERENCE.md → Execute → Done!

**Questions?** Reference: `.specify/memory/constitution.md` § XIII (Continuous Improvement)

