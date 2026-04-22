# Tasks: Slash Command Refactor

- [x] **Phase 1: Backend & Messaging**
  - [x] Add `GET_WORKSPACE_FILES` and `WORKSPACE_FILES_RESULT` to `src/shared/messageTypes.ts`.
  - [x] Implement `handleGetWorkspaceFiles` in `src/editor/handlers/fileHandlers.ts` to scan workspace directories (excluding node_modules/.git).
  - [x] Register the handler with the webview message router.

- [x] **Phase 2: Client-Side Caching**
  - [x] Create `src/webview/utils/fileCache.ts` as a singleton.
  - [x] Implement memory storage and `search(query, limit)` logic.
  - [x] Update `src/webview/editor.ts` to request workspace files on `editorFullyInitialized`.
  - [x] Update `src/webview/editor.ts` to listen for `WORKSPACE_FILES_RESULT` and populate `fileCache`.

- [x] **Phase 3: UI Components**
  - [x] Create `src/webview/components/SuggestionList.ts`.
  - [x] Implement DOM rendering, absolute positioning logic based on client rect.
  - [x] Add keyboard event handlers (Arrow keys, Enter, Escape).
  - [x] Add CSS styling for dropdowns, items, active states, and icons to `src/webview/editor.css`.
  - [x] Add CSS styling for inline file search input (`.file-link-search-input`).

- [x] **Phase 4: Unified Command Registry**
  - [x] Create `src/webview/extensions/CommandRegistry.ts`.
  - [x] Implement `@tiptap/suggestion` configuration.
  - [x] Relax `allow` to trigger on `$from.parent.inlineContent`.
  - [x] Port all existing slash commands (Headings, Lists, Tables, Quotes, Alerts, Mermaid).
  - [x] Add conditional `items` filtering for file search triggered via `/link ` or `/file `.
  - [x] Build custom inline UI file picker overlay invoked by selecting the "File Link" block option.
  - [x] **Fix Stale Closure Bug**: Update the SuggestionList wrapper to continuously capture the dynamically updated `props.command` in `onUpdate`, guaranteeing correct deletion ranges when the user selects a block command.
  - [x] Remove legacy plugins (`slashCommand.ts`, `FileLinkSuggestion.ts`) from codebase and `editor.ts`.

- [x] **Phase 5: Final Validation & Testing**
  - [x] Verify block commands correctly delete typed text upon execution.
  - [x] Verify inline file picker is usable via keyboard and correctly outputs Markdown links.
  - [x] Ensure extension builds cleanly (`npm run build:debug`) with zero strict typing errors.
