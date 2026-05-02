# Spec: Slash Command Refactor & Performance Optimization

## 1. Outcome
Refactor the current slash command architecture to support multiple providers (blocks, file links, etc.) through a unified registry and shared UI components. Improve performance for file linking by implementing client-side caching and local fuzzy search within the webview.

## 2. Success Criteria
- [x] **Unified Registry**: A single TipTap extension handles all slash command triggers (e.g., `/`).
- [x] **Shared UI**: Command menus use a common UI component for rendering, selection, and keyboard navigation.
- [x] **Client-Side Caching**: The webview fetches the workspace file list once (or on demand) and searches it locally.
- [x] **Local Fuzzy Search**: Fast, non-blocking fuzzy search within the webview.
- [x] **Inline File Picker**: Selecting "File Link" from the block menu opens a custom, inline file picker that filters the cached files and inserts the link on selection.
- [x] **No Regression**: Headings, lists, and file links still function as expected.
- [x] **Correct Range Deletion**: Triggering a command accurately removes the typed slash command text (fixing stale closure issues in the TipTap renderer).

## 3. Open Questions / Resolutions

**Q: How should we handle cache invalidation (e.g., when new files are created in the workspace)?**
**A:** For now, the cache is populated once on editor initialization. Dynamic cache invalidation (listening to VS Code file creation/deletion events and updating the cache live) is deferred to a future enhancement.

**Q: Should the file list be pre-fetched on editor load or only when the `/link` or `/file` command is triggered?**
**A:** Pre-fetched on editor load. When the editor reaches the `editorFullyInitialized` state, it immediately requests the workspace files via a `GET_WORKSPACE_FILES` message. This ensures instant, zero-latency search on the very first slash command trigger.

**Q: Which fuzzy search library should be used (e.g., `fuzzysort`) or should we use a simple string matching first?**
**A:** We implemented a custom, lightweight substring matching logic built directly into `fileCache.ts` to keep the dependency footprint small. This provides perfectly adequate performance for standard workspace sizes without requiring external libraries.

**Q: How do we prevent slash commands from leaving leftover query text (like `/head`) in the editor when hitting Enter?**
**A:** The `props.command` callback provided by TipTap's suggestion renderer captures the active text range dynamically as the user types. We resolved this by forcing the `SuggestionList` component to constantly capture the latest `props.command` reference via the `onUpdate` lifecycle hook. This ensures the deletion range always spans the full length of the typed query.

**Q: How do we handle file linking from the block menu without breaking the suggestion API?**
**A:** Programmatically typing `/link ` to re-trigger the suggestion menu was unreliable. Instead, selecting "File Link" now spawns a dedicated, native-feeling inline DOM overlay (an input box and results list) absolutely positioned at the cursor. This UI pulls directly from the `fileCache` and cleans itself up gracefully when dismissed.

## 4. Technical Constraints & Discoveries
- **TipTap Suggestion API Constraint**: The `items()` callback in `@tiptap/suggestion` receives only `{ query }` and **not** the `editor` or `range`. Passing these extra arguments causes silent failures in the plugin.
- **State Closure Bug**: The `props.command` passed to the suggestion render functions captures the `range` dynamically. When passing a callback to a custom UI component, it must continually update (`onUpdate`) to use the latest `props.command`; otherwise, executing the command deletes only the first slash character, leaving leftover query text.
- **Menu Trigger Scope**: The `allow` condition must check `$from.parent.inlineContent` instead of strictly `paragraph`, to allow triggering inside list items, blockquotes, and tables.
