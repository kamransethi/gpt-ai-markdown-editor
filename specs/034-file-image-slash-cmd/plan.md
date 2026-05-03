# Implementation Plan: File & Image Slash Commands

**Folder**: `specs/034-file-image-slash-cmd/plan.md` | **Date**: 2026-05-02 | **Spec**: [spec.md](./spec.md)  
**Status**: Implemented ✅

---

## Summary

The `/image` slash command was completely broken — it dispatched a dead `CustomEvent` (`slashCommandInsertImage`) with no listener, silently doing nothing. This plan unifies the File Link and Image slash commands under a single reusable picker abstraction (`openWorkspacePicker`) and adds an Obsidian-style active link href preview using `onSelectionUpdate` + a CSS `::after` rule.

---

## Stack

**Language/Runtime**: TypeScript 5.3, VS Code WebView  
**Key deps**: `@tiptap/core`, `@tiptap/suggestion`, `@tiptap/pm`  
**Testing**: Jest + jsdom

---

## Phases

### Phase 1 — Refactor File Picker to Shared Abstraction

**Goal**: Replace the inline `openFilePicker` (used only by File Link) with `openWorkspacePicker(editor, insertFrom, mode: 'fileLink' | 'image')` that handles both insertion modes.

**Files**:
- `src/webview/extensions/CommandRegistry.ts` — MODIFY: rename and extend `openFilePicker` → `openWorkspacePicker(mode)`, parameterize insertion logic

**Key decisions**:
- Mode is `'fileLink'` or `'image'` — determined at call site, not inferred from file extension
- `insertFileLink()` — inserts `[text](href)` via `link` mark
- `insertImage()` — inserts `{ type: 'image', attrs: { src, alt } }` ProseMirror node

---

### Phase 2 — Fix Broken Image Slash Command

**Goal**: Remove the dead CustomEvent dispatch from Image slash command and replace with the shared picker call.

**Files**:
- `src/webview/extensions/CommandRegistry.ts` — MODIFY: Image block item action now calls `openWorkspacePicker(editor, range.from, 'image')`

**Root cause**: Original code called `window.dispatchEvent(new CustomEvent('slashCommandInsertImage'))`. No listener for this event existed anywhere in the codebase. The fix is complete removal of the event approach.

---

### Phase 3 — Add `/image` and `/img` Slash Search Modes

**Goal**: Support typing `/image query` and `/img query` in the slash menu to pre-filter the image file picker, matching UX of `/link` and `/file`.

**Files**:
- `src/webview/extensions/CommandRegistry.ts` — MODIFY: `items()` function — add `/image` and `/img` mode cases alongside existing `/link` and `/file` modes

---

### Phase 4 — Obsidian-Style Active Link Preview

**Goal**: When the cursor is inside a local file link, show the href inline via a CSS `::after` pseudo-element without modifying stored markdown.

**Files**:
- `src/webview/editor.ts` — MODIFY: `onSelectionUpdate` callback — detect link mark at cursor, check href is local, add/remove `.link-edit-preview` class and `data-link-href` attribute
- `src/webview/editor.css` — MODIFY: add `.markdown-link.link-edit-preview::after` rule rendering `attr(data-link-href)` in muted color

**Implementation approach**:
1. In `onSelectionUpdate`, get `$from` from `editor.state.selection`
2. Check for a `link` mark at `$from.pos`
3. Find the anchor DOM element via `editor.view.nodeDOM()` or walk the DOM at `$from.pos`
4. If `href` does not start with `http`, `mailto:`, or `#`, add class + attribute
5. On every `onSelectionUpdate`, remove the class from any previously decorated anchor first

---

## Files

| File | Action | Purpose |
|------|--------|---------|
| `src/webview/extensions/CommandRegistry.ts` | MODIFY | Refactor picker to shared abstraction; fix Image command; add `/image`+`/img` search modes |
| `src/webview/editor.ts` | MODIFY | Add `onSelectionUpdate` link-preview logic |
| `src/webview/editor.css` | MODIFY | Add `.markdown-link.link-edit-preview::after` CSS rule |

---

## Key Risks

| Risk | Cause | Mitigation |
|------|-------|-----------|
| Link preview flicker | `onSelectionUpdate` fires frequently during typing | Only apply/remove the class when the href actually changes; guard with early-exit checks |
| Image node not rendered | File path differs from what the webview can `src` | Use path as-is (same as File Link); editor handles resource resolution |
| Picker position off-screen | Picker positioned relative to `insertFrom` node | Clamp picker top/left to viewport bounds |

---

## Implementation Decisions

**Decision 1 — Picker mode parameter vs separate functions**:
- [x] **A**: Single `openWorkspacePicker(mode)` with insertion branching inside — keeps UI code deduplicated
- [ ] **B**: Two separate functions `openFileLinkPicker` / `openImagePicker` with shared picker UI extracted
- Recommendation: **A** — The picker UI is identical; only the final insertion step differs. Single function is simpler.

**Decision 2 — Link preview approach**:
- [x] **A**: CSS `::after` + `data-link-href` attribute set dynamically in `onSelectionUpdate` — non-destructive, no markdown change
- [ ] **B**: Floating tooltip above the link — more complex positioning, requires additional DOM overlay
- Recommendation: **A** — Matches Obsidian's inline preview approach. Zero markdown impact.

**Decision 3 — Image insertion format**:
- [x] **A**: TipTap image node `{ type: 'image', attrs: { src: file.path, alt: file.filename } }` — renders as `![alt](src)` in markdown
- [ ] **B**: Insert raw markdown text `![filename](path)` as a text node — bypasses TipTap schema
- Recommendation: **A** — Uses TipTap's schema correctly; markdown serialization is automatic.
