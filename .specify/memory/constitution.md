# Flux Flow Markdown Editor — Constitution

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
4. Run `npm test` — ALL tests must pass (new + existing, currently 1000+)
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

All custom functionality MUST be implemented as modular Tiptap Extensions. The project baseline is TipTap 3.22.4+, which provides hardened serialization for tables and task lists.

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

1. **Feedback loops**: Set `ignoreNextUpdate` flag when applying edits. Check `lastEditTimestamp` before updating from external changes. Skip if content unchanged. Frontmatter is parsed using `gray-matter` to ensure metadata integrity independent of TipTap serialization.
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

## XIII. Specs, Implementation Plans, and Test-Driven Development

**Workflow**: `spec.md` → LLM ANALYSIS (behind scenes) → `implementation_plan.md` → Review 1 (design) → LLM code → Tests → Review 2 (code)

This section defines how to create specs, plan implementations, and handoff to LLM for development.

### The Workflow

1. **Create spec.md** (manual, user-written)
   - Level-appropriate template (quick bug, medium feature, or major feature)
   - Use `/speckit.specify` to clarify with LLM
   - Finalize and commit spec.md

2. **LLM ANALYSIS** (internal LLM reasoning, not a file)
   - Read spec.md
   - Understand problem/requirements
   - Research technical approach
   - Determine tech stack and architecture
   - *Result: Passed to LLM context, not committed*

3. **Generate implementation_plan.md** (LLM + user review)
   - LLM creates plan based on ANALYSIS
   - Files to change + functions to modify
   - Test cases to write
   - High-level code structure
   - *User reviews and approves (Review 1)*

4. **LLM Writes Code** (TDD: test first)
   - Implement tests that fail (RED)
   - Implement code to pass tests (GREEN)
   - Refactor while keeping tests green
   - Run `npm test` (new + relevant category tests)
   - Run `npm test` (all 828 tests — regression suite)

5. **User Code Review** (Review 2)
   - Review final code and tests
   - Verify acceptance criteria met
   - Approve or request changes

6. **Merge to Main**
   - Commit: spec.md + implementation_plan.md + code + tests
   - IMPLEMENTATION.md auto-generated or manual summary
   - Ready for changelog/release notes

### Three-Level System

**Decision Tree**: Choose based on scope and effort

```
Is this a bug or <1 day of work?
  → YES: Level 1 (Quick Bug)
  
Is it 2-3 days and clear scope?
  → YES: Level 2 (Medium Feature)
  
Is it >1 week or unclear scope?
  → YES: Level 3 (Major Feature)
```

#### Level 1: Quick Bug (NNN-BUG-issue-name)

**Use case**: Bug fixes, small features, quick iterations  
**Folder**: `specs/NNN-BUG-title/`

**Files**:
- **spec.md** (1 page)
  - Problem statement (2-3 sentences)
  - Reproduction steps (numbered)
  - Acceptance criteria (3-5 bullet points)
  - Related issues (if any)
- **implementation_plan.md** (half page)
  - Files to change (list)
  - Key functions/components
  - Test cases to write (list)
  - Estimated complexity
- **test.ts** (LLM writes after plan approved)
  - Failing test reproducing bug
- **IMPLEMENTATION.md** (after merge)
  - What changed (2-3 sentences max)
  - Why it matters to users
  - Technical notes if needed

**Review Process**:
1. User approves spec.md + implementation_plan.md
2. LLM codes + tests
3. User reviews code
4. Merge

**Effort**: ~30 min review + LLM coding

---

#### Level 2: Medium Feature (NNN-FEATURE-issue-name)

**Use case**: Features with clear design, modest scope  
**Folder**: `specs/NNN-FEATURE-title/`

**Files**:
- **spec.md** (2-3 pages)
  - User scenarios/acceptance scenarios (Given/When/Then format)
  - Requirements (FR-NNN style)
  - Success criteria
  - Edge cases
- **implementation_plan.md** (1-2 pages)
  - Architecture overview
  - Files and structure
  - Test plan (unit, integration)
  - Phased approach if multi-step
  - Tech decisions (why this approach)
- **test.ts** (LLM writes)
  - Comprehensive test cases
- **IMPLEMENTATION.md** (after merge)
  - Overview of changes
  - User-facing benefits
  - Technical decisions made

**Review Process**:
1. User approves spec.md
2. LLM generates implementation_plan.md (uses /speckit.plan if helpful)
3. User approves plan
4. LLM codes + tests
5. User reviews code
6. Merge

**Effort**: ~1-2 hours review + LLM coding

---

#### Level 3: Major Feature (NNN-MAJOR-issue-name)

**Use case**: Large features, architectural changes, multi-week effort  
**Folder**: `specs/NNN-MAJOR-title/`

**Files**:
- **spec.md** (4-6 pages, full speckit template)
  - User stories P1, P2, P3 (independently testable)
  - Requirements (FR-NNN traceability)
  - Success criteria
  - Assumptions and constraints
  - Edge cases and error handling
- **research.md** (from /speckit.plan Phase 0)
  - Technology research
  - Decisions made (with rationale)
  - Alternatives considered
- **implementation_plan.md** (2-4 pages, from /speckit.plan Phase 1)
  - Architecture and data model
  - Phase breakdown (if multi-week)
  - Test strategy
  - Dependencies and risks
  - Tech stack justification
- **tasks.md** (from /speckit.tasks Phase 2)
  - Actionable tasks with dependencies
  - Estimated effort per task
- **test.ts** (LLM writes)
  - Comprehensive test matrix
  - Integration tests
- **IMPLEMENTATION.md** (after merge)
  - Feature overview
  - Architecture changes
  - Testing approach used

**Review Process**:
1. User approves spec.md and research.md
2. LLM generates implementation_plan.md (use /speckit.plan)
3. User approves plan
4. Generate tasks.md (use /speckit.tasks)
5. LLM codes per tasks (can handle incrementally)
6. User reviews code at each phase
7. Merge

**Effort**: ~4-8 hours upfront + phased LLM coding

---

### Templates and Integration with /speckit

**Templates** (in `.specify/templates/`):
- `quick-bug.md` — Level 1 minimal spec template
- `medium-feature.md` — Level 2 spec template with scenarios
- `major-feature.md` — Level 3 full speckit template (same as existing spec-template.md)

**Workflow Integration**:
- When using `/speckit.specify`: Auto-detect or ask user (Quick/Medium/Major?)
- Auto-select template based on level
- Rest of /speckit.* commands work unchanged
- Existing major features continue to use existing spec-template.md

**Folder Naming Convention**:
- `NNN-BUG-issue-name` (e.g., 006-BUG-ai-refine-code-blocks)
- `NNN-FEATURE-issue-name` (e.g., 007-FEATURE-dark-mode)
- `NNN-MAJOR-issue-name` (e.g., 008-MAJOR-plugin-system)

### Artifacts in Git

**Always commit**:
- spec.md (problem/requirement definition)
- implementation_plan.md (design approval point)
- Code and tests
- IMPLEMENTATION.md (auto-summarized from changes, or manually written)

**Never commit** (ephemeral):
- ANALYSIS (LLM reasoning from spec → plan, stays in context)
- Intermediate drafts
- Research artifacts (stay in LLM context, summarized in spec/plan)

### Release Notes Generation

**IMPLEMENTATION.md format** (for auto-scraping):

```markdown
# IMPLEMENTATION.md

## What Changed
- File: what changed, why (1 sentence)
- File: what changed, why (1 sentence)

## Why It Matters (User-Facing)
[1-2 sentences for end user viewing release notes]

## How It Works (Technical)
[Internal notes for developers]
```

**Generation**:
After each release, scrape all `specs/*/IMPLEMENTATION.md` files merged in this release.
Format into changelog entry per spec.

### Git Log Discipline

**Commit messages** should reference the spec:
```
fix(editor): fix H1-H3 scroll jiggle

Fixes specs/004-BUG-scroll-regression-fix

Root cause: scrollIntoView() in TOC pane caused layout thrashing.
Solution: Removed scrollIntoView() call.
All 828 tests pass.
```

**Pattern**: `type(scope): description` + `Fixes specs/NNN-issue-name` in commit body.

### Regression Testing

**After each LLM-coded feature**:
1. Run specific test file: `npm test -- test-file.test.ts`
2. Run category tests: `npm test -- --testPathPattern=features` (or similar)
3. Run full regression suite: `npm test` (all 828 tests must pass)

**Failures block merge** — no exceptions.

### Handling Failed or Partial Fixes

**If fix is FAILED** (attempted but cannot implement):
1. Update `spec.md`: Mark `Status: FAILED`
2. Add section: "Why This Cannot Be Fixed" (root cause analysis)
3. Reference platform limitations or architectural conflicts
4. Commit spec + ANALYSIS summary (if valuable for future reference)
5. Move to KNOWN_ISSUES.md: `CANNOT_FIX` section with link to spec

**If fix is PARTIAL** (works for some cases, not others):
1. Update `spec.md`: Mark `Status: PARTIAL`
2. Add section: "What Works" / "What Doesn't Work"
3. Create NEW issue (next NNN) for the remaining cases
4. Commit current spec + code for partial fix
5. Move to KNOWN_ISSUES.md: `PARTIAL` section with link to spec

### Reference from KNOWN_ISSUES.md

```markdown
## RESOLVED ✅
- **BUG-X**: Title — [spec](specs/006-BUG-title/spec.md) | Commit: abc123

## CANNOT_FIX 🔴
- **BUG-Y**: Title — Platform limitation (see spec) — [spec](specs/007-BUG-title/spec.md)

## PARTIAL ⚠️
- **FR-A**: Title (works for X, see spec for details) — [spec](specs/008-FEATURE-title/spec.md)

## OPEN 🟡
- **BUG-Z**: Title (needs investigation) — [spec](specs/009-BUG-title/spec.md)
```

---

## XIV. Data Safety & Roundtrip Testing (CRITICAL)

**Zero silent data loss.** Every release must pass comprehensive roundtrip testing before public availability.

### Roundtrip Testing Requirements

- Load a document → edit in Flux Flow → save → reload in VS Code source editor → verify content unchanged
- Run on documents 100+ lines, complex tables, images, Mermaid diagrams, all formatting types
- Test stress scenarios: rapid typing, undo/redo loops, large pastes, external file changes
- `STRESS_TEST_DOC.md` (located in project root) is the canonical stress test corpus — update it when new features land
- `npm test` must include roundtrip tests (stressTestRoundTrip) — no manual testing handoff to users

### Tracked Bandaids & Fixes

All bugs and workarounds MUST be traceable:

1. **Root-cause analysis**: Before implementing a fix, understand WHY the bug exists
2. **Explicit tracking**: Create a `.md` file in `/memories/repo/` documenting the issue, root cause, and fix strategy
3. **Test coverage**: Write a failing test that catches the bug before applying the fix
4. **Rotation**: Review all tracked bandaids monthly — upgrade them to clean architecture or document why they must remain

### Examples of Tracked Bandaids

- `tbody-fix-root-cause.md` — TipTap rendering issue with empty tbody elements
- `tiptap-ordered-list-fix.md` — Markdown serialization for ordered lists with custom markers
- `menu-heading-style-collision.md` — CSS specificity conflict between menu styles and heading typography

### Known Issues Register

All known bugs are tracked in `KNOWN_ISSUES.md` at the project root. Each bug has:
- A failing test in `src/__tests__/webview/knownIssues.test.ts`
- Root cause analysis and proposed fix
- Priority and confidence to fix

**Maintenance rules:**
- When a new bug is found, add it to `KNOWN_ISSUES.md` with a failing test
- When a bug is fixed, move it to a "Resolved" section with the fix commit hash
- Review the known issues list before each release

## Architectural Constraints

### Platform Integration

**CustomTextEditorProvider Rationale:**
- Text-based editing model keeps Git diffs clean and human-readable
- Undo/redo flow through VS Code, not reimplemented
- Save lifecycle handled by platform, never custom implementations
- Webview is a RENDERER, not a source of truth

### Editor Framework: TipTap + ProseMirror

**Why TipTap over raw ProseMirror:**
- Easier extension API — modular, composable, well-documented
- Official Markdown plugin handles most syntax out of the box
- Rich ecosystem of extensions reduces custom code

**Document Synchronization Model:**
- Canonical source: VS Code's TextDocument
- Webview renders TipTap view from markdown
- User edits computed → Markdown serialized → full document replacement (not diffs)
- 500ms debounce on outbound updates
- 2s grace period before accepting external changes (don't interrupt user typing)

### UI/UX Constraints

**Typography-First Design:**
- Body text: Serif font (Charter/Georgia) — readable prose, not monospace code
- Line height: 1.6–1.8 for body text
- Margins: White space is part of the product
- All visual changes validated by reading 3000+ word document for 10+ minutes in light and dark themes

## Development Workflow & Quality Gates

### Before Each Commit

- [ ] `npm test` passes (all tests, not just new ones)
- [ ] No roundtrip regressions (spot check on complex documents)
- [ ] CSS changes verified in light, dark, and high-contrast themes
- [ ] If modifying `src/webview/extensions/`, verify new extension follows Pattern (Section VIII)
- [ ] If touching `src/editor/` sync logic, verify against Document Sync Pitfalls (Section X)
- [ ] If changing toolbar, verify order parity (Section VII)

### Git Conventions

- **Never commit/push without user review** — only create branches
- **Use `git mv`** for renaming/moving tracked files (preserves history)
- **Dependency changes**: Update `THIRD_PARTY_LICENSES.md` in the same commit
- **Commit message format**: `type(scope): description` (e.g., `feat(editor): add strikethrough formatting`)

### Performance Verification

After implementing performance-sensitive features:

1. Run `npm build:debug`
2. Load a 5000+ line document in the editor
3. Measure responsiveness: typing latency, menu opens, undo/redo speed
4. Check Performance budget (Section III) — if exceeded, profile and optimize before merging

## Governance

**This constitution is the single source of truth** for project constraints, quality standards, and architectural decisions. All code, tests, and design decisions must align with these principles.

### Amendment Procedure

1. **Identifying a need**: Create an issue or discussion documenting the constraint or principle that conflicts with current practice
2. **Proposal & review**: Draft the amendment; get consensus from project maintainers
3. **Version bump**: Update `CONSTITUTION_VERSION` per semantic versioning (see below)
4. **Propagation**: Update dependent templates and guidance files (see consistency checklist in mode instructions)
5. **Commit message**: `docs(constitution): amend vX.Y.Z — [reason]`

### Version Policy

- **MAJOR** (e.g., 1.0.0 → 2.0.0): Backward-incompatible principle removal or redefinition; fundamental architecture shift
- **MINOR** (e.g., 1.0.0 → 1.1.0): New principle or section added; material expansion of existing guidance
- **PATCH** (e.g., 1.0.0 → 1.0.1): Clarifications, wording fixes, typo corrections, non-semantic refinements

### Compliance & Review

- Every PR/MR must verify compliance with principles relevant to the change
- Assigned reviewers should flag violations of Sections I–XIII before approval
- If a violation is intentional, document the rationale in the commit message or PR description
- Monthly: review tracked bandaids (Section XIII) and upgrade or archive as appropriate

---

## XV. Knowledge Graph (Phase 1)

The Knowledge Graph provides hybrid search and relationship tracking across the entire workspace.

- **Hybrid Search**: Uses Reciprocal Rank Fusion (RRF) to combine lexical (FTS4) and semantic (Float32 vectors) search results.
- **Data Mobility**: Cross-platform portability is ensured by using `sql.js` (WASM) and a flat binary vector store.
- **Persistence**: Data resides in `~/.fluxflow` (or a custom `dataDir`).
- **Graph Chat**: A RAG-enabled streaming interface for conversational querying of the workspace.

---

**Version**: 1.1.0 | **Ratified**: 2026-04-09 | **Last Amended**: 2026-04-19
