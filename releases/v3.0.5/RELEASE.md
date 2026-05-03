# Release Notes — v3.0.5

Date: 2026-05-03

## Highlights

- Full overhaul of bullet and ordered list handling inside table cells
- TAB/SHIFT+TAB indent cycling for table cell bullets
- Major webview modernization: reactive settings, image placeholders, AST export
- Playwright component test harness — real Chromium tests without VS Code
- TipTap upgraded to 3.22.5

---

## Features

### Table Cell Bullets — Complete Overhaul

Bullet and ordered lists inside GFM table cells now work reliably end-to-end.

- Bullets and ordered lists serialize with `<br>` separators — table structure no longer breaks due to embedded newlines
- `toggleBulletListSmart` adds or removes `- ` prefix on **selected lines only**, not the entire cell
- **TAB** on a bullet line increases indent and cycles marker: `- → + → *`
- **SHIFT+TAB** decreases indent and cycles back: `* → + → -`
- Nested bullets (depth 0/1/2) preserve correct indentation and alternating markers on round-trip
- Blockquotes, GitHub Alerts, and fallback blocks inside table cells also fixed

### Webview Modernization

- Custom dark/light theme infrastructure
- Image placeholders displayed during async load operations
- Reactive settings panel — changes apply live without a webview reload
- AST-based markdown export pipeline for more accurate output
- `BaseOverlay` unified overlay system
- Improved clipboard pipeline

### Slash Commands

- File and image slash commands reuse the existing picker (no duplicate pickers)
- Active file-link entry shows href preview before insertion

### Knowledge Graph

- Enhanced configuration options (embedding model, RAG parameters)
- Improved workspace indexing reliability

---

## Improvements

### TipTap 3.22.5 Upgrade

- Updated from 3.22.4 to 3.22.5
- Optional peer dependency shims added (`@tiptap/extension-collaboration`, `@tiptap/y-tiptap`, `@tiptap/extension-node-range`) for clean builds without warnings

### Test Suite Reorganization

- Tests restructured into a domain-driven architecture across 9 extension domains (blocks, formatting, frontmatter, images, links, mermaid, tables, features, webview UI)
- Test documentation added at `docs/tests/_index.md`

### Playwright Component Tests (New)

- Real Chromium test harness for webview interactions — no VS Code required
- 20 tests covering table bullet load, add, nest, serialize, round-trip, and edge cases
- Run with: `npm run test:playwright`

### Editor Infrastructure

- Removed bandaid fixes; replaced with correct solutions and regression tests
- Table selection reliability improvements
- Granular table compression toggles

---

## Bug Fixes

- Table bullet toggle no longer wraps the entire cell content as one list item
- Tab/Shift+Tab no longer deletes cell content when cursor is on a non-bullet line
- `prefixLen` calculation corrected for Tab/Shift+Tab prefix deletion
- Ordered list markers preserved correctly in table cells across round-trips
- Empty table cells alongside bullet cells remain structurally valid

---

## Build & Release

- vsix: `releases/v3.0.5/gpt-ai-markdown-editor-3.0.5.vsix`
- All release build gates passed: settings persistence (32 tests), round-trip stress test (11 tests), bundle verification
