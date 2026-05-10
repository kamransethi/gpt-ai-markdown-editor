# Tasks: Standalone Editor Bridge

**Feature**: `specs/040-standalone-editor-bridge/`
**Plan**: [plan.md](plan.md) | **Spec**: [spec.md](spec.md)

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Foundational — Bridge Wiring (CRITICAL PATH)

**Purpose**: Remove the module-scope `acquireVsCodeApi()` crash from `editor.ts` and route all host communication through `getActiveBridge()`. This is the prerequisite for every other task.

**⚠️ CRITICAL**: No standalone, dev-server, or adapter tasks can begin until this phase is complete and all existing tests pass.

- [ ] T001 [F] Extend `src/webview/hostBridge.ts`: add `setBridge(bridge)`, `getActiveBridge()`, and `requestInitialContent()` to the interface — write unit tests RED first in `src/__tests__/webview/hostBridge.test.ts`
- [ ] T002 [F] FAIL tests: run `npm test -- --testPathPattern=hostBridge` and confirm T001 tests fail
- [ ] T003 [F] Implement `setBridge` / `getActiveBridge` in `hostBridge.ts` — make T001 tests GREEN
- [ ] T004 [F] Remove `const vscode = acquireVsCodeApi()` and `window.vscode = vscode` from module scope of `src/webview/editor.ts` (lines 311–314); import and call `getActiveBridge()` lazily in each function instead of `vscode.postMessage`
- [ ] T005 [P] [F] Replace every `vscode.postMessage(...)` call in `src/webview/editor.ts` with `getActiveBridge().postMessage(...)` — mechanical substitution of 20+ sites
- [ ] T006 [F] Run full test suite: `npm test` — ALL 1000+ tests must pass before proceeding

**Checkpoint**: `editor.ts` no longer references `acquireVsCodeApi` at module scope; all existing tests green.

---

## Phase 2: User Story 1 — Browser Boot Without Crash (P1)

**Goal**: Developer runs `npm run dev`, opens Chrome, editor loads with no errors.

**Independent Test**: Run `npm run dev`, navigate to `localhost:3000`, observe no console errors and editor renders.

### Tests for User Story 1

> **Write these RED first, then implement**

- [ ] T007 [P] [US1] Unit test in `src/__tests__/webview/standalone.test.ts`: mock localStorage, verify `createWebMockAdapter()` returns MOCK_CONTENT when localStorage is empty
- [ ] T008 [P] [US1] Unit test in `src/__tests__/webview/standalone.test.ts`: verify `createWebMockAdapter()` postMessage with type `saveAndEdit` writes `content` to localStorage

### Implementation for User Story 1

- [ ] T009 [US1] Add `createWebMockAdapter()` to `src/webview/hostBridge.ts`: sets `window.vscode` compatible shim, saves `content` to localStorage on `edit`/`saveAndEdit` postMessage, `requestInitialContent()` reads localStorage or returns embedded MOCK_CONTENT
- [ ] T010 [US1] Create `src/webview/standalone.ts` entry point: calls `setBridge(createWebMockAdapter())` first, then dispatches synthetic `UPDATE` message using `MessageType.UPDATE` with content from `adapter.requestInitialContent()`
- [ ] T011 [US1] Create `scripts/build-standalone.js`: esbuild entry `src/webview/standalone.ts` → `dist/standalone.js`, with `--serve=3000`, `--servedir=public`, same shimOptionalDependenciesPlugin as `build-webview.js`
- [ ] T012 [P] [US1] Create `public/index.html`: minimal HTML page that loads `dist/standalone.js`; sets `data-theme="light"` and `data-vscode-theme-kind="vscode-light"` on body; includes `<div id="editor" data-testid="tiptap-editor"></div>`
- [ ] T013 [US1] Add `"dev": "node scripts/build-standalone.js"` to `scripts` in `package.json`
- [ ] T014 [US1] Run `npm test` — all tests must still pass

**Checkpoint**: `npm run dev` starts a server; browser loads editor with sample content; no JS errors.

---

## Phase 3: User Story 2 — Content Survives Browser Refresh (P2)

**Goal**: Edit content in standalone, refresh browser, content is restored.

**Independent Test**: Edit text, save (or wait for debounce), refresh, verify content returns.

- [ ] T015 [US2] Verify end-to-end: open standalone in Chrome, type text, reload page, confirm text is restored from localStorage — manual verification step
- [ ] T016 [P] [US2] Unit test: verify that after `bridge.postMessage({ type: 'saveAndEdit', content: 'hello' })`, `localStorage.getItem('gptai-standalone-content')` equals `'hello'`

**Checkpoint**: localStorage round-trip works; refresh restores last-saved content.

---

## Phase 4: User Story 3 — Test-ID Addressability (P3)

**Goal**: Playwright/Robot Framework can target editor and toolbar by `data-testid`.

**Independent Test**: Playwright selector `[data-testid="tiptap-editor"]` resolves in < 2s.

- [ ] T017 [P] [US3] Add `data-testid="tiptap-editor"` to `<div id="editor">` in the VS Code webview HTML template (`src/editor/MarkdownEditorProvider.ts` — `getHtmlForWebview`)
- [ ] T018 [P] [US3] Add `data-testid` to toolbar button rendering in `src/webview/BubbleMenuView.ts`: derive testid slug from `btn.title` or `btn.label` (e.g. `"toolbar-btn-bold"`, `"toolbar-btn-italic"`, `"toolbar-btn-heading"`) on the `button` element created in the `btn.type === 'button'` branch
- [ ] T019 [US3] Run `npm test` — all tests must still pass

**Checkpoint**: `[data-testid="tiptap-editor"]` resolves in both standalone and VS Code webview HTML.

---

## Phase 5: User Story 4 — VS Code Parity (P1)

**Goal**: All existing VS Code editor behaviour unchanged after bridge refactor.

**Independent Test**: Open any `.md` file in VS Code extension; save/AI features work; no new console errors.

- [ ] T020 [US4] Build the extension: `npm run build:debug` — must complete without errors
- [ ] T021 [US4] Run full test suite: `npm test` — ALL 1000+ tests must pass
- [ ] T022 [US4] Manual smoke: open extension in Extension Development Host, open a markdown file, verify content loads, edits save, no new console errors
- [ ] T023 [P] [US4] Run `npm run verify-build` to confirm dist artifacts are correct

**Checkpoint**: Zero regressions. VS Code extension works identically to pre-change.
