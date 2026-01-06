---
name: Stop .MD Auto-Linking
overview: ""
todos:
  - id: diagnose-path
    content: Confirm link creation path for .MD autolink
    status: pending
  - id: add-test-md-link
    content: Add failing test for .MD auto-linking
    status: pending
    dependencies:
      - diagnose-path
  - id: implement-guard
    content: Prevent bare extensions from becoming links
    status: pending
    dependencies:
      - add-test-md-link
  - id: verify-regressions
    content: Run link/markdown webview tests
    status: pending
    dependencies:
      - implement-guard
---

# Stop .MD Auto-Linking

Prevent plain `.MD` text from being auto-converted into links by tightening link detection and adding tests.

## Approach

- Inspect current link creation path (TipTap Link + marked) to confirm if detection happens on input vs. markdown parse.
- Add unit test reproducing `.MD` turning into a link in TipTap Markdown parsing to lock the bug.
- Adjust link parsing to skip bare extension-like tokens (e.g., `.MD`, `.md`, `.txt`) while preserving real URLs and [`text`](url).
- Verify no regressions: normal links still link; `.MD` stays plain text.

## Files to Touch

- `src/webview/editor.ts` — Link/Markdown configuration tweak to disable bare-extension autolink.
- `src/webview/extensions/` (new helper if needed) — Guard against extension-only link marks.
- `src/__tests__/webview/` — Add failing test for `.MD` autolink, keep existing link behavior intact.

## Todos

- diagnose-path: Confirm where autolink is applied (Link vs Markdown).
- add-test-md-link: Add failing test for `.MD` autolinking.
- implement-guard: Prevent bare extensions from becoming links.
- verify-regressions: Re-run relevant webview markdown/link tests.