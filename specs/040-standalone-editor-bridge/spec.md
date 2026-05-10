# Feature Specification: Standalone Editor Bridge

**Folder**: `specs/040-standalone-editor-bridge/`
**Created**: 2026-05-09
**Status**: Draft

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Developer Opens Editor in a Standard Browser (Priority: P1)

A developer working on the extension wants to rapidly inspect or test the rich-text editor without launching a VS Code Extension Development Host. They run a single command, open their browser, and see the editor pre-populated with sample content, ready to interact with.

**Why this priority**: This is the foundational unlock. Every other testing and standalone scenario depends on the editor being able to boot outside VS Code at all. Unblocks Robot Framework and Playwright harness work.

**Independent Test**: Run the dev-server command, navigate to `localhost:3000`, confirm the editor renders markdown content and toolbar buttons are visible.

**Acceptance Scenarios**:

1. **Given** a developer runs the dev-server command, **When** they open the browser to the local address, **Then** the editor loads with sample markdown content and no JavaScript errors appear in the console.
2. **Given** the editor is open in standalone mode, **When** the page loads, **Then** no error about `acquireVsCodeApi is not defined` (or any equivalent VS Code API reference) appears.
3. **Given** the editor is open in standalone mode, **When** the developer types and edits content, **Then** the rich-text formatting toolbar functions (bold, italic, headings) work correctly.

---

### User Story 2 — Edited Content Survives a Browser Refresh (Priority: P2)

A developer editing content in standalone mode refreshes the browser tab. Their edits are not lost.

**Why this priority**: Without persistence, the standalone mode is only useful for visual inspection, not iterative content testing. This makes the dev loop practical.

**Independent Test**: Type content in standalone mode, refresh the browser, confirm the content is restored.

**Acceptance Scenarios**:

1. **Given** the editor contains edited markdown in standalone mode, **When** the developer refreshes the browser, **Then** the previously edited content is restored automatically.
2. **Given** a fresh browser session with no prior saved content, **When** the editor loads, **Then** the default sample content is displayed.

---

### User Story 3 — Automated Tests Can Target Editor Elements (Priority: P3)

A test author writing Playwright or Robot Framework tests can reliably locate the editor container and primary toolbar buttons using stable, semantic attributes rather than fragile CSS selectors or positional queries.

**Why this priority**: Enables the existing Playwright infrastructure to target the webview UI elements without brittleness. Foundational for future test suite expansion.

**Independent Test**: Load the editor in standalone mode, run a Playwright selector for `[data-testid="tiptap-editor"]`, confirm it resolves to the editor container.

**Acceptance Scenarios**:

1. **Given** the editor is rendered (in either VS Code or standalone mode), **When** a test queries `[data-testid="tiptap-editor"]`, **Then** exactly one element is returned corresponding to the main editor container.
2. **Given** the editor toolbar is visible, **When** a test queries toolbar buttons by `data-testid`, **Then** the primary formatting buttons (bold, italic, heading) are individually addressable.

---

### User Story 4 — VS Code Extension Behaviour Is Unchanged (Priority: P1)

A user opening a `.md` file through the VS Code Explorer continues to experience the editor exactly as before — content loads from the real file, saves propagate to disk, and all existing features work.

**Why this priority**: This is a non-regression requirement. All changes must be invisible to VS Code users. Parity with the current production behaviour is mandatory.

**Independent Test**: Open a markdown file in VS Code via Explorer; confirm content loads, edits are saved, and no new console errors appear.

**Acceptance Scenarios**:

1. **Given** a markdown file is opened via VS Code Explorer, **When** the custom editor loads, **Then** the file content is displayed correctly and the editor operates identically to the pre-change behaviour.
2. **Given** the user makes edits and saves (Ctrl+S), **When** the save completes, **Then** the file on disk is updated and the dirty indicator clears, exactly as before.
3. **Given** the extension is running, **When** any message-based feature is used (AI refine, image handling, link search), **Then** it continues to function without regression.

---

### Edge Cases

- What happens when the developer-mode local server is started but the browser has stale cached content from a previous session with incompatible data in local storage?
- How does the editor behave if the browser's local storage is cleared between sessions?
- What if both the VS Code environment and the standalone environment are somehow loaded simultaneously (e.g., VS Code Webview pointing to same `localhost`)?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The editor MUST start without any error when opened in a standard browser tab where the VS Code extension API is not present.
- **FR-002**: In standalone mode, the editor MUST display a pre-defined sample markdown document as its initial content.
- **FR-003**: In standalone mode, all save operations MUST persist content to browser local storage instead of propagating to a file system.
- **FR-004**: In standalone mode, the editor MUST restore the most recently saved content from local storage on page load (when saved content exists).
- **FR-005**: The editor MUST expose `data-testid="tiptap-editor"` on the main editor container element.
- **FR-006**: The primary toolbar formatting buttons (bold, italic, at minimum) MUST each expose a unique `data-testid` attribute.
- **FR-007**: All communication between the editor UI and its host environment (VS Code or standalone) MUST be routed through the bridge abstraction (`hostBridge.ts`) — no direct calls to the VS Code API may remain at the module scope of `editor.ts`. The bridge interface MUST be designed so additional adapter implementations (e.g., server-backed, Electron) can be added without modifying editor logic.
- **FR-008**: The standalone dev server MUST be startable with a single `npm` command.
- **FR-009**: The standalone editor MUST apply a visual theme approximating VS Code's default color palette so that the editor UI is legible (not invisible or broken).
- **FR-010**: In VS Code, all existing capabilities (AI features, image handling, file navigation, saving, frontmatter validation) MUST continue to function without regression.

### Key Entities

- **HostBridge**: The abstraction layer through which all editor ↔ host communication flows. Has two concrete implementations: one for VS Code and one for standalone browser use.
- **Standalone Adapter**: The implementation of HostBridge used in the browser. Reads initial content from local storage (or falls back to a hard-coded sample), and writes saves back to local storage.
- **VS Code Adapter**: The existing implementation of HostBridge that uses the VS Code extension messaging API. Unchanged in behaviour.
- **Sample Content**: A hard-coded markdown document embedded in the standalone adapter, used as the initial content when no saved session exists.
- **Dev Server**: A local HTTP server that serves the editor bundle and a minimal HTML harness page for standalone testing.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Opening `localhost:3000` (or equivalent dev server address) in Chrome produces a fully rendered editor with no JavaScript errors — measured by zero `console.error` or uncaught exceptions on load.
- **SC-002**: After editing content and refreshing the browser, 100% of the last-saved content is restored — verified by comparing the pre-refresh and post-refresh editor text.
- **SC-003**: A Playwright selector `[data-testid="tiptap-editor"]` resolves to exactly one element in under 2 seconds of page load.
- **SC-004**: Opening a markdown file in VS Code after this change produces identical behaviour to before — zero regressions across the existing automated test suite.
- **SC-005**: The standalone dev server starts in under 10 seconds from running the npm command.

## Assumptions

- The existing esbuild build infrastructure is retained for this phase; migrating to a different bundler is out of scope.
- **Standalone mode scope (v1)**: In this phase, standalone mode targets developer workflows and automated testing. The architecture must not preclude standalone becoming part of a web-based platform for collaborative or hosted markdown editing in a future phase — all adapter and bridge interfaces are designed to be swappable.
- Local storage is the persistence mechanism for the standalone adapter in v1. The bridge interface is intentionally designed so a `ServerAdapter` (HTTP/WebSocket-backed) can replace the standalone adapter in a future phase without touching editor logic.
- The existing `createNoOpBridge()` in `hostBridge.ts` is kept for unit testing purposes; the new standalone adapter is a separate, named export.
- Content saved in standalone local storage and content in VS Code are completely separate in v1; no sync between them is required.
- The VS Code adapter already has a safe fallback (`createNoOpBridge`) when the VS Code API is unavailable — this guard is preserved.
- The sample markdown document used in standalone mode is a hard-coded string in the codebase (not loaded from the file system at runtime). In a future phase this would be replaced by a document loaded from a server or URL parameter.
- Mobile browser support is explicitly out of scope and not a future target. The standalone editor is a desktop web application.
