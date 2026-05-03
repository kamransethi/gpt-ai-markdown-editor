# Implementation Plan: Unified AI Explanation Webview with Markdown Table Support

**Folder**: `specs/038-unified-ai-webview-markdown/plan.md` | **Date**: 2026-05-03 | **Spec**: [spec.md](spec.md)  
**Status**: Draft → In Planning

## Summary

Unify the AI explanation webview component to serve both text operations (document summaries) and image analysis (alt text/descriptions) while adding full markdown rendering with table support. Both workflows currently use the same panel but maintain separate code paths; streaming chunks will render markdown incrementally as they arrive, with a hard 4K character limit per response. Core technical approach: adapt GraphChat's streaming pattern (async generator events + CHUNK messages) to the AI explanation panel, integrate `markdown-it` for HTML rendering, and consolidate UI logic into a single component.

## Stack

**Language/Runtime**: TypeScript 5.9+, Node.js 18+  
**Key deps**: `markdown-it` v14.1.1 (rendering), `highlight.js` v11.11.1 (code syntax), @tiptap/* (editor integration)  
**Testing**: Jest 30.3.0 + jsdom; existing test count: 1000+

## Phases

**Phase 1 — Core Markdown Rendering Infrastructure**: Set up markdown-to-HTML pipeline with table styling, 4K truncation logic, and unified component structure

- Files: CREATE `src/webview/extensions/aiExplain-unified.ts`, MODIFY `src/webview/extensions/aiExplain.ts`, MODIFY `src/webview/editor.css`
- Tests: 15 unit tests — markdown rendering (tables, nested elements, code blocks), truncation at 4K, incremental rendering

**Phase 2 — Streaming Integration &amp; Unified Flow**: Adapt GraphChat streaming pattern; ensure text and image operations both use the same component with CHUNK-based updates

- Files: MODIFY `src/features/aiExplain.ts` (extend message types), MODIFY `src/webview/extensions/aiExplain.ts` (streaming handler), CREATE test fixtures
- Tests: 12 integration tests — chunk accumulation, streaming cancellation, DOM updates during streaming, error handling

**Phase 3 — UI/UX Polish &amp; Copy/Insert Actions**: Implement copy-to-clipboard, insert-into-document, context-specific titles, cancel button, model name footer

- Files: MODIFY `src/webview/editor.css`, MODIFY `src/webview/extensions/aiExplain.ts` (button handlers)
- Tests: 10 tests — copy action, insert position validation, button visibility logic

## Files


| File                                          | Action | Purpose                                                                                                       |
| --------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------- |
| `src/webview/extensions/aiExplain-unified.ts` | CREATE | Core component: markdown rendering pipeline, streaming handler, unified panel UI logic                        |
| `src/webview/extensions/aiExplain.ts`         | MODIFY | Message routing, stream setup, backward compatibility wrapper (delegates to unified component)                |
| `src/features/aiExplain.ts`                   | MODIFY | Extend message types (CHUNK, DONE, ERROR); 4K truncation in extension host; reuse GraphChat streaming pattern |
| `src/webview/editor.css`                      | MODIFY | Markdown table styles (borders, padding, header bg), code block formatting, panel responsiveness              |
| `src/__tests__/webview/aiExplain.test.ts`     | CREATE | 37 unit + integration tests covering rendering, streaming, truncation, error states                           |
| `src/__tests__/features/aiExplain.test.ts`    | MODIFY | Add tests for 4K limit, streaming chunking, message batching                                                  |


## Key Risks


| Risk                                                      | Cause                                                                | Mitigation                                                                            |
| --------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Performance regression due to markdown rendering overhead | `markdown-it` parsing + DOM updates on each chunk                    | Test streaming perf; optimize re-renders with requestAnimationFrame; limit chunk size |
| DOM bloat from long streamed responses                    | 4K limit may not prevent pathological markdown (e.g., nested tables) | Enforce 4K hard stop at extension host; add max-height + scrolling to panel CSS       |
| Regression in existing text/image AI operations           | Unified component may break current workflows                        | Maintain message type compatibility; write regression tests for existing scenarios    |
| Markdown injection vulnerabilities                        | LLM output treated as safe without sanitization                      | Document assumption; add comment linking to security decision in clarifications       |
| CSS conflicts with webview theming                        | New markdown styles might override existing variables                | Use CSS specificity carefully; inherit theme colors; test in both light/dark themes   |


## Implementation Decisions

*Confirm these before coding starts. Reply with your choices or say "all good".*

**Decision 1 — Streaming Location**: Should 4K truncation occur at the extension host (before streaming) or webview (stop rendering after 4K)?

- [x] **A**: Truncate at extension host (stop reading from LLM early, save bandwidth, simpler)
- [ ] **B**: Truncate at webview (let extension host stream full response, webview stops rendering at 4K)

- Recommendation: **A** — Reduces bandwidth, prevents pathological markdown parsing, aligns with performance budgets

**Decision 2 — Markdown Rendering Timing**: Render markdown for each chunk incrementally, or accumulate full text then render once at completion?

- [x] **A**: Render incrementally per chunk (faster perceived response, more DOM updates)
- [ ] **B**: Accumulate all chunks, render once at DONE (fewer DOM updates, longer perceived latency)

- Recommendation: **A** — Matches GraphChat UX; use requestAnimationFrame batching to optimize re-renders

**Decision 3 — Component Architecture**: Single unified component file, or separate data model + view components?

- [x] **A**: Single file (simpler, faster iteration, all logic in one place)
- [ ] **B**: Separate module with classes (more testable, extensible)

- Recommendation: **A** — Feature spec doesn't require extensibility; keep implementation simple and cohesive