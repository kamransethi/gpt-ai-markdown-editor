# Implementation Plan: Image AI Ask Menu

**Folder**: `specs/011-image-ai-ask/plan.md` | **Date**: 2026-04-11 | **Spec**: [spec.md](spec.md)  
**Status**: Draft → Approved ✅

## Summary

Add an **Ask** section to the image context menu ("..." button) with five vision-powered actions: Explain, Generate Alt Text, Extract Text, Describe, and Ask a Question. The system extends the existing `LlmProvider` abstraction to support image inputs, routes image data from the webview to the extension host, streams LLM responses into a reusable results panel, and gracefully handles non-vision models.

## Stack

**Language/Runtime**: TypeScript 5.3, Node.js 18+  
**Key deps**: @tiptap/core, VS Code Language Model API (vision), Ollama `/api/chat` images field  
**Testing**: Jest + jsdom (unit + integration)

## Phases

**Phase 1 — Vision Provider Layer**: Extend LLM abstraction for image inputs, add vision detection, implement image loading on extension host.
- Files:
  - `src/features/llm/types.ts` (MODIFY) — add `VisionLlmMessage` type with image support
  - `src/features/llm/copilotProvider.ts` (MODIFY) — handle image content parts
  - `src/features/llm/ollamaProvider.ts` (MODIFY) — send images via Ollama `images` field
  - `src/features/llm/providerFactory.ts` (MODIFY) — add `createImageLlmProvider()` using `ollamaImageModel`, add `getImageModelDisplayName()`, update `isVisionCapable()` to check `ollamaImageModel` (not `ollamaModel`)
  - `src/features/imageAsk.ts` (CREATE) — extension-host handler with image loading, prompts, streaming; uses `createImageLlmProvider()` and `getImageModelDisplayName()`
  - `src/shared/messageTypes.ts` (MODIFY) — add IMAGE_ASK + IMAGE_ASK_RESULT types
  - `src/editor/MarkdownEditorProvider.ts` (MODIFY) — include `modelDisplayName` and `imageModelDisplayName` in `getWebviewSettings()`; trigger SETTINGS_UPDATE on LLM config changes (`llmProvider`, `aiModel`, `ollamaModel`, `ollamaImageModel`)
  - `src/webview/editor.ts` (MODIFY) — apply `modelDisplayName` and `imageModelDisplayName` to `window.__dkAiModelDisplayName` and `window.__dkAiImageModelDisplayName` in `applyWebviewSettings()`
  - `src/webview/extensions/aiExplain.ts` (MODIFY) — read `window.__dkAiImageModelDisplayName` in `showImageAskLoading()` to populate footer immediately on open; read `window.__dkAiModelDisplayName` in `showExplainPanel()` for AI Summary
- Tests: 14 unit tests covering vision message construction, Ollama image payload, Copilot image parts, vision capability detection, image file loading, prompt templates, separate image/text model routing

**Phase 2 — Menu & Messaging**: Add Ask section to image menu, wire webview→extension host round-trip, register handler in message router.
- Files:
  - `src/webview/features/imageMenu.ts` (MODIFY) — add Ask section with 5 menu items
  - `src/webview/features/imageAskActions.ts` (CREATE) — webview-side action dispatch, sends IMAGE_ASK messages
  - `src/editor/MarkdownEditorProvider.ts` (MODIFY) — add IMAGE_ASK case to handleWebviewMessage
  - `src/webview/editor.css` (MODIFY) — styles for Ask menu items (reuse existing menu-item pattern)
- Tests: 6 tests covering menu rendering, action dispatch, message format

**Phase 3 — Results Panel & Document Actions**: Build streaming results panel, copy/insert-below/apply-alt-text buttons, custom question input.
- Files:
  - `src/webview/features/imageAskPanel.ts` (CREATE) — results panel UI with streaming, Copy, Insert Below, Apply buttons
  - `src/webview/extensions/imageAskExtension.ts` (CREATE) — TipTap extension for receiving results, inserting text after image, updating alt text
  - `src/webview/editor.css` (MODIFY) — results panel styles (reuse ai-explain-panel pattern)
  - `src/webview/editor.ts` (MODIFY) — register imageAskExtension + message handler
- Tests: 10 tests covering panel rendering, streaming display, copy action, insert-below positioning, alt text update, custom question flow, non-vision model error display

## Files

| File | Action | Purpose |
|------|--------|---------|
| `src/features/llm/types.ts` | MODIFY | Add `VisionLlmMessage` with optional `images` field |
| `src/features/llm/copilotProvider.ts` | MODIFY | Support image content parts in Copilot API calls |
| `src/features/llm/ollamaProvider.ts` | MODIFY | Send base64 images in Ollama `images` array |
| `src/features/llm/providerFactory.ts` | MODIFY | Add `isVisionCapable()` export |
| `src/features/imageAsk.ts` | CREATE | Extension-host handler: load image, build prompt, stream response |
| `src/shared/messageTypes.ts` | MODIFY | Add `IMAGE_ASK` and `IMAGE_ASK_RESULT` message types |
| `src/webview/features/imageMenu.ts` | MODIFY | Add Ask section with 5 menu items below Reveal |
| `src/webview/features/imageAskActions.ts` | CREATE | Webview action dispatch for Ask menu items |
| `src/webview/features/imageAskPanel.ts` | CREATE | Streaming results panel with action buttons |
| `src/webview/extensions/imageAskExtension.ts` | CREATE | TipTap extension for result handling + document mutations |
| `src/editor/MarkdownEditorProvider.ts` | MODIFY | Route IMAGE_ASK messages to handler |
| `src/webview/editor.css` | MODIFY | Results panel + menu item styles |
| `src/webview/editor.ts` | MODIFY | Register image ask extension + message listener |
| `src/__tests__/features/imageAsk.test.ts` | CREATE | 14 tests: vision layer + handler |
| `src/__tests__/webview/imageAskMenu.test.ts` | CREATE | 6 tests: menu rendering + dispatch |
| `src/__tests__/webview/imageAskPanel.test.ts` | CREATE | 10 tests: panel + document actions |

## Key Risks

| Risk | Cause | Mitigation |
|------|-------|-----------|
| Copilot LM API may not expose vision capability metadata | VS Code API evolves; no documented `supportsVision` flag | For Copilot, attempt the request — if model rejects image content parts, catch and show friendly error. Known vision models (gpt-4o, gpt-4.1) are allowlisted. |
| Large images exhaust LLM token limits or timeout | User pastes 10+ MB screenshots | Resize images >2 MB on the extension host using sharp or canvas before encoding. Set a 4 MB hard ceiling on base64 payload. |
| CSP blocks inline image data in webview→extension bridge | Webview security policy restrictions | Images are NOT sent through webview HTML — the webview sends only the image `src` path/URL; the extension host reads the actual image bytes from disk or fetches the URL. |
| Ollama model name doesn't indicate vision capability reliably | Many community models have arbitrary names | Attempt the request; if Ollama returns an error about images not being supported, surface a clear message suggesting known vision models |

## Implementation Decisions

*Confirm these before coding starts. Reply with your choices or say "all good".*

**Decision 1 — Image data flow: webview sends path vs. webview sends base64**: The webview has the image visible but sending large base64 over postMessage is slow. Alternatively, the webview sends only the image path/URL and the extension host reads the file from disk or fetches the URL.
- [x] **A**: Webview sends image path/URL only → extension host reads bytes ✅
- [ ] **B**: Webview reads image to base64 via canvas → sends over postMessage

**Decision 2 — Extending LlmProvider interface**: The current `generate()` only accepts `LlmMessage[]` (text). We need to pass images too.
- [x] **A**: Add a new `generateWithVision(messages, images, abortSignal)` method to the interface ✅
- [ ] **B**: Extend `LlmMessage` to allow an optional `images?: string[]` field

**Decision 3 — Results panel: new panel vs. reuse AI Explain panel**: The AI Explain panel already handles streaming + display.
- [ ] **A**: Create a separate `imageAskPanel` with its own DOM
- [x] **B**: Reuse AI Explain panel with mode switching — less new code, reuse existing streaming infrastructure ✅
