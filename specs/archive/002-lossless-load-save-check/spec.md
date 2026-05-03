# Feature Specification: Lossless Markdown Load/Save Compatibility Check

**Feature Branch**: `002-lossless-load-save-check`  
**Created**: 2026-04-06  
**Status**: Draft  
**PRD Domains**: `editor-core`
**Input**: User description: "Automated roundtrip test at build/package time + optional runtime 'Check file compatibility' warning when opening files that may result in data loss"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Build-Time Roundtrip Test (Priority: P1)

A developer builds or packages the extension. The test suite automatically loads `STRESS_TEST_DOC.md` into a headless editor, serializes it back to markdown, and compares the result to the original. If any content is lost or mutated, the build fails and a diff report is printed showing exactly which lines changed.

**Why this priority**: This is the foundational safety net. Every TipTap upgrade or bandaid change is validated automatically before it can ship. It catches data loss regressions immediately, at the point of lowest cost to fix.

**Independent Test**: Running `npm test` (or the build/package scripts) executes the roundtrip test and either passes green or fails with a visible diff. Delivers value as a standalone CI gate.

**Acceptance Scenarios**:

1. **Given** the extension is built with `npm run build:debug` or `npm run build:release`, **When** the build completes, **Then** the roundtrip test for `STRESS_TEST_DOC.md` has run and any failure causes the build to report an error.
2. **Given** `STRESS_TEST_DOC.md` is loaded into a headless editor and serialized back to markdown, **When** the output is compared to the original, **Then** the comparison is byte-for-byte identical (or within a defined tolerance for whitespace normalization).
3. **Given** a TipTap upgrade introduces a regression that drops bold marks inside ordered lists, **When** the roundtrip test runs, **Then** the test fails and prints a unified diff identifying the lost content.
4. **Given** the roundtrip test passes, **When** the package script completes, **Then** the `.vsix` is produced successfully.

---

### User Story 2 — Runtime "Check File Compatibility" Warning (Priority: P2)

A user opens a markdown file in the editor. If the "Check File Compatibility" setting is enabled (default: ON), the extension silently runs a roundtrip check on the file in the background before fully loading it. If the serialized output differs from the original, a warning dialog is shown listing the differences. The user can choose to open anyway (accepting the risk) or cancel to keep the file untouched.

**Why this priority**: Protects real user data during normal use. A user with a carefully crafted document should never silently lose content just by opening and saving it.

**Independent Test**: Enabling the setting and opening a known-lossy file triggers the warning dialog. Cancel leaves the file unchanged. Proceed opens normally.

**Acceptance Scenarios**:

1. **Given** "Check File Compatibility" is ON and a user opens a `.md` file, **When** the roundtrip check detects no differences, **Then** the file opens normally with no interruption.
2. **Given** "Check File Compatibility" is ON and a user opens a `.md` file that would lose content on save, **When** the roundtrip check detects differences, **Then** a warning dialog appears describing the affected content before the file is fully loaded.
3. **Given** the warning dialog is shown, **When** the user clicks "Cancel", **Then** the file is not opened in the editor and the original file is unchanged.
4. **Given** the warning dialog is shown, **When** the user clicks "Open Anyway", **Then** the file opens in the editor with a persistent caution indicator visible, reminding the user that saving may alter the file.
5. **Given** "Check File Compatibility" is OFF, **When** a user opens any `.md` file, **Then** no roundtrip check is performed and files open immediately as before.
6. **Given** a very large file (e.g., > 500KB), **When** the compatibility check runs, **Then** it completes within 3 seconds or shows a progress indicator and does not block the UI thread.

---

### User Story 3 — Difference Report for Developer Investigation (Priority: P3)

When a roundtrip difference is detected (either at build time or at runtime), a structured diff report is produced that clearly identifies what changed, making it straightforward for the developer to locate the root cause in code.

**Why this priority**: Detection without diagnosis is incomplete. The diff report transforms a vague "something changed" into an actionable code location.

**Independent Test**: Introducing a known regression (e.g., removing the `OrderedListMarkdownFix`) and running the roundtrip test produces a readable diff report.

**Acceptance Scenarios**:

1. **Given** a roundtrip difference is detected, **When** the diff report is generated, **Then** it shows the original lines, the serialized lines, and the specific characters or tokens that differ.
2. **Given** a build-time failure, **When** the developer reads the test output, **Then** the diff is printed in a unified diff format (`---` / `+++` / `@@`) to the console.
3. **Given** a runtime warning dialog, **When** the user expands details, **Then** a human-readable summary of affected content is shown (e.g., "Bold formatting lost in 2 ordered list items", "Frontmatter field 'theme' was dropped").

---

### Edge Cases

- What happens when `STRESS_TEST_DOC.md` itself is edited or deleted? The build-time test should fail with a clear message ("stress test document not found") rather than a cryptic error.
- What happens when the roundtrip produces semantically equivalent but textually different output (e.g., trailing newline, normalized whitespace, `*` vs `_` for italic)? The comparison logic must define a tolerance policy and document it — trivial normalization differences should not cause false failures.
- What happens when the file contains content the editor intentionally does not support (e.g., Marp-specific YAML directives, raw HTML not handled by the editor)? The spec should describe which elements are expected to round-trip losslessly and which are out of scope.
- What happens when the compatibility check crashes (e.g., out of memory on a huge file)? The error must be caught and the file should fall back to opening normally with a logged warning — it must never block the user's ability to open a file.
- What happens when the user opens the same file multiple times with the warning? The check should not re-run redundantly; once accepted per session is sufficient.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The build scripts (`build:release`, `package:release`) MUST execute a markdown roundtrip test using `src/__tests__/STRESS_TEST_DOC.md` as the input fixture, and MUST fail the build if differences are detected.
- **FR-002**: The roundtrip test MUST load the stress test document into a headless TipTap editor instance (same extensions as the real editor), serialize the result back to markdown, and compare to the original source.
- **FR-003**: When a roundtrip difference is detected at build time, the test output MUST include a unified diff identifying the changed lines or characters.
- **FR-004**: The extension MUST expose a configuration setting `gptAiMarkdownEditor.checkFileCompatibility` (boolean, default `true`) that controls whether the runtime compatibility check runs when opening files.
- **FR-005**: When `checkFileCompatibility` is `true` and a user opens a `.md` file, the extension MUST perform a background roundtrip check before displaying the editor content.
- **FR-006**: When the runtime roundtrip check detects differences, the extension MUST present a blocking warning dialog that describes the risk and offers "Cancel" and "Open Anyway" options before the file is loaded into the editor.
- **FR-007**: Selecting "Cancel" in the warning dialog MUST prevent the file from being opened and MUST leave the file on disk completely unchanged.
- **FR-008**: Selecting "Open Anyway" MUST open the file and MUST display a persistent caution indicator (e.g., status bar item or editor label) for the duration of the editing session.
- **FR-009**: The runtime roundtrip check MUST complete within 3 seconds for files up to 500KB; for larger files it MUST show a progress notification rather than silently hanging.
- **FR-010**: Any error or crash during the runtime compatibility check MUST be caught, logged, and MUST NOT prevent the user from opening the file — it should fail open, not fail closed.
- **FR-011**: The roundtrip comparison MUST apply a defined tolerance policy for known-acceptable normalization differences (e.g., a single trailing newline, consistent line endings) so that they do not produce false failures.
- **FR-012**: The stress test document (`STRESS_TEST_DOC.md`) MUST cover: YAML frontmatter, all heading levels, bold/italic/strikethrough inline marks, ordered and unordered lists with nested items, task lists, tables, fenced code blocks, Mermaid diagrams, LaTeX math expressions, blockquotes, GitHub Alerts, colored spans, image references, and links.

### Key Entities

- **Roundtrip Test**: A process that loads a markdown document into the editor, serializes it back to markdown, and compares the two for differences.
- **Stress Test Document**: The canonical fixture file (`STRESS_TEST_DOC.md`) used as the input for build-time roundtrip tests. Must remain comprehensive and versioned with the codebase.
- **Diff Report**: A structured output (build-time: console unified diff; runtime: human-readable dialog summary) describing what content changed between original and serialized output.
- **Compatibility Check Setting**: A user-configurable toggle that enables or disables the runtime roundtrip check on file open.
- **Caution Indicator**: A persistent UI element shown during an editing session when the user has chosen to open a file that failed the compatibility check.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of builds that introduce a markdown roundtrip regression are caught before a `.vsix` is produced — zero silent data-loss releases.
- **SC-002**: The build-time roundtrip test adds less than 10 seconds to the total build time.
- **SC-003**: When "Check File Compatibility" is ON, users are warned before opening any file that would lose content — zero silent data-loss incidents during normal use.
- **SC-004**: The runtime compatibility check completes in under 3 seconds for files up to 500KB, keeping the file-open experience responsive.
- **SC-005**: The diff report identifies the specific lines or tokens that changed, allowing the developer to locate the root-cause code within one hour of reading the report.
- **SC-006**: The build-time test produces zero false failures on a clean codebase (i.e., the tolerance policy eliminates spurious whitespace/normalization mismatches).

## Assumptions

- The headless editor used in the build-time roundtrip test uses the exact same TipTap extension configuration as the real editor (`editor.ts`), so it faithfully reproduces production load/save behavior.
- `STRESS_TEST_DOC.md` is treated as a versioned test artifact and is updated whenever new markdown features are added to the editor.
- The roundtrip comparison operates on the raw markdown text (string comparison), not on rendered HTML, so it catches serialization differences directly.
- Some intentionally unsupported elements (e.g., Marp-specific YAML directives, arbitrary raw HTML tags the editor does not handle) are excluded from the lossless guarantee and documented as known out-of-scope items in the tolerance policy.
- The runtime check reads the file from disk, performs the roundtrip entirely in-process (no file writes), and discards the result — it is read-only and never modifies the file.
- "Check File Compatibility" defaults to ON because data protection is more important than the slight delay on file open; users who find it inconvenient can disable it explicitly.
- Large file timeout (> 500KB, > 3 seconds) triggers a non-blocking notification rather than cancelling the check — the check continues in the background and the warning appears if differences are found.

