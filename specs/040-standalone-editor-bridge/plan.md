# Implementation Plan: Standalone Editor Bridge

**Folder**: `specs/040-standalone-editor-bridge/plan.md` | **Date**: 2026-05-09 | **Spec**: [spec.md](spec.md)
**Status**: Draft

## Summary

Wire the existing (but unwired) `hostBridge.ts` abstraction into `editor.ts` so the editor can boot in a standard browser without crashing. The critical change is one line: replace the module-scope `const vscode = acquireVsCodeApi()` call with `createVsCodeBridge()`, which already has a safe no-op fallback. Then add a `WebMockAdapter`, a `public/` standalone harness page, an esbuild dev-server script, and `data-testid` attributes to enable Playwright targeting.

**Key architectural fact discovered during research**: `BubbleMenuView.ts` and `frontmatterUI.ts` already use `window.vscode?.postMessage()` with optional chaining — they silently no-op when `window.vscode` is absent. This means the standalone adapter only needs to populate `window.vscode` correctly and all dependent files automatically work.

## Stack

**Language/Runtime**: TypeScript 5.x, Node.js 18+
**Key deps**: esbuild (already in use), `src/webview/hostBridge.ts` (existing)
**Testing**: Jest (unit), Playwright (UI/smoke)

## Constitution Compliance

| Principle | Check | Notes |
|---|---|---|
| I. Reading Experience | ✅ | No UI changes; layout/typography untouched |
| II. TDD (RED → GREEN) | ✅ | Bridge unit tests written first; existing 1000+ tests must all pass |
| III. Performance Budgets | ✅ | Bridge is synchronous; no latency added on the hot path |
| IV. Embrace VS Code | ✅ | VS Code path unchanged; bridge is transparent |
| V. Simplicity Wins | ✅ | One module-scope line changed; no new abstraction layers |
| VI. CSS / Theme | ⚠️ | `vscode-mock.css` added — must use existing `--md-*` variable names, not invent new ones |

## Phases

**Phase 1 — Bridge Wiring (CRITICAL PATH)**: Remove `acquireVsCodeApi()` from module scope; route `editor.ts` through `createVsCodeBridge()`.
- Files: `src/webview/hostBridge.ts` MODIFY, `src/webview/editor.ts` MODIFY
- Tests: 4 unit tests covering bridge creation in both environments

**Phase 2 — Standalone Adapter & Dev Server**: Add `WebMockAdapter`, standalone HTML harness, esbuild dev script, npm command.
- Files: `src/webview/hostBridge.ts` MODIFY (add `createWebMockAdapter`), `scripts/build-standalone.js` CREATE, `public/index.html` CREATE, `package.json` MODIFY
- Tests: 2 unit tests for WebMockAdapter (localStorage read/write)

**Phase 3 — CSS Theme & Test IDs**: Add `vscode-mock.css`, add `data-testid` attributes.
- Files: `src/styles/vscode-mock.css` CREATE, `public/index.html` MODIFY, `src/webview/editor.ts` MODIFY (testid on editor mount target), `src/webview/BubbleMenuView.ts` MODIFY (testids on toolbar buttons)
- Tests: 1 Playwright smoke test asserting `[data-testid="tiptap-editor"]` resolves

## Files

| File | Action | Purpose |
|------|--------|---------|
| `src/webview/hostBridge.ts` | MODIFY | Add `requestInitialContent()` to interface; add `createWebMockAdapter()` export |
| `src/webview/editor.ts` | MODIFY | Remove module-scope `acquireVsCodeApi()` call; init via `createVsCodeBridge()` |
| `src/webview/BubbleMenuView.ts` | MODIFY | Add `data-testid` to bold, italic, heading toolbar buttons |
| `src/styles/vscode-mock.css` | CREATE | VS Code CSS variable fallbacks for standalone legibility |
| `scripts/build-standalone.js` | CREATE | esbuild `--serve` script for standalone dev mode |
| `public/index.html` | CREATE | Standalone harness HTML page (loads `dist/standalone.js`) |
| `package.json` | MODIFY | Add `"dev": "node scripts/build-standalone.js"` script |
| `src/__tests__/webview/hostBridge.test.ts` | CREATE | Unit tests for bridge factory functions |
| `src/__tests__/webview/standalone.test.ts` | CREATE | Unit tests for WebMockAdapter localStorage behaviour |

## Implementation Decisions

*Confirm these before coding starts.*

**Decision 1 — How to thread the bridge through `editor.ts`**

`editor.ts` has 20+ `vscode.postMessage(...)` call sites. Options:

- [ ] **A — Keep `window.vscode` as the global carrier**: `createVsCodeBridge()` populates `window.vscode` (already done in hostBridge.ts line 29); `createWebMockAdapter()` populates it too. No call-site changes needed across `editor.ts`, `BubbleMenuView.ts`, `frontmatterUI.ts`.
- [ ] **B — Pass bridge instance through function parameters**: Refactor all 20+ call sites to use `bridge.postMessage(...)`. Correct architecture — bridge instance is explicit, not a global. More work now, but this is the only architecture that scales to a real deployed web app.
- Recommendation: **B** — Standalone mode may evolve into a production web application. A `window.vscode` global is appropriate inside a VS Code webview but is a design smell in a standalone browser app or future Electron shell. Doing the call-site refactor now is the correct investment. The 20+ call sites in `editor.ts` are mechanical replacements (`vscode.postMessage` → `bridge.postMessage`); risk is manageable with the existing test suite. `BubbleMenuView.ts` and `frontmatterUI.ts` already use `window.vscode?.postMessage()` with optional chaining and can be updated in Phase 3 after the core is stable.

**Decision 2 — Standalone entry point (new bundle vs reuse `editor.ts`)**

- [ ] **A — New standalone entry point** `src/webview/standalone.ts` that imports `editor.ts` and injects the WebMockAdapter before anything else.
- [ ] **B — Modify `editor.ts` directly** so it detects environment and picks the right bridge.
- Recommendation: **A** — A thin entry point preserves the clean separation between the editor logic and the environment adapter. If standalone becomes a real app, `standalone.ts` grows into an app shell (routing, auth, document loading) without polluting `editor.ts`. This is also the exact pattern of `editor-harness.ts` already in the repo.

**Decision 3 — `requestInitialContent()` implementation**

The VS Code host *pushes* initial content via a `message` event; the spec proposes a pull-style Promise API.

- [ ] **A — Add `requestInitialContent(): Promise<string>` to the bridge interface**: VS Code bridge wraps the first `UPDATE` message in a Promise; WebMockAdapter resolves immediately with localStorage content or the mock doc. Clean, explicit contract — a future ServerAdapter would do an HTTP GET here.
- [ ] **B — Skip the new method**: WebMockAdapter dispatches a synthetic `UPDATE` message; the existing `window.addEventListener` handler in `editor.ts` picks it up unchanged.
- Recommendation: **A** — If standalone becomes a real app, a server-backed adapter will need to fetch initial content via an async call (HTTP, WebSocket handshake, URL param). The `requestInitialContent()` Promise is the correct seam for that. Adding it now costs one wrapper function per adapter and one call-site change in `editor.ts`; skipping it now means a more invasive change later.

## Key Risks

| Risk | Cause | Mitigation |
|------|-------|-----------|
| Module-scope crash in browser | `acquireVsCodeApi()` called before bridge | Decision 1-A + Decision 2-A: standalone entry populates shim before import |
| Regression in VS Code path | Bridge wrapping changes message timing | VS Code bridge populates `window.vscode` identically to current code; no timing change |
| `window.vscode` not set when `BubbleMenuView.ts` toolbar renders | Bridge init order | Both adapters set `window.vscode` synchronously before any DOM events fire |
| esbuild standalone bundle references VS Code types | TypeScript compile error | Standalone entry uses `(window as any).acquireVsCodeApi` pattern already in hostBridge |
| CSS variables invisible in standalone | No VS Code theme applied | `vscode-mock.css` uses existing `--md-*` variable definitions from `editor.css` as source of truth |

## Technical Notes (Research Findings)

1. **Line 311 of `editor.ts`** is the only hard crash point: `const vscode = acquireVsCodeApi()`. Everything else uses `window.vscode` which is already optional-chained in most places.

2. **`hostBridge.ts` line 29** already does `(window as any).vscode = vscode` inside `createVsCodeBridge()`. This means the bridge is designed to serve as the source of truth for `window.vscode`. The current code bypasses this by setting it at module scope in `editor.ts` directly.

3. **The Playwright harness** (`src/__tests__/playwright/harness/`) already proves the pattern: a separate esbuild entry (`editor-harness.ts`) initializes TipTap without VS Code. We follow the same structure for the standalone dev entry.

4. **`frontmatterUI.ts`** and **`BubbleMenuView.ts`** use `window.vscode?.postMessage()` (optional chaining). With Decision 1-B, these will be migrated to call `bridge.postMessage()` via a module-level bridge reference, removing the `window.vscode` dependency entirely.

5. **`initAiPrompts()`** at line 315 of `editor.ts` calls `vscode.postMessage` indirectly. In standalone mode this will hit the mock's no-op postMessage. Acceptable — AI features don't need to work in v1 standalone.

6. **Forward-compatibility surface**: The `HostBridge` interface (`postMessage`, `onMessage`, `requestInitialContent`) is the contract that future adapters must implement. A `ServerAdapter` for a web-based markdown platform would implement `requestInitialContent()` as an HTTP fetch (loading a document by ID or path) and `postMessage()` as a WebSocket or REST call. No changes to `editor.ts` would be required. This is the primary architectural value of doing Decision 1-B now. Mobile is explicitly out of scope.
