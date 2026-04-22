# Implementation Plan: Slash Command Refactor

## Architecture Overview
The goal is to move away from multiple disconnected suggestion plugins (e.g., `slashCommand.ts`, `FileLinkSuggestion.ts`) to a single `CommandRegistry` that handles both inserting Markdown blocks and fuzzy-searching workspace files. 

## Files to Modify/Create

1. **`src/webview/extensions/CommandRegistry.ts`** (NEW)
   - Core TipTap extension using `@tiptap/suggestion`.
   - Replaces `slashCommand.ts` and `FileLinkSuggestion.ts`.
   - Uses `allow` guard `($from.parent.inlineContent)` to trigger everywhere inline text is allowed (paragraphs, lists, blockquotes, tables).
   - Manages state closure carefully in the `render` functions to ensure `props.command` always has the most up-to-date `range` from TipTap for proper deletion of the slash query text.
   - Contains a built-in `openFilePicker` UI overlay specifically for the "File Link" block menu item.

2. **`src/webview/components/SuggestionList.ts`** (NEW)
   - Shared generic UI component to render the slash command dropdown.
   - Handles `ArrowUp`, `ArrowDown`, `Enter`, and `Escape` navigation.
   - Accepts a generic `SuggestionItem` array.

3. **`src/webview/utils/fileCache.ts`** (NEW)
   - A lightweight client-side singleton class to cache workspace file paths.
   - Provides a `search(query, limit)` method for instantaneous, zero-latency fuzzy searching.

4. **`src/editor/handlers/fileHandlers.ts`**
   - Add backend message handler to support `GET_WORKSPACE_FILES`.
   - Use `vscode.workspace.findFiles` to retrieve markdown and image files.
   - Send `WORKSPACE_FILES_RESULT` back to the webview.

5. **`src/shared/messageTypes.ts`**
   - Add new types `GET_WORKSPACE_FILES` and `WORKSPACE_FILES_RESULT`.

6. **`src/webview/editor.ts`**
   - Initialize `fileCache` upon receiving `WORKSPACE_FILES_RESULT`.
   - Request files when the editor is fully initialized.
   - Register `CommandRegistry` in the TipTap extension list.

7. **`src/webview/editor.css`**
   - Add generic styles for `.slash-command-menu` and `.slash-command-item`.
   - Add styles for the inline file picker input (`.file-link-search-input`).

## Key Technical Decisions
- **Instant Search**: Fetching files on every keystroke via `postMessage` is too slow for a fluid IDE experience. The workspace files are fetched once on editor startup and cached in the webview.
- **API Adherence**: `@tiptap/suggestion`'s `items()` callback strictly receives `{ query }`. All editor manipulation must happen downstream in the resolved `command()` execution.
- **Stale Closures**: To ensure text deletion works correctly when hitting Enter, the UI component must be continually updated via `onUpdate` to use the latest `props.command` reference which holds the dynamically expanding text range.
- **Inline Pickers vs Text Injection**: Instead of programmatically typing `/link ` to re-trigger the menu (which is brittle), clicking the "File Link" command mounts an explicit native-feeling DOM overlay (search box + results) exactly where the cursor is.
