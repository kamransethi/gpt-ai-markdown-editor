# Feature Specification: Browser-First Testing Migration

**Folder**: `specs/043-browser-testing-migration/`  
**Created**: 2026-05-10  
**Status**: Draft

## Problem Statement

The current test suite gives false confidence. Over a thousand tests pass regularly while real regressions — broken CSS decorations, duplicate TipTap extension warnings, broken Web Worker integration — go undetected in production. This happens because the tests run against jsdom, a simulated browser that cannot render CSS, cannot run Web Workers, and cannot observe real DOM layout or keyboard events.

The consequences are:

1. **False security** — tests pass by exercising mocks, not the real editor. Bugs that only appear in a real browser ship to users.
2. **High maintenance burden** — mocking TipTap internals is brittle. Every TipTap version bump requires rewriting large volumes of mock code unrelated to the feature under test.
3. **Layout blindness** — no test can catch overlapping UI, broken z-indices, scroll-position bugs, or missing visual decorations.
4. **Incomplete picture** — the 1000+ Jest test count is misleading. Most of these test mocks, not behaviour. The ~30 existing Playwright tests cover more real surface area than hundreds of jsdom tests.

The project already has working Playwright infrastructure (`playwright.config.ts`, harness files, passing specs). The goal of this feature is to make Playwright the primary testing method for all editor behaviour, lock the harness API, and establish a clear migration scope for existing jsdom tests — without deleting valid pure-logic tests.

## User Scenarios & Testing

### User Story 1 — Reliable Feature Verification (Priority: P1)

A developer implements a new editor feature and writes a Playwright test that verifies it works in a real browser. The test fails when the behaviour is broken and passes only when it genuinely works — without mocking any editor internals.

**Why this priority**: This is the core capability. Without it, every test added is potentially worthless.

**Independent Test**: Write a single Playwright test for bold formatting, deliberately break the shortcut, and confirm the test fails.

**Acceptance Scenarios**:

1. **Given** a developer writes a Playwright test for an editor interaction, **When** the tested behaviour is broken in the browser, **Then** the test fails with an actionable error message.
2. **Given** an editor interaction works correctly in the browser, **When** the Playwright test runs, **Then** it passes without requiring any mocks of TipTap commands or ProseMirror state.
3. **Given** a test fails, **When** the developer runs it in headed mode (`--headed`), **Then** they can watch the browser reproduce the failure exactly.

---

### User Story 2 — Regression-Safe TipTap Updates (Priority: P2)

A developer updates TipTap to a new minor version. The test suite reports clearly whether any user-visible editor behaviour broke — without requiring mock rewrites.

**Why this priority**: TipTap updates are routine. The current mock burden makes them costly and causes the project to fall behind on updates.

**Independent Test**: Apply a TipTap patch bump and run the Playwright suite; no test should need to be rewritten to accommodate internal API changes.

**Acceptance Scenarios**:

1. **Given** a TipTap minor version update, **When** the Playwright integration tests run, **Then** no test fails solely because TipTap internal APIs changed (as opposed to real, user-visible behaviour changes).
2. **Given** a TipTap update breaks real editor behaviour, **When** the Playwright tests run, **Then** the relevant test fails with a description of what visibly changed.

---

### User Story 3 — Visual & Layout Regression Detection (Priority: P3)

A developer changes CSS or a TipTap NodeView. The test suite catches visual regressions — missing decorations, overlapping elements, broken layout — before they reach users.

**Why this priority**: Layout bugs are currently invisible to the test suite. They surface only in user bug reports.

**Independent Test**: A DOM-state assertion test confirms that a spell-check decoration renders. A CSS change that removes the decoration causes the test to fail.

**Acceptance Scenarios**:

1. **Given** a CSS change causes a spell-check underline to stop rendering, **When** the Playwright tests run, **Then** a test that asserts the decoration's CSS class is present fails.
2. **Given** a change causes the floating toolbar to overlap the editor content, **When** the Playwright tests run, **Then** a bounding-box assertion test fails.
3. **Given** no visual regressions were introduced, **When** all Playwright tests run, **Then** they all pass.

---

### Edge Cases

- **Server startup failure**: If `npx serve` fails to start, Playwright must fail fast with a clear error (`ERR_CONNECTION_REFUSED`), not hang indefinitely. `playwright.config.ts` must set a `webServer.timeout` and `reuseExistingServer: false` in CI.
- **Harness API break**: If a method on `window.editorAPI` is renamed or removed, all dependent tests break at once. The harness API must be treated as a versioned contract — changes require updating all callers simultaneously, not incrementally.
- **Test isolation and concurrency**: Most tests run concurrently across Playwright worker processes (one browser context per worker, one spec file per worker). Tests that mutate global editor state — configuration settings, AI provider selection, dictionary contents — MUST be grouped in a dedicated spec file configured to run sequentially (`workers: 1` scoped to that file). Standard editor content tests reset state via `window.editorAPI.setMarkdown('')` between tests without a full page reload, keeping them fast. Tests that require a fully clean browser context (e.g., testing harness initialization itself) use `beforeAll(page.reload)` within their own `test.describe` block.
- **Pure-logic Jest tests**: Tests with no DOM dependency (serialization, string transforms, VS Code host handlers) must continue to run unchanged. They are explicitly not in scope for migration.
- **VS Code host-side interactions**: Tests verify browser-layer correctness only. The test harness runs in a standalone webview, not inside a VS Code extension host. Host-side logic (message routing, file system operations) is verified by Jest Node tests of `MarkdownEditorProvider` and message handlers — not by Playwright.

## Requirements

### Functional Requirements

- **FR-001**: The editor MUST expose two stable, versioned harness objects in the standalone webview build:
  - `window.editorAPI` with at minimum: `isReady()`, `setMarkdown(md)`, `getMarkdown()`, `getActiveMarks()`, `getSelectionCoords()`, `runCommand(name, ...args)`.
  - `window.spellAPI` with at minimum: `isReady()`, `getSuggestions(word)`, `addToDictionary(word)`, `removeFromDictionary(word)`.
  Both contracts must be locked before any feature-area Playwright specs are written (see FR-003).
- **FR-002**: The harness MUST block test interaction until both TipTap and the spell-check worker are fully initialized, signalled via their respective `isReady()` returning `true`.
- **FR-003**: The harness API contract MUST be locked and documented before any feature-area Playwright specs are written. Changes to the API require updating all dependent tests in the same commit.
- **FR-004**: New tests for all editor interactions (formatting, paste, keyboard navigation, context menus, decorations, scroll) MUST be written as Playwright specs against the standalone webview. Every button in the main toolbar, bubble menu, and every item in all context menus MUST have at least one click-test in its domain spec verifying it produces the correct editor output or UI response.
- **FR-005**: Tests for pure logic (string transforms, file path resolution, VS Code host message handlers, markdown serialization) MUST remain as Jest Node tests and are explicitly excluded from migration.
- **FR-006**: Playwright integration tests MUST NOT mock TipTap commands, ProseMirror state, or internal editor APIs. If a test requires such mocking, it is a signal that the test belongs at the Jest Node tier.
- **FR-007**: Visual regression tests MUST use DOM-state assertions (element presence, CSS class verification, bounding-box comparison) as the primary method. Pixel snapshot tests MAY be added only for complex rendered outputs (Mermaid diagrams) and only when a consistent rendering environment can be guaranteed.
- **FR-008**: The following jsdom test files are the explicit, named migration scope for this spec. They MUST each have a Playwright replacement written and the original deleted before this spec is considered complete:
  - `src/__tests__/extensions/frontmatter/frontmatter.test.ts` — 40+ TipTap mocks; tests the frontmatter TipTap extension in a fake DOM
  - `src/__tests__/extensions/links/linkDialog.test.ts` — 12 TipTap mocks; tests link dialog extension interaction
  - `src/__tests__/smoke/undo-sync.test.ts` — 43 TipTap mocks; smoke-tests undo/redo state by mocking the entire editor stack
  - `src/__tests__/extensions/blocks/codeBlockShikiWithUi.test.ts` — mocks `@tiptap/extension-code-block-lowlight`; tests NodeView DOM output
  - `src/__tests__/extensions/blocks/codeBlockWithUi.test.ts` — mocks `@tiptap/extension-code-block-lowlight`; tests NodeView DOM output
  - `src/__tests__/webview/ui/searchOverlay.test.ts` — mocks `@tiptap/pm/view` decorations; the decoration assertion tests migrate to Playwright; pure-logic string tests in this file may be kept as Jest Node after extraction
- **FR-009**: All other jsdom tests not in FR-008 scope MUST be migrated only when the feature they cover is actively changed. They MUST NOT be deleted without a Playwright replacement.
- **FR-010**: Playwright specs MUST be tagged with one of two execution tiers:
  - **Smoke tier** (`@smoke`): A small subset covering the most critical user-visible interactions (at minimum: bold/italic toggle, undo/redo, one slash command, spell-check decoration, one context menu item). Smoke tests must complete in under 2 minutes on a developer machine.
  - **Release tier** (full suite, untagged): Covers every toolbar button, every context menu item, all domain specs, and all FR-008 migration targets. This tier has no time cap — running up to 20 minutes is acceptable. It runs only in the release pipeline.
- **FR-011**: Three pipeline stages:
  1. **Pre-commit**: Jest Node only (target: <15 s).
  2. **Smoke CI**: Playwright `@smoke`-tagged tests only — runs on every pull request / push (target: <2 min).
  3. **Release CI**: Full Playwright suite — runs on release builds; no time cap (up to 20 min acceptable).
- **FR-012**: Playwright spec files MUST run concurrently across worker processes by default (one browser context per worker). Spec files whose tests mutate global editor state (configuration, dictionary contents, AI provider selection) MUST be isolated into a dedicated file and configured to run sequentially. Individual tests within a concurrent spec file MUST reset editor content state via the harness before each test — a full page reload is only permitted where harness re-initialization is the thing under test.

### Key Entities

- **Test Harness** (`window.editorAPI`, `window.spellAPI`): Two stable, versioned interfaces between Playwright tests and the running editor and spell-check worker respectively. Neither exposes TipTap internals or worker implementation details.
- **Standalone Webview**: `public/index.html` + `dist/webview.js` served by `npx serve . -p 4321`. The Playwright test target. Distinct from the VS Code webview, which additionally has CSP headers, `acquireVsCodeApi()`, and extension host message routing.
- **Integration Tier**: Playwright specs covering user-visible editor interactions per PRD domain.
- **Visual Tier**: Playwright DOM-state and (limited) snapshot specs for layout and rendering correctness.
- **Unit Tier**: Jest Node specs for pure logic. These are correct, fast, and kept as-is.

## Test Suite Structure by Product Domain

This section defines the authoritative file layout and coverage scope for the Playwright suite, organized by source-code complexity and product domain. Test file size is proportional to the complexity of the code under test. Each spec file is owned by one domain; tests within a file cover only that domain's scenarios.

Coverage priority is driven by lines of code: more code = more tests. The totals below are the combined line counts of all source files owned by that domain.

| PRD Domain | Spec File | Tier | Key Coverage | Source Complexity | Priority |
|---|---|---|---|---|---|
| **Editor Core** | `playwright/editor-core.spec.ts` | Integration | Bold/italic/underline/strikethrough shortcuts; headings H1–H6; blockquote; horizontal rule; inline code; hard break; undo/redo; cut/copy/paste; text selection; scroll stability; roundtrip serialization | `editor.ts` 2,143 lines | **High** |
| **Toolbar & Bubble Menu** | `playwright/bubble-menu.spec.ts` | Integration | Every toolbar button clicked and verified to produce correct editor output or UI response; bubble menu appears on text selection and hides on deselection; context-aware buttons show/hide per node type (e.g. table buttons only when in table); heading level picker; alignment buttons; AI refine button; text color picker | `BubbleMenuView.ts` 1,731 lines | **High** |
| **Tables** | `playwright/tables.spec.ts` | Integration + Round-trip | Table creation via toolbar and markdown input; Tab/Shift+Tab cell navigation; Shift+Enter inserts new line within a cell (hardBreak preserved on serialization); bullet lists in cells — single level and nested depth-0/1/2; ordered lists in cells without embedded newlines; bold, italic, and highlighted text in cells; task items in cells; copy/paste table preserves structure; table context menu — every item (add row above/below, remove row, add column left/right, remove column, align left/center/right); full round-trip serialization: load → getMarkdown → setMarkdown → getMarkdown must be identical; mixed cell content (text + bullet + break in same cell) | `tableClipboard.ts` 269, `sharedTableOps.ts` 267, `tableMarkdownSerializer.ts` 211, `tableBulletListSmart.ts` 203, `tableInsert.ts` 232, `tableContextMenu.ts` 129 — **~1,311 lines total** | **High — most complex data path** |
| **Search & Replace** | `playwright/search.spec.ts` | Integration | Search opens via keyboard shortcut and toolbar button; all matching instances highlighted simultaneously; next/previous result navigation; replace single instance; replace all; case-sensitive toggle; regex mode toggle; empty-query state (no highlight); overlay closes via Escape and close button | `searchOverlay.ts` 541, `searchAndReplace.ts` 516 — **1,057 lines total** | **High** |
| **Images** | `playwright/images.spec.ts` | Integration | Paste image from clipboard inserts at cursor; drag-and-drop file from filesystem; context menu appears on right-click of image — every context menu item (edit alt text, rename file, resize, copy path, open externally, AI explain); rename dialog opens, accepts new name, updates reference; large-image confirmation dialog appears and is dismissible; local-image-outside-repo dialog; image metadata dialog renders fields; drawio image double-click dispatches `openDiagram` command | `imageDragDrop.ts` 1,199, `customImage.ts` 436, `imageContextMenu.ts` 407, `imageRenameDialog.ts` 667, `imageMetadata.ts` 336, `imageConfirmation.ts` 230 — **~2,099 lines total** | **High** |
| **Links** | `playwright/links.spec.ts` | Integration | Insert link via dialog (external URL and file path); autocomplete suggestions appear on `[[` prefix; autocomplete item selected inserts correct link syntax; file-link drop inserts markdown link; edit existing link reopens dialog pre-filled; remove link; external vs internal link distinction | `linkDialog.ts` 750, `linkAutocomplete.ts` 431 — **1,181 lines total** | **High** |
| **Spell Check** | `playwright/spell-check.spec.ts` | Integration | Decoration renders on misspelled word; no decoration on correct word; code block content excluded from spell checking; contraction not flagged as error; right-click opens suggestion context menu; accept suggestion replaces word; add word to dictionary removes decoration permanently; remove word from dictionary re-decorates; `window.spellAPI.isReady()` resolves before first check | `spellCheck.ts` 455 lines | **Done — extend with dictionary tests** |
| **Settings Panel** | `playwright/settings-panel.spec.ts` | Integration | Panel opens via toolbar; AI provider section renders and each provider selectable; spell-check toggle disables/re-enables decorations; theme selector changes editor CSS class; export settings section visible; reset to defaults button; save persists across page reload (via harness) | `settingsPanel.ts` 1,354 lines | **Medium** |
| **AI Chat** | `playwright/ai-chat.spec.ts` | Integration (UI-only) | Chat panel opens; message input accepts text; send button present and clickable; response area renders markdown output (bold, lists, code blocks); knowledge graph chat mode toggle present; provider-unavailable error state renders inline; chat history panel shows previous messages | `chatWebview.ts` 443, `graphChat.ts` 334 — **777 lines total** | **Medium** |
| **AI Refine / Explain / Summary** | `playwright/ai-actions.spec.ts` | Integration (UI-only) | Refine action menu appears when text selected; Explain button visible in toolbar; image right-click shows AI explain item; image explain dialog opens with loading state; summary action renders summary panel; each AI action shows correct error state when no provider is configured; markdown output in AI result panel renders correctly (tables, code blocks, lists) | `aiRefine.ts` 219, `aiExplain.ts` 270, `aiExplain-unified.ts` 266, `imageAsk.ts` 256 — **1,011 lines total** | **Medium** |
| **Slash Commands** | `playwright/slash-commands.spec.ts` | Integration | `/` opens command palette; each command item click inserts correct node type (heading, code block, table, image placeholder, mermaid, task list, horizontal rule, blockquote); Escape dismisses without insertion; command palette filters on typing | `slashCommand.ts` | **Medium** |
| **Frontmatter** | `playwright/frontmatter.spec.ts` | Visual + Integration | Panel renders when document has YAML frontmatter; panel hidden when absent; edits in panel update document content; YAML parse error surfaces inline feedback; frontmatter modal open/close | `frontmatterPanel.ts`, `frontmatterModal.ts` | **Medium** |
| **Mermaid Diagrams** | `playwright/mermaid.spec.ts` | Visual + Integration | Mermaid code block renders as diagram node (not raw text); double-click opens editor modal; modal save updates diagram source; template insertion from toolbar creates valid mermaid block; modal cancel discards changes | `mermaid.ts` 346, `mermaidEditor.ts` 215 — **561 lines total** | **Medium** |
| **Code Blocks & GitHub Alerts** | `playwright/code-blocks.spec.ts` | Integration | Code block creation; language dropdown selection changes highlight; copy button copies code to clipboard; Shiki syntax highlighting renders (CSS color classes present in DOM); GitHub Alert types (Note, Warning, Important, Tip, Caution) each render with correct icon and CSS class | `codeBlockShikiWithUi.ts`, `codeBlockWithUi.ts`, `githubAlerts.ts` 449 | **Medium** |
| **Navigation & TOC** | `playwright/navigation.spec.ts` | Integration | TOC panel renders all headings; click on TOC item scrolls to heading; TOC updates in real time when heading is added or removed; outline panel shows document structure | `tocPane.ts` 246, `tocOverlay.ts` 216 — **462 lines total** | **Medium** |
| **Draw.io** | `playwright/drawio.spec.ts` | Integration | `.drawio.svg` image recognized as diagram type; double-click dispatches `openDiagram` command; not treated as raster image by context menu | `customImageMessagePlugin.ts` 265 | **Low** |
| **Plugin System** | `playwright/plugin-system.spec.ts` | Integration | Toolbar button registered by plugin appears in correct position; plugin command executes and produces output; core editor remains functional when plugin throws an error | `CommandRegistry.ts` 515 | **Low** |
| **Export / Serialization** | *(Jest Node — no migration)* | Unit | `htmlToMarkdown`, compression, Pandoc-compatible output, table minification | Pure logic — Jest Node is correct | **N/A** |
| **Configuration (host-side)** | *(Jest Node — no migration)* | Unit | Settings read/write, media path resolution, provider config persistence | Host-side only — Playwright cannot reach VS Code settings | **N/A** |
| **Knowledge Graph** | *(deferred)* | — | Hybrid search, vector indexing — requires dedicated harness extension | Separate spec | **Deferred** |
| **Global State** | `playwright/global-state.spec.ts` *(sequential)* | Integration | Dictionary word add/remove; AI provider switching; configuration panel changes — anything that mutates shared global editor state | Runs with `workers: 1`; isolated from concurrent suite | **Medium** |

### Smoke Tier (`@smoke` tag)

The smoke subset runs on every push (target: <2 minutes). It must cover one critical path per major functional area:

| Area | Smoke test(s) |
|---|---|
| Editor core | Bold toggle via keyboard shortcut |
| Toolbar | Click italic button, verify mark applied |
| Tables | Create table, Tab to next cell, type in cell |
| Tables (data) | Insert bullet list in cell, verify roundtrip |
| Spell check | Misspelling decoration renders |
| Search | Open search, type query, first match highlighted |
| Images | Right-click image, context menu opens |
| Links | Insert link via dialog, link node present |
| AI actions | Refine menu appears on text selection |
| Slash commands | `/` opens palette |
| Settings | Panel opens |

All other tests are release-tier only (untagged, run in release pipeline, no time cap).

### Test File Locations

All Playwright specs live in `src/__tests__/playwright/`. Harness helpers in `src/__tests__/playwright/harness/`. Jest Node tests remain in `src/__tests__/` subdirectories organized by source module.

### Test File Location

All Playwright specs live in `src/__tests__/playwright/`. Harness helper code lives in `src/__tests__/playwright/harness/`. Jest Node tests remain in `src/__tests__/` subdirectories organized by source module.

### What Is Not Covered by Playwright

The following are explicitly NOT covered by this spec's Playwright suite and remain Jest Node or deferred:

- VS Code host message routing (`MarkdownEditorProvider`, `MessageRouter`)
- File system operations (`spellHandlers`, image path resolution)
- Markdown serialization logic (`htmlToMarkdown`, compression, table minification)
- VS Code settings persistence
- Actual LLM inference calls — AI feature tests cover UI wiring only (button present, panel renders, error state shows); LLM responses are not asserted
- Knowledge Graph indexing and search (requires dedicated harness extension)

## Success Criteria

### Measurable Outcomes

- **SC-001**: Zero new jsdom tests that mock TipTap or ProseMirror internals are merged after this feature ships.
- **SC-002**: A TipTap minor-version update requires zero mock rewrites in the Playwright test suite.
- **SC-003**: Every PRD domain listed in the test structure table above has at least one passing Playwright spec. Every toolbar button and every context menu item in every menu has at least one click-test in the relevant domain spec.
- **SC-004**: Any CSS change that removes a spell-check or formatting decoration is caught by an existing Playwright test before merge.
- **SC-005**: All FR-008 target test files are replaced with Playwright equivalents and the originals are deleted.
- **SC-006**: The Playwright smoke tier completes in under 2 minutes on a developer machine. The full release tier completes in under 20 minutes. There is no time cap on the release tier beyond 20 minutes.
- **SC-007**: A developer can reproduce any failing Playwright test by running it with `--headed` and watching the browser.
- **SC-008**: The pre-commit hook runs Jest Node only (< 15 s); Playwright is CI-only.

## Assumptions

- The standalone webview build (`public/index.html` + `dist/webview.js`) is the Playwright test target. It operates without `acquireVsCodeApi()` via the bridge abstraction introduced in spec 040. No new build output is needed.
- The Playwright test suite tests browser-layer correctness only. It does not test VS Code host behaviour (file saving, extension settings, message routing to the host). That remains Jest Node.
- Pixel snapshot tests are deferred until a pinned Docker rendering environment is established. Until then, all visual tests use DOM-state assertions (class presence, element existence, bounding boxes).
- The existing `window.editorAPI` skeleton from spec 040 is the harness foundation. This spec formalises and locks its contract.
- Pure Jest Node tests (serialization, host handlers, string logic) are correct and valuable — they are not in scope for migration or deletion.

## Out of Scope

- End-to-end tests inside VS Code (opening real `.md` files via the extension host) — requires a separate VS Code extension test harness spec.
- Performance benchmarking or load testing.
- Knowledge Graph Playwright testing — deferred to its own spec.
- Pixel snapshot CI infrastructure — deferred until rendering environment is stabilised.
- Deleting any Jest Node pure-logic test.

## Clarifications

### Session 2026-05-10

- Q: Should tests run concurrently across spec files, and how should global-state-mutating tests be isolated? → A: Concurrent workers by default (one browser context per worker); global-state-mutating tests isolated into `global-state.spec.ts` with `workers: 1`; content reset via `setMarkdown('')`, not page reload.
- Q: Should the existing migration scope in FR-008 list files explicitly or leave a wildcard for any file importing `jest.mock('@tiptap/*')`? → A: Audit the files now and list them explicitly. Confirmed migration targets: `frontmatter.test.ts` (40+ mocks), `linkDialog.test.ts` (12 mocks), `undo-sync.test.ts` (43 mocks), `codeBlockShikiWithUi.test.ts` (1 mock), `codeBlockWithUi.test.ts` (1 mock), `searchOverlay.test.ts` (decoration tests migrate; pure-logic tests extracted and kept as Jest Node).
- Q: Should `window.spellAPI` be documented as a separate harness contract alongside `window.editorAPI`? → A: Yes — keep them separate; document both in FR-001. Spell check is one domain test in a much broader suite; every main toolbar button and every context menu item must be click-tested in the full release suite.
- Q: Should the 90-second time cap on the full Playwright suite be retained? → A: No — abandon the 90-second rule. Replace with a two-tier model: smoke tier (<2 min) runs on every push; release tier (up to 20 min, no cap) runs on release builds.
