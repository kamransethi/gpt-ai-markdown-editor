# Feature Specification: MARP File Round-Trip Test

**Folder**: `specs/044-marp-roundtrip-test/`  
**Created**: 2026-05-12  
**Status**: Draft  
**Input**: User description: "There is a problem. Some data is being lost when opened in this editor. Around 40 lines are lost in the attached file! I need you to add another round trip test for marp files. Load the attached file, introduce a space into the file and then validate what would be serialized. The test should report everything which was broken so the AI coding agent can find and fix those issues after compare - in an automated fashion"

## Context & Problem Statement

When a MARP presentation file is opened in the rich-text editor and then serialized back to markdown, content is silently dropped or corrupted. Initial test runs against `MARP_STRESS_TEST.md` (165 lines) detected **266 diff entries** — a combination of missing and spuriously added lines affecting the frontmatter CSS block, all slide separators, HTML comment directives, and nested HTML blocks. This causes destructive data loss whenever a MARP file is saved after being opened for editing. There is currently no automated test that catches this regression.

A round-trip test is needed that:
1. Loads a representative MARP stress-test file
2. Serializes the document back to markdown immediately (no edit required)
3. Compares input vs output line-by-line
4. Reports every discrepancy in a structured, AI-actionable format so the root causes can be identified and fixed

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — MARP Round-Trip Data Loss Detection (Priority: P1)

A developer or QA engineer runs the test suite and the test automatically detects when any content is lost or corrupted during a MARP file open-then-serialize cycle. The test fails with a detailed, structured diff that precisely names every missing, added, or changed line.

**Why this priority**: Data loss on save is critical. Users open MARP presentations, make a small edit, save, and silently lose 40+ lines. This must be caught automatically.

**Independent Test**: The test loads `MARP_STRESS_TEST.md` into the Playwright-driven editor, serializes back to markdown immediately without any edit, and compares the result against the original. It can be run in isolation with the Playwright test runner and delivers immediate value by surfacing the data loss.

**Acceptance Scenarios**:

1. **Given** the MARP stress test file is loaded, **When** the content is serialized to markdown immediately without any edit, **Then** the output is identical to the input (no data loss, no lines added or removed, no content changed).
2. **Given** data loss occurs (lines are dropped or corrupted), **When** the test runs, **Then** it fails and outputs a line-numbered, structured diff report listing every missing line, every added line, and every changed line.
3. **Given** the test output, **When** read by an AI coding agent, **Then** the agent can identify exactly which markdown constructs (e.g., Marp slide separators, CSS comment directives, nested HTML divs, image attributes) are being dropped or corrupted.

---

### User Story 2 — Structured Failure Report for AI-Assisted Debugging (Priority: P2)

When the test fails, it produces a structured report that an AI coding agent can consume directly to locate and fix the root causes of data loss — without any manual analysis.

**Why this priority**: The primary consumer of this test's output is an AI coding agent. A human-readable diff is insufficient; the output must identify construct types (not just raw line numbers) so the agent knows what to fix.

**Independent Test**: The test can be run independently to validate MARP round-trip fidelity and produces the same structured output format, independent of downstream fix work.

**Acceptance Scenarios**:

1. **Given** the test detects differences, **When** it reports them, **Then** the report groups differences by construct type (frontmatter, slide separator, CSS directive, HTML block, image reference, code block, body text).
2. **Given** a line is missing from the output, **When** reported, **Then** the report includes: the original line number, the line content, and the construct type label.
3. **Given** a line is present in the output but was not in the input, **When** reported, **Then** the report includes: the output line number, the spurious line content, and a label indicating it is unexpected.
4. **Given** a line's content has changed (not missing, not added), **When** reported, **Then** the report shows the original and serialized versions side by side.

---

### User Story 3 — Foundational Regression Guard (Priority: P3)

After the data loss bugs are fixed, the test continues to run in CI as a regression guard, ensuring that future changes to the markdown serializer, MARP extension, or HTML preservation layer do not reintroduce data loss.

**Why this priority**: Without a regression guard, the same data loss could silently return in a future refactor.

**Independent Test**: Once all diffs are resolved and the test passes, it can be committed as a permanent fixture in the test suite and included in the standard Jest run.

**Acceptance Scenarios**:

1. **Given** all round-trip bugs are fixed, **When** the test runs, **Then** it passes with zero diffs reported.
2. **Given** a future code change reintroduces data loss, **When** the test runs in CI, **Then** it fails immediately with the structured diff report.
3. **Given** the test is part of the Playwright suite, **When** the Playwright test run executes, **Then** the MARP round-trip test executes automatically without special flags.

---

### Edge Cases

- What happens when the MARP frontmatter contains multi-line CSS style blocks?  
  → The serializer must preserve all CSS lines verbatim, including indentation.
- What happens when `---` appears as a Marp slide separator vs. a YAML frontmatter delimiter vs. a Markdown horizontal rule?  
  → Each must be preserved in its correct semantic role; none may be dropped or converted.
- What happens when `<!-- class: no-margin -->` or similar Marp-specific HTML comment directives appear at the top of a slide?  
  → These must survive the round-trip as HTML comment blocks, not be stripped.
- What happens when an image is referenced with both HTML syntax (`<img>`) and Markdown syntax (`![alt](src){.class}`)?  
  → Both forms must be preserved in their original syntax without conversion.
- What happens with nested `<div>` blocks that contain slide-level separators?  
  → The parser must not treat `---` inside HTML blocks as slide separators.
- What happens when the MARP file contains a `style:` block with a multi-line pipe literal in the frontmatter?  
  → The entire style block must survive serialization unchanged.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The test MUST load `src/__tests__/MARP_STRESS_TEST.md` as the input fixture (the file used to reproduce the known data loss).
- **FR-002**: The test MUST parse the file through the same editor pipeline (TipTap + extensions) used by the real editor when a MARP file is opened.
- **FR-003**: The test MUST serialize the document immediately after loading, with no edits applied, using the same serializer used by the real editor on save.
- **FR-004**: The test MUST perform a line-by-line comparison between the original input and the serialized output.
- **FR-005**: When differences are found, the test MUST fail (not just warn) so CI catches regressions.
- **FR-006**: The failure output MUST list every missing line (present in input, absent in output) with its original line number and content.
- **FR-007**: The failure output MUST list every spurious line (absent in input, present in output) with its output line number and content.
- **FR-008**: The failure output MUST list every changed line with both the original and serialized versions.
- **FR-009**: Each reported difference MUST include a construct-type label assigned by an ordered set of regex rules applied to the original input line. The minimum required labels are: `[FRONTMATTER]`, `[SLIDE-SEPARATOR]`, `[CSS-DIRECTIVE]`, `[HTML-BLOCK]`, `[IMAGE]`, `[CODE-BLOCK]`, `[BODY-TEXT]`. The rules MUST be defined as an explicit, extensible list within the test file.
- **FR-010**: The test MUST be implemented as a Playwright test running in a real browser environment to be as close as possible to the actual editing experience. VS Code extension host APIs that are unavailable in Playwright must be stubbed; pure-UI extensions (e.g., bubble menus, placeholder) may be omitted.
- **FR-011**: The test MUST use the same TipTap extensions that the production editor uses for markdown parsing and serialization, so the test faithfully reproduces real-world behaviour.
- **FR-012**: The test file MUST be located in `src/__tests__/playwright/` alongside other Playwright-based tests.
- **FR-013**: After all bugs are fixed, the test MUST pass with zero diffs and continue to run as part of the Playwright test suite.

### Key Entities

- **MARP Stress Test File** (`MARP_STRESS_TEST.md`): The canonical input fixture representing a real-world MARP presentation with complex constructs (frontmatter, slide separators, CSS directives, HTML blocks, images, code blocks). Lives in `src/__tests__/`.
- **Editor Parse Pipeline**: The TipTap editor instance with all production extensions (including MARP/Marp extension if any, HTML preservation, image, frontmatter, etc.) that transforms markdown → internal document.
- **Markdown Serializer**: The component that transforms an internal TipTap document → markdown string. Must be the exact same serializer used on file save.
- **Round-Trip Diff Report**: The structured output produced when input ≠ output. Contains per-line entries with line numbers, content, change type (missing/added/changed), and construct-type label.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The test detects 100% of the currently known data loss (verified: 266 diff entries across `MARP_STRESS_TEST.md`) when run against the unpatched editor — zero false negatives.
- **SC-002**: The structured diff output is sufficient for an AI coding agent to identify the root-cause construct types without manual inspection of source code.
- **SC-003**: After data loss bugs are fixed, the test passes in under 30 seconds on a developer machine (Playwright browser startup included).
- **SC-004**: The test produces zero false positives — the only permitted normalization is stripping one trailing newline from the serialized output; all other differences are failures.
- **SC-005**: The test runs without modification as part of the existing Playwright test suite in CI; no VS Code extension host is required.
- **SC-006**: Future regressions that reintroduce any single dropped line are caught within one CI run.

---

## Clarifications

### Session 2026-05-12

- Q: What normalization is the test permitted to apply before comparing input vs output without counting as a failure? → A: Trim one trailing newline from the document end only. All other differences (internal whitespace, blank-line counts, indentation) are reported as failures.
- Q: How should the test handle TipTap extensions that depend on VS Code APIs or the filesystem? → A: Use Playwright where possible so extensions run in a real browser (closest to the actual editing experience). Mock or stub VS Code/filesystem side effects only where Playwright cannot reach them; omit pure-UI extensions (e.g., bubble menus, placeholder).
- Q: How should the single-space edit be made in the Playwright context? → A: Skip the edit entirely — load the file, serialize immediately, and compare. No simulated edit.
- Q: How should the test assign a construct-type label to each differing line? → A: Classify via an ordered set of regex rules applied to the original input line (e.g., `---` inside frontmatter → `[FRONTMATTER]`; bare `---` → `[SLIDE-SEPARATOR]`; `<!--` → `[CSS-DIRECTIVE]`; `<div`/`<img` → `[HTML-BLOCK]`; ` ``` ` → `[CODE-BLOCK]`; `![` or `<img src` → `[IMAGE]`; all else → `[BODY-TEXT]`). Rules are defined in the test file and can be extended as new constructs are discovered.

## Assumptions

- The existing `src/__tests__/MARP_STRESS_TEST.md` file is the canonical reproducer for the data loss issue and will be used as-is (not a copy).
- The editor's markdown serializer is the same code path executed on real file saves; no additional bridging is needed to call it from tests.
- The test runs in Playwright (real browser) to maximise fidelity to the actual editing experience. The existing Playwright harness in `src/__tests__/playwright/` will be reused.
- VS Code extension host APIs unavailable in Playwright (e.g., `vscode.workspace`, file-system access) will be stubbed at the boundary; the markdown parsing and serialization pipeline itself must not be mocked.
- The only permitted normalization before comparison is stripping one trailing newline from the serialized output (the conventional serializer artifact). All other differences are failures and must be reported. This must be documented as a comment in the test code.
- No edit is applied before serialization. The test is a pure parse-then-serialize round-trip — this isolates the data loss to the editor pipeline itself, not any user input handling.
- MARP-specific extensions (slide separator handling, frontmatter CSS, comment directives) may require new or modified TipTap extensions to fix the root causes; those fixes are out of scope for this spec but are the expected downstream action.
- The test is not responsible for fixing the data loss — only detecting and reporting it. Fix work will follow in a separate feature.
