# Implementation Tasks: Remove Editor Bandaids

**Folder**: `specs/031-remove-editor-bandaids/tasks.md`

## Phase 1: Setup

*(No project initialization or setup tasks required for this feature)*

## Phase 2: Foundational

*(No shared dependencies or foundational prerequisites for these independent fixes)*

## Phase 3: Native Image Navigation [US1]

**Goal**: Make image selection and deletion behave naturally without custom two-step lag.
**Independent Test**: Deleting an image takes a single Backspace keypress.

- [x] T001 [US1] Delete custom lag logic by removing `src/webview/extensions/imageEnterSpacing.ts`
- [x] T002 [US1] Unregister the `imageEnterSpacing` extension and register `imageBoundaryNav` in `src/webview/editor.ts`
- [x] T003 [P] [US1] Remove any lingering CSS targeting `.image-selection-highlight` or custom image cursors in `src/webview/editor.css`
- [x] T004 [US1] Create `src/webview/extensions/imageBoundaryNav.ts` to handle inserting an empty paragraph when Enter is pressed at document boundaries near images.
- [x] T005 [US1] Create `src/__tests__/webview/editor-bandaids.test.ts` and write a test verifying single-keystroke image deletion and boundary insertion.

## Phase 4: Fix Greedy Selection in Tables [US2]

**Goal**: Prevent text selection from getting "trapped" inside tables due to drag-handle exclusions.
**Independent Test**: Clicking and dragging text from inside a cell to outside the table works smoothly.

- [x] T006 [US2] Remove explicit `table`, `tr`, `td`, `th` exclusions from the drag handle logic in `src/webview/extensions/draggableBlocks.ts`
- [x] T007 [US2] Write a test in `src/__tests__/webview/editor-bandaids.test.ts` verifying native selection expansion across table boundaries.

## Phase 5: Standardize Bullet Lists in Tables [US6]

**Goal**: Rely on native TipTap bullet list formatting inside tables instead of raw text replacements.
**Independent Test**: Typing "- " inside a table cell creates a native TipTap bullet list node.

- [x] T008 [US6] Delete `src/webview/utils/tableBulletUtils.ts`
- [x] T009 [US6] Delete `src/webview/utils/tableSelectionUtils.ts`
- [x] T010 [US6] Remove all usages and imports of `toggleTableBulletHack` from `src/webview/BubbleMenuView.ts` and replace with standard `toggleBulletList()`
- [x] T011 [US6] Modify `src/webview/editor.ts` (or the relevant extension file if isolated) to configure the `TableCell` extension with `content: 'block+'` so it allows lists.
- [x] T012 [US6] Write a test in `src/__tests__/webview/editor-bandaids.test.ts` verifying native bullet list creation and serialization inside table cells.

## Phase 6: Fix Link "Absorption" [US3]

**Goal**: Prevent text typed immediately after a link from becoming part of the link itself.
**Independent Test**: Typing after a link inserts plain text.

- [ ] T013 [US3] Modify `src/webview/editor.ts` to remove the blanket `inclusive: false` override for the Link extension, ensuring the underlying bug is fixed via proper schema definition or ProseMirror plugins.
- [ ] T014 [US3] Write a test in `src/__tests__/webview/editor-bandaids.test.ts` verifying typing at link boundaries.

## Phase 7: Standardize Blank Line Handling [US4]

**Goal**: Use native paragraph serialization instead of invisible regex post-processing.
**Independent Test**: Adding exactly 3 blank lines persists exactly 3 blank lines across a save/load round-trip.

- [ ] T015 [US4] Remove `data-blank-line` attribute manipulation from `src/webview/extensions/markdownParagraph.ts`
- [ ] T016 [US4] Delete the `normalizeBlankLines` regex replacement logic from `src/webview/utils/markdownSerialization.ts`
- [ ] T017 [US4] Modify `src/webview/extensions/customListItem.ts` (or the relevant list logic) to serialize multiple empty lines inside list items as HTML `<br>` tags to prevent breaking the Markdown parser.
- [ ] T018 [US4] Write a test in `src/__tests__/webview/editor-bandaids.test.ts` verifying a 1:1 roundtrip of consecutive empty lines without regex intervention, and `<br>` serialization in lists.

## Phase 8: Remove Table Unwrapping DOM Hacks [US5]

**Goal**: Use proper TipTap `parseHTML` rules instead of manual DOM walking.
**Independent Test**: Pasting an HTML table containing `<tbody>` parses and renders successfully.

- [ ] T019 [US5] Remove the manual DOM `node.querySelectorAll` and `el.remove()` stripping hacks for `colgroup`, `thead`, `tbody`, and `tfoot` from `src/webview/editor.ts`
- [x] T020 [US5] Delete aggressive `stopPropagation` from global paste handler in `src/webview/features/clipboardHandling.ts`
- [x] T021 [US5] Implement a `parseHTML` rule in `src/webview/editor.ts` (or table extension file) to natively intercept HTML tables from the clipboard instead of manual regex processing.
- [x] T022 [US5] Add logic to detect nested tables during paste. If detected, display an alert to the user warning them about flattened nested tables vs native HTML retention.
- [x] T023 [US5] Create `src/__tests__/webview/paste-handling.test.ts` to verify the warning mechanism and HTML `<tbody>` stripping via `parseHTML`.

## Phase 9: Polish & Cross-Cutting Concerns

- [x] T023 Run the complete regression test suite (`npm test`) to ensure no side effects from removing the workarounds.
- [ ] T024 Run the `stressTestRoundTrip` to verify document data integrity.

## Dependencies

- US1, US2, US3, US4, US5, and US6 are largely independent and can be completed in parallel or in any order.
- Phase 9 (Polish) must run after all functional phases.

## Implementation Strategy

We will deliver these fixes incrementally, verifying the editor feels snappy and behaves like a standard textarea after each bandaid is removed. By relying on TipTap defaults and extensions, we eliminate over 1,000 lines of custom, brittle logic.
