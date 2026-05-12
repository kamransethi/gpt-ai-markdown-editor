# Flux Flow Markdown Editor — Constitution

> Single source of truth for project constraints, quality standards, and architectural decisions.

---

## I. Reading Experience is Paramount

Typography and readability are the product. Every decision must serve the reading experience first.

- Serif body text (Charter/Georgia) — prose, not code
- Generous spacing — white space is a feature, not waste
- Test every visual change by reading a 3000+ word doc for 10+ minutes in both light and dark themes

## II. Browser-First Testing (NON-NEGOTIABLE)

**RED → GREEN → REFACTOR → VERIFY — in a real browser, not a fake DOM**

| Tier | Runner | When to use | Command |
|------|--------|-------------|---------|
| **1. Playwright (Chromium)** | Real browser | Anything touching the editor, DOM, TipTap, CSS, decorations, keyboard, clipboard | `npx playwright test` |
| **2. Jest (Node — pure logic)** | Node.js | String transforms, file I/O, VS Code host handlers, serialisation | `npm test` |
| **3. Jest (jsdom) — BANNED** | Fake DOM | Do not write new jsdom tests. Migrate old ones when touched. | — |

**Why jsdom is banned**: It cannot render CSS, run Workers, fire real keyboard events, or detect duplicate TipTap extension names. A jsdom test that passes proves nothing about browser correctness — we proved this when 91 passing Jest tests coexisted with live drag-handle duplicate-extension warnings and broken spell-check decorations.

**Decision heuristic**: if a test needs `jest.mock()` for DOM or TipTap internals, it belongs in Playwright.

**Playwright harness**: All specs drive the editor via `window.editorAPI` / `window.spellAPI`. Harness files live in `src/__tests__/playwright/harness/`. Server runs at `http://localhost:4321` (configured in `playwright.config.ts`).

**TDD flow**:
1. Write a failing Playwright test (or Jest Node for host logic)
2. Implement the minimum clean solution
3. Refactor — keep tests green
4. `npx playwright test` AND `npm test` must both pass before merge

Bug fixes: reproduce with a failing test first, then fix.

## III. Performance Budgets

| Metric | Budget |
|--------|--------|
| Editor initialization | < 500 ms |
| Typing latency | < 16 ms (never block the editor thread) |
| Cursor / formatting actions | < 50 ms |
| Menu / toolbar actions | < 300 ms |
| Document sync debounce | 500 ms |
| External update skip window | 2 s (don't interrupt active typing) |

Performance is a day-1 constraint. Verify after any performance-sensitive change by loading a 5000+ line document and checking against the budgets above.

## IV. Embrace VS Code

Don't fight the platform. Integrate deeply.

- **TextDocument is canonical** — the webview renders it; edits serialize back to it. VS Code owns save/undo/redo.
- Inherit theme colors via CSS variables — never hard-code color values
- Follow VS Code keyboard conventions (Ctrl/Cmd+B for bold, etc.)
- Commands must be discoverable via the command palette (`when: activeCustomEditorId == gptAiMarkdownEditor.editor`)
- Git diffs must be clean (text-based custom editor provider)
- Webview is a RENDERER, not a source of truth

## V. Simplicity Wins

- Simplest solution that works — no over-engineering
- Don't add features, refactor code, or make improvements beyond what was asked
- No speculative abstractions
- Research official docs (VS Code API, TipTap/ProseMirror) before implementing
- Suggest simpler alternatives when a request is a bandaid or fights the platform

## VI. CSS & Styling Discipline

All UI colors MUST use variables defined in `:root`/`body` at the top of `editor.css`. Never invent `--md-*` variables without defining them there.

**Key variables:**
- Primary buttons: `--md-button-bg` / `--md-button-fg`; hover: `--md-button-hover-bg`
- Secondary/cancel: `background: none; border: 1px solid var(--md-menu-border)`
- Input focus: `--md-button-bg` (not `--md-accent-primary`)
- Danger actions: `--md-error-fg`
- UI font: `--md-font-family` (not `--md-font-sans`)

**Specificity discipline**: After any CSS edit, verify the change compiled into `dist/webview.css`. Beware the `:is()` specificity trap — it takes the specificity of its highest-specificity argument; keep type-only selectors inside `:is()`.

**Theme support**: Always use `--vscode-*` variables. Define base (light) styles, override for `.vscode-dark` and `.vscode-high-contrast`.

## VII. Toolbar Order Parity

Shared controls must appear in **identical order** in both the header toolbar and the floating selection toolbar:

**Bold → Italic → Highlight → Text Color → Strikethrough → Inline Code → Heading controls**

Any reorder in one toolbar must be mirrored in the other in the same commit. Single ordering source in `BubbleMenuView.ts`.

## VIII. Modular TipTap Extension Strategy

All custom functionality MUST be modular TipTap Extensions. Baseline: TipTap 3.22.4+.

1. **No core redundancy** — if StarterKit or an official `@tiptap/extension-*` provides it, use it. (StarterKit v3 includes `gapCursor` — do not register it separately.)
2. **Total encapsulation** — DOM manipulation goes in `addNodeView`, not global event listeners in `editor.ts`
3. **Location**: `src/webview/extensions/[feature].ts` — export one `Extension.create()` / `Node.create()` / `Mark.create()`
4. **Messaging**: communicate with the VS Code host via `vscode.postMessage` only
5. **Registration flow**: create extension → add to `editor.ts` array → add toolbar button in `BubbleMenuView.ts` (if needed) → wire messages in `MarkdownEditorProvider.ts` (if needed) → add `package.json` command (if needed)

## IX. Error Handling & Runtime Safety

- All `async` functions on critical paths (save, sync, file ops) MUST have `try/catch`
- User-visible notifications for failures that risk data loss
- Log prefix: `[DK-AI]`; technical details only when `gptAiMarkdownEditor.developerMode` is on
- Throttle repeated error notifications — no spam loops
- Never silently discard failures that risk data loss
- `console.error()` for errors (kept in production); `console.log()` for dev debug (stripped in production)

## X. Document Sync Pitfalls

Read before touching sync or editor state:

1. **Feedback loops** — set `ignoreNextUpdate` when applying edits; skip if content unchanged; use `gray-matter` for frontmatter to keep it independent of TipTap serialization
2. **Cursor position** — save before content updates, restore after; update selection AFTER content or cursor jumps to start
3. **Large docs** — 500 ms debounce on outbound updates; skip redundant updates; respect user editing state
4. **Mermaid** — always wrap rendering in `try/catch`; provide fallback UI with error message and code view

## XI. TypeScript Standards

- Strict mode (tsconfig)
- `const` over `let`; never `var`
- No `any` — explicit types on params and returns
- Meaningful names (`_view` prefix for intentionally unused params)
- Private members prefixed with `_`
- JSDoc on all exported functions (params, returns, throws)
- Inline comments explain WHY, not WHAT

## XII. Image & DOM Handling

- Images are `inline: true` with atomic behavior — prevents phantom gaps between consecutive images
- NodeView: `<span class="image-wrapper">` with `display: inline-block`
- Enter key handlers: return `true` to stop propagation — `preventDefault()` alone doesn't stop ProseMirror
- Empty paragraph filtering: at serialization time, NOT during typing (causes cursor jumps)
- Position math: `$from.after($from.depth)` for safe positions; avoid `$pos.end(0)` (can overflow)

## XIII. Spec & Commit Discipline

**Spec naming**: `specs/NNN-title/` — sequential number, kebab-case title.

**Commit format**: `type(scope): description` with spec reference in body when applicable:
```
feat(editor): add spell-check decorations
Implements specs/042-offline-spell-check
```

**Known issues** tracked in `KNOWN_ISSUES.md` — every open issue has a failing regression test. When fixed, move to Resolved with commit hash.

**Failed/partial specs**: mark `Status: FAILED` or `Status: PARTIAL` in `spec.md`; document why; open a new spec for remaining work.

**Dependency changes**: always update `THIRD_PARTY_LICENSES.md` in the same commit.

## XIV. Data Safety (CRITICAL)

**Zero silent data loss.**

- All releases pass roundtrip testing: load → edit → save → reload in VS Code source → verify unchanged
- Test on documents with 100+ lines, tables, images, Mermaid, all formatting types
- `STRESS_TEST_DOC.md` is the canonical stress corpus — update it when new features land
- Every bug fix needs a failing regression test before the fix is applied
- Tracked workarounds documented in `/memories/repo/` — review monthly, upgrade or archive

## XV. Knowledge Graph

- Hybrid search via Reciprocal Rank Fusion (RRF): lexical FTS4 + Float32 semantic vectors
- Portable via `sql.js` (WASM) + flat binary vector store
- Data persists in `~/.fluxflow` (or configured `dataDir`)

---

## Quality Gates (Before Every Commit)

- [ ] `npx playwright test` — all browser tests pass
- [ ] `npm test` — all Node (host-side) tests pass, if any changed
- [ ] No roundtrip regressions (spot-check complex documents)
- [ ] CSS verified in light, dark, and high-contrast themes
- [ ] Modified extensions follow Section VIII pattern
- [ ] Modified sync logic checked against Section X pitfalls
- [ ] Toolbar changes respect Section VII order parity

## Governance

Amendment procedure: identify conflict → draft change → bump version → propagate to templates → commit as `docs(constitution): amend vX.Y.Z — reason`.

**Versioning**: MAJOR = principle removed or redefined; MINOR = new principle or material expansion; PATCH = wording/typo fix.

---

**Version**: 2.0.0 | **Ratified**: 2026-04-09 | **Last Amended**: 2026-05-10
