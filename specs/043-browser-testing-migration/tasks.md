# Tasks: Browser-First Testing Migration

**Input**: `specs/043-browser-testing-migration/plan.md` + `spec.md`  
**Branch**: `043-browser-testing-migration`

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other [P] tasks in the same phase
- **[US1]** = User Story 1 (Reliable Feature Verification)
- **[US2]** = User Story 2 (Regression-Safe TipTap Updates)
- **[US3]** = User Story 3 (Visual & Layout Regression Detection)

---

## Phase 1: Harness & Config Lock (Blocking prerequisite)

**Purpose**: Build the foundation all specs depend on. Nothing in Phase 2+ can start until these pass.

- [ ] T001 Create `src/__tests__/playwright/harness/full-editor.ts` — full-extension harness with `window.editorAPI` (isReady, setMarkdown, getMarkdown, runCommand, getActiveMarks, getSelectionCoords, focusCell, insertText, indentBulletLine, dedentBulletLine) and `window.spellAPI` (isReady, isWorkerReady, setMarkdown, getSpellErrorWords, getSuggestions, addToDictionary, removeFromDictionary) — imports all production extensions: StarterKit, Markdown, Table, TableKit, ListKit, Bold, Italic, Underline, Strike, Code, Highlight, TextStyle, TextColor, Heading, Blockquote, HorizontalRule, CodeBlockShiki, Link, CustomImage, MermaidExtension, SpellCheck, SearchAndReplace, TabIndentation, TableBulletListSmart, SlashCommand, CommandRegistry, TableOfContents, FrontmatterPanel, GitHubAlerts, TaskItemClipboardFix, OrderedListMarkdownFix, ImageBoundaryNav, AiExplain
- [ ] T002 Create `src/__tests__/playwright/harness/full-editor.html` — host page that loads `full-editor.js`; includes TipTap CSS, editor container `#editor`, meta bar `#editor-meta`, and status div `#status`
- [ ] T003 Modify `scripts/build-playwright-harness.js` — add `full-editor.ts` as third esbuild entry point alongside `editor-harness.ts` and `spell-harness.ts`
- [ ] T004 Create `src/__tests__/playwright/helpers/index.ts` — shared test helpers: `FULL_HARNESS_URL`, `waitForEditor(page, timeout?)`, `setContent(page, md)`, `getContent(page)`, `getActiveMarks(page)`, `runEditorCommand(page, name, ...args)`, `waitForContextMenu(page)`, `clickContextMenuItem(page, label)`
- [ ] T005 Modify `playwright.config.ts` — add `projects` array: project `smoke` with `grep: /@smoke/` and `timeout: 30_000`; project `release` (default) with no grep filter and `timeout: 60_000`; keep existing `webServer` config unchanged; update `testMatch` to include new spec files

---

## Phase 2: High-Priority Specs

**Purpose**: Cover the highest-complexity domains (Editor Core, Toolbar, Tables, Search, Images, Links). Independent test criterion: Run `npx playwright test editor-core.spec.ts` and bold toggle test passes.

### User Story 1 — Reliable Feature Verification

- [ ] T006 [US1] Create `src/__tests__/playwright/editor-core.spec.ts` with tests:
  - `@smoke` bold toggle via Ctrl+B — applies mark, Ctrl+B again removes mark
  - `@smoke` italic toggle via Ctrl+I
  - Underline via Ctrl+U
  - Strikethrough applies `.strikethrough` CSS class
  - Inline code applies `<code>` node
  - H1–H6 via toolbar runCommand `toggleHeading` with level 1–6 — verifies `<h1>`…`<h6>` in DOM
  - H1–H2 via `#` and `##` markdown shortcut (type at start of line)
  - Blockquote via toolbar
  - Horizontal rule via toolbar
  - `@smoke` undo single change — Ctrl+Z restores previous content
  - Redo — Ctrl+Y restores undone change
  - Undo chain — three changes then three undos returns to original
  - `@smoke` roundtrip — `setMarkdown(md)` → `getMarkdown()` returns identical content for heading, list, table, code
  - Scroll stability — setMarkdown with 100 headings, scroll to bottom, content still present
  - Plain text paste — pasted text appears in editor
  - `@smoke` hard break — Shift+Enter inside paragraph adds `<br>` visible in DOM

- [ ] T007 [P] [US1] Create `src/__tests__/playwright/bubble-menu.spec.ts` with tests:
  - `@smoke` bubble menu appears on text selection
  - Bubble menu disappears on click outside
  - Bold button in bubble menu applies mark (verify `<strong>` in DOM)
  - Italic button applies mark
  - Underline button applies mark
  - Strikethrough button applies mark
  - Inline code button applies mark
  - Highlight button applies `.highlight` class
  - Text color button opens color picker
  - Link button opens link dialog
  - H1–H6 picker buttons each set heading node
  - Align left, center, right buttons apply text-align style
  - `@smoke` AI refine button visible on text selection
  - Bullet list button inserts `<ul>` node
  - Ordered list button inserts `<ol>` node
  - Task list button inserts task item node
  - Table-specific buttons (add/remove row, add/remove col) visible when cursor in table
  - Table-specific buttons hidden when cursor outside table

- [ ] T008 [P] [US1] [US2] Create `src/__tests__/playwright/tables.spec.ts` with tests:
  - `@smoke` create table via toolbar runCommand `insertTable` — verifies `<table>` in DOM
  - Create table via markdown input `|a|b|\n|---|---|\n|c|d|`
  - `@smoke` Tab moves to next cell (Tab in first cell, cursor moves to second)
  - Shift+Tab moves to previous cell
  - Tab from last cell adds new row
  - `@smoke` Shift+Enter inserts hard break in cell — `<br>` visible inside `<td>`
  - Two hard breaks in same cell — two `<br>` nodes present
  - Roundtrip hard break — `getMarkdown()` contains `<br>` after Shift+Enter
  - `@smoke` bullet list in cell — insert via runCommand `toggleBulletList`, `<ul>` present inside `<td>`
  - Nested bullet depth-1 — Tab in bullet, `<ul><ul>` present
  - Nested bullet depth-2 — second Tab, three levels present
  - Ordered list in cell — no embedded newlines in getMarkdown output
  - Bold mark in cell — `<strong>` inside `<td>` after Ctrl+B
  - Italic mark in cell
  - Highlight mark in cell — `.highlight` class inside `<td>`
  - Task item in cell — checkbox visible, checked state preserved
  - Mixed content (text + bullet + break in same cell) — correct roundtrip
  - `@smoke` right-click in table opens context menu
  - Table context menu: "Add row above" — row count increases
  - Table context menu: "Add row below"
  - Table context menu: "Remove row"
  - Table context menu: "Add column left"
  - Table context menu: "Add column right"
  - Table context menu: "Remove column"
  - Table context menu: "Align left", "Align center", "Align right" — `text-align` class on `<td>`
  - Roundtrip fidelity — load fixture with bullets+breaks+marks, `getMarkdown()` → `setMarkdown()` → `getMarkdown()` must be identical

- [ ] T009 [P] [US1] [US3] Create `src/__tests__/playwright/search.spec.ts` with tests:
  - `@smoke` search opens via keyboard shortcut (Ctrl+F or configured shortcut)
  - Search opens via toolbar button
  - Query highlights all instances in DOM (`.search-highlight` class)
  - Next button moves to next match (`.search-current` class moves)
  - Previous button cycles back
  - Match count indicator shows correct number
  - Replace single — one instance replaced, others still highlighted
  - Replace all — all instances replaced
  - Case-sensitive toggle — unchecked matches both cases; checked matches exact case only
  - Regex mode toggle — regex query matches pattern
  - Empty query — no highlights, no errors
  - Escape closes overlay and removes highlights
  - Close button closes overlay and removes highlights

- [ ] T010 [P] [US1] Create `src/__tests__/playwright/images.spec.ts` with tests:
  - `@smoke` right-click image opens context menu — `.context-menu` visible in DOM
  - Context menu: "Edit alt text" item present
  - Context menu: "Edit alt text" opens dialog with alt text field
  - Context menu: "Rename file" item present
  - Context menu: "Rename file" opens rename dialog
  - Context menu: "Resize" item present
  - Context menu: "Copy path" item present (fires message, no crash)
  - Context menu: "Open externally" item present (fires message, no crash)
  - `@smoke` Context menu: "AI explain" item present
  - Context menu: "AI explain" opens explain panel in loading state
  - Draw.io: `.drawio.svg` image recognized — context menu shows "Open diagram" not "Resize"
  - Draw.io: double-click dispatches `openDiagram` message (verify via `window.__lastMessage`)
  - Rename dialog: dialog renders with filename input
  - Large image confirmation dialog: appears for images > size threshold

- [ ] T011 [P] [US1] Create `src/__tests__/playwright/links.spec.ts` with tests:
  - `@smoke` link dialog opens from toolbar button
  - Insert external URL via dialog — `<a href="...">` present in DOM
  - Insert internal file path via dialog — link node contains file path
  - `@smoke` `[[` prefix triggers autocomplete dropdown
  - Typing after `[[` narrows autocomplete suggestions
  - Pressing Enter selects autocomplete item — link inserted
  - Click existing link opens dialog pre-populated with URL
  - Remove link — link mark removed, text content remains

---

## Phase 3: Medium-Priority Specs

**Purpose**: Cover Settings, AI panels, Slash Commands, Frontmatter, Mermaid, Code Blocks, Navigation. Independent test criterion: each spec can run in isolation with `npx playwright test <spec>.spec.ts`.

- [ ] T012 [P] [US1] Create `src/__tests__/playwright/settings-panel.spec.ts` with tests:
  - `@smoke` settings panel opens via toolbar gear icon
  - AI provider section renders (heading present)
  - Spell check toggle is present and clickable
  - Toggling spell check off — wait, re-check `.spell-error` decorations absent
  - Toggling spell check on — decorations reappear
  - Theme selector is present

- [ ] T013 [P] [US1] Create `src/__tests__/playwright/ai-chat.spec.ts` with tests:
  - `@smoke` chat panel opens via toolbar or sidebar button
  - Message input field is present and accepts text
  - Send button is present and clickable (no crash without provider)
  - Response area is present
  - No provider: error message renders inline (no JS console errors)
  - Knowledge graph chat toggle present

- [ ] T014 [P] [US1] Create `src/__tests__/playwright/ai-actions.spec.ts` with tests:
  - `@smoke` select text; AI refine toolbar button/menu appears
  - AI explain button visible in toolbar
  - Click AI explain: panel opens (loading state visible or error state)
  - `@smoke` right-click image: "AI explain" item in context menu
  - Click "AI explain" on image: explain panel opens
  - No provider configured: each AI action shows error message, no JS crash

- [ ] T015 [P] [US1] Create `src/__tests__/playwright/slash-commands.spec.ts` with tests:
  - `@smoke` `/` at start of line opens command palette
  - Typing after `/` narrows suggestions
  - "Heading 1" command inserts `<h1>` node
  - "Heading 2" command inserts `<h2>` node
  - "Code block" command inserts `<pre><code>` node
  - "Table" command inserts `<table>` node
  - "Bullet list" command inserts `<ul>` node
  - "Task list" command inserts task item node
  - "Blockquote" command inserts `<blockquote>` node
  - "Horizontal rule" command inserts `<hr>` node
  - Escape closes palette without insertion

- [ ] T016 [P] [US1] [US3] Create `src/__tests__/playwright/frontmatter.spec.ts` with tests:
  - Document with YAML frontmatter shows "VIEW FRONTMATTER" button in meta bar
  - Document without frontmatter hides the button
  - Click "VIEW FRONTMATTER" — frontmatter modal opens
  - Modal shows key-value fields for frontmatter
  - Edit a field, save — `getMarkdown()` includes updated YAML

- [ ] T017 [P] [US1] [US3] Create `src/__tests__/playwright/mermaid.spec.ts` with tests:
  - `@smoke` mermaid fenced block renders as diagram node (not raw `<pre><code>`)
  - Diagram node has `.mermaid` CSS class or data attribute
  - Double-click diagram node opens mermaid editor modal
  - Modal shows source code in textarea
  - Modal save — `getMarkdown()` contains updated mermaid source
  - Modal cancel — `getMarkdown()` unchanged

- [ ] T018 [P] [US1] [US3] Create `src/__tests__/playwright/code-blocks.spec.ts` with tests:
  - `@smoke` fenced code block renders as `.code-block-highlighted` node (not raw text)
  - Language dropdown present in code block
  - Changing language — language label updates in DOM
  - Copy button present in code block
  - Copy button click — no crash; clipboard access attempted
  - Shiki highlighting: `<span>` with color class inside code block for `typescript` language
  - GitHub Alert `[!NOTE]` — renders `.github-alert` or `.github-alert-note` CSS class
  - GitHub Alert `[!WARNING]` — renders warning class
  - GitHub Alert `[!IMPORTANT]` — renders important class
  - GitHub Alert `[!TIP]` — renders tip class
  - GitHub Alert `[!CAUTION]` — renders caution class

- [ ] T019 [P] [US1] Create `src/__tests__/playwright/navigation.spec.ts` with tests:
  - `@smoke` TOC panel shows headings after setting content with H1, H2, H3
  - TOC panel item count matches heading count in document
  - Click TOC item — editor scroll position changes (or focus moves to heading)
  - Add new heading via editor — TOC updates in real time

---

## Phase 4: Low-Priority Specs + FR-008 Migration

**Purpose**: Complete coverage of low-priority domains and delete FR-008 jsdom test files.

- [ ] T020 [P] [US1] Create `src/__tests__/playwright/drawio.spec.ts` with tests:
  - `.drawio.svg` image right-click context menu — shows "Open diagram" or equivalent item
  - `.drawio.svg` image — does NOT show "Resize" item (wrong type)
  - Double-click `.drawio.svg` image — dispatches `openDiagram` to host (verify via captured message)

- [ ] T021 [P] [US1] Create `src/__tests__/playwright/plugin-system.spec.ts` with tests:
  - Register a test command via `CommandRegistry.registerCommand()` — command appears in slash menu
  - Execute registered command — produces editor output
  - Plugin error (command throws) — editor remains functional, no crash

- [ ] T022 Create `src/__tests__/playwright/global-state.spec.ts` (sequential, `workers: 1`) with tests:
  - Add word to dictionary via `window.spellAPI.addToDictionary()` — `.spell-error` decoration removed globally
  - Remove word from dictionary via `window.spellAPI.removeFromDictionary()` — decoration reappears
  - AI provider switch (if settings panel has multiple providers) — subsequent panel shows new provider selected
  - Config panel change persists after `setMarkdown('')` reset cycle

### FR-008 jsdom Migrations (delete after Playwright replacements verified)

- [ ] T023 Verify `frontmatter.spec.ts` passes (T016), then delete `src/__tests__/extensions/frontmatter/frontmatter.test.ts`
- [ ] T024 Verify `links.spec.ts` passes (T011), then delete `src/__tests__/extensions/links/linkDialog.test.ts`
- [ ] T025 Verify `editor-core.spec.ts` undo tests pass (T006), then delete `src/__tests__/smoke/undo-sync.test.ts`
- [ ] T026 Verify `code-blocks.spec.ts` passes (T018), then delete `src/__tests__/extensions/blocks/codeBlockShikiWithUi.test.ts`
- [ ] T027 Verify `code-blocks.spec.ts` passes (T018), then delete `src/__tests__/extensions/blocks/codeBlockWithUi.test.ts`
- [ ] T028 Modify `src/__tests__/webview/ui/searchOverlay.test.ts` — extract pure-logic (non-DOM, non-decoration) string parsing tests into a separate `searchOverlay.logic.test.ts` file; delete the jsdom + `@tiptap/pm/view` mock portions; verify `npm test` still passes

---

## Dependencies

```
T001 (full-editor.ts)
  └─ T002 (full-editor.html)
       └─ T003 (build script)
            └─ T004 (helpers)
                 └─ T005 (playwright.config.ts)
                      ├─ T006 editor-core    →  T025 (delete undo-sync)
                      ├─ T007 bubble-menu    [P with T006]
                      ├─ T008 tables         [P with T006]
                      ├─ T009 search         [P with T006]  →  T028 (modify searchOverlay)
                      ├─ T010 images         [P with T006]
                      ├─ T011 links          [P with T006]  →  T024 (delete linkDialog)
                      ├─ T012–T019           [P, Phase 3]
                      │    T016 frontmatter  →  T023 (delete frontmatter.test.ts)
                      │    T018 code-blocks  →  T026, T027 (delete codeBlock tests)
                      └─ T020–T022           [P, Phase 4]
```

## Parallel Execution Examples

**Phase 2** (after T005): T006, T007, T008, T009, T010, T011 can all run in parallel — different spec files, no shared state.

**Phase 3** (after Phase 2 harness validates): T012–T019 can all run in parallel.

**Phase 4**: T020, T021, T022 can run in parallel. T023–T028 must run AFTER their respective spec passes.

## Implementation Strategy

1. **MVP (T001–T006)**: Harness + editor-core spec. Delivers US1 independently testable.
2. **High coverage (T007–T011)**: Tables, bubble menu, search, images, links. Highest-ROI specs.
3. **Full coverage (T012–T022)**: Medium + low priority domains.
4. **Migration (T023–T028)**: FR-008 jsdom deletion. Strictly last — only after replacements verified.
