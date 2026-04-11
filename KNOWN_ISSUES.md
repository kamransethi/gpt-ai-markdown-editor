# Known Issues

> **Maintained by:** All contributors
> **Convention:** See METHOD in `.specify/memory/constitution.md` § XIII
> **Folder Structure:** Each issue has `specs/NNN-issue-name/` with spec.md, test.ts, IMPLEMENTATION.md

---

## OPEN 🔴

### BUG-FR1-PARTIAL: AI Refine Corrupts Code Blocks and Other Constructs


| Field      | Value                                                                                                                                                                                                |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Category   | Bug                                                                                                                                                                                                  |
| Priority   | High                                                                                                                                                                                                 |
| Status     | 🔴 OPEN — Needs investigation                                                                                                                                                                        |
| Problem    | FR-1 partial fix works for blockquotes/alerts, but AI Refine still corrupts content inside code blocks, strikethrough regions, and other complex nesting scenarios. Wrapper detection is incomplete. |
| Workaround | Don't use AI Refine on text inside code blocks; use standard find/replace instead.                                                                                                                   |
| Next Step  | Create specs/NNN-ai-refine-code-blocks/ with test case reproducing corruption.                                                                                                                       |


## CANNOT_FIX (Platform Limitations)

### BUG-I: File Not Exposed to GitHub Copilot Chat


| Field      | Value                                                                                                                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Category   | Bug                                                                                                                                                                                                          |
| Priority   | Medium                                                                                                                                                                                                       |
| Spec       | [specs/005-copilot-integration-and-ai-refine/spec.md](specs/005-copilot-integration-and-ai-refine/spec.md)                                                                                                   |
| Analysis   | VS Code Custom Editor API does not integrate with Copilot's @-mention discovery system. `stream.reference()` only works for built-in editors. No platform API exists to expose custom editors to Copilot UI. |
| Workaround | Users can use `#file:` manual references or `@fluxflow` chat participant.                                                                                                                                    |


---

### FR-4: Selected Text Context in Copilot


| Field      | Value                                                                                                                                                                  |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Category   | Feature Request                                                                                                                                                        |
| Priority   | Low                                                                                                                                                                    |
| Spec       | [specs/005-copilot-integration-and-ai-refine/spec.md](specs/005-copilot-integration-and-ai-refine/spec.md)                                                             |
| Analysis   | Blocked by BUG-I. Selection tracking is implemented, but Copilot cannot receive selection metadata because custom editors are not exposed to Copilot's context system. |
| Workaround | Manually copy/paste selected text into Copilot chat.                                                                                                                   |


---

## RESOLVED ✅

### FR-2: Remember Last Custom Refinement Command


| Field          | Value                                                                                                      |
| -------------- | ---------------------------------------------------------------------------------------------------------- |
| Category       | Feature Request                                                                                            |
| Priority       | Low                                                                                                        |
| Status         | ✅ TESTED AND WORKS                                                                                         |
| Spec           | [specs/005-copilot-integration-and-ai-refine/spec.md](specs/005-copilot-integration-and-ai-refine/spec.md) |
| Implementation | Module-level `lastCustomCommand` stores last instruction; textarea pre-filled on next dialog open.         |


---

### FR-3: Better UX for Custom Refinement Dialog Shortcuts


| Field          | Value                                                                                                      |
| -------------- | ---------------------------------------------------------------------------------------------------------- |
| Category       | Feature Request                                                                                            |
| Priority       | Low                                                                                                        |
| Status         | ✅ TESTED AND WORKS                                                                                         |
| Spec           | [specs/005-copilot-integration-and-ai-refine/spec.md](specs/005-copilot-integration-and-ai-refine/spec.md) |
| Implementation | Keyboard handler on textarea: Enter submits, Shift+Enter = line break, Esc = close.                        |


---

## PARTIAL ⚠️

### FR-1: AI Refine Preserves Block Quote Formatting


| Field       | Value                                                                                                      |
| ----------- | ---------------------------------------------------------------------------------------------------------- |
| Category    | Feature Request                                                                                            |
| Priority    | Medium                                                                                                     |
| Status      | ⚠️ PARTIAL — Works for blockquotes/alerts, broken for code blocks                                          |
| Spec        | [specs/005-copilot-integration-and-ai-refine/spec.md](specs/005-copilot-integration-and-ai-refine/spec.md) |
| What Works  | Blockquotes (`>`), GitHub alerts (`> [!NOTE]`), callouts — wrapper detection applies correctly.            |
| What Breaks | Code blocks and mixed nesting scenarios (see BUG-FR1-PARTIAL below).                                       |


---

## Navigation

- **Spec Kit Format**: Use [constitution.md](.specify/memory/constitution.md) § XIII for workflow
- **Create New Issue**: `specs/NNN-issue-name/` with three files: spec.md (problem), test.ts (RED test), IMPLEMENTATION.md (brief summary)

---

# LEGACY BUGS (Pre-April 2026)

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

## BUG-G: Overall copy-paste robustness (medium priority)


| Field             | Value                                       |
| ----------------- | ------------------------------------------- |
| Priority          | Medium                                      |
| Test status       | No dedicated test — needs refactoring audit |
| Confidence to fix | Medium                                      |


**Symptom:** Copy-pasting into the editor from various sources is generally buggy. Multiple bandaids exist.

**Root cause:** The paste pipeline has multiple layers: `clipboardHandling.ts` → `pasteHandler.ts` → TipTap's built-in paste handling. These layers sometimes conflict or miss edge cases.

**Fix:** Refactoring needed. Consolidate paste handling into a single pipeline. Move extension-specific paste handling into `addProseMirrorPlugins` within each extension (per AGENTS.md refactoring roadmap).