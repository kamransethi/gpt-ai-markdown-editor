# Test Architecture & Organization

This folder documents the complete test strategy for Flux Flow: when each suite runs, what it tests, and the design rationale behind the organization.

## Overview

The project uses a three-layer test architecture:

| Layer | Runner | When | Tests |
|---|---|---|---|
| **Unit** | Jest (Node/jsdom) | Every build, pre-commit | Pure logic: extensions, features, serialization |
| **Integration** | Jest (Node/jsdom) | Release builds | Full TipTap round-trip, known issues, edge cases |
| **Component** | Playwright (real Chromium) | Manual / CI scheduled | Webview UI interactions, keyboard commands, fixture loading |

---

## Test Suites: Complete Catalog

### Jest Unit Tests (~1000+ tests total)

All run via `npm test` or `npm run test:watch`. Environment is Node or jsdom (browser-like DOM without a real browser).

#### Editor Extensions (jsdom)

| Suite | Purpose | Example tests |
|---|---|---|
| `extensions/blocks/` | Code block rendering | Syntax highlighting, Shiki fallback, GitHub Alerts |
| `extensions/formatting/` | Inline & block formatting | Bold, italic, paragraph styles, tab indentation |
| `extensions/frontmatter/` | YAML frontmatter | Validation, parsing, edge cases, modal interaction, serialization |
| `extensions/images/` | Image handling | Dialogs, placeholders, indented code blocks, spacing |
| `extensions/links/` | Link parsing & dialogs | File links, autolinks, link command behavior |
| `extensions/mermaid/` | Diagram editing | Nodeview, modal, templates, user interaction |
| `extensions/tables/` | Table authoring | Insert, clipboard, cell bullets, ordered lists, nesting |

#### Core Features (Node)

| Suite | Purpose | Example tests |
|---|---|---|
| `features/` | Business logic | AI refine provider, LLM selection, image conversion, export, word count, outline, knowledge graph, search integration |
| `editor/` | File & document handling | Frontmatter rendering, image path resolution, image rename tracking, undo sync |
| `extension/` | VS Code integration | Settings persistence, viewer prompt persistence (build gates) |

#### Webview UI (jsdom)

| Suite | Purpose | Example tests |
|---|---|---|
| `webview/ui/` | Editor chrome | Bubble menu, base overlay, search overlay, TOC pane, settings panel, toolbar refresh |

#### Smoke & Integration (jsdom)

| Suite | Purpose | Run condition |
|---|---|---|
| `smoke/` | Edge cases & regressions | `npm test` — HTML preservation, hash sync, undo sync, paste handling, shortcuts |
| `integration/` | Full workflows | `npm test` — export content, known issues, paste diagnostics, scroll stability, task lists |
| `e2e/` | Headless automation | `npm test` — robot table data entry (TipTap only, no browser) |

**Special case: `integration/stressTestRoundTrip.test.ts`**

- Loaded from `STRESS_TEST_DOC.md` (canonical fixture with all markdown features)
- Parses into TipTap, serializes back to markdown
- Asserts output is semantically equivalent to input
- Detects silent data loss from TipTap upgrades
- Runs via `npm run test:roundtrip` (release builds only)

---

### Playwright Component Tests (20 tests)

**File:** `playwright/table-bullets.spec.ts`  
**Runner:** Playwright with real Chromium  
**Build:** `npm run build:playwright-harness && npx playwright test`

| Category | Test count | What it verifies |
|---|---|---|
| Load & fixture | 2 | Fixture loads, editor ready, all sections present |
| Single-level bullets | 3 | Serialization, marker preservation, table structure |
| Commands | 2 | `toggleBulletListSmart` add & remove |
| Nesting levels | 4 | Depth-0/1/2 markers, all levels on one row, Tab/Shift+Tab indent |
| Ordered lists | 1 | Serialization without embedded newlines |
| Multi-cell | 1 | Multiple bullet cells in same row stay valid |
| Round-trip stability | 2 | Idempotent serialization (load → serialize → load → serialize matches) |
| Text insertion | 1 | Insert bullets into empty cell |
| Edge cases | 4 | Empty cells, mixed text+bullets, sparse cells, last column |

---

## Run Triggers & Test Sequence

### Pre-commit Hook
```
npm run precommit
```
**Runs:** eslint + all Jest tests (~1000+)  
**Purpose:** Catch regressions before pushing  
**Duration:** ~30–60s

### Local Development Build
```
npm run build:debug
```
**Sequence:**
1. `test:settings` (Jest: settings persistence)
2. Build extension (Node)
3. Build webview (esbuild)

**Purpose:** Catch breaking changes before reloading VS Code  
**Duration:** ~10–15s (tests ~2–3s, build ~5–10s)

### Release Build
```
npm run build:release
```
**Sequence:**
1. `test:settings` (Jest: settings persistence)
2. Build extension (Node, minified)
3. Build webview (esbuild, minified)
4. `test:roundtrip` (Jest: full markdown round-trip)
5. `verify-build` (check .vsix artifacts)

**Purpose:** Verify lossless serialization & extension integrity before publish  
**Duration:** ~30–45s (tests ~5–10s, builds ~15–20s, verification ~5s)

### Manual Test Commands

| Command | What | Duration |
|---|---|---|
| `npm test` | All Jest suites | ~2–3m |
| `npm run test:watch` | Jest in watch mode | Interactive |
| `npm run test:coverage` | Jest + coverage report (60% threshold) | ~3–5m |
| `npm run test:roundtrip` | Only stress-test round-trip | ~10–20s |
| `npm run test:settings` | Only settings persistence | ~5–10s |
| `npm run test:playwright` | All Playwright specs (headless) | ~10–15s |
| `npm run test:playwright --headed` | Playwright with visible Chromium | ~15–20s |
| `npm run test:playwright --headed --slow-mo=800` | Playwright with 800ms delay per action | ~2–3m (visible interactions) |
| `npm run test:playwright:ui` | Playwright UI explorer (interactive) | Interactive |

### CI / Release Pipeline
```
npm run vsix
```
= `npm run build:release && npm run prepackage:release && npm run package:release`

**Runs:** Full build:release chain (includes test:settings + test:roundtrip)

---

## Coverage Policy

**Threshold:** 60% on branches, functions, lines, statements (enforced)

**Excluded (by design):**
- `src/extension.ts` — requires real VS Code host process
- `src/editor/MarkdownEditorProvider.ts` — VS Code editor API surface
- `src/features/documentExport.ts` — requires headless Chrome + Word binary
- `src/webview/**` — UI requires running editor; covered by Playwright instead

---

## Design Rationale

### Why Playwright for webview, not ExTester?

1. **Playwright targets the DOM directly** — can access webview iframes reliably across VS Code versions
2. **ExTester wraps WebdriverIO** — fragile against VS Code Electron version changes, slower, higher setup complexity
3. **For webview-heavy apps**, Playwright + component testing (HTML harness) is more stable

### Why separate Playwright from Jest?

1. **Jest runs in Node/jsdom** — fast, deterministic, no browser startup
2. **Playwright runs real Chromium** — slow startup (5–10s), but verifies actual browser behavior (CSS, events, timers)
3. **Jest tests logic in isolation** — Playwright tests the full UI integration
4. **Playwright not in pre-commit** — launching Chromium on every commit would slow down developer workflow

### Why test settings persistence on every build?

Settings persistence is the gateway between the extension host and user configuration. If it breaks:
- User settings don't load on reload → broken editor state
- New settings don't save → user changes are lost

Testing it early (before full build) catches regressions before the build completes.

### Why only test:roundtrip on release?

The stress test is computationally expensive (full TipTap parse + serialize + diff):
- `npm test` runs in ~2–3 minutes
- `npm run test:roundtrip` alone is ~10–20 seconds
- Running it on every build would add 20% latency to dev workflow

Reserve it for release builds where accuracy > speed.

---

## Fixture Files

| File | Purpose | Used by |
|---|---|---|
| `__tests__/fixtures/table-bullets.md` | Bullets in tables at various nesting levels, ordered lists, task items, edge cases | Playwright table-bullets suite |
| `__tests__/STRESS_TEST_DOC.md` | Canonical markdown with all supported syntax — headers, lists, tables, code, images, mermaid, HTML, frontmatter | Jest integration/stressTestRoundTrip |
| `__tests__/STRESS_TEST.drawio.svg` | Draw.io diagram fixture | Reference only (not executed) |

---

## Troubleshooting

### A Jest test fails
```
npm test -- --testNamePattern="name of failing test"
```
Runs only that test with verbose output.

### Playwright test fails
```
npm run test:playwright:ui
```
Opens interactive explorer; click a test to step through with screenshots and trace logs.

### Settings persistence broke
```
npm run test:settings
```
Run immediately — this is a build blocker.

### Round-trip serialization regressed
```
npm run test:roundtrip
```
Load `STRESS_TEST_DOC.md` in the editor manually to inspect what changed.

### High false-positive rate in Playwright tests
Check:
1. Is the harness built? `npm run build:playwright-harness`
2. Is `serve` running the static server? Check `playwright.config.ts` webServer config
3. Does Chromium exist? `npx playwright install chromium`

---

## Future Improvements

- **@vscode/test-electron** — Add Layer 2 (extension host integration) for VS Code API tests currently using mocks
- **Visual regression snapshots** — Playwright can capture DOM/canvas snapshots to catch accidental UI changes
- **Contract tests** — Test the postMessage protocol between extension and webview in isolation
- **Performance benchmarks** — Profile markdown parse/serialize on large documents
