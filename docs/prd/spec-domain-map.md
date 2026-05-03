# Spec Domain Mapping

This file provides a legacy mapping from existing spec folders to PRD domains. It is intended to support PRD generation for older spec files that do not yet include inline `**PRD Domains**:` metadata.

## Mapping Table

| Spec Folder | PRD Domains |
|---|---|
| `specs/archive/001-default-markdown-viewer/` | `configuration`, `editor-core` |
| `specs/archive/002-lossless-load-save-check/` | `editor-core` |
| `specs/archive/003-plugin-system/` | `plugin-system` |
| `specs/archive/004-scroll-regression-fix/` | `editor-core` |
| `specs/archive/005-copilot-integration-and-ai-refine/` | `ai-features`, `editor-core` |
| `specs/archive/006-BUG-viewer-prompt-persistence/` | `configuration`, `editor-core` |
| `specs/archive/007-add-frontmatter-details/` | `frontmatter`, `editor-core` |
| `specs/archive/008-view-frontmatter-button/` | `frontmatter`, `editor-core` |
| `specs/archive/009-versioned-releases/` | `dev-tooling` |
| `specs/archive/010-llm-provider-selection/` | `ai-features`, `configuration` |
| `specs/archive/011-image-ai-ask/` | `ai-features`, `images` |
| `specs/archive/012-about-editor/` | `dev-tooling` |
| `specs/archive/013-pandoc-bullet-newlines/` | `tables`, `export` |
| `specs/archive/014-navigation-panel/` | `navigation` |
| `specs/archive/015-graceful-copilot-fallback/` | `ai-features`, `configuration` |
| `specs/archive/016-attachment_image_config/` | `images`, `configuration` |
| `specs/archive/017-system_config/` | `configuration` |
| `specs/archive/019-html-br-optimization/` | `export` |
| `specs/archive/020-file-drag-drop/` | `editor-core`, `images` |
| `specs/archive/021-drawio-double-click/` | `images`, `drawio` |
| `specs/archive/022-premium-editor-features-ai-refinements/` | `ai-features`, `editor-core` |
| `specs/archive/023-knowledge-graph-phase1/` | `knowledge-graph` |
| `specs/archive/024-fluxflow-config-folder/` | `configuration`, `knowledge-graph` |
| `specs/archive/025-tiptap-3.22.3-3.22.4-update/` | `dev-tooling`, `editor-core` |
| `specs/archive/026-slash-command-refactor/` | `slash-commands`, `editor-core` |
| `specs/archive/027-graph-bug-fixes/` | `knowledge-graph`, `ai-features` |
| `specs/archive/029-minify-tables/` | `tables`, `export` |
| `specs/archive/030-compression-enhancement/` | `tables`, `export` |
| `specs/archive/031-remove-editor-bandaids/` | `dev-tooling`, `editor-core` |
| `specs/archive/032-webview-modernization/` | `dev-tooling`, `editor-core` |
| `specs/archive/033-table-cell-bullet-serialization/` | `tables`, `editor-core` |
| `specs/034-file-image-slash-cmd/` | `slash-commands`, `images` |
| `specs/035-image-context-menu/` | `images`, `editor-core` |
| `specs/036-test-suite-reorganization/` | `dev-tooling` |

## Notes

- New specs should include inline `**PRD Domains**:` metadata in the header for automatic updates.
- Legacy specs are supported through this mapping until they are normalized.
