# Version 2.0.39

**Release Date**: April 16, 2026
**Previous Release**: [v2.0.38](../v2.0.38/)

## Bug Fixes

- Restored `STRESS_TEST_DOC.md` test fixture — task list checkboxes (`- [x]`, `- [ ]`), `<mark>` tags, and nested list indentation were accidentally corrupted in the v2.0.38 release commit.
- Fixed `aiRefineProvider` tests — the graceful Copilot fallback (spec 015) added provider availability checks that the tests didn't mock, causing all 8 tests to fail with "GitHub Copilot is not available".
- Fixed TypeScript type error in error-throwing test generators (`yield` → `yield ''` to satisfy `AsyncGenerator<string>` return type).

---

## Stats

**Test Status**: ✅ 1031 tests passing
**Build**: ✅ Debug and release builds clean
**Linting**: ✅ All checks pass
