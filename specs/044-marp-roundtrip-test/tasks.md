# Tasks: MARP File Round-Trip Test

**Feature**: `specs/044-marp-roundtrip-test/`  
**Input**: `specs/044-marp-roundtrip-test/plan.md`, `specs/044-marp-roundtrip-test/spec.md`  
**Created**: 2026-05-12  
**Status**: Active

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify the test environment and fixture file are in place before writing the spec.

- [x] T001 Confirm `src/__tests__/MARP_STRESS_TEST.md` fixture exists and covers all MARP construct types (frontmatter, slide separators, CSS directives, HTML blocks, images, code blocks)
- [x] T002 Confirm Playwright harness `src/__tests__/playwright/harness/full-editor.html` loads all production extensions and exposes `window.editorAPI.setMarkdown` / `getMarkdown`
- [x] T003 [P] Confirm `src/__tests__/playwright/helpers/index.ts` exports `FULL_HARNESS_URL`, `waitForEditor`, `setContent`, `getContent`

**Checkpoint**: Harness and fixture verified — spec file implementation can begin

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core helper functions that the test depends on must be implemented inside `marp-roundtrip.spec.ts` before the test body can be written.

- [x] T004 Implement `classifyLines(lines: string[]): ConstructType[]` in `src/__tests__/playwright/marp-roundtrip.spec.ts` — ordered regex classifier with frontmatter and code-fence state tracking; minimum labels: `[FRONTMATTER]`, `[SLIDE-SEPARATOR]`, `[CSS-DIRECTIVE]`, `[HTML-BLOCK]`, `[CODE-BLOCK]`, `[IMAGE]`, `[BODY-TEXT]`
- [x] T005 Implement `computeDiff(original: string, output: string): DiffEntry[]` in `src/__tests__/playwright/marp-roundtrip.spec.ts` — LCS-based line diff returning typed entries (`missing` / `added` / `changed`) with original line numbers and construct-type labels
- [x] T006 Implement `formatReport(diffs, origLineCount, outLineCount): string` in `src/__tests__/playwright/marp-roundtrip.spec.ts` — structured failure report with numbered entries, MISSING/ADDED/CHANGED markers, line numbers and construct-type labels

**Checkpoint**: Helper functions complete — test body can be written

---

## Phase 3: User Story 1 — MARP Round-Trip Data Loss Detection (Priority: P1) 🎯 MVP

**Goal**: A single Playwright test that loads `MARP_STRESS_TEST.md`, serializes immediately, diffs input vs output, and fails with a structured report if any data is lost or corrupted.

**Independent Test**: Run `npx playwright test marp-roundtrip.spec.ts --project smoke` in isolation — the test must run without errors and fail with a non-empty diff report against the unpatched editor.

- [x] T007 [US1] Implement test `'load-only round-trip is identical (zero data loss) @smoke'` in `src/__tests__/playwright/marp-roundtrip.spec.ts`:
  - Navigate to `FULL_HARNESS_URL`, call `waitForEditor`
  - Fetch fixture via `page.evaluate(() => fetch('/src/__tests__/MARP_STRESS_TEST.md').then(r => r.text()))`
  - `setContent(page, original)` + `page.waitForTimeout(100)`
  - `getContent(page)` → strip one trailing `\n` (only permitted normalisation, documented as comment)
  - `computeDiff(normalised, output)` → if `diffs.length > 0`: `expect(diffs, formatReport(...)).toHaveLength(0)`
- [x] T008 [US1] Run `npx playwright test marp-roundtrip.spec.ts --project smoke` and confirm: test executes without infrastructure errors AND fails with a non-empty structured diff report (confirms the known data loss is detected)

**Checkpoint**: US1 complete — test detects and reports the known ~40+ line data loss with structured output

---

## Phase 4: User Story 2 — Structured Failure Report for AI-Assisted Debugging (Priority: P2)

**Goal**: The failure report output is structured enough for an AI coding agent to identify root-cause construct types without manual inspection.

**Independent Test**: Inspect the test failure output from T008 — confirm it groups entries by `[FRONTMATTER]`, `[SLIDE-SEPARATOR]`, `[HTML-BLOCK]`, `[CSS-DIRECTIVE]`, `[IMAGE]`, `[CODE-BLOCK]`, `[BODY-TEXT]` labels with line numbers and content.

- [x] T009 [P] [US2] Verify the report produced by T008 contains `[FRONTMATTER]` entries for the YAML / CSS style block lines in `src/__tests__/MARP_STRESS_TEST.md`
- [x] T010 [P] [US2] Verify the report contains `[SLIDE-SEPARATOR]` entries for bare `---` lines that are lost
- [x] T011 [P] [US2] Verify the report contains `[HTML-BLOCK]` entries for `<div>` / `</div>` / `<img>` lines that are lost
- [x] T012 [P] [US2] Verify the report contains `[CSS-DIRECTIVE]` entries for `<!-- class: ... -->` lines that are lost
- [x] T013 [US2] Update `specs/044-marp-roundtrip-test/plan.md` with the actual root causes identified from the report — two confirmed: (1) `style:` pipe-literal CSS leaks into document body; (2) `---` inside `<div>` blocks truncates remaining content

**Checkpoint**: US2 complete — report is machine-readable and pinpoints root causes by construct type

---

## Phase 5: User Story 3 — Foundational Regression Guard (Priority: P3)

**Goal**: After data loss bugs are fixed in a future feature, this test passes with zero diffs and permanently guards against regressions in CI.

**Independent Test**: Once upstream fixes are applied, run `npx playwright test marp-roundtrip.spec.ts` — expect `1 passed`.

- [ ] T014 [US3] After upstream MARP serializer bugs are fixed: run `npx playwright test marp-roundtrip.spec.ts --project smoke` and confirm test passes with zero diffs
- [ ] T015 [US3] After upstream bugs are fixed: run the full Playwright suite (`npx playwright test --project release`) and confirm no regressions introduced by the upstream fix
- [ ] T016 [US3] Update `specs/044-marp-roundtrip-test/spec.md` Status from `Draft` to `Complete` once T014 passes
- [ ] T018 [US3] Verify SC-003: time the passing test run and confirm it completes in under 30 s (Playwright browser startup included) — `time npx playwright test marp-roundtrip.spec.ts --project smoke`

**Checkpoint**: US3 complete — regression guard is active in CI; any future data loss is caught automatically

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T017 [P] Extend `classifyLines` rules in `src/__tests__/playwright/marp-roundtrip.spec.ts` if new MARP construct types are discovered during the fix sprint (e.g., `[MARP-ATTRIBUTE]` for `{.class style="..."}` image attributes)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can verify immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — helper functions block test body
- **US1 (Phase 3)**: Depends on Phase 2 — test body depends on helpers
- **US2 (Phase 4)**: Depends on Phase 3 — report quality can only be validated once test runs
- **US3 (Phase 5)**: Blocked on upstream bug-fix feature (separate spec) — cannot complete until serializer is fixed
- **Polish (Phase 6)**: Can run any time after Phase 3

### User Story Dependencies

- **US1 (P1)**: No upstream code changes needed — purely additive test
- **US2 (P2)**: Depends on US1 output (report inspection)
- **US3 (P3)**: Blocked externally — depends on a future fix feature resolving the bugs this test reports

### Parallel Opportunities

- T003 (helpers check) can run in parallel with T001/T002 (fixture check)
- T004, T005, T006 (helper implementations) can be written in parallel within the same file
- T009–T012 (report label verification) can all be done in parallel as they check different sections of the same report output

---

## Parallel Example: Phase 2 (Foundational Helpers)

```bash
# All three helpers can be authored simultaneously in marp-roundtrip.spec.ts:
T004  classifyLines()     ← no dependency on T005 or T006
T005  computeDiff()       ← no dependency on T004 or T006
T006  formatReport()      ← no dependency on T004 or T005
```

---

## Implementation Strategy

**MVP scope**: Phases 1–4 (T001–T013). This delivers immediate value — the test runs, catches the known data loss, and produces an AI-actionable report. The regression guard (US3 / Phase 5) is only completable after a separate fix feature resolves the root causes.

**Suggested sequencing**: T001–T003 → T004–T006 → T007 → T008 → T009–T013 (parallel) → T014–T016 (after fix sprint)

**Note on completed tasks**: T001–T013 were completed as part of the initial implementation sprint (2026-05-12). T014–T016 are pending the upstream MARP serializer fix feature.
