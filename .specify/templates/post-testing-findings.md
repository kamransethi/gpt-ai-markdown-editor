# Post-Testing Findings & Fixes

**Feature**: `[NNN-TYPE-title]`  
**Date**: [DATE]  
**Original Spec**: [Link to spec.md]  
**Original Plan**: [Link to plan.md]  

---

## Testing Summary

**Tester**: [You / User feedback]  
**Date Tested**: [DATE]  
**Environment**: VS Code [version], macOS/Windows/Linux, light/dark theme  
**Test Duration**: ~X minutes

---

## What Was Tested

- [ ] Scenario 1 from spec.md: [Outcome]
- [ ] Scenario 2 from spec.md: [Outcome]
- [ ] Scenario 3 from spec.md: [Outcome]
- [ ] Edge case: [Outcome]
- [ ] Performance check: [Outcome]
- [ ] Theme testing: [Light / Dark / High-contrast]

---

## Issues Found

### 🐛 Issue 1: [Title]

**Severity**: Critical / High / Medium / Low  
**Discovered**: During [test scenario]  
**Description**: [What went wrong, exact steps to reproduce]

**Root cause** (after investigation):  
[Why this happened - code-level detail]

**Fix applied**:
```typescript
// What code changed
```

**Test added**:
```typescript
// Regression test to prevent this in future
```

**Commits**:
```bash
git commit -m "fix(NNN-TYPE-title): handle edge case X

Root cause: [brief]
Fix: [brief]"
```

**Status**: ✅ FIXED

---

### 🐛 Issue 2: [Title]

[Same structure as Issue 1]

---

## New Requirements Discovered

### Requirement A: [Title]

**Discovered during**: [test scenario that revealed this]  
**Impact**: [How this affects original spec]

**Decision**: 
- [ ] Add to v1 (requires code change)
- [ ] Defer to v2 (note for future)
- [ ] Reject (doesn't fit scope)

**If adding to v1**:
- Updated spec.md: [YES/NO, which sections]
- Updated plan.md: [YES/NO, which sections]
- Code changes: [List files modified]
- New tests: [Count and type]
- Git commit: `git commit -m "spec(NNN-TYPE-title): add requirement A"`

---

## Performance Validation

| Metric | Budget | Actual | Status |
|--------|--------|--------|--------|
| Editor init | <500ms | [X]ms | ✅ / ⚠️ / ❌ |
| Typing latency (feature active) | <16ms | [X]ms | ✅ / ⚠️ / ❌ |
| Feature toggle | <50ms | [X]ms | ✅ / ⚠️ / ❌ |
| Memory added | ~2MB | [X]MB | ✅ / ⚠️ / ❌ |

---

## Test Results

```
Test Suites: 1 passed
Tests: 828 passed (original) + 12 new = 840 total
Time: 45s
Coverage: [feature area] >80%
```

**Regression check**: ✅ All existing tests still pass  
**New tests**: ✅ All new tests pass

---

## Lessons Learned

### What Worked Well
- [Implementation technique that was solid]
- [Testing approach that caught issues early]
- [Architecture choice that simplified things]

### What Could Be Better
- [Process improvement for next feature]
- [Architectural pattern to revisit]
- [Test coverage gap we noticed]

### For Future Features (Constitution Update?)
- Should we add rule: [rule]?
- Should we add to tech stack: [tech]?
- Should we update `.specify/memory/constitution.md`?

---

## Updated Documentation

### Updates to spec.md

[If requirements changed, document what was added/removed]

```diff
- Original requirement: [text]
+ Updated requirement: [text]
```

### Updates to plan.md

[If implementation changed, document it]

```diff
- Original plan: [text]
+ Actual implementation: [text]
  Reason: [why plan changed]
```

### Changes committed

```bash
git add specs/NNN-TYPE-title/spec.md specs/NNN-TYPE-title/plan.md
git commit -m "docs(NNN-TYPE-title): update spec/plan based on testing findings"
```

---

## Final Checklist

- [ ] All issues fixed and tested
- [ ] All performance budgets met
- [ ] All 828+ tests pass (full regression suite)
- [ ] spec.md updated with discoveries
- [ ] plan.md updated with actual implementation
- [ ] IMPLEMENTATION.md file created with changes summary
- [ ] Code review ready (or already approved)
- [ ] Ready to merge

---

## Status

**Overall**: ✅ COMPLETE / 🔧 IN PROGRESS / ❌ BLOCKED

**Next step**: [Merge to main / Request review / Iterate on issue]

