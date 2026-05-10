# Implementation Plan: Open as Rich Text Button

**Folder**: `specs/041-open-as-rich-text-button/plan.md` | **Date**: 2026-05-09 | **Spec**: [spec.md](spec.md)
**Status**: Approved ✅

## Summary

Adds a toolbar icon button to the VS Code editor title bar that appears only when a `.md` file is open in the native text editor. Clicking it calls the existing `gptAiMarkdownEditor.openFile` command to switch to TipTap. No new runtime code is needed — the change is purely declarative `package.json` contributions plus an icon on the existing command.

## Stack

**Language/Runtime**: TypeScript 5.x, VS Code Extension API  
**Key deps**: None new  
**Testing**: Jest + jsdom (unit); manual Extension Development Host (integration)

## Phases

**Phase 1 — package.json contributions** *(COMPLETE)*: Add `editor/title` menu entry and icon to existing `openFile` command.
- Files: `package.json` MODIFY
- Tests: Build verification (`npm run build:debug`)

**Phase 2 — Test coverage**: Write unit test verifying the `openFile` command resolves URI from active text editor when no explicit URI is passed.
- Files: `src/__tests__/extension/openFileCommand.test.ts` CREATE
- Tests: 4 unit tests

**Phase 3 — Verification**: Build debug, verify JSON validity, run full test suite.
- Files: none
- Tests: `npm test` — all 1000+ must pass

## Files

| File | Action | Purpose |
|------|--------|---------|
| `package.json` | MODIFY ✅ | Add `editor/title` menu entry + icon to `openFile` command |
| `src/__tests__/extension/openFileCommand.test.ts` | CREATE | Unit tests for openFile command URI resolution logic |

## Key Risks

| Risk | Cause | Mitigation |
|------|-------|-----------|
| Button appears in TipTap toolbar too | `when` clause not precise enough | Use `activeEditor == workbench.editors.files.textFileEditor` to target only the native text editor |
| Button absent from text editor | Wrong `activeEditor` context key value | Verify in Extension Development Host; fallback: drop `activeEditor` condition and rely on `resourceScheme == file` |

## Implementation Decisions

**Decision 1 — `when` clause precision**: Two options for filtering the button to text-only tabs.
- [x] **A**: `resourceExtname == .md && resourceScheme == file && activeEditor == workbench.editors.files.textFileEditor` — most precise, hides button in TipTap
- [ ] **B**: `resourceExtname == .md && resourceScheme == file` — simpler but shows button even when TipTap is active (redundant but harmless)
- Chosen: **A** — verified `workbench.editors.files.textFileEditor` is the correct context key for the native text editor

**Decision 2 — Command reuse vs new command**: Use existing `openFile` command or register a dedicated `openAsRichText`.
- [x] **A**: Reuse `gptAiMarkdownEditor.openFile` — already handles URI resolution from active editor; no duplication
- [ ] **B**: New `openAsRichText` command — unnecessary since openFile already does exactly this
- Chosen: **A**

