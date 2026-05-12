# Test Architecture & Organization

This document is the single reference for how the editor is tested: what runs where, when, and why. Coverage is proportional to code complexity — domains with more source code have more tests.

## Architecture: Browser-First

| Tier | Runner | Scope | When |
|---|---|---|---|
| **Playwright (browser)** | Real Chromium | All editor UI, formatting, menus, decorations, tables, AI panels, search, images, links | Smoke: every push; Release: release builds |
| **Jest Node** | Node.js (no DOM) | Pure logic: serialization, string transforms, file handlers, host message routing | Every build, pre-commit |
| **Jest jsdom** | jsdom (simulated DOM) | **BANNED for new tests.** Existing jsdom tests that mock TipTap are migration targets. jsdom cannot run CSS, Web Workers, or real keyboard events. |

The ~30 Playwright tests catch more real regressions than hundreds of jsdom tests because they run in an actual browser against the real TipTap instance.

---

## Playwright Suite — Complete Spec Catalog

All specs live in `src/__tests__/playwright/`. Harness helpers in `src/__tests__/playwright/harness/`.

Build first: `npm run build:debug` then start the server: `npx serve . -p 4321`.

Run all: `npx playwright test`  
Run smoke only: `npx playwright test --grep @smoke`  
Run single spec: `npx playwright test tables.spec.ts`  
Run headed: `npx playwright test --headed`  
Interactive UI: `npx playwright test --ui`

### Execution Tiers

- **Smoke (`@smoke`)** — critical-path subset, one test per major area. Target: <2 minutes on any developer machine. Runs on every push.
- **Release (untagged)** — full suite including every button, every context menu item, all data-path scenarios. No time cap (up to 20 minutes acceptable). Runs on release builds only.

### Spec Files by Domain

Coverage priority is driven by source-code line counts. More code = more tests.

#### editor-core.spec.ts — `editor.ts` 2,143 lines — **High**
Tests the fundamental editing loop that every other feature depends on.

| Category | Tests |
|---|---|
| Inline formatting `@smoke` | Bold via Ctrl+B; italic via Ctrl+I; underline; strikethrough; inline code |
| Block formatting | Headings H1–H6 via toolbar and `#` markdown shortcut; blockquote; horizontal rule |
| Undo / redo `@smoke` | Undo single change; redo restores; undo chain across multiple changes |
| Paste | Plain text paste; markdown paste preserves structure |
| Roundtrip | `setMarkdown(md)` → `getMarkdown()` returns identical content for heading, list, table, code |
| Scroll | Large document scrolls; cursor stays visible after jump |

---

#### bubble-menu.spec.ts — `BubbleMenuView.ts` 1,731 lines — **High**
Every button in the floating toolbar must be click-tested.

| Category | Tests |
|---|---|
| Visibility `@smoke` | Bubble menu appears on text selection; disappears on click outside |
| Inline marks | Bold, italic, underline, strikethrough, inline code, highlight, text color — each button applies and toggles the mark |
| Heading picker | Each heading level button sets the correct node type |
| Alignment | Left, center, right alignment buttons apply CSS class |
| Link | Link button opens link dialog |
| Table buttons | Add row, add column, remove row, remove column buttons visible when cursor in table |
| AI button `@smoke` | AI refine button visible on text selection |
| List buttons | Bullet list, ordered list, task list buttons insert correct node |
| Context awareness | Table-specific buttons hidden when cursor is outside a table; image-specific controls shown when image selected |

---

#### tables.spec.ts — ~1,311 lines across 6 files — **High (most complex data path)**
Tables have the most custom serialization and state management in the codebase. Test every data type a cell can hold.

| Category | Tests |
|---|---|
| Creation `@smoke` | Create table via toolbar button; create via markdown `|col|col|` input |
| Cell navigation `@smoke` | Tab moves to next cell; Shift+Tab moves to previous; Tab from last cell adds new row |
| Cell new lines | Shift+Enter inserts a hard break within a cell; two breaks create visible second line; `getMarkdown()` preserves the `<br>` in output |
| Bullets in cells `@smoke` | Insert bullet list in cell via toolbar; single-level bullet serializes correctly; nested bullets depth-1 and depth-2 each serialize with correct indentation |
| Ordered lists in cells | Ordered list in cell serializes without embedded newlines |
| Highlighted text | Apply highlight mark to text in cell; mark present after `getMarkdown()` roundtrip |
| Bold / italic in cells | Bold and italic marks survive roundtrip |
| Task items in cells | Checkbox task item renders in cell; checked state preserved |
| Mixed content | Text + bullet + hard break in same cell; serializes and reloads identically |
| Copy/paste | Copy cell content; paste into another cell preserves structure |
| Context menu `@smoke` | Right-click in table opens context menu |
| Context menu items | Add row above; add row below; remove row; add column left; add column right; remove column; align left; align center; align right — each item produces correct structural change |
| Roundtrip fidelity | Load → `getMarkdown()` → `setMarkdown()` → `getMarkdown()` must be byte-identical for a table with bullets, breaks, and mixed marks |

---

#### search.spec.ts — 1,057 lines — **High**

| Category | Tests |
|---|---|
| Open `@smoke` | Search opens via keyboard shortcut; opens via toolbar button |
| Highlighting | All instances of query highlighted in DOM |
| Navigation | Next button moves to next match; previous button cycles back; count indicator updates |
| Replace | Replace single occurrence; replace all occurrences |
| Options | Case-sensitive toggle; regex mode toggle |
| Empty query | No highlights shown; no errors |
| Close | Escape key closes; close button closes; highlights removed on close |

---

#### images.spec.ts — ~2,099 lines across 5 files — **High**

| Category | Tests |
|---|---|
| Paste `@smoke` | Paste image from clipboard inserts image node at cursor |
| Drag and drop | Drop image file onto editor inserts image node |
| Context menu `@smoke` | Right-click image opens context menu |
| Context menu: alt text | "Edit alt text" item opens dialog; new alt text saved to markdown |
| Context menu: rename | "Rename file" item opens rename dialog |
| Context menu: resize | "Resize" item opens resize dialog |
| Context menu: copy path | "Copy path" writes path to clipboard |
| Context menu: open externally | "Open externally" item present and fires correct message |
| Context menu: AI explain | "AI explain" item present; clicking opens explain panel |
| Rename dialog | Dialog accepts new filename; document reference updated |
| Large image dialog | Confirmation dialog appears for oversized images |
| Local image outside repo | Warning dialog appears for images outside workspace |
| Metadata dialog | Image metadata panel renders filename, dimensions |
| Draw.io | `.drawio.svg` image double-click dispatches `openDiagram`; treated as diagram, not raster |

---

#### links.spec.ts — 1,181 lines — **High**

| Category | Tests |
|---|---|
| Insert `@smoke` | Link dialog opens from toolbar; insert external URL; link node present in DOM |
| File link | Insert internal file path; link node contains file path |
| Autocomplete `@smoke` | `[[` prefix triggers autocomplete dropdown |
| Autocomplete select | Selecting autocomplete item inserts correct wiki link syntax |
| Edit | Click existing link opens dialog pre-populated with URL |
| Remove | Remove link strips mark, leaves text content |
| File drop | Drop a file link from sidebar; markdown link inserted at cursor |

---

#### spell-check.spec.ts — `spellCheck.ts` 455 lines — **Done; extend**

| Category | Tests |
|---|---|
| Decoration `@smoke` | Misspelled word gets underline decoration CSS class |
| Correct word | No decoration on correctly spelled word |
| Exclusions | Code block content not decorated; inline code not decorated |
| Contractions | Contractions (e.g. "don't") not flagged |
| Context menu `@smoke` | Right-click misspelled word shows suggestions |
| Accept suggestion | Clicking suggestion replaces the word |
| Add to dictionary | Word added via `window.spellAPI.addToDictionary()`; decoration removed |
| Remove from dictionary | Word removed via `window.spellAPI.removeFromDictionary()`; decoration reappears |
| Readiness | `window.spellAPI.isReady()` resolves before first decoration is applied |

---

#### settings-panel.spec.ts — `settingsPanel.ts` 1,354 lines — **Medium**

| Category | Tests |
|---|---|
| Open `@smoke` | Settings panel opens via toolbar gear icon |
| AI provider | Provider selector section renders; each provider option selectable |
| Spell check toggle | Toggling off removes decorations; toggling on restores them |
| Theme | Theme selector changes editor CSS theme class |
| Export settings | Export settings section visible and editable |
| Reset | Reset to defaults button present |

---

#### ai-chat.spec.ts — 777 lines — **Medium**

| Category | Tests |
|---|---|
| Open `@smoke` | Chat panel opens from toolbar or sidebar |
| Input | Message input field accepts text |
| Send | Send button present and clickable |
| Response | Response area renders markdown (bold, lists, code blocks visible as formatted elements) |
| Graph mode | Knowledge graph chat toggle present |
| No provider | Provider-unavailable error state renders inline; no JS error thrown |

---

#### ai-actions.spec.ts — 1,011 lines — **Medium**

AI feature tests cover UI wiring only. LLM inference is not called; tests verify panels open, buttons are present, and error states display correctly.

| Category | Tests |
|---|---|
| Refine `@smoke` | Select text; AI refine button/menu appears |
| Explain | Toolbar explain button present; clicking opens explain panel with loading state |
| Image explain | Right-click image → AI explain item; panel opens |
| Summary | Summary action button present; panel renders with loading state |
| Error states | Each AI action shows human-readable error when no provider configured |
| Output rendering | AI result panel renders markdown output (tables, code, lists) as formatted HTML, not raw text |

---

#### slash-commands.spec.ts — **Medium**

| Category | Tests |
|---|---|
| Open `@smoke` | `/` at start of line opens command palette |
| Filter | Typing narrows visible commands |
| Heading commands | `/h1` through `/h6` each insert correct heading node |
| Code block | Code block command inserts fenced code block |
| Table | Table command inserts table |
| Image | Image command inserts image placeholder |
| Mermaid | Mermaid command inserts mermaid code block |
| Task list | Task list command inserts task item |
| Dismiss | Escape closes palette without inserting anything |

---

#### frontmatter.spec.ts — **Medium**

| Category | Tests |
|---|---|
| Panel present | Document with YAML frontmatter shows frontmatter panel |
| Panel absent | Document without frontmatter hides panel |
| Edit | Change a value in panel; `getMarkdown()` reflects the change |
| Parse error | Malformed YAML shows inline error feedback in panel |
| Modal | Frontmatter modal opens and closes |

---

#### mermaid.spec.ts — 561 lines — **Medium**

| Category | Tests |
|---|---|
| Render | Mermaid fenced block renders as diagram node (not raw text) |
| Edit modal | Double-click opens editor modal with source code |
| Save | Modal save updates diagram; new source visible via `getMarkdown()` |
| Cancel | Modal cancel discards changes |
| Template insert | Toolbar mermaid button inserts a valid mermaid block |

---

#### code-blocks.spec.ts — **Medium**

| Category | Tests |
|---|---|
| Create | Fenced code block renders as code block node |
| Language dropdown | Language selector changes syntax highlighting |
| Copy button | Copy button writes code to clipboard |
| Shiki highlighting | Syntax highlighting CSS color classes present in DOM for known language |
| GitHub Alerts — all 5 types | `[!NOTE]`, `[!WARNING]`, `[!IMPORTANT]`, `[!TIP]`, `[!CAUTION]` each render with correct icon CSS class |

---

#### navigation.spec.ts — 462 lines — **Medium**

| Category | Tests |
|---|---|
| TOC renders `@smoke` | TOC panel shows all document headings |
| TOC click | Click heading in TOC scrolls editor to heading |
| TOC updates | Adding a new heading via editor updates TOC in real time |
| Outline | Outline panel shows hierarchical document structure |

---

#### drawio.spec.ts — 265 lines — **Low**

| Test | What |
|---|---|
| Type detection | `.drawio.svg` image recognized as diagram type |
| Double-click | Dispatches `openDiagram` message to host |
| Context menu | Does not show raster image options |

---

#### plugin-system.spec.ts — `CommandRegistry.ts` 515 lines — **Low**

| Test | What |
|---|---|
| Registration | Toolbar button registered by plugin appears |
| Execution | Plugin command produces expected output |
| Isolation | Plugin error does not crash core editor |

---

#### global-state.spec.ts *(sequential — `workers: 1`)* — **Medium**

Tests that mutate shared global state. Isolated from the concurrent suite.

| Test | What |
|---|---|
| Dictionary add | Add word; decoration removed globally |
| Dictionary remove | Remove word; decoration restored globally |
| AI provider switch | Switch provider; subsequent UI reflects new provider |
| Config panel save | Config change persists after `setMarkdown('')` reset |

---

## Jest Node Tests — Complete Catalog

Run via `npm test`. No DOM. No browser. Pure Node.js logic.

**These tests are correct and are NOT migration targets.**

| Module group | What is tested |
|---|---|
| `extensions/formatting/` | Bold, italic, paragraph style AST output |
| `extensions/tables/` | Table serialization edge cases, cell bullet logic, ordered list output |
| `extensions/frontmatter/` | *(migrating to Playwright — see spec 043 FR-008)* |
| `extensions/links/` | *(migrating to Playwright — see spec 043 FR-008)* |
| `extensions/blocks/` | *(migrating to Playwright — see spec 043 FR-008)* |
| `extensions/mermaid/` | Mermaid AST → markdown serialization |
| `extensions/images/` | Image path resolution, placeholder logic |
| `features/aiRefine` | AI refine prompt construction |
| `features/documentExport` | `htmlToMarkdown`, compression, Pandoc output |
| `features/fluxflow/` | Knowledge graph chunking, embedding, search logic |
| `features/wordCount` | Word count algorithm |
| `features/outlineView` | Heading extraction logic |
| `editor/handlers/` | Host message handler routing (mocked VS Code API) |
| `editor/utils/pathUtils` | File path resolution and normalization |
| `smoke/` | *(undo-sync.test.ts migrating — see FR-008; remainder kept)* |
| `integration/stressTestRoundTrip` | Full markdown → TipTap → markdown roundtrip (`npm run test:roundtrip`) |
| `extension/` | Settings persistence, viewer prompt persistence |

---

## Run Triggers

### Pre-commit
```
npm run precommit
```
Runs ESLint + all Jest Node tests. Target: <15 seconds. Playwright does NOT run here.

### Local Build (debug)
```
npm run build:debug
```
Sequence: `test:settings` → build extension → build webview. ~10–15 s total.

### Release Build
```
npm run build:release
```
Sequence: `test:settings` → build → `test:roundtrip` → `verify-build`. ~30–45 s total.

### Smoke CI (every push)
```
npx playwright test --grep @smoke
```
Target: <2 minutes. Covers one critical path per major functional area.

### Release CI (release builds)
```
npx playwright test
```
Full suite — all domains, all buttons, all context menu items. No time cap; up to 20 minutes acceptable.

### Manual Commands

| Command | What | Notes |
|---|---|---|
| `npm test` | All Jest Node tests | ~2–3 min |
| `npm run test:watch` | Jest in watch mode | Interactive |
| `npm run test:coverage` | Jest + coverage report | 60% threshold enforced |
| `npm run test:roundtrip` | Stress-test roundtrip only | ~10–20 s |
| `npm run test:settings` | Settings persistence only | ~5 s |
| `npx playwright test` | All Playwright specs (headless) | Release suite |
| `npx playwright test --grep @smoke` | Smoke tier only | <2 min |
| `npx playwright test --headed` | Playwright with visible Chromium | Debugging |
| `npx playwright test --ui` | Playwright interactive UI explorer | Step-through with screenshots |

---

## Coverage Policy

**Threshold:** 60% on branches, functions, lines, statements (enforced by Jest).

**Excluded from Jest coverage (covered by Playwright instead):**
- `src/webview/**` — all UI modules; real-browser testing is the correct tool
- `src/extension.ts` — requires live VS Code host
- `src/editor/MarkdownEditorProvider.ts` — VS Code editor API surface
- `src/features/documentExport.ts` — requires headless Chrome + Word binary

---

## Fixtures

| File | Purpose | Used by |
|---|---|---|
| `__tests__/fixtures/table-bullets.md` | Bullets in tables at nesting levels 0/1/2, ordered lists, task items, edge cases | Playwright `tables.spec.ts` |
| `__tests__/STRESS_TEST_DOC.md` | All supported markdown syntax — headers, lists, tables, code, images, mermaid, HTML, frontmatter | Jest `stressTestRoundTrip.test.ts` |
| `__tests__/STRESS_TEST.drawio.svg` | Draw.io diagram fixture | Reference only |

---

## Design Decisions

### Why Playwright for all UI, not jsdom?

jsdom cannot run CSS, Web Workers, or real keyboard events. The spell-check worker, Shiki syntax highlighting, TipTap decoration system, and scroll behavior are all invisible to jsdom. Bugs in these areas ship to users undetected. Playwright runs a real Chromium instance — the same engine the VS Code webview uses.

### Why keep Jest Node tests?

Jest Node is correct for pure logic: string transforms, serialization, file path resolution, host message handler routing. These have no DOM dependency and run in <15 seconds total. They are fast, reliable, and not being replaced.

### Why proportional coverage?

Large modules have more code paths, more conditional branches, and more integration surface. A 2,000-line file tested by 3 tests is under-tested by definition. The domain table lists source-code line counts explicitly so coverage decisions are traceable, not arbitrary.

### Why two Playwright tiers?

Pre-commit Playwright would add 5–20 minutes to every commit. A smoke tier (<2 min) provides safety on each push; the full release tier catches regressions that only appear in edge-case combinations — acceptable when run once per release.

### Why not ExTester for VS Code integration?

ExTester wraps WebdriverIO, which is fragile against VS Code Electron version changes and has higher setup complexity. For webview-heavy apps, Playwright + an HTML harness is more stable. Host-side VS Code API behaviour is tested via Jest Node with a mocked VS Code API — no real extension host required.

---

## Troubleshooting

### A Jest test fails
```
npm test -- --testNamePattern="name of failing test"
```

### A Playwright test fails
```
npx playwright test --ui
```
Click the failing test to step through with screenshots and trace logs.

### Playwright can't connect to the server
1. Build the webview: `npm run build:debug`
2. Check `playwright.config.ts` `webServer` config — server must start on port 4321
3. Chromium missing: `npx playwright install chromium`

### Smoke tests pass but release suite fails
The failing test is in the release tier only — an edge case not covered by smoke. Run `npx playwright test --headed <spec-file>` to watch the failure in the browser.


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
