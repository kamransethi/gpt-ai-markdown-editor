# Implementation Plan: [FEATURE] (INTERACTIVE)

**Branch**: `[###-TYPE-title]` | **Date**: [DATE] | **Spec**: [link to spec.md]  
**Status**: Draft → Under Review → Approved ✅  
**Input**: Features specified in `/specs/[###-TYPE-title]/spec.md`

---

## Summary

[2-3 sentences: Technical approach to solve the spec requirements. What will we build and why?]

---

## Technology Stack

| Layer | Choice | Version | Why |
|-------|--------|---------|-----|
| Language | [e.g., TypeScript] | [e.g., 5.3] | [Rationale] |
| Runtime | [e.g., Node.js] | [e.g., 18+] | [Rationale] |
| Framework | [e.g., TipTap] | [e.g., 3.x] | [Rationale] |
| Testing | [e.g., Jest] | [e.g., 29+] | [Rationale] |
| Key Deps | [e.g., highlight.js] | [e.g., 11.x] | [Rationale] |

**Performance targets:**
- Editor init: <500ms
- Typing latency: <16ms (never block)
- Feature toggle: <50ms
- Memory overhead: <2MB

---

## Architecture Overview

[High-level diagram description or text description of how components interact]

---

## Phases

Organized by testable checkpoint. Each phase can be coded, tested, and validated independently.

### Phase 1: [Core Functionality]

**What**: [1-2 sentences describing this phase's output]

**Files to Create**:
- `src/path/file1.ts` (X lines) — [purpose]
- `src/path/file2.ts` (Y lines) — [purpose]

**Files to Modify**:
- `src/existing/file.ts` — [what changes, why]

**Tests to Write** (RED first, then code):
- `Test 1`: [description]
- `Test 2`: [description]
- `Test 3`: [description]

**Acceptance**: [How do we know Phase 1 is done?]

---

### Phase 2: [Feature Polish / Integration]

**What**: [1-2 sentences]

**Files to Create**:
- [files]

**Files to Modify**:
- [files]

**Tests to Write**:
- [tests]

**Acceptance**: [How do we know Phase 2 is done?]

---

### Phase 3: [Toolbar/UX Integration (if needed)]

**What**: [1-2 sentences]

**Files to Create/Modify**: [list]

**Tests to Write**: [list]

**Acceptance**: [How do we know Phase 3 is done?]

---

## Complete File Matrix

| File | Action | Scope | Priority |
|------|--------|-------|----------|
| `src/webview/extensions/feature.ts` | CREATE | 50 lines | P1 |
| `src/webview/editor.ts` | MODIFY | +30 lines | P1 |
| `src/webview/editor.css` | MODIFY | +15 lines | P2 |
| `src/extension.ts` | MODIFY | +5 lines | P3 |
| `src/__tests__/webview/feature.test.ts` | CREATE | 80 lines | P1 |

---

## Test Strategy

**Total tests to write**: ~12  
**Test breakdown by type**:
- Unit tests (node schema, API): 4
- Integration tests (DOM, rendering): 5
- UI tests (user interactions): 3

**How we ensure correctness**:
1. RED → GREEN → REFACTOR cycle for each test
2. Run full suite after each change: `npm test`
3. All 828+ existing tests must still pass

**Test file location**: `src/__tests__/webview/feature.test.ts`

---

## Risks & Mitigations

| Risk | Root Cause | Severity | Mitigation |
|------|-----------|----------|-----------|
| [Risk description] | [Why this could happen] | High/Medium/Low | [How to prevent] |
| [Risk description] | [Why this could happen] | High/Medium/Low | [How to prevent] |

---

## Data Model (if applicable)

[If creating new types, nodes, or attributes]

```typescript
interface FeatureNode {
  type: "featureBlock";
  attrs: {
    property1: string;
    property2: number;
  };
}
```

---

## Key Architectural Decisions

- **Decision 1**: [What] — [Why this choice over alternatives]
- **Decision 2**: [What] — [Why this choice]
- **Decision 3**: [What] — [Why this choice]

---

## 🔴 Implementation Decisions — Confirm These With Me

Before I start coding, confirm these architecture choices or propose alternatives:

### Decision 1: [Clear Title]

**Context**: [Why this decision matters]

- [ ] **Approach A** — [Description + pros/cons]
- [ ] **Approach B** — [Description + pros/cons]
- [ ] **Approach C** — [Description + pros/cons]

**My recommendation**: Approach A (because [reason])

**Your decision**: [Pick one, or propose alternative]

---

### Decision 2: [Clear Title]

**Context**: [Why this decision matters]

- [ ] **Choice 1** — [Description + implications]
- [ ] **Choice 2** — [Description + implications]

**My recommendation**: Choice 1 (because [reason])

**Your decision**: [Pick one, or explain if you disagree]

---

## How to Approve This Plan

1. **Confirm architecture decisions** — Check boxes above and confirm approach
2. **Validate file list** — Are the files to modify correct?
3. **Agree on test strategy** — Do the test counts look right?
4. **Sign off** — Reply with "Plan approved" or suggest changes

---

## Next Steps After Approval

1. I write tests (RED) — they all fail initially
2. I write code (GREEN) — tests pass
3. Run `npm test` — all 828+ tests pass
4. You review code ← **BEFORE MERGE**
5. Merge to main

---

**Status**: Waiting for plan approval ✋  
**Blocker**: Confirm implementation decisions above  
**Timeline after approval**: ~X hours for phases 1-3 + testing

