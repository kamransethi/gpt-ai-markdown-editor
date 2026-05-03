# Feature Specification: Graceful Copilot Fallback & Lower Version Support

**Folder**: `specs/015-graceful-copilot-fallback/`  
**Created**: April 16, 2026  
**Status**: Draft  
**PRD Domains**: `ai-features`, `configuration`  
**Input**: User description: "Lower minimum version to v1.90. Make Chat Participant fail with a message IF the selected model is GitHub Copilot and not available (either cause of VS version being too low, the user not signed up for GitHub Copilot, or the extension being used in Cursor or Windsurf). In the error, encourage the user to use Ollama configuration as an option or alternatively sign up for GitHub Copilot and use VS Code."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Existing User with Copilot on Latest VS Code (Priority: P1)

User has GitHub Copilot subscription and VS Code 1.90+. They use the Chat Participant normally without any interruptions. This validates that the core feature still works for the primary use case.

**Why this priority**: The main target user—existing Copilot users on current VS Code—must continue to work seamlessly. This is the baseline happy path.

**Independent Test**: Chat Participant (@markdown-editor) can be invoked and responds to questions about markdown documents.

**Acceptance Scenarios**:

1. **Given** VS Code 1.90+, GitHub Copilot signed in, **When** user types `@markdown-editor` in chat, **Then** chat participant appears and responds normally
2. **Given** markdown document open, **When** user asks "@markdown-editor: summarize this document", **Then** response is generated via Copilot

---

### User Story 2 - Ollama User Chooses Ollama Provider (Priority: P1)

User has Ollama running locally. They configure the extension to use Ollama instead of Copilot. Chat Participant works via Ollama without errors.

**Why this priority**: Ollama is the primary fallback. Users without Copilot should be able to use the extension by switching providers. This unblocks the feature for non-Copilot users.

**Independent Test**: When LLM provider is set to Ollama, Chat Participant works via local Ollama instance.

**Acceptance Scenarios**:

1. **Given** Ollama running on localhost:11434, **When** user sets `gptAiMarkdownEditor.llmProvider` to "Ollama", **Then** Chat Participant uses Ollama
2. **Given** markdown document open, **When** user invokes Chat Participant with Ollama configured, **Then** response comes from Ollama without Copilot error

---

### User Story 3 - No Copilot Available, Copilot Selected, Auto-Detect Ollama (Priority: P1)

User is on VS Code 1.90+, no Copilot subscription, but has Ollama running locally. When they try to use Chat Participant with Copilot selected, the system detects Ollama is available and suggests switching to it.

**Why this priority**: Gives users an immediate solution without requiring manual configuration. Auto-detection creates a smooth UX for the fallback case.

**Independent Test**: Error message suggests Ollama when both Copilot is unavailable and Ollama is reachable.

**Acceptance Scenarios**:

1. **Given** Copilot unavailable, Ollama running locally, Copilot provider selected, **When** user tries to use Chat Participant, **Then** error shows "Ollama detected—switch to Ollama provider?"
2. **Given** error message shown, **When** user clicks "Switch to Ollama", **Then** Chat Participant uses Ollama immediately

---

### User Story 4 - No Copilot, No Ollama, User Sees Setup Instructions (Priority: P2)

User has no Copilot and no Ollama. When they try Chat Participant, they get clear instructions on how to set up either option.

**Why this priority**: Ensures users aren't left hanging. Guides them toward a working solution. Slightly lower priority than detecting Ollama because it requires user action.

**Independent Test**: Clear setup instructions appear when Copilot unavailable and Ollama not detected.

**Acceptance Scenarios**:

1. **Given** Copilot unavailable, Ollama not detected, **When** user invokes Chat Participant, **Then** error message includes links/instructions for Ollama setup and Copilot signup
2. **Given** error shown, **When** user follows Ollama link, **Then** they arrive at Ollama installation page
3. **Given** error shown, **When** user follows Copilot link, **Then** they arrive at GitHub Copilot signup page

---

### User Story 5 - Cursor/Windsurf Environment with Copilot Unavailable (Priority: P2)

User is in Cursor or Windsurf IDE with Copilot-as-provider selected, but the environment doesn't expose the `vscode.lm` API (or Copilot isn't available). Error message acknowledges the environment and provides specific guidance.

**Why this priority**: Cursor/Windsurf users are a distinct segment. Acknowledging their environment builds trust and provides relevant solutions (e.g., "Switch to Ollama" is always available in those IDEs).

**Independent Test**: Error message customizes language based on detected IDE environment.

**Acceptance Scenarios**:

1. **Given** running in Cursor/Windsurf, Copilot unavailable, **When** user tries Chat Participant, **Then** error says "In Cursor/Windsurf, use Ollama or sign up for Copilot in VS Code"
2. **Given** error shown, **When** user follows Ollama instructions, **Then** Chat Participant works via Ollama

---

### User Story 6 - Extension Load Does Not Show Errors (Priority: P1)

When the extension loads, it silently detects which providers are available. No prompts, dialogs, or error messages appear on activation. Errors only appear when the user actually tries to use a feature.

**Why this priority**: Extension activation must be clean and non-intrusive. Users shouldn't be nagged about Copilot status if they don't use the Chat Participant.

**Independent Test**: Extension activates without showing any dialogs or notifications about Copilot/Ollama availability.

**Acceptance Scenarios**:

1. **Given** extension activates (any provider availability state), **When** extension finishes loading, **Then** no dialog or notification about Copilot/Ollama appears
2. **Given** Chat Participant not used, **When** user edits markdown files, **Then** no Copilot/provider-related messages appear

---

### Edge Cases

- What happens when user switches LLM provider mid-session? (Provider change should take effect immediately on next Chat Participant invocation)
- What if Ollama becomes unreachable after extension load? (Graceful error when Chat Participant is invoked; suggest checking Ollama server)
- What if user has Copilot on VS Code 1.89 (just below minimum)? (Chat Participant disabled; error explains minimum version is 1.90)
- What if running in VS Code Web (web-based VS Code)? (Check if `vscode.lm` is available; if not, treat as Copilot unavailable)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Minimum VS Code version MUST be lowered from 1.115.0 to 1.90 in `package.json`
- **FR-002**: Chat Participant registration (`vscode.chat.createChatParticipant`) MUST be wrapped in a try-catch; if registration fails, silently skip without showing user errors during activation
- **FR-003**: When user invokes Chat Participant or related AI features (context menu, main menu), system MUST attempt to initialize the selected LLM provider
- **FR-004**: If GitHub Copilot provider is selected and unavailable (no Copilot subscription, VS Code version <1.90, or running in Cursor/Windsurf without Copilot), the system MUST check if Ollama is reachable on the configured endpoint
- **FR-005**: If Ollama is detected as reachable, error message MUST suggest switching to Ollama provider with a quick action button
- **FR-006**: If Ollama is NOT reachable, error message MUST provide setup instructions for both Ollama and GitHub Copilot with clickable links
- **FR-007**: Error message text MUST be customized based on detected environment (VS Code, Cursor, or Windsurf)
- **FR-008**: Ollama auto-detection MUST use a non-blocking HTTP HEAD request to `<ollama-endpoint>/api/tags` with a 2-second timeout
- **FR-009**: Error MUST appear only when user invokes a feature (Chat Participant, AI Refine, AI Explain, etc.), NOT during extension activation
- **FR-010**: System MUST respect user's explicit LLM provider selection; if Ollama is selected, Chat Participant MUST use Ollama regardless of Copilot availability
- **FR-011**: Error messages MUST include clear, non-technical language suitable for end users
- **FR-012**: All AI-related features (Chat Participant, AI Refine, AI Explain, image AI Ask, etc.) MUST fail gracefully with the same provider-unavailable error

### Key Entities

- **LLM Provider State**: Current provider selection ("GitHub Copilot" or "Ollama"), availability status, reachability
- **Environment**: Detected IDE (VS Code, Cursor, Windsurf)
- **Error Context**: Which feature triggered the error, which provider was attempted, what fallbacks are available

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Extension installs and activates on VS Code 1.90+ without errors
- **SC-002**: Users with Copilot on VS Code 1.90+ can use Chat Participant without interruption
- **SC-003**: Users with Ollama configured can use Chat Participant and AI features without Copilot errors
- **SC-004**: When Copilot is unavailable and Ollama is reachable, auto-detection suggests Ollama to users ≥90% of the time
- **SC-005**: Extension does not show any dialogs, notifications, or messages during activation (silent initialization)
- **SC-006**: Error messages appear within 1 second of user invoking a feature that requires an unavailable provider
- **SC-007**: Users can follow instructions in error message to set up Ollama or Copilot and immediately retry without restarting extension
- **SC-008**: Setup instruction links are accurate and lead to correct external pages (Ollama docs, Copilot signup)
- **SC-009**: No regressions: existing tests pass, Chat Participant still works for all supported provider configurations

## Assumptions

- Users with Copilot already have it signed in to VS Code; no explicit login is required by the extension
- Ollama server responds to HTTP requests within reasonable timeouts (2 seconds for health check)
- Users have permission to change extension settings; no enterprise policies prevent provider switching
- VS Code 1.90+ is freely available to all users who want to upgrade
- Cursor and Windsurf environments do not expose the `vscode.lm` API or do so with differences that would require special handling
- Users understand the distinction between "GitHub Copilot (requires subscription)" and "Ollama (free, local)"
- Error messages in multiple environments (VS Code, Cursor, Windsurf) can be differentiated via extension environment variables or API checks
- Chat Participant is not critical to core markdown editing; users can edit markdown even if Chat Participant fails
