# Spec: Knowledge Graph & AI Settings Refinements (Bug Fixes)

## Problem Description
Following the implementation of the Knowledge Graph Phase 1 and AI Settings overhaul, several critical bugs and UX inconsistencies were identified:
1. **Hardcoded LLM Backend**: Graph Chat was hardcoded to use Ollama for text generation, ignoring the user's selected LLM Provider (e.g., GitHub Copilot).
2. **Incorrect Search Mode Status**: The "Search Mode" indicator on the Graph settings page incorrectly showed "Hybrid" even when the Embedding Model was set to "Disabled".
3. **Theme Inconsistency**: Graph Chat sometimes defaulted to VS Code's dark theme (via `.vscode-dark`) even when the user set the editor to Light mode in custom settings.
4. **Broken Links**: Inline file reference links (e.g., `(src/foo.md)`) in the Graph Chat assistant output were not clickable, although the "sources found" panel items worked correctly.

## Success Criteria
- [x] **Dynamic LLM Provider**: Graph Chat correctly utilizes the `llmProvider` setting (GitHub Copilot or Ollama) for text generation.
- [x] **Accurate Search Status**: The Search Mode indicator correctly displays "Lexical Only" when the Embedding Model is "Disabled".
- [x] **Strict Theme Adherence**: Graph Chat webview strictly follows the editor's `themeOverride` setting, ignoring VS Code's system theme.
- [x] **Clickable File Links**: Inline markdown file references in chat output are interactive and open the respective files when clicked.

## Proposed Changes

### AI & Graph Logic [Extension Host]
- **`graphChat.ts`**: Updated `streamAnswer` to use the `createLlmProvider()` factory instead of a hardcoded provider.

### Settings UI [Webview]
- **`settingsPanel.ts`**: Updated the conditional logic for the Search Mode badge to accurately reflect the "Disabled" state of the embedding model.

### Graph Chat [Webview]
- **`chatWebview.ts`**: 
    - Added event listeners for the `.chat-file-ref` class to handle clicks on inline file links.
    - Ensured `setTheme` correctly updates the `data-theme` attribute for strict CSS scoping.
- **`chatWebview.css`**: Removed the `.vscode-dark` selector from the dark theme media query to prevent VS Code theme leakage.

## Verification Results
- **Dynamic Provider**: Verified that switching to GitHub Copilot correctly routes RAG queries through the Copilot backend.
- **Search Mode**: Confirmed the badge switches between "Hybrid" and "Lexical Only" based on the Embedding Model setting.
- **Theming**: Confirmed Graph Chat remains in Light mode when the editor is Light, regardless of VS Code's theme.
- **Interactivity**: Confirmed that clicking `(path/to/file.md)` in a chat response opens that file in the editor.
