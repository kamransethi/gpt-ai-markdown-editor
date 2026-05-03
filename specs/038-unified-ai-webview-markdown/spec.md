# Feature Specification: Unified AI Explanation Webview with Markdown Table Support

**Folder**: `specs/038-unified-ai-webview-markdown/`  
**Created**: 2026-05-03  
**Status**: Draft  
**PRD Domains**: `ai-features`, `images`, `tables`  
**Input**: User request to unify AI explanation webviews and add markdown table support for both text operations and image analysis

---

## User Scenarios &amp; Testing *(mandatory)*

### User Story 1 — Display AI Summary with Rich Formatting (Priority: P1)

As a user, I want to read AI-generated summaries and analyses with proper formatting including tables, lists, and bold text, so that complex information is presented clearly and organized.

**Why this priority**: Currently table formatting doesn't display correctly in the AI explanation panel, making structured data unreadable. This is the primary blocker for professional use.

**Independent Test**: User generates a summary of a document. The panel displays formatted text with tables, bullet lists, and headers that match markdown rendering. User can read all structured data clearly.

**Acceptance Scenarios**:

1. **Given** document text is sent to AI for summary, **When** AI returns response with markdown tables, **Then** tables render with borders, headers, and aligned columns in the webview
2. **Given** AI response contains markdown (bold, italic, lists, code), **When** response loads in panel, **Then** all formatting displays correctly
3. **Given** panel contains long table, **When** user views panel, **Then** table is scrollable without breaking layout

---

### User Story 2 — Unified Component for Text and Image Analysis (Priority: P1)

As a developer maintaining the codebase, I want a single webview component that handles both document summaries and image analysis results, so that I don't maintain duplicate UI code.

**Why this priority**: Two separate webview implementations create code duplication, inconsistent UX, and duplicate bug fixes. Unifying reduces maintenance burden and ensures feature parity.

**Independent Test**: Both text AI operations (Generate Summary) and image AI ask (Explain Image) display results in the same webview panel. Styling and formatting behavior are identical between the two.

**Acceptance Scenarios**:

1. **Given** user triggers "Generate Summary" from AI menu, **When** result loads, **Then** panel shows "AI Summary" title with result formatted as markdown
2. **Given** user right-clicks image and selects "Explain Image", **When** result loads, **Then** same panel shows "Explain Image" title with result formatted as markdown
3. **Given** both operations display results in succession, **When** switching between them, **Then** panel reuses same DOM structure (no create/destroy cycles)

---

### User Story 3 — Copy and Insert Actions from Unified Panel (Priority: P2)

As a user, I want to copy AI-generated explanations or insert them into my document from a single, consistent interface, so that workflow is predictable regardless of operation type.

**Why this priority**: User actions (copy, insert) should be available for all AI operations, but currently scattered across different implementations.

**Independent Test**: User generates both a summary and image explanation. Both panels offer copy button. Insert button appears for applicable operations. Actions work identically.

**Acceptance Scenarios**:

1. **Given** AI explanation is displayed in panel, **When** user clicks "Copy", **Then** explanation text is copied to clipboard with confirmation feedback
2. **Given** image explanation result is shown, **When** user clicks "Insert Below", **Then** text is inserted into document below the image
3. **Given** document summary is displayed, **When** user clicks "Insert Below", **Then** text is inserted at cursor position

### User Story 4 — Stream Information to the WebView (Priority: P1)

As a user, I want to see the explanation, description or summary (whatever the user requested) STREAM to the webview so they can see it appearing - this should  share the same DNA as the GraphChat feature already in the app. This allows faster time to view. This feature is already done in Graph Chat, I’m wondering if you can reuse it.
**Why this priority**: Streaming shows results as they arrive, reducing time-to-first-token perception and improving responsiveness. GraphChat already implements this pattern successfully.

**Independent Test**: User generates summary. Text appears incrementally in panel as response arrives. User can read partial results before completion. Panel correctly displays markdown formatting for each chunk.

**Acceptance Scenarios**:

1. **Given** AI operation is triggered, **When** LLM response begins streaming, **Then** webview receives discrete CHUNK messages with incremental text
2. **Given** chunks are arriving, **When** markdown formatting is applied, **Then** tables and lists render correctly even during partial updates
3. **Given** streaming is in progress, **When** user clicks cancel/stop, **Then** in-flight chunks halt and partial response remains visible

---

## Clarifications

### Session 2026-05-03

- Q: How does GraphChat stream data to the webview? → A: Extension host loops async generator events (`streamAnswer()`), posting discrete messages to webview: `CHUNK` (with incremental + accumulated text), `SOURCES`, `DONE`, `ERROR`. Webview accumulates and renders incrementally. Uses `AbortController` for cancellation.
- Q: Should response length limit be 4K or 15K characters? → A: 4K hard limit (stop reading from LLM at 4K, prevent buffer bloat during streaming, performance optimization).
- Q: Which markdown rendering library should be used? → A: `markdown-it` v14.1.1 (already in dependencies). Supports tables, GFM, integrates with `highlight.js` for code syntax highlighting. Zero additional bloat.
- Q: Should rendered markdown be sanitized before displaying in webview? → A: No sanitization (assume LLM provider output is safe and trusted).
---

### Edge Cases

- What happens when AI response is very long (&gt;10,000 characters)? : Stop at 4K characters
- How does panel handle responses with both tables and code blocks? Should come correctly. See GraphChat implementation
- What if markdown rendering contains nested elements (tables inside blockquotes)? Render those - Assumption is that markdown will be correct
- How does panel scroll behavior work on mobile or narrow viewports? No special handling - Ideally the webview should be resizeable.

---

## Functional Requirements


| ID     | Requirement                                                                                                                                              |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-001 | The unified AI webview panel MUST render markdown syntax including headings, bold, italic, lists, links, code blocks, and tables                         |
| FR-002 | The panel MUST support table formatting with borders, header styling, and aligned columns (not plain text tables)                                        |
| FR-003 | The same webview component MUST be used for both text AI operations (summaries, refinements) and image AI ask results                                    |
| FR-004 | The panel MUST display context-specific titles ("AI Summary" for documents, "Explain Image" for images, "Ask About Image" for custom questions)          |
| FR-005 | The panel MUST provide a "Copy" button to copy the AI response text to clipboard                                                                         |
| FR-006 | The panel MUST provide context-appropriate action buttons (e.g., "Insert Below" for image extraction/description, "Insert Below" for document summaries) |
| FR-007 | The panel footer MUST display the LLM model name used to generate the response                                                                           |
| FR-008 | The panel MUST enforce a hard limit of 4,000 characters maximum per response (stop reading from LLM at this threshold)                                   |
| FR-009 | The panel MUST close when user clicks the close button or clicks outside the panel                                                                       |


---

## Success Criteria


| ID     | Criterion                                                                                                                               |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| SC-001 | Text AI operations and image AI ask both display results in the same webview component (not separate implementations)                   |
| SC-002 | Markdown tables render with proper formatting (borders, aligned columns, header styling) in all AI response types                       |
| SC-003 | Both text summaries and image analysis results display formatted markdown (bold, italic, lists, headers, tables, code blocks) correctly |
| SC-004 | Copy button successfully copies full response text to clipboard with user-visible confirmation                                          |
| SC-005 | Insert button (when present) successfully inserts response text into document at correct position                                       |
| SC-006 | No regression in AI response generation, provider selection, or error handling from existing specs                                      |
| SC-007 | Panel layout remains stable across different response lengths and markdown complexity                                                   |
| SC-008 | All 1000+ existing tests continue to pass                                                                                               |
| SC-009 | Responses are truncated at exactly 4,000 characters; no responses exceed this limit in the webview                                       |


---

## Out of Scope

- Real-time markdown preview as user types (only for AI-generated responses)
- Custom markdown dialect or extensions beyond CommonMark
- Exporting responses to external formats (PDF, Word, etc.)
- Print styling for the panel
- Syntax highlighting inside markdown code blocks (basic code display only)

---

## Assumptions

1. **Markdown library available**: `markdown-it` v14.1.1 is available in project dependencies and will be used for markdown-to-HTML rendering with GitHub Flavored Markdown support
2. **Response format**: AI providers continue returning plain markdown text (no embedded HTML or special formatting required)
3. **Panel positioning**: Webview panel continues to appear in fixed position on right side of editor (not repositionable)
4. **Action availability**: Not all operations need all buttons (e.g., document summary may not have "Insert Below" if used differently than image extraction)
5. **CSS strategy**: Existing CSS variables for theming (`--md-foreground`, `--md-border`, etc.) continue to work for unified component styling
6. **Security approach**: LLM provider output is assumed to be safe and trusted; no HTML sanitization will be applied to rendered markdown

---

## Related Specifications

- **Spec 005**: AI refine formatting preservation (inline text refinement)
- **Spec 011**: Image AI ask workflows (image analysis)
- **Spec 022**: Premium editor features and AI refinements

---

## Implementation Notes

### Current State

- Text operations use `src/webview/extensions/aiExplain.ts` for display logic
- Image operations use the same module but with different titles and action buttons
- Markdown rendering is not applied — responses display as plain text
- Table formatting does not render properly

### What Needs to Change

- Extract shared webview panel UI into a single, reusable component
- Add markdown-to-HTML rendering for all AI responses
- Unify action button logic (copy, insert) into one place
- Update panel styling to accommodate markdown-rendered content

### Why This Matters

- Eliminates code duplication between text and image operations
- Fixes table rendering issue for all AI operations at once
- Provides better UX through consistent formatting
- Easier to add new AI operations in the future (they automatically support tables, copy, insert)