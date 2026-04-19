# Spec: H1-H3 Scroll Regression Bug

**Ticket**: Scroll jiggle/snap-to-top regression with H1-H3 headings  
**Severity**: Critical (user cannot scroll content)  
**Status**: FIXED ✅  
**Category**: Bug Report  
**Date Reported**: April 11, 2026

---

## Problem Statement

Document contents cannot be scrolled vertically when the markdown contains H1, H2, or H3 headings. Instead:
- User scrolls down to position X
- Document snaps back to top (showing only H1 heading)
- Scroll position oscillates/jiggles
- User is unable to navigate the document

**Key Observation**: Issue ONLY occurs with H1-H3 headings; H4-H6 and plain text documents scroll normally.

This correlates perfectly with the TOC (Table of Contents) pane depth setting: default `tocMaxDepth=3` means only H1-H3 headings appear in the TOC outline.

---

## Reproduction Steps

1. Create or open a markdown document with H1-H3 headings
2. In the editor, scroll down to view lower content
3. Observe: Document snaps back to top
4. Scroll position oscillates repeatedly

**Non-Reproduction** (works fine):
- Same steps with H4-H6 headings only → No jiggle
- Same steps with plain text (no headings) → No jiggle

---

## Expected Behavior

- ✅ User can scroll vertically through any document
- ✅ Scroll position persists when content updates
- ✅ TOC pane updates do NOT affect main editor scroll
- ✅ Works with all heading levels (H1-H6)

---

## Technical Analysis

### Suspected Root Cause

Layout thrashing caused by:
1. TOC pane element updates during scroll
2. Sticky positioning layout recalculation
3. Cascading layout changes affecting main editor

**See**: [IMPLEMENTATION.md](IMPLEMENTATION.md) for detailed root cause analysis

---

## Acceptance Criteria

- [ ] Document with H1 heading scrolls smoothly
- [ ] Document with H1-H3 headings scrolls smoothly
- [ ] Document with H4-H6 headings scrolls smoothly (verify no regression)
- [ ] Scroll position preserved across content updates
- [ ] All existing tests pass
- [ ] No performance regression

---

## Related Issues

- None currently
- This was a regression from recent UI improvements

---

## Notes for Implementation

- Review `src/webview/features/tocPane.ts` for DOM manipulation
- Check `src/webview/editor.ts` for layout-triggering updates
- Verify CSS in `src/webview/editor.css` doesn't cause layout bugs
- Consider scroll position preservation during content sync

---

**Document Status**: Problem specification complete. See [IMPLEMENTATION.md](IMPLEMENTATION.md) for solution.
