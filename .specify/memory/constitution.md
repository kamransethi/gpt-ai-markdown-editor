# Visual AI Markdown Editor — Constitution

> Governing principles for the VS Code WYSIWYG Markdown Editor.
> This is the single source of truth for project constraints, quality standards, and architectural decisions.

---

## I. Reading Experience is Paramount

Typography and readability are the product. Every decision must serve the reading experience first.

- Serif body text (Charter/Georgia) — prose, not code
- Generous spacing — white space is a feature, not waste
- Test every visual change by reading a 3000+ word doc for 10+ minutes in both light and dark themes
- UX question: "Does this improve the reading experience?" — if not, reconsider

## II. Test-Driven Development (NON-NEGOTIABLE)

**RED → GREEN → REFACTOR → VERIFY**

1. Write failing tests BEFORE implementation
2. Implement the simplest clean solution to make tests pass
3. Refactor while keeping tests green
4. Run `npm test` — ALL tests must pass (new + existing)
5. Cover positive, negative, and edge cases

Bug fixes follow the same flow: write a failing test that replicates the bug, then fix it.

No task is "done" until all tests pass. No quick hacks or patches — audit and fix root causes.

## III. Performance Budgets

| Metric | Budget |
|--------|--------|
| Editor initialization | <500ms |
| Typing latency | <16ms (never block the editor thread) |
| Other interactions (cursor, formatting) | <50ms |
| Menu/toolbar actions | <300ms |
| Document sync debounce | 500ms |
| External update skip | 2s (don't interrupt user if they edited recently) |
| Target document size | 10,000+ lines handled smoothly |

Performance is a day-1 constraint, not a "we'll optimize later" item.

## IV. Embrace VS Code

Don't fight the platform. Integrate deeply.

- **TextDocument is canonical** — the webview renders it; edits flow back to update it. VS Code handles save/undo/redo.
- Inherit theme colors via CSS variables — never hard-code color values
- Follow VS Code keyboard conventions (Ctrl/Cmd+B for bold, etc.)
- Commands must be discoverable via the command palette
- Git diffs and commits must work correctly (text-based provider)
- Scope palette commands with `when: activeCustomEditorId == gptAiMarkdownEditor.editor`

## V. Simplicity Wins

- Simplest solution that works — no over-engineering
- Don't add features, refactor code, or make improvements beyond what was asked
- No speculative "might need" abstractions
- Research official docs (VS Code API, TipTap/ProseMirror) before implementing — prefer facts over assumptions
- Always suggest simpler alternatives if a request is a bandaid or goes against VS Code paradigms

## VI. CSS & Styling Discipline

### Deterministic Color System

All UI colors MUST use variables defined at the top of `editor.css`. Never invent new `--md-*` variables without defining them in `:root`/`body`.

**Key variable mappings:**
- Primary buttons: `--md-button-bg` / `--md-button-fg`
- Primary hover: `--md-button-hover-bg`
- Secondary buttons: `--md-button-secondary-bg` / `--md-button-secondary-fg`
- Cancel/neutral: `background: none; border: 1px solid var(--md-menu-border)`
- Input focus border: `--md-button-bg` (not `--md-accent-primary`)
- Font family for UI: `--md-font-family` (not `--md-font-sans`)

### Button Hierarchy

1. **Primary action** (Submit, Save, Apply): `--md-button-bg` bg + `--md-button-fg` text
2. **Secondary/Cancel**: Transparent bg + `--md-menu-border` border
3. **Danger** (Delete, destructive): `--md-error-fg` color

### CSS Specificity Rules

- After any CSS edit, check `dist/webview.css` with `grep` to confirm the change compiled correctly
- Explicitly calculate specificity of overriding vs overridden rules
- **`:is()` specificity trap**: `:is()` takes the specificity of its HIGHEST-specificity argument. Keep type-only selectors in `:is()` — handle class selectors separately.
- Common values: `.class` = 0,1,0 | `element` = 0,0,1 | `.class element` = 0,1,1

### Theme Support

- Always use VS Code CSS variables (`--vscode-editor-background`, etc.) for theme-aware colors
- Define base styles for light theme, override for `.vscode-dark` / `.vscode-high-contrast`
- Test in light, dark, and high-contrast themes

## VII. Toolbar Order Parity

Keep shared control order identical between the header formatting toolbar and the floating selection toolbar.

Shared controls: **Bold, Italic, Highlight, Text Color, Strikethrough, Inline Code, Heading controls**.

If one toolbar reorders shared controls, the other must be updated in the same change. Prefer a single shared ordering source in `src/webview/BubbleMenuView.ts`.

## VIII. Modular Tiptap Extension Strategy

All custom functionality MUST be implemented as modular Tiptap Extensions.

1. **No Core Redundancy**: If StarterKit or an official `@tiptap/extension-*` provides it, use that. Don't write custom input rules for things official packages handle.
2. **Total Encapsulation**: Extensions must be self-sufficient. DOM manipulation (e.g., drag handles) MUST be in `addNodeView`, NOT via global event listeners in `editor.ts`.
3. **Strict Boundaries**:
   - Extensions reside in `src/webview/extensions/`
   - Export a single `Extension.create()`, `Node.create()`, or `Mark.create()` object
   - Communicate with VS Code backend via standardized `vscode.postMessage` payloads

### TipTap Extension Pattern

1. Create extension in `src/webview/extensions/[feature].ts`
2. Register in `editor.ts` extensions array
3. Add toolbar button in `BubbleMenuView.ts` (if UI needed)
4. Wire messages in `MarkdownEditorProvider.ts` (if extension-side logic needed)
5. Add command in `package.json` contributes (if command palette entry needed)

## IX. Error Handling & Runtime Safety

### Critical Operations (save, sync, file operations)

- All `async` functions must have try/catch
- Show user-visible error notifications for failures that risk data loss
- Log with `[DK-AI]` context prefix
- Include technical details only when Developer Mode is enabled (`gptAiMarkdownEditor.developerMode`)

### Runtime Error Policy

- Throttle repeated error notifications to avoid spam loops
- Never silently discard failures that risk data loss
- Use `console.error()` for errors (always kept), `console.log()` for dev debugging (removed in production)

## X. Document Sync Pitfalls

These are critical known issues — read before working on sync/editor state:

1. **Feedback loops**: Set `ignoreNextUpdate` flag when applying edits. Check `lastEditTimestamp` before updating from external changes. Skip if content unchanged.
2. **Cursor position**: Save cursor before content updates, restore after. Update selection AFTER content, or cursor jumps to start.
3. **Performance with large docs**: 500ms debounce on updates. Skip redundant updates. Respect user editing state.
4. **Mermaid rendering**: Always wrap in try/catch. Provide fallback UI with error message and code view option.

## XI. TypeScript Standards

- Strict mode enabled (tsconfig)
- Prefer `const` over `let`, never `var`
- Add types for function parameters and returns — no `any`
- Meaningful variable names (no `x`, `temp`, `data`)
- Private members prefixed with `_`
- JSDoc for all exported functions (params, returns, throws)
- Inline comments explain WHY, not WHAT

## XII. Image & DOM Handling

- Images are `inline: true` with atomic behavior (avoids phantom gaps between consecutive images)
- NodeView structure: `<span class="image-wrapper">` with `display: inline-block`
- Enter key handlers: return `true` to stop propagation — `preventDefault()` alone doesn't stop ProseMirror handlers
- Empty paragraph handling: filter at serialization time, NOT during typing (which causes cursor jumps)
- Position calculation: use `$from.after($from.depth)` for safe positions, avoid `$pos.end(0)` which can overflow

---

*Last updated: 2026-04-04*

## [SECTION_2_NAME]
<!-- Example: Additional Constraints, Security Requirements, Performance Standards, etc. -->

[SECTION_2_CONTENT]
<!-- Example: Technology stack requirements, compliance standards, deployment policies, etc. -->

## [SECTION_3_NAME]
<!-- Example: Development Workflow, Review Process, Quality Gates, etc. -->

[SECTION_3_CONTENT]
<!-- Example: Code review requirements, testing gates, deployment approval process, etc. -->

## Governance
<!-- Example: Constitution supersedes all other practices; Amendments require documentation, approval, migration plan -->

[GOVERNANCE_RULES]
<!-- Example: All PRs/reviews must verify compliance; Complexity must be justified; Use [GUIDANCE_FILE] for runtime development guidance -->

**Version**: [CONSTITUTION_VERSION] | **Ratified**: [RATIFICATION_DATE] | **Last Amended**: [LAST_AMENDED_DATE]
<!-- Example: Version: 2.1.1 | Ratified: 2025-06-13 | Last Amended: 2025-07-16 -->
