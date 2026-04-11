# Known Issues

> **Maintained by:** All contributors
> **Tests:** `src/__tests__/webview/knownIssues.test.ts`
> **Convention:** Each issue has a test. ✕ = test confirms bug, ✓ = test passes (UI-only bug)

---

## NEW BUGS:

### ~~BUG-I: File not exposed to GitHub Copilot chat~~ ✅ FIXED


| Field       | Value                                                                                                                 |
| ----------- | --------------------------------------------------------------------------------------------------------------------- |
| Priority    | Medium                                                                                                                |
| Test status | ✓ PASSING — fixed                                                                                                     |
| Resolution  | Active document URI now tracked via `activeWebview.ts`; chat participant uses `stream.reference(docUri)` to expose file; added `getActiveDocumentUri` command for external discovery. Note: VS Code's implicit "active file" context for custom editors remains a platform limitation — users can use `@fluxflow` chat participant or `#file:` references. |


---

## FEATURE REQUESTS:

### ~~FR-1: AI Refine should preserve block quote formatting~~ ✅ IMPLEMENTED


| Field       | Value                                                                                                                 |
| ----------- | --------------------------------------------------------------------------------------------------------------------- |
| Resolution  | System prompt updated to instruct AI not to add block-level markers; `handleAiRefineResult` now detects blockquote/callout/alert ancestor nodes and uses selection-based replacement (`deleteSelection` + `insertContent`) that preserves the parent node context. |

---

### ~~FR-2: Remember last custom refinement command~~ ✅ IMPLEMENTED


| Field       | Value                                                                                                                |
| ----------- | -------------------------------------------------------------------------------------------------------------------- |
| Resolution  | Module-level `lastCustomCommand` variable stores the last custom instruction; textarea is pre-filled on next dialog open. Clears on extension reload. |

---

### ~~FR-3: Better UX for custom refinement dialog shortcuts~~ ✅ IMPLEMENTED


| Field       | Value                                                                                                             |
| ----------- | ----------------------------------------------------------------------------------------------------------------- |
| Resolution  | Keyboard handler moved to `input.addEventListener('keydown')` on the textarea: Enter submits, Shift+Enter allows line breaks, Escape closes. |

---

### FR-4: Selected text context in Copilot (optional)


| Field       | Value                                                                                                                |
| ----------- | -------------------------------------------------------------------------------------------------------------------- |
| Status      | Partial — selected text IS included in the `@fluxflow` chat participant context. ProseMirror positions are tracked. VS Code Copilot API does not currently support showing line ranges for custom editor selections. |

# REVIEWED BUGS:

## BUG-A: Ordered list nested bullets not editable


| Field             | Value                                                |
| ----------------- | ---------------------------------------------------- |
| Priority          | Medium                                               |
| Test status       | ✓ passes (headless) — bug is visual/interaction only |
| Confidence to fix | High                                                 |


**Symptom:** When an ordered list has nested unordered bullets, the bullets are not editable.

**Root cause:** ProseMirror renders the nested `<ul>` correctly, but the DOM interaction layer (possibly CSS or `contentEditable` attribute inheritance) prevents the user from placing the cursor inside nested list items in certain configurations. The headless test confirms the schema is correct.

**Fix:** Inspect CSS for nested list items inside ordered lists. Check if any `pointer-events`, `user-select`, or `contenteditable` override is blocking interaction. May also be a ListKit configuration issue with `nested: true`.

---

## ~~BUG-B1: Editor still editable while Insert Link dialog is open~~ ✅ FIXED


| Field       | Value                                                                                                                 |
| ----------- | --------------------------------------------------------------------------------------------------------------------- |
| Priority    | Medium                                                                                                                |
| Test status | ✓ PASSING — fixed                                                                                                     |
| Resolution  | `showLinkDialog()` now calls `editor.setEditable(false)`, `hideLinkDialog()` restores with `editor.setEditable(true)` |


---

## ~~BUG-B2: File link insertion replaces selected text (data loss)~~ ✅ FIXED


| Field       | Value                                                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Priority    | High                                                                                                                                 |
| Test status | ✓ PASSING — fixed                                                                                                                    |
| Resolution  | File click handler now guards with `if (textInput && !textInput.value.trim())` — only sets filename when no text is already selected |


---

## BUG-B3: Link text characters lost on right side (intermittent)


| Field             | Value                                   |
| ----------------- | --------------------------------------- |
| Priority          | Medium                                  |
| Test status       | ✓ passes (not reproducible in headless) |
| Confidence to fix | Low                                     |


**Symptom:** Some characters on the right side of displayed link text are lost on save, appearing after the link construct instead.

**Root cause:** Likely a mark boundary issue during markdown serialization. When TipTap serializes the link mark, the boundary detection (`getMarkRange`) may shorten the range by a character or two if there's whitespace or special characters at the boundary. Could also be related to `findNearestTextRange` in `applyLinkAtRange`.

**Fix:** Debug by adding logging to `applyLinkAtRange` when range doesn't match exactly. Check if `findNearestTextRange` returns a shorter range than expected.

---

## ~~BUG-B4: Next character typed after link gets included in link~~ ✅ FIXED


| Field       | Value                                                                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Priority    | High                                                                                                                                                          |
| Test status | ✓ PASSING — fixed (2 tests)                                                                                                                                   |
| Resolution  | Extended Link with `inclusive() { return false; }` — the default `inclusive()` returned `this.options.autolink` (true), causing marks to extend at boundaries |


---

## ~~BUG-B5: Links to .md files open in VS Code text editor~~ ✅ FIXED


| Field       | Value                                                                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Priority    | Medium                                                                                                                                                        |
| Test status | ✓ PASSING — fixed                                                                                                                                             |
| Resolution  | `handleOpenFileLink` now checks `fileExtension === '.md'` and uses `vscode.commands.executeCommand('vscode.openWith', fileUri, 'gptAiMarkdownEditor.editor')` |


---

## BUG-C1: Indented table after numbered list (acceptable)


| Field             | Value                          |
| ----------------- | ------------------------------ |
| Priority          | Low (acceptable)               |
| Test status       | ✓ passes — documented behavior |
| Confidence to fix | N/A                            |


**Symptom:** An indented table after a numbered list item gets an extra blank line inserted on save.

**Status:** Acceptable behavior. The content is preserved; only whitespace formatting changes.

---

## BUG-C2: Table column copy-paste puts header in all cells


| Field             | Value                                                  |
| ----------------- | ------------------------------------------------------ |
| Priority          | Medium                                                 |
| Test status       | ✓ passes (pasteIntoCells works correctly in isolation) |
| Confidence to fix | Medium                                                 |


**Symptom:** Selecting all cells in column A → copy → paste into column B → header cell value appears in ALL cells of column B.

**Root cause:** `pasteIntoCells()` itself works correctly row-by-row (confirmed by test). The bug is likely in how the clipboard data is constructed during the copy operation. When a `CellSelection` spanning a column is serialized to TSV, the selection may not properly capture each row's individual cell content — possibly serializing only the header text for all rows.

**Fix:** Debug `getSelectedTableMatrix()` — verify it returns the correct per-row values when a column selection is active. The `CellSelection` may iterate cells differently than expected. Also check `serializeTableMatrix` for proper row iteration.

---

## ~~BUG-D: Empty doc placeholder missing on non-first lines~~ ✅ FIXED


| Field       | Value                                                                                                                                                                                                                                                                                                                                                |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Priority    | Low                                                                                                                                                                                                                                                                                                                                                  |
| Test status | ✓ PASSING — fixed                                                                                                                                                                                                                                                                                                                                    |
| Resolution  | Fixed CSS selector: changed `.ProseMirror p.is-editor-empty:first-child::before` to `.ProseMirror.is-editor-empty > p.is-empty:first-child::before` — the "Start writing..." prompt now only shows for the first paragraph when the entire editor is empty, while the `.is-empty::before` rule with `data-placeholder` handles all other empty lines |


---

## BUG-E: Cannot insert line between adjacent tables


| Field             | Value                                   |
| ----------------- | --------------------------------------- |
| Priority          | Medium                                  |
| Test status       | ✓ passes (programmatic insertion works) |
| Confidence to fix | Medium                                  |


**Symptom:** User cannot click between two adjacent tables to insert a new paragraph. There's no visual affordance for the gap.

**Root cause:** GapCursor works programmatically (confirmed by test), but there's no visual "click target" between tables. The user sees two tables touching with no clickable space. The `ImageEnterSpacing` extension handles images but doesn't have table-specific gap rendering.

**Fix:** Add a visual affordance between adjacent block nodes (tables, code blocks). Options:

1. CSS-based hover line between tables (like Notion)
2. "+" button that appears between block nodes
3. Extend `ImageEnterSpacing` to also handle table gaps

---

## ~~BUG-F: Obsidian checkbox paste loses bold formatting~~ ✅ FIXED


| Field       | Value                                                                                                                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Priority    | Low                                                                                                                                                                             |
| Test status | ✓ PASSING — fixed (2 tests)                                                                                                                                                     |
| Resolution  | Changed `taskListItem` turndown rule to use `turndown.turndown(contentDiv.innerHTML)` instead of `contentDiv.textContent` — preserves bold, italic, and other inline formatting |


---

## BUG-G: Overall copy-paste robustness (medium priority)


| Field             | Value                                       |
| ----------------- | ------------------------------------------- |
| Priority          | Medium                                      |
| Test status       | No dedicated test — needs refactoring audit |
| Confidence to fix | Medium                                      |


**Symptom:** Copy-pasting into the editor from various sources is generally buggy. Multiple bandaids exist.

**Root cause:** The paste pipeline has multiple layers: `clipboardHandling.ts` → `pasteHandler.ts` → TipTap's built-in paste handling. These layers sometimes conflict or miss edge cases.

**Fix:** Refactoring needed. Consolidate paste handling into a single pipeline. Move extension-specific paste handling into `addProseMirrorPlugins` within each extension (per AGENTS.md refactoring roadmap).

---

## ~~BUG-H: Search next/prev buttons don't navigate~~ ✅ FIXED


| Field       | Value                                                                                                                                                                                                               |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Priority    | Medium                                                                                                                                                                                                              |
| Test status | ✓ PASSING — fixed                                                                                                                                                                                                   |
| Resolution  | Changed `nextSearchResult` and `previousSearchResult` commands to accept `tr` and `dispatch` params, call `if (dispatch) dispatch(tr)`, and return `true` — removed `editor.commands.focus()` call that stole focus |
