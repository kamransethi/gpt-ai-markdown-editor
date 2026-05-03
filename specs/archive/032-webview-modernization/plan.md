# Implementation Plan: Webview Modernization

**Folder**: `specs/032-webview-modernization/plan.md` | **Date**: 2026-05-02 | **Spec**: [spec.md](./spec.md)
**Status**: Approved ✅

## Summary

Refactor five major webview bandaid areas identified in `Analysis.md` plus an immediate paste regression fix (FR-006) introduced by the 031 bandaid removal. Each phase targets a specific file cluster and is paired with test cases that enforce measurable success criteria. Priority order: FR-006 → FR-002 → FR-004 → FR-001 → FR-003 → FR-005.

## Stack

**Language/Runtime**: TypeScript 5.3, Node.js 18+
**Key deps**: `@tiptap/core`, `@tiptap/pm` (ProseMirror), `@tiptap/extension-image`, turndown, markdown-it
**Testing**: Jest + jsdom

## Phases

**Phase 1 — FR-006 [Web-Paste Regression Fix]**: Fix silent paste drop for mixed text/html + image/* clipboard
- Files: `src/webview/utils/pasteHandler.ts` (MODIFY), `src/webview/features/clipboardHandling.ts` (MODIFY), `src/webview/features/imageDragDrop.ts` (MODIFY — expose `queueImageFromUrl`)
- Tests: Extend `src/__tests__/webview/paste-handling.test.ts` with 4 new cases

**Phase 2 — FR-002 [Native Image Placeholders]**: Replace DOM-scraping placeholder with ProseMirror DecorationSet
- Files: `src/webview/extensions/imageUploadPlugin.ts` (CREATE), `src/webview/features/imageDragDrop.ts` (MODIFY — insertImage uses DecorationSet)
- Tests: Create `src/__tests__/webview/imagePlaceholder.test.ts` with 4 cases

**Phase 3 — FR-004 [Unified Event Pipeline]**: Move drop/paste listeners into TipTap `editorProps`
- Files: `src/webview/editor.ts` (MODIFY — add handleDrop/handlePaste to editorProps), `src/webview/features/imageDragDrop.ts` (MODIFY — remove view.dom listeners)
- Tests: Extend `paste-handling.test.ts` with 2 event-pipeline cases

**Phase 4 — FR-001 [Reactive Settings Panel]**: Typed state model → render pipeline, zero querySelector
- Files: `src/webview/settings/settingsState.ts` (CREATE), `src/webview/settings/settingsPanel.ts` (MODIFY — read from state, not DOM)
- Tests: Create `src/__tests__/webview/settingsPanel-reactive.test.ts` with 4 cases

**Phase 5 — FR-003 [AST Export Serialization]**: Replace cloneNode(true) with doc.descendants() traversal
- Files: `src/webview/utils/docSerializer.ts` (CREATE), `src/webview/utils/exportContent.ts` (MODIFY — call docSerializer)
- Tests: Create `src/__tests__/webview/exportContent-ast.test.ts` with 4 cases

**Phase 6 — FR-005 [BaseOverlay Framework]**: Shared overlay class with focus-return stack
- Files: `src/webview/overlays/BaseOverlay.ts` (CREATE), `src/webview/features/tableInsert.ts` (MODIFY), `src/webview/features/searchOverlay.ts` (MODIFY), `src/webview/features/tocOverlay.ts` (MODIFY)
- Tests: Create `src/__tests__/webview/baseOverlay.test.ts` with 4 cases

## Files

| File | Action | Purpose |
|------|--------|---------|
| `src/webview/utils/pasteHandler.ts` | MODIFY | Add `hasOnlyImageContent()` helper; fix `processPasteContent` image-early-return |
| `src/webview/features/clipboardHandling.ts` | MODIFY | Use `hasOnlyImageContent()` guard; add img URL extraction + upload routing |
| `src/webview/features/imageDragDrop.ts` | MODIFY | Expose `queueImageFromUrl()`; remove view.dom event listeners; use DecorationSet |
| `src/webview/extensions/imageUploadPlugin.ts` | CREATE | TipTap extension with DecorationSet plugin state for upload placeholders |
| `src/webview/editor.ts` | MODIFY | Add `handleDrop`/`handlePaste` to `editorProps` |
| `src/webview/settings/settingsState.ts` | CREATE | Typed `SettingsState` model, `createDefaultState()`, `applyConfiguration()` |
| `src/webview/settings/settingsPanel.ts` | MODIFY | Read from `SettingsState`, remove all `querySelector` state-reads |
| `src/webview/utils/docSerializer.ts` | CREATE | `serializeDocToHtml(doc)`: pure AST-to-HTML walker via `doc.descendants()` |
| `src/webview/utils/exportContent.ts` | MODIFY | Replace `cloneNode(true)` + querySelectorAll chain with `serializeDocToHtml()` |
| `src/webview/overlays/BaseOverlay.ts` | CREATE | Overlay lifecycle class: open(trigger), close(), focus stack management |
| `src/webview/features/tableInsert.ts` | MODIFY | Use `BaseOverlay` lifecycle; remove boilerplate DOM append/focus |
| `src/webview/features/searchOverlay.ts` | MODIFY | Use `BaseOverlay` lifecycle; keep ProseMirror search plugin |
| `src/webview/features/tocOverlay.ts` | MODIFY | Use `BaseOverlay` lifecycle |
| `src/__tests__/webview/paste-handling.test.ts` | MODIFY | +4 FR-006 cases, +2 FR-004 cases |
| `src/__tests__/webview/imagePlaceholder.test.ts` | CREATE | 4 FR-002 test cases |
| `src/__tests__/webview/settingsPanel-reactive.test.ts` | CREATE | 4 FR-001 test cases |
| `src/__tests__/webview/exportContent-ast.test.ts` | CREATE | 4 FR-003 test cases |
| `src/__tests__/webview/baseOverlay.test.ts` | CREATE | 4 FR-005 test cases |

## Key Risks

| Risk | Cause | Mitigation |
|------|-------|-----------|
| Double image insertion on web paste | HTML processed AND image-upload flow both insert | Strip `<img>` tags from HTML before TipTap insertion; upload flow re-inserts final |
| DecorationSet position drift | User types before upload completes | `tr.mapping.map(pos)` applied in every plugin `apply()` call |
| settings panel re-hydration blank flash | Async getConfiguration response | Render defaults synchronously before posting GET_CONFIGURATION |
| settingsPanel.ts size | ~2100 lines, high churn risk | Work in small hunks; run `npm test` after each querySelector group removed |
| BaseOverlay focus stack corruption | Overlay opened without trigger ref | Stack entry uses `document.activeElement` captured at `open()` time |

## Implementation Decisions

**Decision 1 — Paste priority**: HTML+image clipboard → HTML wins, images queued separately.
- [x] **A**: `hasOnlyImageContent()` — return image path only when no `text/html` present.
- [ ] **B**: Always prefer image binary.
- Recommendation: **A** — matches browser copy behavior from webpages.

**Decision 2 — Image placeholders**: ProseMirror DecorationSet (not schema node mutation).
- [x] **A**: Widget decoration + plugin state upload map.
- [ ] **B**: Keep DOM-scraping approach.
- Recommendation: **A** — decorations don't mutate document; position survives concurrent edits.

**Decision 3 — Settings panel framework**: Typed state model + existing render functions.
- [x] **A**: `SettingsState` object + refactor `render()` to accept state.
- [ ] **B**: Full Lit/React adoption.
- Recommendation: **A** — minimal risk; no new framework dependency.

**Decision 4 — Export serialization**: Pure `doc.descendants()` walker.
- [x] **A**: `docSerializer.ts` — pure function, testable without DOM.
- [ ] **B**: Keep cloneNode with fixes.
- Recommendation: **A** — eliminates class-name coupling to TipTap render output.

**Decision 5 — BaseOverlay**: Plain TypeScript class with focus stack.
- [x] **A**: `BaseOverlay` TS class; no Custom Elements API.
- [ ] **B**: Web Components / Lit.
- Recommendation: **A** — VS Code webview supports Custom Elements but adds bundle complexity unnecessarily.
