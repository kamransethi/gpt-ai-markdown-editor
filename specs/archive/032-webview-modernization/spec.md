# Feature Specification: Webview Modernization

**Folder**: `specs/032-webview-modernization/`  
**Created**: 2026-04-27  
**Status**: Draft  
**PRD Domains**: `editor-core`, `dev-tooling`  
**Input**: User description: "Refactor webview bandaids based on analysis: Settings Panel (DOM spaghetti), Image Drag/Drop (DOM scraping), Export (DOM cloning), Global Events (bypassing framework), Overlays (raw HTML injection)."

## Clarifications

### Session 2026-05-02
- Q: If an image placeholder is deleted before upload completes, how should the system behave? → A: Cancel upload and do not modify document.
- Q: What export serialization model should the feature use? → A: Serialize AST content to structured HTML-like output, then convert to PDF/Word separately.
- Q: When pasting web content that includes inline images (HTML + binary image in clipboard), how should the images be handled? → A: Trigger the existing image-upload flow for each `<img src>` URL found in the pasted HTML.
- Q: When a `BaseOverlay` dialog closes, where should focus return? → A: Return focus to the element that had focus immediately before the overlay was opened.
- Q: If VS Code global state is empty on webview reload (e.g. new install), how should the settings panel behave? → A: Apply built-in defaults silently, then post a `getConfiguration` message to the extension host to fetch persisted workspace settings.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reactive Settings Panel (Priority: P1)

Developers and users benefit from a more stable and responsive settings UI. When a user toggles a setting, the UI updates instantly through reactive data binding rather than manual DOM manipulation.

**Why this priority**: High. The settings panel is the primary configuration interface and is currently the most fragile part of the webview logic.

**Independent Test**: Can be tested by opening the settings panel and verifying that all toggles, inputs, and conditional sections update correctly and persist settings via VS Code's message passing without console errors.

**Acceptance Scenarios**:

1. **Given** the settings panel is open, **When** a user changes a setting, **Then** the UI reflects the change immediately through reactive state binding without manual element-by-element updates.
2. **Given** a conditional setting (e.g., AI provider options), **When** the parent setting changes, **Then** the dependent UI sections show/hide automatically based on the state model.

---

### User Story 2 - Stable Image Uploads (Priority: P1)

Users see reliable placeholders during image uploads. Even if the user continues typing or editing the document while an image is being processed, the final image is inserted into the correct location without failing due to DOM structural changes.

**Why this priority**: High. Prevents document corruption and "image not found in DOM" errors during async operations.

**Independent Test**: Can be tested by dropping a large image and immediately typing several paragraphs of text. The final image should appear exactly where it was dropped, regardless of the text changes.

**Acceptance Scenarios**:

1. **Given** an image is dropped into the editor, **When** the upload is in progress, **Then** a framework-native placeholder is displayed at the drop position.
2. **Given** an upload completes, **When** the transaction is dispatched, **Then** the final image replaces the decoration at the correct mapped position, even if the surrounding text was edited.

---

### User Story 3 - High-Performance Document Export (Priority: P2)

Users can export large documents quickly and without UI stutters. The system generates the export content by traversing the internal document tree rather than scraping and cloning the browser DOM.

**Why this priority**: Medium. Improves performance for power users with large documents.

**Independent Test**: Can be tested by exporting a document with 100+ images and complex formatting. The export should initiate without a "Deep Clone" memory spike or UI freeze.

**Acceptance Scenarios**:

1. **Given** an export request (PDF or Word), **When** the export logic runs, **Then** it traverses the `editor.state.doc` nodes to generate the output instead of calling `document.cloneNode`.

---

### User Story 4 - Native Event Lifecycle (Priority: P2)

The editor behaves predictably with external files and clipboard content. Drag, drop, and paste events are handled through the standard framework lifecycle, allowing for consistent behavior across all editor extensions.

**Why this priority**: Medium. Ensures compatibility between different TipTap extensions.

**Independent Test**: Can be tested by dragging files into different parts of the editor (tables, lists, quotes) and verifying that the correct handler is triggered without global event conflicts.

**Acceptance Scenarios**:

1. **Given** a file drop or paste event, **When** the event occurs over the editor, **Then** it is handled by the native editor event lifecycle.

---

### User Story 5 - Robust Web-Content Paste With Images (Priority: P1)

Users can copy rich content from a web page — including sections that contain inline images — and paste it into the editor without the paste being silently dropped.

**Why this priority**: High. The 031 bandaid removal (T020, T022) deleted the `stopPropagation` guard from the global paste handler. As a result, when the clipboard contains both binary image data and `text/html` (the standard browser behavior when copying a page section), `processPasteContent` detects `isImage: true` and returns early, dropping the entire paste silently.

**Root cause**: `hasImageContent` in `pasteHandler.ts` returns `true` whenever any `image/*` MIME type appears in `clipboardData.items`, even when the primary payload is rich HTML. `clipboardHandling.ts` then exits without processing the HTML.

**Independent Test**: Can be tested by copying a paragraph from a webpage that contains an inline `<img>` and pasting into the editor. The text content and image reference should appear in the editor, not a blank result.

**Acceptance Scenarios**:

1. **Given** a user copies a section from a web page containing inline images, **When** they paste into the editor, **Then** the HTML text content is processed and each `<img src>` URL is queued through the existing image-upload flow.
2. **Given** a paste event contains both binary image data and `text/html`, **When** `processPasteContent` runs, **Then** it prioritises the HTML payload unless the clipboard contains *only* image MIME types (a pure screenshot paste).
3. **Given** a pure screenshot paste (only `image/png` in clipboard items, no `text/html`), **When** the paste event fires, **Then** the existing image-upload flow handles it unchanged.
4. **Given** a pasted HTML section contains `<img src="https://...">` URLs, **When** the HTML is processed, **Then** each image URL is individually queued for upload and replaced with a local placeholder decoration until the upload completes.

---

### Edge Cases

- **Webview Reload**: On reload, the reactive settings panel must apply built-in defaults immediately (no blank UI), then post a `getConfiguration` message to the VS Code extension host. When the response arrives, the state model updates and the UI re-renders with persisted values — no `querySelector` calls permitted during this re-hydration path.
- **Deleted Placeholder**: If a user deletes an image placeholder before upload completes, cancel the upload and do not modify the document. Abort the upload and clean up temporary artifacts to avoid orphaned uploads or unexpected insertions.
- **Nested Overlays**: Verify that the new `BaseOverlay` class correctly handles focus traps and z-index when multiple overlays (e.g., Table Insert inside a modal) are present. On each overlay close, focus must return to the previously focused element; if the inner overlay closes, focus returns inside the outer overlay; if the outer overlay closes, focus returns to the editor.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: **Reactive Settings Panel**: Refactor settings logic to use a reactive component model with a clear State -> View mapping.
- **FR-002**: **Native Placeholders**: Replace manual DOM-based image placeholders with framework-native UI decorations.
- **FR-003**: **Model-Based Serialization**: Rewrite export logic to generate content by walking the internal document tree model and emitting a structured AST-derived HTML-like representation for downstream PDF/Word conversion.
- **FR-004**: **Unified Event Pipeline**: Move external event listeners for drop/paste into the native editor lifecycle hooks.
- **FR-005**: **Overlay Framework**: Implement a shared overlay management system to manage lifecycle and event cleanup for all dialogs. On close, `BaseOverlay` must restore focus to the element that held focus immediately before the overlay was opened.
- **FR-006**: **Robust Web-Content Paste**: Fix `processPasteContent` / `clipboardHandling.ts` so that a clipboard containing both binary `image/*` items and `text/html` correctly processes the HTML payload instead of silently returning early. Each `<img src>` URL extracted from the pasted HTML must be individually routed through the existing image-upload flow. Pure image-only pastes (screenshots, no `text/html`) must continue to route to the image-upload flow unchanged.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Elimination of all direct manual DOM queries for state binding in the settings panel.
- **SC-002**: 100% elimination of "placeholder not found" errors during concurrent editing and uploading.
- **SC-003**: Export uses AST-based serialization to structured HTML-like output, eliminating `cloneNode(true)` DOM cloning during large-document export.
- **SC-004**: All file drop and paste events in `editor.ts` must pass through the `editorProps` lifecycle, verified by test coverage in `pasteHandler.test.ts`.
- **SC-005**: Pasting a copied web section containing inline `<img>` tags must (a) insert the HTML text content into the editor without silent drops, and (b) queue each `<img src>` URL through the image-upload flow; verified by new test cases in `pasteHandler.test.ts` that supply a mixed `text/html` + `image/png` clipboard and assert both the HTML insertion and upload-queue invocation.
- **SC-006**: On webview reload with empty global state, the settings panel renders with built-in defaults within one render cycle and dispatches exactly one `getConfiguration` message to the extension host; verified by a unit test that mocks the VS Code message API.

## Assumptions

- **Performance**: We assume that moving to AST traversal for export will provide a significant performance gain for large files.
- **Compatibility**: We assume that standardizing on `editorProps` will resolve existing "bandaid" conflicts between table pasting and file drops.
- **Modern Browser Support**: We assume the use of modern Web APIs (Custom Elements) is acceptable for the VS Code Webview environment.
