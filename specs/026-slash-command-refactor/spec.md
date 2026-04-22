# Spec: Slash Command Refactor & Performance Optimization

## 1. Outcome
Refactor the current slash command architecture to support multiple providers (blocks, file links, etc.) through a unified registry and shared UI components. Improve performance for file linking by implementing client-side caching and local fuzzy search within the webview.

## 2. Success Criteria
- [ ] **Unified Registry**: A single TipTap extension handles all slash command triggers (e.g., `/`).
- [ ] **Shared UI**: Command menus use a common UI component for rendering, selection, and keyboard navigation.
- [ ] **Client-Side Caching**: The webview fetches the workspace file list once (or on demand) and searches it locally.
- [ ] **Local Fuzzy Search**: Fast, non-blocking fuzzy search within the webview.
- [ ] **No Regression**: Headings, lists, and file links still function as expected.

## 3. Open Questions
- [ ] How should we handle cache invalidation (e.g., when new files are created in the workspace)?
- [ ] Should the file list be pre-fetched on editor load or only when the `/link` or `/file` command is triggered?
- [ ] Which fuzzy search library should be used (e.g., `fuzzysort`) or should we use a simple string matching first?
