# Implementation Plan: MARP File Round-Trip Test

**Feature**: `specs/044-marp-roundtrip-test/`  
**Created**: 2026-05-12  
**Status**: Active

---

## Technical Context

| Item | Detail |
|------|--------|
| Test environment | Playwright (Chromium) — real browser, same as all other spec files |
| Harness entry point | `src/__tests__/playwright/harness/full-editor.html` via `FULL_HARNESS_URL` |
| Editor API | `window.editorAPI.setMarkdown(md)` / `window.editorAPI.getMarkdown()` |
| Helpers | `src/__tests__/playwright/helpers/index.ts` — `waitForEditor`, `setContent`, `getContent` |
| Fixture file | `src/__tests__/MARP_STRESS_TEST.md` (already exists — 118 lines) |
| Output file | `src/__tests__/playwright/marp-roundtrip.spec.ts` (new) |
| Extensions | Full production set already loaded by `full-editor.ts` — no harness changes needed |
| Permitted normalisation | Strip exactly one trailing `\n` from serialized output before comparison |
| Construct-type classifier | Ordered regex rules applied to original input lines |

---

## Constitution Check

| Principle | Status |
|-----------|--------|
| Test-first (detect before fix) | ✓ — test is the deliverable |
| No over-engineering | ✓ — single file, no new helpers or abstractions |
| Reuse existing harness | ✓ — `FULL_HARNESS_URL` + existing helpers |
| CI-runnable | ✓ — Playwright suite already runs in CI |

---

## Phase 0: Research Findings

All clarifications resolved during spec phase. No external dependencies to resolve.

**Key findings from codebase exploration:**

1. `full-editor.ts` loads the complete production extension set (including `GenericHTMLBlock`, `HtmlCommentBlock`, `FrontmatterExtension` indirectly via StarterKit/Markdown). This is the correct harness to use.
2. `setContent(page, md)` calls `editorAPI.setMarkdown(md)` which uses `editor.commands.setContent(md, { contentType: 'markdown' })` — the real parse path.
3. `getContent(page)` calls `editorAPI.getMarkdown()` which returns the serialized markdown — the real serialize path.
4. `waitForEditor(page)` + `setContent` + `getContent` are already exported from `helpers/index.ts`.
5. `MARP_STRESS_TEST.md` has 118 lines with: multi-line frontmatter with CSS `style:` block, slide `---` separators, `<!-- class: ... -->` HTML comment directives, `<div class="columns">` HTML blocks, `<img>` tags, fenced code blocks, and body text.
6. The Playwright config serves everything from repo root on `localhost:4321`; fixture path needs to be fetched via `page.evaluate` using `fetch('/src/__tests__/MARP_STRESS_TEST.md')` — consistent with how `table-bullets.spec.ts` reads its fixture via `fs.readFileSync`.
7. The test harness has a 50ms wait after `setContent` — adequate for TipTap render; for large files we will use 100ms.

**Construct-type regex rules (ordered — first match wins):**

| Label | Rule |
|-------|------|
| `[FRONTMATTER]` | Line is within the YAML frontmatter block (between first and second `---`) |
| `[SLIDE-SEPARATOR]` | Bare `---` line outside frontmatter |
| `[CSS-DIRECTIVE]` | Starts with `<!--` |
| `[HTML-BLOCK]` | Starts with `<` (excluding `<!--`) |
| `[CODE-BLOCK]` | Starts with ` ``` ` |
| `[IMAGE]` | Contains `![` or `<img` |
| `[BODY-TEXT]` | Everything else |

---

## Phase 1: Design

### Single deliverable

**`src/__tests__/playwright/marp-roundtrip.spec.ts`**

Structure:
```
describe('MARP Round-Trip')
  test: 'load-only round-trip is identical (zero data loss) @smoke'
    1. Fetch MARP_STRESS_TEST.md via page.evaluate → fetch()
    2. setContent(page, original)
    3. await page.waitForTimeout(100)
    4. output = await getContent(page)
    5. normalise: strip one trailing \n from output
    6. diff = computeDiff(original, output)
    7. if diff.length > 0: format structured report, throw expect failure
```

**`computeDiff(original, output)`** — inline function in the test file:
- Split both strings into lines
- Run Myers diff (simplified: longest-common-subsequence via DP)
- Return array of `{ type: 'missing'|'added'|'changed', origLine?, outLine?, origContent, outContent, label }`

**`classifyLine(line, lineIndex, allLines)`** — inline function:
- Tracks whether we're inside the frontmatter block via state flag
- Applies ordered regex rules

**Failure report format:**
```
MARP Round-Trip Failures (N total):

[1] MISSING   line 42  [CSS-DIRECTIVE]  <!-- class: no-margin -->
[2] MISSING   line 43  [HTML-BLOCK]     <div class="columns">
[3] ADDED     out:38   [BODY-TEXT]      (empty line)
[4] CHANGED   line 71  [IMAGE]
    ORIGINAL: <img src="media/proton-pass.svg" class="rounded" style="width:72%;" alt="tool" />
    OUTPUT:   <img src="media/proton-pass.svg">
```

### No harness changes needed

The existing `full-editor.html` + `full-editor.ts` + `helpers/index.ts` are sufficient as-is.

---

## Root Causes (Confirmed from Test Run 2026-05-12)

The 266 diff entries produced by the initial test run reveal two distinct root causes:

### RC-1: Frontmatter `style:` pipe-literal CSS leaks into document body

The YAML frontmatter contains a multi-line `style: |` pipe-literal block with ~15 lines of CSS. The serializer exits frontmatter prematurely — it closes the YAML block at the first blank line inside the pipe literal rather than at the closing `---`. As a result:
- Frontmatter YAML keys (`marp: true`, `title:`, `theme:`, etc.) are dropped
- The CSS content inside the pipe literal is re-parsed as document body (CSS class names become headings, rules become body text)
- An empty paragraph is prepended before the frontmatter delimiter

### RC-2: `---` inside `<div>` blocks truncates document

The HTML block parser does not suppress slide-separator detection inside open `<div>` elements. When the stress test file reaches the `<div class="columns">` block that internally contains `---` separators (part of the nested slide structure), the parser treats those `---` lines as real slide separators. This causes the slide-separator logic to close the current block prematurely and everything after — approximately 80+ lines — is dropped entirely.

### Fix scope

Both root causes require changes to the markdown parser/serializer pipeline (outside the scope of this test feature). This test will serve as the regression guard for those fixes.

---

## Files Changed

| File | Action |
|------|--------|
| `src/__tests__/playwright/marp-roundtrip.spec.ts` | **CREATE** |
| `specs/044-marp-roundtrip-test/plan.md` | **CREATE** (this file) |
| `.github/copilot-instructions.md` | **UPDATE** — plan reference updated to `specs/044-marp-roundtrip-test/plan.md` |

No other files need modification.
