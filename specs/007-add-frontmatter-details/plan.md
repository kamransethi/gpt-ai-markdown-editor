# Implementation Plan: Collapsible Front Matter Panel

**Branch**: `007-add-frontmatter-details` | **Status**: ✅ COMPLETE | **Spec**: [spec.md](spec.md)

## Summary

Atom node (`frontmatterBlock`) stores YAML in `attrs.yaml`. NodeView renders collapsible header + read-only `<pre><code>` with highlight.js syntax coloring. Full round-trip: extract on load via `injectFrontmatterBlock()`, serialize on save via `restoreFrontmatter()` (trims leading newlines). Toolbar button toggles visibility.

## Stack

**Tech**: TypeScript 5.3, Node.js 18+, TipTap 3.x  
**Key deps**: `@tiptap/core`, `highlight.js` (YAML module), `js-yaml` (validation)  
**Tests**: Jest + jsdom, all 992 tests pass (zero regressions)

## Phases

**Phase 1**: TipTap atom node + NodeView, basic toggle  
- Files: `src/webview/extensions/frontmatterPanel.ts` (CREATE), `src/webview/editor.ts` (MODIFY)  
- Tests: 6 unit tests (node schema, DOM rendering, toggle)

**Phase 2**: Highlight.js syntax highlighting + CSS styling  
- Files: `src/webview/editor.css` (MODIFY)  
- Tests: 3 integration tests (rendering, theme switching)

**Phase 3**: Load/save integration + toolbar button  
- Files: `src/webview/editor.ts` (MODIFY: injectFrontmatterBlock, restoreFrontmatter), `src/extension.ts` (MODIFY: toolbar)  
- Tests: 2 integration tests (serialization, toolbar)

## Files to Modify/Create

| File | Action | Purpose |
|------|--------|---------|
| `src/webview/extensions/frontmatterPanel.ts` | CREATE | Atom node + NodeView for front matter block |
| `src/webview/editor.ts` | MODIFY | Initialize node, inject/sync on load/save |
| `src/webview/editor.css` | MODIFY | Panel styling (spacing, colors, fonts) |
| `src/extension.ts` | MODIFY | Toolbar button for toggle |
| `src/__tests__/webview/frontmatterPanel.test.ts` | CREATE | 18 tests (node, DOM, toggle, highlight) |

## Key Risks & Mitigations

| Risk | Cause | Mitigation |
|------|-------|-----------|
| **ProseMirror breaks with hidden contentDOM** | Display: none breaks rendering | Use atom node (no children, no contentDOM) + manual DOM |
| **Nested child nodes fail schema validation** | YAML stored as children | Store YAML in node `attrs` instead |
| **Extra newlines on save** | renderMarkdown() returns '' | Trim leading newlines in restoreFrontmatter() |
| **Events stolen by ProseMirror** | Clicks on header consumed | Add `stopPropagation()` on mousedown + click |

---
