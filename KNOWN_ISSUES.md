# Known Issues

> **Maintained by:** All contributors
> **Tests:** `src/__tests__/webview/knownIssues.test.ts`
> **Convention:** Each issue has a test. ✕ = test confirms bug, ✓ = test passes (UI-only bug)

---

## BUG-A: Ordered list nested bullets not editable

| Field | Value |
|-------|-------|
| Priority | Medium |
| Test status | ✓ passes (headless) — bug is visual/interaction only |
| Confidence to fix | High |

**Symptom:** When an ordered list has nested unordered bullets, the bullets are not editable.

**Root cause:** ProseMirror renders the nested `<ul>` correctly, but the DOM interaction layer (possibly CSS or `contentEditable` attribute inheritance) prevents the user from placing the cursor inside nested list items in certain configurations. The headless test confirms the schema is correct.

**Fix:** Inspect CSS for nested list items inside ordered lists. Check if any `pointer-events`, `user-select`, or `contenteditable` override is blocking interaction. May also be a ListKit configuration issue with `nested: true`.

---

## BUG-B1: Editor still editable while Insert Link dialog is open

| Field | Value |
|-------|-------|
| Priority | Medium |
| Test status | ✕ FAILING — confirmed |
| Confidence to fix | High |

**Symptom:** When text is selected and user right-clicks → Insert Link, the editor remains editable behind the modal. Expected: editor should be dimmed and non-interactive (like image hover overlay).

**Root cause:** `showLinkDialog()` in `src/webview/features/linkDialog.ts` never calls `editor.setEditable(false)`. The overlay exists but has no backdrop blocking editor interaction.

**Fix:** In `showLinkDialog()`: call `editor.setEditable(false)` and add a semi-transparent backdrop div. In `hideLinkDialog()`: call `editor.setEditable(true)`. Reuse the darkening pattern from the image hover overlay.

---

## BUG-B2: File link insertion replaces selected text (data loss)

| Field | Value |
|-------|-------|
| Priority | High |
| Test status | ✓ passes (test uses direct mark API, not dialog flow) |
| Confidence to fix | High |

**Symptom:** When text is selected → Insert Link → File mode → pick a file, the filename replaces the selected text. Data loss.

**Root cause:** In `linkDialog.ts` line ~342, the file click handler sets `textInput.value = formatFileLinkLabel(fileResult.filename)` unconditionally. When text was already selected, this overwrites it.

**Fix:** Add a guard: only set `textInput.value` when `textInput.value` is empty (no text was selected). If text is selected, keep it and only update the URL field.

```typescript
// In linkDialog.ts file click handler:
if (textInput && !textInput.value.trim()) {
  textInput.value = formatFileLinkLabel(fileResult.filename);
}
```

---

## BUG-B3: Link text characters lost on right side (intermittent)

| Field | Value |
|-------|-------|
| Priority | Medium |
| Test status | ✓ passes (not reproducible in headless) |
| Confidence to fix | Low |

**Symptom:** Some characters on the right side of displayed link text are lost on save, appearing after the link construct instead.

**Root cause:** Likely a mark boundary issue during markdown serialization. When TipTap serializes the link mark, the boundary detection (`getMarkRange`) may shorten the range by a character or two if there's whitespace or special characters at the boundary. Could also be related to `findNearestTextRange` in `applyLinkAtRange`.

**Fix:** Debug by adding logging to `applyLinkAtRange` when range doesn't match exactly. Check if `findNearestTextRange` returns a shorter range than expected.

---

## BUG-B4: Next character typed after link gets included in link

| Field | Value |
|-------|-------|
| Priority | High |
| Test status | ✕ FAILING — confirmed (2 tests) |
| Confidence to fix | Medium |

**Symptom:** After pasting/inserting a link, the next character typed appears inside the link text instead of after it. E.g., `[example](url)` + type "X" → `[exampleX](url)` instead of `[example](url)X`.

**Root cause:** TipTap's Link extension sets `inclusive: false` on the mark, but when content is inserted via `setContent` with markdown, the cursor ends up at a position where the link mark is still "storedMarks" active. The mark doesn't properly exit. The `exitable` option may not be configured, or ProseMirror's storedMarks aren't cleared at the mark boundary.

**Fix:** Ensure the Link extension has `exitable: true` configured (TipTap v3 option). Alternatively, add a custom `onSelectionUpdate` handler that clears `storedMarks` when cursor moves past a link boundary.

```typescript
Link.configure({
  openOnClick: false,
  // ... existing config
}).extend({
  // Ensure inclusive is false and exitable is true
  inclusive: false,
  exitable: true,
})
```

---

## BUG-B5: Links to .md files open in VS Code text editor

| Field | Value |
|-------|-------|
| Priority | Medium |
| Test status | ✓ passes (placeholder — needs extension-side test) |
| Confidence to fix | High |

**Symptom:** Clicking a markdown link to a `.md` file opens it in VS Code's built-in text editor instead of the WYSIWYG markdown editor.

**Root cause:** `handleOpenFileLink` in `src/editor/handlers/fileHandlers.ts` line ~516 uses `vscode.workspace.openTextDocument + showTextDocument` for all non-image files. This always opens in the default text editor.

**Fix:** For `.md` files, use `vscode.commands.executeCommand('vscode.openWith', fileUri, 'gptAiMarkdownEditor.editor')` to open with our custom editor provider.

```typescript
if (fileExtension === '.md') {
  await vscode.commands.executeCommand('vscode.openWith', fileUri, 'gptAiMarkdownEditor.editor');
} else {
  const doc = await vscode.workspace.openTextDocument(fileUri);
  await vscode.window.showTextDocument(doc);
}
```

---

## BUG-C1: Indented table after numbered list (acceptable)

| Field | Value |
|-------|-------|
| Priority | Low (acceptable) |
| Test status | ✓ passes — documented behavior |
| Confidence to fix | N/A |

**Symptom:** An indented table after a numbered list item gets an extra blank line inserted on save.

**Status:** Acceptable behavior. The content is preserved; only whitespace formatting changes.

---

## BUG-C2: Table column copy-paste puts header in all cells

| Field | Value |
|-------|-------|
| Priority | Medium |
| Test status | ✓ passes (pasteIntoCells works correctly in isolation) |
| Confidence to fix | Medium |

**Symptom:** Selecting all cells in column A → copy → paste into column B → header cell value appears in ALL cells of column B.

**Root cause:** `pasteIntoCells()` itself works correctly row-by-row (confirmed by test). The bug is likely in how the clipboard data is constructed during the copy operation. When a `CellSelection` spanning a column is serialized to TSV, the selection may not properly capture each row's individual cell content — possibly serializing only the header text for all rows.

**Fix:** Debug `getSelectedTableMatrix()` — verify it returns the correct per-row values when a column selection is active. The `CellSelection` may iterate cells differently than expected. Also check `serializeTableMatrix` for proper row iteration.

---

## BUG-D: Empty doc placeholder missing on non-first lines

| Field | Value |
|-------|-------|
| Priority | Low |
| Test status | ✓ passes (DOM classes are applied; bug is CSS-only) |
| Confidence to fix | High |

**Symptom:** New/empty files show placeholder only on the first line. Each empty line should show a placeholder.

**Root cause:** The Placeholder extension correctly applies `is-empty` class to all empty paragraphs (`showOnlyCurrent: false` is set). However, the CSS in `editor.css` line ~1792 uses `.ProseMirror p.is-editor-empty:first-child::before` which only targets the first child. The `.is-empty::before` rule at line ~504 uses `content: attr(data-placeholder)` but the `data-placeholder` attribute may not be set on non-first paragraphs.

**Fix:** The TipTap Placeholder extension normally handles this with `showOnlyCurrent: false`. Verify the `data-placeholder` attribute is present on each empty `<p>`. If not, configure Placeholder with a per-node placeholder function. See: https://tiptap.dev/docs/editor/extensions/functionality/placeholder

---

## BUG-E: Cannot insert line between adjacent tables

| Field | Value |
|-------|-------|
| Priority | Medium |
| Test status | ✓ passes (programmatic insertion works) |
| Confidence to fix | Medium |

**Symptom:** User cannot click between two adjacent tables to insert a new paragraph. There's no visual affordance for the gap.

**Root cause:** GapCursor works programmatically (confirmed by test), but there's no visual "click target" between tables. The user sees two tables touching with no clickable space. The `ImageEnterSpacing` extension handles images but doesn't have table-specific gap rendering.

**Fix:** Add a visual affordance between adjacent block nodes (tables, code blocks). Options:
1. CSS-based hover line between tables (like Notion)
2. "+" button that appears between block nodes
3. Extend `ImageEnterSpacing` to also handle table gaps

---

## BUG-F: Obsidian checkbox paste loses bold formatting

| Field | Value |
|-------|-------|
| Priority | Low |
| Test status | ✕ FAILING — confirmed (2 tests) |
| Confidence to fix | High |

**Symptom:** Pasting from Obsidian, checkboxes render as raw `<input>` elements and bold formatting is lost. E.g., `<strong>Bug</strong>` becomes plain text "Bug".

**Root cause:** The `taskListItem` turndown rule in `src/webview/utils/pasteHandler.ts` extracts text via `node.textContent` or `contentDiv.textContent`, which strips all HTML formatting. The `<strong>` tags inside `<li>` are lost.

**Fix:** Instead of using `.textContent`, use turndown's built-in content conversion for the list item's child nodes. Replace the `text` extraction with:
```typescript
// Instead of:
text = contentDiv.textContent?.trim() || '';
// Use turndown to convert the inner HTML:
text = turndown.turndown(contentDiv.innerHTML).trim();
```
Or use the `_content` parameter that turndown already passes to the replacement function, which contains the already-converted inner markdown.

---

## BUG-G: Overall copy-paste robustness (medium priority)

| Field | Value |
|-------|-------|
| Priority | Medium |
| Test status | No dedicated test — needs refactoring audit |
| Confidence to fix | Medium |

**Symptom:** Copy-pasting into the editor from various sources is generally buggy. Multiple bandaids exist.

**Root cause:** The paste pipeline has multiple layers: `clipboardHandling.ts` → `pasteHandler.ts` → TipTap's built-in paste handling. These layers sometimes conflict or miss edge cases.

**Fix:** Refactoring needed. Consolidate paste handling into a single pipeline. Move extension-specific paste handling into `addProseMirrorPlugins` within each extension (per AGENTS.md refactoring roadmap).

---

## BUG-H: Search next/prev buttons don't navigate

| Field | Value |
|-------|-------|
| Priority | Medium |
| Test status | ✓ passes (commands work; bug is UI interaction) |
| Confidence to fix | High |

**Symptom:** When a search is performed, clicking the arrow buttons doesn't jump to next/prev match. In a previous version, this was caused by the search dialog being modal — clicking back into the doc and then arrows would work.

**Root cause:** The `nextSearchResult` and `previousSearchResult` commands in `searchAndReplace.ts` call `editor.commands.focus()` first, then mutate `storage.resultIndex`, then return `false`. Returning `false` means TipTap doesn't dispatch a new transaction, so the plugin's `apply()` method won't re-run to update decorations. The plugin checks `lastResultIndex !== resultIndex` but this comparison only happens on the next transaction. The `editor.commands.focus()` call may steal focus from the search input, but the overlay's `mousedown` handler has `e.preventDefault()` on non-input elements — this may conflict.

**Fix:** Change the commands to return `true` instead of `false`, which tells TipTap to dispatch a transaction and triggers the plugin's `apply()` to re-evaluate decorations. Or explicitly dispatch an empty transaction after updating the index.

```typescript
nextSearchResult: () => ({ editor, tr, dispatch }) => {
  const { results, resultIndex } = editor.storage.searchAndReplace;
  editor.storage.searchAndReplace.resultIndex = results.length
    ? (resultIndex + 1) % results.length
    : 0;
  if (dispatch) dispatch(tr);
  return true;
},
```
