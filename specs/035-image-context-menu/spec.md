# Feature Specification: Image Context Menu

**Folder**: `specs/035-image-context-menu/`  
**Created**: 2026-05-02  
**Status**: Draft  
**PRD Domains**: `images`, `editor-core`  
**Input**: User description: "Images no longer need to have the [...] button on the upper right. Move that context menu to right click on images. Similar to the custom table context menu — same design language and philosophy."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Right-Click to Access All Image Actions (Priority: P1)

As a user editing a document, I want to right-click any image to get a context menu with all available actions, so that image management feels native and discoverable without hunting for a small button in the corner.

**Why this priority**: The `[...]` button is small, easy to miss, and only visible on hover. A right-click context menu is the universal, expected interaction pattern for in-place content management. Removing the button and replacing it with right-click declutters the image UI and aligns it with how the table context menu works.

**Independent Test**: Right-click any image in the editor → the context menu appears at the cursor position with the full action list visible. The `[...]` hover button is no longer present.

**Acceptance Scenarios**:

1. **Given** any image in the editor, **When** I right-click it, **Then** a context menu appears at the cursor position using the same visual design as the table context menu.
2. **Given** the image context menu is open, **When** I press Escape or click outside the menu, **Then** the menu closes without taking any action.
3. **Given** any image, **When** I hover over it, **Then** no `[...]` button appears — the hover state may still show a selection outline but not the old menu button.
4. **Given** the image context menu is open, **When** I use arrow keys, **Then** I can navigate between menu items and press Enter to activate one.

---

### User Story 2 — Clipboard Actions on Images (Priority: P1)

As a user, I want to Cut, Copy, and Delete an image via the right-click menu, so that I can manage images using the same clipboard workflow I use for text.

**Why this priority**: The old `[...]` menu had no clipboard operations. The table context menu includes Cut/Copy/Paste/Delete at the top — parity is required.

**Independent Test**: Right-click an image → Cut → the image disappears from the document and can be Pasted elsewhere.

**Acceptance Scenarios**:

1. **Given** an image in the editor, **When** I right-click → Cut, **Then** the image is removed from the document and copied to the clipboard.
2. **Given** an image in the editor, **When** I right-click → Copy, **Then** the image is copied to the clipboard and remains in the document.
3. **Given** content is on the clipboard, **When** I right-click → Paste, **Then** the clipboard content is inserted at the image's position.
4. **Given** an image in the editor, **When** I right-click → Delete, **Then** the image is removed from the document (shown in red to signal a destructive action).

---

### User Story 3 — File Management Actions (Priority: P2)

As a user, I want to rename, replace, revert size, and refresh an image from the context menu — the same actions that existed in the `[...]` menu — so that I lose no functionality in the migration.

**Why this priority**: These are existing features. The spec ensures they are preserved and correctly migrated.

**Independent Test**: Right-click image → Rename → enter a new filename → the file is renamed on disk and all references in the workspace are updated.

**Acceptance Scenarios**:

1. **Given** a local image, **When** I right-click → Rename, **Then** the rename dialog opens with the current filename pre-filled.
2. **Given** a local image, **When** I right-click → Replace…, **Then** a file picker opens to select a replacement image file.
3. **Given** a resized image, **When** I right-click → Revert to Original Size, **Then** the image's width/height overrides are cleared and it renders at its native dimensions.
4. **Given** a local image that may have changed on disk, **When** I right-click → Refresh, **Then** the image is reloaded from disk.
5. **Given** an external image (http/https), **When** I right-click, **Then** Rename and Replace are hidden or disabled — these actions only apply to local files.

---

### User Story 4 — Reveal Image in File System (Priority: P2)

As a user, I want to open an image's parent folder in Finder/Explorer or highlight it in the VS Code workspace panel, so that I can quickly navigate to or manage the file.

**Why this priority**: Migrated directly from the `[...]` menu. This is a key feature for users managing large sets of images.

**Acceptance Scenarios**:

1. **Given** a local image, **When** I right-click → Open in Finder/Explorer, **Then** the OS file manager opens and the image's parent folder is revealed.
2. **Given** a local image, **When** I right-click → Show in Workspace, **Then** the VS Code file explorer scrolls to and highlights the image file.
3. **Given** an external image (http/https), **When** I right-click, **Then** the Reveal section is hidden or the items are disabled with a tooltip.

---

### User Story 5 — AI Actions on Images (Priority: P3)

As a user, I want access to AI-powered image analysis from the context menu (Custom, Explain, Extract Text), so that I can understand and extract value from images without leaving the editor.

**Why this priority**: Migrated from the `[...]` menu with an improved submenu structure. Lower priority than navigation/file ops but high value.

**Acceptance Scenarios**:

1. **Given** an image in the editor, **When** I right-click → Ask the image [AI] ▶, **Then** a submenu appears with: Custom, Explain, Extract Text.
2. **Given** I select Custom from the AI submenu, **When** the dialog opens, **Then** I can type a free-form question about the image and submit it.
3. **Given** I select Explain, **When** the AI request is sent, **Then** a loading indicator appears and the result is shown inline or in a panel.
4. **Given** I select Extract Text, **When** the AI request completes, **Then** the extracted text is presented so I can copy it.

---

### Edge Cases

- What happens when the image is external (http/https/data URI)? → Show a simplified menu with Clipboard + Ask AI only.
- What happens when an image file no longer exists on disk? → Rename and Replace should still be available; Refresh and Open in Finder should show an appropriate error or notification.
- What happens when the user right-clicks on an image while the editor is read-only? → Menu should show clipboard Copy only; all modification actions are disabled.
- What happens when two images are directly adjacent and the right-click position is ambiguous? → The clicked image's node is used as context.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A right-click on any image in the editor MUST open the image context menu at the cursor position; the `[...]` hover button MUST be removed.
- **FR-002**: The image context menu MUST use the same `MenuBuilder` component and CSS design language as the table context menu (separators, danger color for Delete, section labels, submenus).
- **FR-003**: The menu MUST include clipboard operations at the top: Cut, Copy, Paste, Delete (Delete in red/danger style).
- **FR-004**: The menu MUST include an `EDIT` section header (non-interactive) followed by: Rename, Replace…, Revert to Original Size, Refresh — preserving current design language.
- **FR-005**: The menu MUST include a `REVEAL` section (local images only): Open in Finder/Explorer, Show in Workspace.
- **FR-006**: The menu MUST include an "Ask the image [AI] ▶" item with a submenu containing: Custom (Ask a Question), Explain, Extract Text.
- **FR-007**: External images MUST use a simplified menu that includes only Clipboard and Ask-the-image AI actions.
- **FR-008**: Existing icons from the current image `[...]` menu MUST be reused for migrated items.
- **FR-009**: The menu MUST close when the user presses Escape, clicks outside, or activates any menu item.
- **FR-010**: The image context menu logic MUST be extracted into a dedicated `imageContextMenu.ts` file following the same module pattern as `tableContextMenu.ts`, reusing shared components where possible.

### Key Entities

- **Image node**: A TipTap/ProseMirror atomic node with `src`, `alt`, `title`, `width`, `height` attributes. Can be local (relative file path) or external (http/https/data URI).
- **Image context menu**: A `MenuBuilder`-based context menu triggered by right-click on an image node. Has sections: Clipboard, EDIT, REVEAL, Ask the image [AI].

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All actions previously available via the `[...]` button are accessible via right-click — zero regression in functionality.
- **SC-002**: The `[...]` hover button is completely removed — it no longer appears in any hover or selection state.
- **SC-003**: The image context menu closes and takes correct action within one user interaction (no multi-step dialogs for clipboard ops).
- **SC-004**: External images always show a simplified menu (Clipboard + Ask the image [AI]) with no local-file-only actions visible.
- **SC-005**: The context menu visually matches the table context menu in font, spacing, color, icon style, and separator design.

---

## Assumptions

- Image resizing (and therefore "Revert to Original Size") is already implemented — this spec migrates it, not creates it.
- The `MenuBuilder` component supports submenus — if not, submenu support must be added as part of this feature.
- "Open in Finder/Explorer" and "Show in Workspace" send VS Code extension host messages (already established by the `[...]` menu) and do not require new extension-side handlers unless they don't exist.
- AI actions (Custom, Explain, Extract Text) are already implemented — this spec migrates them into the new submenu structure.
