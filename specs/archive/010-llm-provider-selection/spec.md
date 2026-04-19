# Feature Specification: LLM Provider Selection

**Folder**: `specs/010-llm-provider-selection/`  
**Created**: April 11, 2026  
**Status**: Draft  
**Input**: User description: "The user should be able to choose the LLM of choice (default = github copilot) between github or a local ollama installation. If the LLM selected is Ollama, then the model should be changeable. It should default to llama3.2:latest"

---

## Fact-Check: Windsurf LLM Provider Restrictions

The user mentioned Windsurf as a motivating example. According to Windsurf's official documentation (docs.windsurf.com/windsurf/models):

- **Windsurf does NOT support local LLMs like Ollama**. All AI calls go through Windsurf's servers.
- **BYOK (Bring Your Own Key)** is supported, but limited to Anthropic Claude models only (Claude 4 Sonnet, Claude 4 Opus, and their Thinking variants). No support for Ollama, local models, or arbitrary API endpoints.
- **No local/offline LLM option** exists in Windsurf—users are tethered to Windsurf's LLM servers.

**Conclusion**: The user's claim is **substantively correct**. Windsurf restricts LLM provider choice to its own model menu plus BYOK for select Anthropic models. Local Ollama or custom LLM endpoints are not supported. This feature differentiates Flux Flow by allowing users to choose between GitHub Copilot and local Ollama.

---

## Clarifications

### Session 2026-04-11

- Q: Should Ollama provider selection apply to the Chat Participant feature too, or only AI Refine and AI Explain? → A: Only Refine and Explain; Chat Participant stays Copilot-only
- Q: Should the architecture support additional providers beyond Copilot and Ollama in the future? → A: Binary toggle for v1; future extensibility is out of scope
- Q: Should users be able to cancel slow Ollama requests mid-generation? → A: Yes, add cancellation support for in-flight requests
- Q: Is privacy/offline capability an explicit goal of this feature? → A: Benefit, not primary goal; main motivation is LLM provider freedom

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Select LLM Provider (Priority: P1)

A writer using an editor that restricts their LLM choice (e.g., Windsurf) wants to switch to Flux Flow and use their own local Ollama installation for AI text refinement and explanation. They need a settings-based way to choose between GitHub Copilot (default) and a local Ollama instance.

**Why this priority**: Core feature. Without provider selection, all AI features are locked to GitHub Copilot. P1 because it unlocks the entire value proposition of LLM freedom.

**Independent Test**: User can open VS Code Settings, change the LLM provider from "GitHub Copilot" to "Ollama", and have AI Refine and AI Explain route to Ollama instead of Copilot. The Chat Participant remains Copilot-only regardless of provider selection.

**Acceptance Scenarios**:

1. **Given** the extension is freshly installed, **When** the user opens AI settings, **Then** the LLM provider defaults to "GitHub Copilot"
2. **Given** the user selects "Ollama" as the LLM provider, **When** they trigger AI Refine on selected text, **Then** the request is sent to the local Ollama instance instead of GitHub Copilot
3. **Given** the user selects "Ollama" as the LLM provider, **When** they trigger AI Explain on a document, **Then** the request is sent to the local Ollama instance instead of GitHub Copilot
4. **Given** the user changes the provider setting, **When** the next AI request is made, **Then** it uses the newly selected provider (no restart required)

---

### User Story 2 - Configure Ollama Model (Priority: P1)

When using Ollama, the user needs to select which local model to use. Different users have different hardware and different models installed. The setting should default to `llama3.2:latest` but allow any model name.

**Why this priority**: Directly tied to P1 Story 1. Without model selection, Ollama support is incomplete. P1 because Ollama users must specify their model.

**Independent Test**: User can set the Ollama model to any installed model name (e.g., `llama3.2:latest`, `codellama:7b`, `mistral:latest`), and AI features use that specific model.

**Acceptance Scenarios**:

1. **Given** the LLM provider is set to "Ollama", **When** the user views the Ollama model setting, **Then** it defaults to `llama3.2:latest`
2. **Given** the LLM provider is set to "Ollama", **When** the user changes the model to `mistral:latest`, **Then** subsequent AI requests use the `mistral:latest` model
3. **Given** the LLM provider is set to "GitHub Copilot", **When** the user views settings, **Then** the Ollama model setting is irrelevant (GitHub Copilot uses its own model selector which already exists)
4. **Given** the user types a custom model name (e.g., `my-fine-tuned-model:v2`), **When** they save, **Then** the system accepts the custom model name for Ollama

---

### User Story 3 - Configure Ollama Server Endpoint (Priority: P2)

Some users run Ollama on a different machine or port. They need to configure the Ollama server URL rather than assuming localhost with default port.

**Why this priority**: Edge case for advanced users. Default `http://localhost:11434` works for most. P2 because standard Ollama installation uses default endpoint.

**Independent Test**: User can set a custom Ollama URL (e.g., `http://192.168.1.100:11434`) and AI requests are routed there.

**Acceptance Scenarios**:

1. **Given** the LLM provider is set to "Ollama", **When** the user views the Ollama endpoint setting, **Then** it defaults to `http://localhost:11434`
2. **Given** the user sets a custom endpoint, **When** an AI request is made, **Then** it uses the custom endpoint URL
3. **Given** the Ollama endpoint is unreachable, **When** an AI request is made, **Then** the user sees a clear error message indicating the connection failed

---

### User Story 4 - Graceful Error Handling (Priority: P2)

When the selected LLM provider is unavailable (Ollama not running, Copilot not signed in), the user should see clear, actionable error messages rather than generic failures.

**Why this priority**: Quality of life. P2 because the system should degrade gracefully.

**Independent Test**: When Ollama is selected but not running, AI features show a helpful error message instead of crashing.

**Acceptance Scenarios**:

1. **Given** the LLM provider is "Ollama" but Ollama is not running, **When** the user triggers AI Refine, **Then** the user sees a message like "Ollama is not reachable at http://localhost:11434. Please start Ollama or change your LLM provider setting."
2. **Given** the LLM provider is "Ollama" and the model is not installed, **When** the user triggers AI Refine, **Then** the user sees a message indicating the model is not available with the model name shown
3. **Given** the LLM provider is "GitHub Copilot" and Copilot is not signed in, **When** the user triggers AI Refine, **Then** existing error handling continues to work (no regression)

---

### Edge Cases & Decisions

- **Provider switch mid-session**: Changing the provider setting takes effect on the next AI request; no restart needed
- **Ollama not installed**: If user selects Ollama but hasn't installed it, a clear error directs them to install Ollama
- **Model not installed on Ollama**: Error message includes the model name so the user can run `ollama pull <model>`
- **Network timeout**: Ollama requests should have a reasonable timeout (assumed 30 seconds for generation, matching typical local inference times)
- **Streaming responses**: Both providers should stream responses to the UI for consistent user experience
- **Copilot model setting**: The existing `gptAiMarkdownEditor.aiModel` setting continues to control which Copilot model is used when provider is "GitHub Copilot". This is unaffected.
- **Both providers unavailable**: If the selected provider fails, the system does NOT auto-fallback to the other provider. User must explicitly switch.
- **Chat Participant**: The VS Code Chat Participant feature remains exclusively tied to GitHub Copilot regardless of the provider setting. It is out of scope for provider switching.
- **Cancellation**: Users MUST be able to cancel an in-flight Ollama request (e.g., via an Escape key or cancel button) since local models on consumer hardware can take significantly longer than cloud-hosted models.
- **Future providers**: Only GitHub Copilot and Ollama are supported in v1. Adding additional providers (e.g., OpenAI direct, Anthropic direct) is out of scope.
- **Privacy benefit**: Running Ollama locally means AI requests never leave the user's machine, providing a natural privacy benefit. This is a side effect of the architecture, not a primary design goal.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a VS Code setting (`gptAiMarkdownEditor.llmProvider`) to select between "GitHub Copilot" (default) and "Ollama" as the LLM provider
- **FR-002**: When "GitHub Copilot" is selected, all AI features (Refine, Explain, Image Ask) MUST continue working exactly as they do today with no behavioral changes
- **FR-003**: When "Ollama" is selected, all AI features MUST route requests to the user's local Ollama instance instead of GitHub Copilot
- **FR-004**: System MUST provide a VS Code setting (`gptAiMarkdownEditor.ollamaModel`) to specify the Ollama model used for **text refinement and document explanation**, defaulting to `llama3.2:latest`
- **FR-004b**: System MUST provide a separate VS Code setting (`gptAiMarkdownEditor.ollamaImageModel`) to specify the Ollama model used for **image analysis (vision tasks)**, defaulting to `llama3.2-vision:latest`. This allows users to configure a vision-capable model independently from their text model.
- **FR-005**: System MUST provide a VS Code setting (`gptAiMarkdownEditor.ollamaEndpoint`) to specify the Ollama server URL, defaulting to `http://localhost:11434`. Both text and image model requests share this endpoint.
- **FR-006**: System MUST stream responses from Ollama to provide the same progressive-display experience as GitHub Copilot responses
- **FR-007**: System MUST display clear, actionable error messages when the selected LLM provider is unreachable or the model is unavailable
- **FR-008**: All Ollama model settings MUST accept any string value (free-form text input) to allow custom model names
- **FR-009**: Changing provider or model settings MUST take effect on the next AI request without requiring a VS Code restart
- **FR-010**: AI Refine (all modes + custom) and AI Explain MUST use `ollamaModel` when provider is Ollama. Image Ask MUST use `ollamaImageModel` when provider is Ollama. The Chat Participant is excluded and remains Copilot-only.
- **FR-011**: The existing Copilot model selection setting (`gptAiMarkdownEditor.aiModel`) MUST remain functional and unaffected when "GitHub Copilot" is the selected provider
- **FR-012**: Users MUST be able to cancel an in-flight Ollama request before it completes, returning to the pre-request state without applying partial results
- **FR-013**: The AI panel (AI Summary / Image Ask results) MUST display the model name (provider + model) in the footer **immediately when the panel opens**, before the response is received, so users can anticipate response time. The display format MUST be `<provider> / <model>` (e.g., `Ollama / llama3.2:latest` or `GitHub Copilot / gpt-4.1`).
- **FR-014**: When showing the model in the AI panel footer for image tasks, the system MUST show the image model (`ollamaImageModel` or the Copilot model), not the text model.

### Key Entities

- **LLM Provider**: The backend service used for AI inference. Currently "GitHub Copilot", adding "Ollama" as an alternative
- **Text Model**: The specific language model used for text refinement and document explanation. For Copilot: model family from existing setting. For Ollama: `ollamaModel` setting (e.g., `llama3.2:latest`)
- **Image Model**: The specific language model used for image/vision analysis. For Copilot: same as text model (all selected Copilot models support vision). For Ollama: `ollamaImageModel` setting (e.g., `llama3.2-vision:latest`) — kept separate because vision models are distinct from general-purpose text models in Ollama
- **Ollama Endpoint**: The server address where Ollama is running (default `http://localhost:11434`). Shared by both text and image model requests.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can switch between GitHub Copilot and Ollama with a single settings change and have all AI features work with the selected provider
- **SC-002**: AI Refine produces equivalent-quality text transformations with Ollama as it does with GitHub Copilot (same prompts, comparable output)
- **SC-003**: AI Explain produces valid document summaries with Ollama using the same prompt structure as GitHub Copilot
- **SC-004**: Users receive a clear, actionable error message within 5 seconds when their selected provider is unreachable
- **SC-005**: Response streaming works with both providers, showing progressive text output during generation
- **SC-006**: Switching providers takes effect immediately (no VS Code restart required)
- **SC-007**: All existing tests continue to pass with zero regressions when the default provider (GitHub Copilot) is selected
- **SC-008**: The AI panel footer shows the current model (provider + model name) as soon as the panel opens — visible before and during generation, not only after completion
- **SC-009**: Image Ask requests use `ollamaImageModel` while text requests use `ollamaModel` — the two can be configured to different models independently

---

## Assumptions

- Users have Ollama installed and running locally if they select it as their provider. The extension does not install or manage Ollama.
- Ollama supports streaming responses compatible with the extension's progressive-display needs
- The default Ollama text model `llama3.2:latest` is capable enough for text refinement and summarization tasks (it is a general-purpose LLM)
- The default Ollama image model `llama3.2-vision:latest` supports the Ollama vision input format (base64 images in the `images` field)
- The existing system prompt and user prompt structure works with both Copilot and Ollama models (no provider-specific prompt engineering needed in v1)
- GitHub Copilot remains the default provider to maintain backward compatibility for existing users
- The extension does not need to verify which models are installed on Ollama; it sends requests and reports errors if the model is unavailable
- Both text and image Ollama models share the same endpoint; users do not need separate Ollama instances for text vs. vision tasks
