# Spec 025: TipTap 3.22.3 to 3.22.4 Upgrade

**PRD Domains**: `dev-tooling`, `editor-core`

## Context
Maintain the project's dependency health by upgrading TipTap to the latest stable version (3.22.4). This update resolves upstream bugs but introduced serialization regressions in our strict roundtrip requirement, which required local mitigation.

## Upstream Changes (v3.22.4)
According to the official TipTap changelog (released April 18, 2026):

### Features & Maintenance
- **Dependency Resolution**: Fixed peer dependency resolution conflicts during installation that occurred in some complex environments.
- **Maintenance**: General package maintenance and version alignment across the `@tiptap/*` ecosystem.

### Bug Fixes
- **Drag Handle**:
  - Resolved ghost image alignment issues when dragging blocks inside offset layouts.
  - Fixed ghost image behavior for Right-to-Left (RTL) content.
- **Node Views**: Internal fixes to improving event bubbling consistency in some edge cases.

## Local Regressions & Required Changes
Upgrading to 3.22.4 caused several failures in our `test:roundtrip` suite due to changes in how the TipTap Markdown extension handles serialization and whitespace.

### 1. Table Cell Content Merging
- **Problem**: TipTap 3.22.4's markdown serializer now aggressively collapses whitespace and strips `<br>` tags returned by custom `renderMarkdown` functions in tables. This caused multi-line bullets in tables to merge into a single line.
- **Solution**: 
  - Modified `tableMarkdownSerializer.ts` to use a temporary internal marker `§§` (Section Symbol) for block breaks.
  - Updated `markdownSerialization.ts` and the roundtrip test suite to convert `§§` back to `<br>` *after* the TipTap serialization pass but *before* saving to disk.

### 2. Task List Serialization Loss
- **Problem**: Task items (`- [x]`) were being serialized as standard bullets (`- `) because the Markdown extension in 3.22.4 requires explicit mapping or specific parent-child relationships that our custom `TaskItemClipboardFix` wasn't satisfying.
- **Solution**:
  - Explicitly added the `TaskList` extension to the editor configuration.
  - Implemented a custom `renderMarkdown` method in `TaskItemClipboardFix` to manually handle the `[x]` / `[ ]` checked state.

### 3. Case Sensitivity in Tests
- **Problem**: The roundtrip test document (`STRESS_TEST_DOC.md`) used `<mark>Highlight</mark>`, but the test expected lowercase `<mark>highlight</mark>`. 3.22.4's serializer preserves tag casing differently than previous versions.
- **Solution**: Standardized the test suite to be case-insensitive for highlight tags and updated the expected capitalized string.

## Success Criteria
- [x] All 23 `@tiptap/*` packages updated to `3.22.4`.
- [x] `npm run test:roundtrip` passing (11/11 tests).
- [x] Lossless preservation of multi-line table cells.
- [x] Lossless preservation of task list states.
