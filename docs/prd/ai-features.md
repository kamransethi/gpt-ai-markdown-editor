# AI Features

<!-- prd-last-spec: 038 -->

## Overview

The AI features domain describes how Flux Flow integrates with language models to support writing assistance, image understanding, and prompt-driven document refinement. It captures the product-facing behavior of choosing providers, handling fallbacks, and exposing AI workflows without locking users into a single service.

## User Scenarios

1. **Provider selection**: Given a user who wants AI assistance, when they configure their environment, then they can choose between available LLM providers and models: Either GitHub Copilot based models or Ollama based models (called Local AI)
2. **Text AI Operations**: Given a document or selected text, when the user chooses an AI action such as "Generate Summary" or another prompt from the AI Actions menu, then the editor sends the text to the extension host, calls the configured LLM provider (GitHub Copilot or Ollama), and displays the structured result in the AI summary/explanation webview panel.
3. **Image AI ask**: Given an image in a document, when the user asks the editor to explain or describe it, then the AI returns accessible text, alt text, or an explanation in a webview panel.
4. **Custom prompts and refinement**: Given a document or selection, when the user invokes an AI refine command, then the system preserves existing formatting and applies the requested improvement.
5. **Graceful fallback**: Given a missing AI provider or service outage, when the user requests an AI action, then the system returns a clear message and offers alternative options.

## Functional Requirements

- **AI-001**: The system MUST let users select and configure their preferred LLM provider and model for AI features.
- **AI-002**: The system MUST handle unavailable AI providers gracefully and surface actionable fallback guidance.
- **AI-003**: The system MUST support image-aware AI queries that return descriptions, alt text, text extraction, or custom insights.
- **AI-004**: The system SHOULD preserve document formatting and block structure when applying AI refinement commands.
- **AI-005**: The system SHOULD allow global custom AI prompt templates that support recurring refinement workflows.
- **AI-006**: The system MUST show text and image explanations in a markdown supported webview, including table formatting

## Business Rules

- AI actions MUST never destroy the original markdown semantics unless the user explicitly accepts the change.
- Provider configuration MUST remain decoupled from the editor’s core behavior so the product can support new providers later.
- Image analysis requests SHALL clearly identify the image and not infer sensitive content beyond the user’s question.
- Fallback messages SHALL be actionable and explain whether the issue is provider availability, configuration, or unsupported content.

## Out of Scope

- Detailed AI model pricing, billing, or provider-specific API behavior.
- Embedded AI model runtime or hosting details.
- AI features unrelated to the editor workflow, such as separate chat-only interfaces outside the document context.

## Spec History

<!-- AUTO-GENERATED: do not edit manually -->


| Spec                                                                                                          | Summary                                                                      | Date |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---- |
| [005-copilot-integration-and-ai-refine](../../specs/archive/005-copilot-integration-and-ai-refine/)           | Improve AI refine formatting preservation and Copilot integration behavior   | —    |
| [010-llm-provider-selection](../../specs/archive/010-llm-provider-selection/)                                 | Add selection between Copilot and local Ollama provider models               | —    |
| [011-image-ai-ask](../../specs/archive/011-image-ai-ask/)                                                     | Add image AI Ask workflows for description, alt text, and custom questions   | —    |
| [015-graceful-copilot-fallback](../../specs/archive/015-graceful-copilot-fallback/)                           | Add graceful fallback behavior for unavailable Copilot/LLM services          | —    |
| [022-premium-editor-features-ai-refinements](../../specs/archive/022-premium-editor-features-ai-refinements/) | Add richer AI prompt and refinement features to the editor                   | —    |
| [027-graph-bug-fixes](../../specs/archive/027-graph-bug-fixes/)                                               | Fix AI provider selection and LLM setting behavior in graph-related features | —    |
| [038-unified-ai-webview-markdown](../../specs/038-unified-ai-webview-markdown/)                               | Unify AI explanation and image analysis webview rendering with markdown tables | —    |


## Pending Review

<!-- Items here need a human to update prose sections above -->


- Confirm if provider-specific configuration changes should be separated into a dedicated functional requirement for configuration stability: Yes