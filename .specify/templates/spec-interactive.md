# Feature Specification: [FEATURE NAME] (INTERACTIVE)

**Feature Branch**: `[###-TYPE-title]`  
**Created**: [DATE]  
**Status**: Draft → Under Clarification → Approved ✅  
**Scope**: [Level 1: <1 day / Level 2: 2-3 days / Level 3: >1 week]

---

## Executive Summary

[1-2 sentences: What user problem does this solve? Why does it matter?]

---

## User Pain Point

[Describe the problem from user perspective, not technical]

---

## Success Criteria (Acceptance)

The feature is done when:
- [ ] Criterion 1: [Measurable outcome]
- [ ] Criterion 2: [Measurable outcome]
- [ ] Criterion 3: [Measurable outcome]
- [ ] All 828+ tests pass
- [ ] Tested in light, dark, and high-contrast themes
- [ ] No performance regression (typing <16ms, interactions <50ms)

---

## User Scenarios & Testing

### Scenario 1: [Title] (CRITICAL PATH)

**Given** [initial state]  
**When** [user action]  
**Then** [expected outcome]

### Scenario 2: [Title]

**Given** [initial state]  
**When** [user action]  
**Then** [expected outcome]

### Scenario 3: [Title] (Optional / Nice-to-have)

**Given** [initial state]  
**When** [user action]  
**Then** [expected outcome]

---

## Functional Requirements

- **FR-001**: [What the system must do]
- **FR-002**: [What the system must do]
- **FR-003**: [What the system must do]

---

## Non-Functional Requirements

- Performance: [e.g., "Feature toggle <50ms"]
- Compatibility: [e.g., "Must work in light, dark, high-contrast themes"]
- Accessibility: [if applicable]
- Browser/platform: [if applicable]

---

## Edge Cases & Error Scenarios

- [ ] What happens if [boundary condition]?
- [ ] How does system handle [error scenario]?
- [ ] What if user [unusual action]?

---

## Key Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| [Option A vs B] | [Selected] | [Why] |
| [Option X vs Y] | [Selected] | [Why] |

---

## Out of Scope (for this version)

- [Feature that could be v2]
- [Enhancement that can wait]

---

## 🔴 Open Questions for User

These sections need YOUR clarification before I generate the implementation plan.

### Question 1: [Clear Title]

[2-3 sentence context about why this matters]

- [ ] **Option A** — [Description of approach A and implications]
- [ ] **Option B** — [Description of approach B and implications]
- [ ] **Option C** — [Description of approach C and implications]

**Your input needed**: Which option? Or propose alternative?

---

### Question 2: [Clear Title]

[2-3 sentence context about decision scope]

- [ ] **Yes** — Go with approach X
- [ ] **No** — Don't include feature Y in v1
- [ ] **Conditional** — Include only if [condition]

**Your input needed**: Pick one or explain reasoning?

---

### Question 3: [Clear Title]

[Context]

- [ ] **Simple** — Minimal scope, core requirement only
- [ ] **Moderate** — Include nice-to-have features
- [ ] **Complete** — Everything you can think of

**Your input needed**: Pick scope level?

---

## How to Provide Clarification

1. **Edit this file** — Check the boxes and add notes:
   ```
   - [x] Option A — Use this approach because [reason]
   ```

2. **OR use `/speckit.clarify`** — I'll ask 3-5 more targeted questions

3. **OR reply directly** — "I pick Option B because..." and I'll update this file

---

## Notes for LLM (Next Steps)

- Once all questions ✅ answered, generate `plan.md`
- Use tech decisions from "Key Decisions" table
- Include architecture, files, tests in plan.md

---

**Status**: Waiting for answers to Open Questions ✋  
**Next step**: Once clarified → generate plan.md

