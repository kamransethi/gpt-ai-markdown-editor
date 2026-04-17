# Feature Specification: Image AI Ask Menu

**Folder**: `specs/011-image-ai-ask/`  
**Created**: 2026-04-11  
**Status**: Draft  
**Input**: User description: "Images have a '...' button in the top right which has categories for EDIT, REVEAL. Add another one for ASK with menu items 'Explain' and other relevant ones. This should send the image to the LLM and return text for the prompt sent with the image. If the selected LLM is not image enabled, then handle nicely asking the user to select a vision model."

## User Scenarios & Testing

### User Story 1 — Explain an Image (Priority: P1)

A user hovers over an image in their markdown document, clicks the "..." menu button, and sees a new **Ask** section below the existing Reveal section. They click **Explain** and the LLM analyzes the image, returning a natural-language description of what the image depicts — its contents, context, and key details. The response appears in a panel similar to the AI Summary panel.

**Why this priority**: This is the core use case — sending an image to a vision-capable LLM and getting back useful information. Every other ASK action builds on the same pipeline.

**Independent Test**: Can be tested by clicking Explain on any image and verifying a meaningful textual explanation appears.

**Acceptance Scenarios**:

1. **Given** a markdown document with an embedded local image is open, **When** the user clicks "..." → Ask → Explain, **Then** the image is sent to the configured LLM with an "explain this image" prompt and a text response streams into a results panel.
2. **Given** a markdown document with an external (URL) image, **When** the user clicks "..." → Ask → Explain, **Then** the external image is fetched and sent to the LLM the same way as a local image.
3. **Given** the LLM returns a multi-paragraph explanation, **When** the response finishes streaming, **Then** the full response is displayed with proper formatting and the user can copy it.

---

### User Story 2 — Generate Alt Text (Priority: P1)

A user wants accessible alt text for an image. They click "..." → Ask → **Generate Alt Text**. The LLM produces a concise, descriptive alt-text string. The user is offered an option to automatically insert it into the image's alt attribute in the markdown source.

**Why this priority**: Alt text is a common accessibility need and directly modifies the document — high practical value.

**Independent Test**: Can be tested by selecting Generate Alt Text on an image that has no alt text and verifying concise alt text is proposed and can be accepted into the document.

**Acceptance Scenarios**:

1. **Given** an image with empty or missing alt text, **When** the user clicks Generate Alt Text, **Then** the LLM returns a concise description (under 125 characters) suitable for alt text and the user can accept or dismiss it.
2. **Given** an image that already has alt text, **When** the user clicks Generate Alt Text, **Then** the existing alt text is shown alongside the new suggestion so the user can compare and choose.
3. **Given** the user accepts the generated alt text, **When** they confirm, **Then** the image node's alt attribute is updated in the editor and the change is reflected in the markdown source.

---

### User Story 3 — Extract Text from Image (Priority: P2)

A user has a screenshot containing text (code snippet, error message, table, handwritten notes). They click "..." → Ask → **Extract Text**. The LLM performs OCR-like extraction and returns the text content, which the user can copy to clipboard or insert into the document.

**Why this priority**: Extracting text from screenshots is a frequent real-world task for developers writing documentation.

**Independent Test**: Can be tested by using Extract Text on a screenshot of code and verifying the returned text matches the visible code.

**Acceptance Scenarios**:

1. **Given** a screenshot containing visible text, **When** the user clicks Extract Text, **Then** the LLM returns the extracted text preserving formatting where possible (e.g., code blocks, line breaks).
2. **Given** extracted text is displayed, **When** the user clicks "Copy", **Then** the text is copied to the clipboard.
3. **Given** extracted text is displayed, **When** the user clicks "Insert Below", **Then** the extracted text is inserted into the document immediately after the image.

---

### User Story 4 — Describe for Documentation (Priority: P2)

A user is writing technical documentation and needs a written description of a diagram, chart, or UI screenshot. They click "..." → Ask → **Describe**. The LLM returns a detailed, documentation-ready paragraph describing the image's content, suitable for inclusion in the document as supporting text.

**Why this priority**: Different from Explain (which is for understanding) — Describe produces prose intended to be inserted directly into the document alongside the image.

**Independent Test**: Can be tested by using Describe on a diagram and verifying the response is a well-written paragraph suitable for documentation.

**Acceptance Scenarios**:

1. **Given** a diagram or chart image, **When** the user clicks Describe, **Then** the LLM returns a documentation-quality paragraph describing its contents.
2. **Given** the description is displayed, **When** the user clicks "Insert Below", **Then** the text is inserted into the document after the image as a new paragraph.

---

### User Story 5 — Ask a Custom Question (Priority: P2)

A user has a specific question about an image that isn't covered by the preset prompts. They click "..." → Ask → **Ask a Question…**. An input box appears where they type a freeform question. The question and image are sent to the LLM and the response is displayed.

**Why this priority**: Provides flexibility for any use case not covered by the preset actions.

**Independent Test**: Can be tested by typing a custom question about any image and verifying the response is contextually relevant.

**Acceptance Scenarios**:

1. **Given** the user clicks "Ask a Question…", **When** an input prompt appears, **Then** the user can type any question and submit it.
2. **Given** a custom question is submitted with the image, **When** the LLM responds, **Then** the response is displayed in the same results panel used by other ASK actions.
3. **Given** the user dismisses the input prompt without typing, **When** they cancel, **Then** no request is made and the menu closes.

---

### User Story 6 — Vision Model Required (Priority: P1)

A user's currently configured LLM does not support image/vision inputs (e.g., a text-only Ollama model). When they click any item under the Ask menu, the system will attempt the request. If the LLM returns an error indicating it doesn't support images, a clear message is shown explaining the issue. Users are responsible for configuring actual vision-capable models for their Ollama instance.

**Why this priority**: Without graceful error handling for non-vision models, ASK features would appear broken for those users. This is a prerequisite for a good experience.

**Independent Test**: Can be tested by configuring a text-only model and clicking an ASK action; the system should attempt it and surface any errors from the model clearly.

**Acceptance Scenarios**:

1. **Given** the user's LLM provider is Ollama with a text-only model (e.g., `llama3.2:latest`), **When** they click any ASK menu item, **Then** the system attempts the request; Ollama returns an error, which is displayed to the user with guidance (e.g., "This model does not support images. Try configuring llava, bakllava, or another vision-capable model").
2. **Given** the user's LLM provider is GitHub Copilot, **When** they click any ASK menu item, **Then** the system uses Copilot's vision-capable models and the request proceeds normally.
3. **Given** the user has configured an Ollama model they claim supports vision, **When** they click an ASK action, **Then** the system trusts their model choice and sends the request. If the model doesn't actually support images, the LLM error is surfaced to the user.

---

### Edge Cases

- What happens when the image file is missing or corrupt? → Show a user-friendly error: "Cannot analyze this image — the file could not be loaded."
- What happens when the image is very large (>10 MB)? → Resize/compress before sending to the LLM to stay within token/size limits. Show a brief "Preparing image…" indicator.
- What happens when the LLM request times out or fails mid-stream? → Show an error message in the results panel with a "Retry" option.
- What happens when the user is offline and using Ollama? → Show "Cannot reach Ollama at [endpoint]. Please check that Ollama is running."
- What happens when the image is a data URI? → Extract the base64 data directly and send it to the LLM without needing to read from disk.
- What happens when the user triggers a second ASK action while one is in progress? → Cancel the in-progress request and start the new one.
- What happens when the image is an SVG? → Rasterize or send the SVG source as text context with a note to the LLM.

## Requirements

### Functional Requirements

- **FR-001**: The image context menu ("..." button) MUST include a new **Ask** section below the existing Reveal section, separated by a menu divider.
- **FR-002**: The Ask section MUST contain the following menu items: **Explain**, **Generate Alt Text**, **Extract Text**, **Describe**, and **Ask a Question…**.
- **FR-003**: Each Ask menu item MUST send the image along with a purpose-specific prompt to the configured LLM provider.
- **FR-004**: The system MUST display LLM responses in a streaming panel (similar to the existing AI Summary panel) with the action name as the title.
- **FR-005**: The results panel MUST include a **Copy** button to copy the response text to the clipboard.
- **FR-006**: For Extract Text and Describe actions, the results panel MUST include an **Insert Below** button that inserts the response text into the document immediately after the image.
- **FR-007**: For Generate Alt Text, the results panel MUST include an **Apply** button that updates the image's alt attribute in the editor.
- **FR-008**: The system MUST attempt to send the image to the configured LLM provider without pre-validation of model vision capability.
- **FR-009**: If the LLM returns an error indicating it does not support image inputs, the system MUST display this error message to the user clearly, showing the model name and endpoint. Users are responsible for configuring actual vision-capable models.
- **FR-010**: The system MUST support both local images (read from disk) and external images (fetched via URL) for all ASK actions.
- **FR-011**: For local images, the system MUST read the image file from the workspace and prepare it for transmission to the LLM.
- **FR-012**: For external images, the system MUST fetch the image data from the URL and prepare it for transmission to the LLM.
- **FR-013**: The system MUST handle images larger than 5 MB by resizing them before sending to the LLM, with a brief progress indicator shown to the user.
- **FR-014**: The system MUST support cancellation of in-progress ASK requests when the user closes the results panel or initiates a new request.
- **FR-015**: The Ask menu section MUST appear for both local and external images (unlike Reveal which is local-only).

### Key Entities

- **Image Context**: The image being analyzed — includes its source (local path or URL), base64 data, alt text, and dimensions.
- **ASK Action**: A predefined or custom prompt type (Explain, Generate Alt Text, Extract Text, Describe, Ask a Question) that determines the system prompt sent with the image.
- **Vision Capability**: Whether the configured LLM provider and model support image inputs alongside text prompts.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can invoke any ASK action on an image and receive a meaningful response within 15 seconds for typical images under 2 MB.
- **SC-002**: 100% of ASK actions display a streaming response — users see text appearing progressively, not a blank wait followed by a wall of text.
- **SC-003**: Users with non-vision models see a helpful guidance message within 1 second of clicking an ASK action, with zero cryptic error messages.
- **SC-004**: The Generate Alt Text action produces alt text that is accepted by users (applied to the image) at least 70% of the time without manual editing.
- **SC-005**: The Insert Below action correctly places extracted or described text immediately after the image in the document with no formatting corruption.
- **SC-006**: All ASK actions work identically for local and external images from the user's perspective.
- **SC-007**: Large images (5-20 MB) are automatically handled without the user needing to manually resize — the action completes successfully with at most a brief "preparing" indicator.

## Assumptions

- The existing LLM provider abstraction (`LlmProvider` interface) will be extended to support image inputs alongside text messages, rather than creating a separate image-specific provider.
- GitHub Copilot's language model API supports vision inputs (GPT-4o and similar models accept image data). If a Copilot model does not support vision, the system will attempt to select one that does.
- Ollama vision models (e.g., `llava`, `bakllava`, `llama3.2-vision`) accept base64-encoded images in the standard `/api/chat` message format via an `images` field.
- The results panel reuses the same UI pattern as the existing AI Summary/Explain panel rather than introducing a new UI paradigm.
- Image resizing for large files will use a canvas-based approach in the webview since the webview has access to DOM APIs.
- The "Ask a Question…" dialog uses a styled overlay input (following the Custom Refinement pattern from aiRefine), not `window.prompt()` or VS Code's `showInputBox`.
- SVG images are out of scope for v1 — if an image is SVG, the ASK menu items will be disabled with a tooltip explaining SVG is not yet supported.
- **Image model is separately configured from text model**: When the provider is Ollama, Image Ask uses `gptAiMarkdownEditor.ollamaImageModel` (default `llama3.2-vision:latest`) rather than `gptAiMarkdownEditor.ollamaModel`. This allows users running a standard text Ollama model to separately configure a vision-capable model for image tasks. When the provider is GitHub Copilot, the same model is used for both text and image tasks.
- **Model shown immediately on panel open**: The AI panel footer shows `<provider> / <model>` as soon as the panel opens (before the request completes), sourced from the webview's cached settings. This is consistent behavior for both AI Summary and Image Ask.
- **Vision model selection is trust-based**: The system does not maintain a hardcoded whitelist of known vision models. Users can configure any Ollama model they wish (including new models, community models, or custom models). If a user selects a non-vision model, the LLM will return an error, which the system displays clearly to the user. This approach is future-proof and allows unlimited model choice.

## Implementation Notes

### Completed

- **Vision model trust implementation** (Commit d9c9a75): Removed hardcoded OLLAMA_VISION_MODELS whitelist. System now trusts user's model choice — if the configured model doesn't support images, the LLM error is surfaced to the user.
- **Provider availability detection** (Commit 8075030): Implemented graceful Copilot fallback with Ollama auto-detection (see spec 015).
- **Image loading and encoding**: Supports local files, external URLs, and data URIs. Images are read as base64 before transmission.
- **LLM provider integration**: Works with both GitHub Copilot (via Language Model API) and Ollama (HTTP `/api/chat` endpoint with `images` field).
- **Separate image/text model configuration**: When provider is Ollama, uses `ollamaImageModel` setting instead of `ollamaModel`.

### Other System Restrictions Found

While implementing trust-based vision models, the team identified similar artificial restrictions in other parts of the system. These are documented for potential future improvement:

1. **Hardcoded AI Model Enum** (`package.json` → `gptAiMarkdownEditor.aiModel`)
   - **Current**: Restricted to 8 hardcoded models (gpt-4.1, gpt-4.1-mini, gpt-4o, claude-sonnet-4, o4-mini, o3-mini)
   - **Impact**: Users cannot select newly released models like gpt-4-turbo, gpt-3.5, or future models without editing package.json
   - **Similar to vision model whitelist**: This could be improved to allow user-provided model names via a text input with a recommended preset list
   - **Recommendation**: Consider making this a free-form string with suggested defaults, similar to how we now handle Ollama models

2. **LLM Provider Whitelist** (Spec 010, documented limitation)
   - **Current**: Only GitHub Copilot and Ollama supported
   - **Out of scope**: OpenAI Direct API, Anthropic Direct API, other endpoints
   - **Note**: This is an architectural decision (not an unnecessary restriction like vision models), but documented for transparency

3. **Image Size Hard Limit** (`imageAsk.ts` → `MAX_IMAGE_BYTES = 4MB`)
   - **Current**: Images larger than 4 MB are rejected
   - **Issue**: Some vision models (like Claude 3.5) can handle larger images; this may be unnecessarily restrictive
   - **Recommendation**: Consider making this configurable or raising the limit with better error handling

4. **SVG Support Out of Scope** (Assumption)
   - **Current**: SVG images not supported in Image Ask
   - **Technical reason**: SVGs aren't naturally "image pixels" — would need rasterization or special handling
   - **Recommendation**: Document clearly in UI; consider for future sprint if demand exists
