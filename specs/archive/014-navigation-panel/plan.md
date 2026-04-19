# Implementation Plan: Navigation Panel Search & Filter

**Folder**: `specs/014-navigation-panel/plan.md` | **Date**: 2026-04-12 | **Spec**: [spec.md](spec.md)  
**Status**: Draft → Approved ✅

## Summary

Add a filter input to the TOC pane header that narrows the heading list in real-time as the user types. Filtering is client-side substring matching against the anchor array already maintained by `tocPane.ts`. The approach modifies the existing `renderTocItems` flow to apply a filter predicate before rendering, keeping a single `update()` path. Keyboard navigation (ArrowDown/Up/Enter/Escape) is wired directly in the input's keydown handler.

## Stack

**Language/Runtime**: TypeScript 5.3, VS Code webview (DOM API)  
**Key deps**: None — pure DOM, consistent with existing `tocPane.ts` patterns  
**Testing**: Jest + jsdom (existing `tocPane.test.ts`)

## Phases

**Phase 1 — Filter input + real-time filtering**:
- Add filter input element to the pane header (between title and collapse button)
- Store the current filter query string in closure state
- On `update()`, filter anchors by case-insensitive substring match before passing to `renderTocItems`
- Show "No matching headings" empty state when filter produces 0 results
- Clear filter on pane hide
- Files:
  - `src/webview/features/tocPane.ts` — MODIFY (add filter input, filtering logic, clear-on-hide)
  - `src/webview/editor.css` — MODIFY (add filter input styles)
- Tests: 5 unit tests — filter matches, no matches empty state, clear restores all, case-insensitive, whitespace-only treated as empty

**Phase 2 — Keyboard navigation + polish**:
- ArrowDown/Up from filter input moves focus to filtered list items
- Enter on focused item triggers navigate callback
- Escape clears filter and dispatches focus back
- Clear button (×) appears when filter has text
- Files:
  - `src/webview/features/tocPane.ts` — MODIFY (keyboard handlers, clear button)
  - `src/webview/editor.css` — MODIFY (clear button styles)
- Tests: 3 tests — Escape clears, arrow key focus movement, Enter triggers navigation

## Files

| File | Action | Purpose |
|------|--------|---------|
| `src/webview/features/tocPane.ts` | MODIFY | Add filter input, filtering logic, keyboard navigation, clear-on-hide |
| `src/webview/editor.css` | MODIFY | Styles for filter input, clear button, and filtered empty state |
| `src/__tests__/webview/tocPane.test.ts` | MODIFY | Add 8 tests for filtering, keyboard, and edge cases |

## Key Risks

| Risk | Cause | Mitigation |
|------|-------|-----------|
| Filter input steals focus on TOC update | `renderTocItems` is called on every scroll event via `rafThrottle` | Filter input is created once and lives outside the re-rendered list; only the list div is cleared/rebuilt |
| Performance lag with many headings | Linear scan on every keystroke | Anchors are already a small array (< 500 items); no-op if query unchanged since last render |
| Active heading tracking breaks with filter | `getActiveTocHeadingId` runs on full anchor set | Filter is applied only at render time in `renderTocItems`; active ID computation uses the filtered set |

## Implementation Decisions

**Decision 1 — Filter input placement**: The header row currently has "CONTENTS" (left) and collapse button (right).
- [x] **A**: Replace header title with an inline filter input that shows placeholder "Filter…" and a small search icon — title disappears, input takes full width. More elegant, saves vertical space.
- [ ] **B**: Add a second row below the header for the filter input — preserves title but takes more vertical space.
- Recommendation: **A** — The "Contents" title is not informative once the user knows it's the TOC. Replacing it with a filter input is a cleaner design (similar to VS Code's outline panel filter).

**Decision 2 — Filter trigger**: When to apply the filter.
- [x] **A**: Filter on every `input` event (real-time, no debounce) — instant feel, negligible cost for < 500 items.
- [ ] **B**: Debounce 150ms — marginal perf gain, adds latency users can feel.
- Recommendation: **A** — Array is small, DOM updates are fast, immediate feedback is better UX.
