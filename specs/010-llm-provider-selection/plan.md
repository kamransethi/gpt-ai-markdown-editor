# Implementation Plan: LLM Provider Selection

**Folder**: `specs/010-llm-provider-selection/plan.md` | **Date**: 2026-04-11 | **Spec**: [spec.md](./spec.md)  
**Status**: Draft → Approved ✅

## Summary

Add a provider abstraction layer so AI Refine and AI Explain can route through either GitHub Copilot (via `vscode.lm` API, the default) or a local Ollama instance (via HTTP streaming). Three new VS Code settings control the provider, Ollama model, and Ollama endpoint. The existing Copilot path is untouched; a new `OllamaProvider` handles HTTP streaming with cancellation and error reporting.

## Stack

**Language/Runtime**: TypeScript 5.3, Node.js 18+ (native `fetch` for Ollama HTTP)  
**Key deps**: `@tiptap/core`, VS Code Extension API (`vscode.lm`), Ollama REST API (`/api/chat`)  
**Testing**: Jest + jsdom (unit tests with mocked HTTP/vscode.lm)

## Phases

**Phase 1 — Provider Abstraction & Settings**: Extract common LLM interface, create Copilot and Ollama provider implementations, add 3 new settings to `package.json`.
- Files:
  - `src/features/llm/types.ts` — CREATE
  - `src/features/llm/copilotProvider.ts` — CREATE
  - `src/features/llm/ollamaProvider.ts` — CREATE
  - `src/features/llm/providerFactory.ts` — CREATE
  - `package.json` — MODIFY (add 3 settings)
- Tests: 8 unit tests covering provider factory, Ollama streaming, Ollama errors, cancellation

**Phase 2 — Wire AI Features to Provider**: Refactor `aiRefine.ts` and `aiExplain.ts` to use the provider abstraction instead of direct `vscode.lm` calls.
- Files:
  - `src/features/aiRefine.ts` — MODIFY
  - `src/features/aiExplain.ts` — MODIFY
- Tests: 6 unit tests covering Refine with Copilot, Refine with Ollama, Explain with Copilot, Explain with Ollama, provider switching, setting fallback

**Phase 3 — Tests & Error Handling Polish**: Comprehensive test suite, error message quality, cancellation UX.
- Files:
  - `src/__tests__/features/llmProvider.test.ts` — CREATE
  - `src/__tests__/features/aiRefineProvider.test.ts` — CREATE
- Tests: 14 total tests across both files

## Files

| File | Action | Purpose |
|------|--------|---------|
| `src/features/llm/types.ts` | CREATE | `LlmProvider` interface + `LlmResponse` type |
| `src/features/llm/copilotProvider.ts` | CREATE | Wraps existing `vscode.lm` calls behind `LlmProvider` |
| `src/features/llm/ollamaProvider.ts` | CREATE | HTTP streaming client for Ollama `/api/chat` |
| `src/features/llm/providerFactory.ts` | CREATE | Reads settings, returns correct provider instance |
| `src/features/aiRefine.ts` | MODIFY | Use `providerFactory` instead of direct `vscode.lm` |
| `src/features/aiExplain.ts` | MODIFY | Use `providerFactory` instead of direct `vscode.lm` |
| `package.json` | MODIFY | Add `llmProvider`, `ollamaModel`, `ollamaEndpoint` settings |
| `src/__tests__/features/llmProvider.test.ts` | CREATE | Provider factory + Ollama client tests |
| `src/__tests__/features/aiRefineProvider.test.ts` | CREATE | AI Refine/Explain integration with provider abstraction |

## Key Risks

| Risk | Cause | Mitigation |
|------|-------|-----------|
| Ollama API incompatibility | Ollama `/api/chat` response format may differ from expectations | Use well-documented streaming JSON format; test against real Ollama locally before release |
| Node.js `fetch` not available | Extension host may run on older Electron without native `fetch` | VS Code 1.90+ ships Electron 29+ with native `fetch`; no polyfill needed |
| Streaming cancellation leak | AbortController signal may not cleanly abort mid-stream | Destroy response body reader on abort; add timeout safety net |
| Copilot regression | Refactoring may break existing Copilot flow | Copilot path is a thin wrapper — existing behavior extracted as-is; existing mocked tests validate |

## Implementation Decisions

*Confirm these before coding starts. Reply with your choices or say "all good".*

**Decision 1 — Ollama API endpoint**: Ollama supports both `/api/generate` (raw completion) and `/api/chat` (chat-style with messages array).
- [ ] **A**: Use `/api/chat` — maps naturally to the existing system+user message pattern; supports multi-turn in the future
- [ ] **B**: Use `/api/generate` — simpler single-prompt endpoint; concatenate system+user into one prompt string
- Recommendation: **A** — `/api/chat` matches our existing message structure (system prompt + user prompt) and is the Ollama team's recommended endpoint.

**Decision 2 — Provider instantiation**: Create provider instances fresh per request vs. cache a singleton.
- [ ] **A**: Fresh per-request — reads settings each time, zero state management, trivially supports mid-session setting changes (FR-009)
- [ ] **B**: Cached singleton — slightly faster, but must listen for setting changes and invalidate
- Recommendation: **A** — Simplest approach; LLM call latency dwarfs object creation; auto-satisfies FR-009 (no restart required).

**Decision 3 — Streaming interface**: How to expose streaming from the provider abstraction.
- [ ] **A**: AsyncGenerator (`async function*`) — both providers yield string chunks; consumer uses `for await`
- [ ] **B**: Callback-based — provider takes `onChunk` callback; consumer accumulates
- Recommendation: **A** — Mirrors the existing `for await (const chunk of response.text)` pattern already used for Copilot; consistent and idiomatic TypeScript.
