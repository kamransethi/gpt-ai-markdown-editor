# Feature Specification: Webview Modernization

**Folder**: `specs/032-webview-modernization/`  
**Created**: 2026-04-27  
**Status**: Draft  
**Input**: User description: "Refactor webview bandaids based on analysis: Settings Panel (DOM spaghetti), Image Drag/Drop (DOM scraping), Export (DOM cloning), Global Events (bypassing framework), Overlays (raw HTML injection)."

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

### Edge Cases

- **Webview Reload**: Ensure reactive state in the settings panel is correctly re-hydrated from VS Code global state after a webview reload.
- **Deleted Placeholder**: If a user manually deletes the range containing an image placeholder decoration, the system must gracefully cancel the upload or ignore the result without throwing "DOM node not found" errors.
- **Nested Overlays**: Verify that the new `BaseOverlay` class correctly handles focus traps and z-index when multiple overlays (e.g., Table Insert inside a modal) are present.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: **Reactive Settings Panel**: Refactor settings logic to use a reactive component model with a clear State -> View mapping.
- **FR-002**: **Native Placeholders**: Replace manual DOM-based image placeholders with framework-native UI decorations.
- **FR-003**: **Model-Based Serialization**: Rewrite export logic to generate content by walking the internal document tree model.
- **FR-004**: **Unified Event Pipeline**: Move external event listeners for drop/paste into the native editor lifecycle hooks.
- **FR-005**: **Overlay Framework**: Implement a shared overlay management system to manage lifecycle and event cleanup for all dialogs.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Elimination of all direct manual DOM queries for state binding in the settings panel.
- **SC-002**: 100% elimination of "placeholder not found" errors during concurrent editing and uploading.
- **SC-003**: Reduction in memory overhead during export of large documents (no `cloneNode(true)` calls).
- **SC-004**: All file drop and paste events in `editor.ts` must pass through the `editorProps` lifecycle, verified by test coverage in `pasteHandler.test.ts`.

## Assumptions

- **Performance**: We assume that moving to AST traversal for export will provide a significant performance gain for large files.
- **Compatibility**: We assume that standardizing on `editorProps` will resolve existing "bandaid" conflicts between table pasting and file drops.
- **Modern Browser Support**: We assume the use of modern Web APIs (Custom Elements) is acceptable for the VS Code Webview environment.
