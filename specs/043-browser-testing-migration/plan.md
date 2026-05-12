# Implementation Plan: Browser-First Testing Migration

**Folder**: `specs/043-browser-testing-migration/plan.md` | **Date**: 2026-05-10 | **Spec**: [spec.md](./spec.md)  
**Status**: Approved ✅

## Summary

Replace jsdom/TipTap-mock tests with real-browser Playwright tests for all editor UI behaviour. A new full-featured `full-editor.ts` harness imports all production extensions and exposes the complete `window.editorAPI` + `window.spellAPI` contracts. Playwright spec files are then written one-per-domain (16 files). Six FR-008 jsdom files are deleted after their Playwright replacements pass. `playwright.config.ts` gains smoke/release project tiers.

## Stack

**Language/Runtime**: TypeScript 5, Node 20  
**Test runner**: Playwright 1.x (real Chromium); Jest Node (pure logic, unchanged)  
**Key deps**: `@playwright/test`, `@tiptap/core`, `@tiptap/extension-*`, `@tiptap/starter-kit`, `@tiptap/markdown`, `@tiptap/extension-table`, `@tiptap/extension-list`, `nspell` (spell worker)  
**Build**: esbuild via `scripts/build-playwright-harness.js` (existing)

## Phases

**Phase 1 — Harness & Config Lock** (blocking prerequisite for all specs):
- Files: `src/__tests__/playwright/harness/full-editor.ts` (CREATE), `src/__tests__/playwright/harness/full-editor.html` (CREATE), `scripts/build-playwright-harness.js` (MODIFY), `playwright.config.ts` (MODIFY), `src/__tests__/playwright/helpers/index.ts` (CREATE)
- Tests: 0 new tests — this phase enables all others

**Phase 2 — High-Priority Specs** (6 files):
- Files: `editor-core.spec.ts`, `bubble-menu.spec.ts`, `tables.spec.ts`, `search.spec.ts`, `images.spec.ts`, `links.spec.ts` — all CREATE
- Tests: ~90 Playwright tests covering High-priority domains

**Phase 3 — Medium-Priority Specs** (8 files):
- Files: `settings-panel.spec.ts`, `ai-chat.spec.ts`, `ai-actions.spec.ts`, `slash-commands.spec.ts`, `frontmatter.spec.ts`, `mermaid.spec.ts`, `code-blocks.spec.ts`, `navigation.spec.ts` — all CREATE
- Tests: ~60 Playwright tests covering Medium-priority domains

**Phase 4 — Low-Priority Specs + FR-008 Migrations** (3 spec files, 5 deletions, 1 modification):
- Files: `drawio.spec.ts`, `plugin-system.spec.ts`, `global-state.spec.ts` — CREATE
- Migrate: Delete 5 jsdom files from FR-008 list; extract pure-logic tests from `searchOverlay.test.ts`

## Files

| File | Action | Purpose |
|------|--------|---------|
| `src/__tests__/playwright/harness/full-editor.ts` | CREATE | Full-extension harness with complete `window.editorAPI` + `window.spellAPI` |
| `src/__tests__/playwright/harness/full-editor.html` | CREATE | HTML host page for full-editor harness |
| `scripts/build-playwright-harness.js` | MODIFY | Add `full-editor.ts` as esbuild entry point |
| `playwright.config.ts` | MODIFY | Add `smoke` project (`--grep @smoke`); set `timeout: 60_000` for release |
| `src/__tests__/playwright/helpers/index.ts` | CREATE | `waitForEditor()`, `setContent()`, `getMarks()`, `FULL_HARNESS_URL` constant |
| `src/__tests__/playwright/editor-core.spec.ts` | CREATE | Formatting, headings, undo/redo, paste, roundtrip |
| `src/__tests__/playwright/bubble-menu.spec.ts` | CREATE | Every toolbar/bubble-menu button click-tested |
| `src/__tests__/playwright/tables.spec.ts` | CREATE | Full table coverage including cell data types, roundtrip |
| `src/__tests__/playwright/search.spec.ts` | CREATE | Search/replace overlay — all controls |
| `src/__tests__/playwright/images.spec.ts` | CREATE | Image context menu — every item |
| `src/__tests__/playwright/links.spec.ts` | CREATE | Link dialog, autocomplete |
| `src/__tests__/playwright/spell-check.spec.ts` | EXTEND | Add `window.spellAPI` dictionary tests |
| `src/__tests__/playwright/settings-panel.spec.ts` | CREATE | Settings panel UI |
| `src/__tests__/playwright/ai-chat.spec.ts` | CREATE | Chat panel UI wiring |
| `src/__tests__/playwright/ai-actions.spec.ts` | CREATE | Refine/explain/summary UI wiring |
| `src/__tests__/playwright/slash-commands.spec.ts` | CREATE | Slash command palette |
| `src/__tests__/playwright/frontmatter.spec.ts` | CREATE | Frontmatter panel |
| `src/__tests__/playwright/mermaid.spec.ts` | CREATE | Mermaid diagram editing |
| `src/__tests__/playwright/code-blocks.spec.ts` | CREATE | Code blocks + GitHub Alerts |
| `src/__tests__/playwright/navigation.spec.ts` | CREATE | TOC panel |
| `src/__tests__/playwright/drawio.spec.ts` | CREATE | Draw.io detection |
| `src/__tests__/playwright/plugin-system.spec.ts` | CREATE | Plugin registration |
| `src/__tests__/playwright/global-state.spec.ts` | CREATE | Global state mutation (sequential) |
| `src/__tests__/extensions/frontmatter/frontmatter.test.ts` | DELETE | FR-008 migration — replaced by frontmatter.spec.ts |
| `src/__tests__/extensions/links/linkDialog.test.ts` | DELETE | FR-008 migration — replaced by links.spec.ts |
| `src/__tests__/smoke/undo-sync.test.ts` | DELETE | FR-008 migration — replaced by editor-core.spec.ts |
| `src/__tests__/extensions/blocks/codeBlockShikiWithUi.test.ts` | DELETE | FR-008 migration — replaced by code-blocks.spec.ts |
| `src/__tests__/extensions/blocks/codeBlockWithUi.test.ts` | DELETE | FR-008 migration — replaced by code-blocks.spec.ts |
| `src/__tests__/webview/ui/searchOverlay.test.ts` | MODIFY | Extract pure-logic string tests; delete jsdom/decorator portion |

## Key Risks

| Risk | Cause | Mitigation |
|------|-------|-----------|
| Full harness build breaks existing tests | New extensions conflict | Keep `full-editor.ts` independent of `editor-harness.ts`; both built by same script |
| Flaky tests from async init | TipTap + spell worker async startup | `waitForEditor()` in helpers polls `window.editorAPI.isReady()` with 15s timeout |
| Context menus use DOM, not native browser menus | Editor has custom DOM context menus | Locate by class `.context-menu` or `[data-testid]`; right-click via `page.click(..., {button: 'right'})` |
| AI panel tests hang | No LLM inference in test env | Tests assert UI state only (loading spinner present, error message visible) — no LLM call |
| FR-008 deletions break CI | jsdom deleted before Playwright replacement passes | Delete jsdom file ONLY as final step in each task, after `npx playwright test <spec>.spec.ts` passes |
| Harness extension list drift | `editor.ts` gains new extension; harness doesn't | Add comment in `full-editor.ts` listing extensions from `editor.ts` — sync in quarterly review |

## Implementation Decisions

**Decision 1 — Full harness vs. standalone webview**:
- [x] **A**: Dedicated `full-editor.ts` — imports production extensions; `window.editorAPI` is explicit; no dependency on `dist/webview.js` freshness
- [ ] **B**: Use `public/index.html` directly — requires `dist/webview.js` rebuilt before each test run
- **Chosen: A** — harness build is part of the test workflow; standalone build is for dev use.

**Decision 2 — Smoke tier implementation**:
- [x] **A**: Playwright `projects` in config — `smoke` project uses `grep: /@smoke/`; release project is unfiltered default
- [ ] **B**: Single project with ad-hoc `--grep` flag
- **Chosen: A** — projects are first-class, CI-friendly, and self-documenting.

**Decision 3 — Selector strategy for UI elements**:
- [x] **A**: CSS class selectors where they exist; add `data-testid` attributes only where CSS classes are ambiguous (e.g., multiple similar buttons)
- [ ] **B**: Only CSS class selectors — no DOM modifications
- **Chosen: A** — minimal DOM changes; `data-testid` only where needed; does not affect production styling.

**Decision 4 — Spec file harness target**:
- All new specs use `FULL_HARNESS_URL = '/src/__tests__/playwright/harness/full-editor.html'`
- Existing `table-bullets.spec.ts` and `spell-check.spec.ts` keep their existing harness URLs (no regression)
- `spell-check.spec.ts` extended with dictionary tests using `window.spellAPI` — it already uses `spell-harness.html`

