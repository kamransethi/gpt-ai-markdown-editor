# Implementation Tasks: File & Image Slash Commands

**Folder**: `specs/034-file-image-slash-cmd/tasks.md`  
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)  
**Status**: All tasks complete ✅

---

## Phase 1: Shared Picker Abstraction [FR-003]

**Goal**: Replace the inline `openFilePicker` with a reusable `openWorkspacePicker(editor, insertFrom, mode)`.  
**Independent Test**: Both `/link` and `/image` commands open the same picker UI.

- [x] T001 [FR-003] Rename `openFilePicker` → `openWorkspacePicker(editor, insertFrom, mode: 'fileLink' | 'image')` in `src/webview/extensions/CommandRegistry.ts`
- [x] T002 [FR-003] Extract `insertFileLink(editor, insertFrom, file)` — inserts text node with `link` mark (`href` = path, text = filename)
- [x] T003 [FR-003] Extract `insertImage(editor, insertFrom, file)` — inserts `{ type: 'image', attrs: { src: path, alt: filename } }` ProseMirror node
- [x] T004 [FR-003] Update File Link block item action to call `openWorkspacePicker(editor, range.from, 'fileLink')`

---

## Phase 2: Fix Broken Image Slash Command [FR-001, SC-001]

**Goal**: Remove the dead `CustomEvent` dispatch and wire Image command to the shared picker.  
**Independent Test**: `/image` opens picker and inserts image node — previously did nothing.

- [x] T005 [FR-001] Remove `window.dispatchEvent(new CustomEvent('slashCommandInsertImage'))` from the Image block item action
- [x] T006 [FR-001] Update Image block item action to call `openWorkspacePicker(editor, range.from, 'image')`

---

## Phase 3: Add `/image` and `/img` Search Modes [FR-001, FR-004, SC-002]

**Goal**: Support typing `/image query` and `/img query` to pre-filter files in the slash search, matching `/link` and `/file` UX.  
**Independent Test**: Typing `/img sunset` shows files matching "sunset".

- [x] T007 [FR-004] Add `/image` mode case to `items()` in `CommandRegistry.ts` — calls `fileCache.search(query)` and returns file results
- [x] T008 [FR-004] Add `/img` mode case to `items()` — alias for `/image` mode

---

## Phase 4: Obsidian-Style Active Link Preview [FR-006, FR-007, SC-004]

**Goal**: Show file path inline next to link text when cursor is inside a local file link.  
**Independent Test**: Cursor inside `[notes](./notes.md)` shows `(./notes.md)` after the text via CSS.

- [x] T009 [FR-006] Add `onSelectionUpdate` handler in `src/webview/editor.ts` — detects `link` mark at cursor position
- [x] T010 [FR-006] In handler: find anchor DOM element at cursor, read `href`, check it is a local path (not `http`, `https`, `mailto:`, `#`)
- [x] T011 [FR-006] Add `.link-edit-preview` class and `data-link-href` attribute to anchor when cursor is inside local link
- [x] T012 [FR-006] Remove `.link-edit-preview` class and `data-link-href` from any previously decorated anchor on every selection update
- [x] T013 [FR-007] Add `.markdown-link.link-edit-preview::after` CSS rule in `src/webview/editor.css` — renders `attr(data-link-href)` in muted/dimmed color after link text
