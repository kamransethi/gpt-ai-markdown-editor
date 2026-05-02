# Implementation Plan: Image Context Menu

**Folder**: `specs/035-image-context-menu/plan.md` | **Date**: 2026-05-02 | **Spec**: [spec.md](./spec.md)
**Status**: In Progress

## Summary

Replace the image hover `[...]` dropdown with a right-click image context menu built with the shared `MenuBuilder` system (same design language as table context menu). Preserve existing image actions and icons, add top clipboard actions, keep `EDIT` as a non-interactive section label, and use a simplified menu for external images (Clipboard + Ask-the-image AI only).

## Stack

**Language/Runtime**: TypeScript 5.3, TipTap/ProseMirror, VS Code Webview  
**Key deps**: `@tiptap/core`, `@tiptap/pm/state`  
**Testing**: Existing webview/unit test suite + debug build

## Phases

### Phase 1 — New Image Context Menu Controller

Create `src/webview/features/imageContextMenu.ts` using `MenuBuilder` and current action handlers.

- Include sections in order:
  - Clipboard: Cut, Copy, Paste, Delete (danger)
  - `EDIT` section label: Rename, Replace…, Revert to original size, Refresh
  - `REVEAL` section label: Open in Finder/Explorer, Show in Workspace
  - Ask-the-image AI submenu: Custom, Explain, Extract Text
- Reuse existing codicon choices from `imageMenu.ts` for migrated items.
- Keep context position for restore-before-action (same approach as table context menu).
- For external images, build simplified menu: Clipboard + Ask-the-image AI only.

### Phase 2 — Wire Right-Click Routing in Editor

Update `src/webview/editor.ts` context menu event routing.

- Instantiate `imageContextMenuCtrl` beside text/table menus.
- On `contextmenu`, detect image target first and show image menu.
- Hide other menus when showing image menu.
- Ensure cleanup (`destroy`) on editor destroy.

### Phase 3 — Remove Hover Button Dropdown Path

Update `src/webview/extensions/customImage.ts` to remove `[...]` button and old dropdown usage.

- Remove `createImageMenuButton`, `createImageMenu`, `showImageMenu`, `hideImageMenu` usage.
- Keep image wrapper, metadata overlay, resize handle, and existing image behavior.
- Preserve local/external detection for metadata behavior.

### Phase 4 — Styling Cleanup

Update `src/webview/editor.css`.

- Remove obsolete `.image-menu-button` and `.image-context-menu` style blocks.
- Keep shared `.context-menu*` styles as the single source of visual language.

## Files

| File | Action | Purpose |
|------|--------|---------|
| `src/webview/features/imageContextMenu.ts` | CREATE | New right-click image context menu controller built on `MenuBuilder` |
| `src/webview/editor.ts` | MODIFY | Route right-click image events to image context menu controller |
| `src/webview/extensions/customImage.ts` | MODIFY | Remove hover `[...]` button/dropdown wiring |
| `src/webview/editor.css` | MODIFY | Remove old image menu button/dropdown CSS |
| `src/webview/features/imageMenu.ts` | MODIFY/KEEP | Retain only shared helpers (e.g., `isExternalImage`) as needed |

## Risks

| Risk | Cause | Mitigation |
|------|-------|-----------|
| Wrong node acted on | Selection drift before action | Restore image node selection at stored context position before action |
| Clipboard inconsistencies | Browser clipboard command limitations | Keep current `document.execCommand` parity used by other context menus |
| External image confusion | Local-only items shown | Build explicit simplified menu for external images |

## Validation

- Run `Build Extension (Debug)`
- Verify right-click image menu behavior manually for local and external images
- Verify no `[...]` button appears on hover
- Verify rename/replace/revert/refresh/reveal/AI actions still function
