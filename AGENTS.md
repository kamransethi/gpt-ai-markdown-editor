# Development Workflow

**Single-dev workflow**: Spec → Plan → Code → Test

## Commands You Use

| Command | What | When |
|---------|------|------|
| `/speckit.specify "problem"` | Generate spec.md from description | Start a feature/bug |
| `/speckit.plan` | Generate plan.md from approved spec | After spec is finalized |
| `/speckit.clarify "question"` | Get clarification on ambiguous spec points | If spec is unclear |

## Workflow Files

**See [.specify/guides/WORKFLOW_AUTOMATION.md](.specify/guides/WORKFLOW_AUTOMATION.md) for master reference of all workflow files.**

- `.specify/guides/WORKFLOW_AUTOMATION.md` — Central workflow reference (update this first, then sync others)
- `.specify/guides/llm-prompts.md` — Copy-paste prompts for each phase
- `.specify/templates/quick-bug.md` — Bug spec template
- `.specify/templates/spec-template.md` — Feature spec template
- `.specify/templates/plan-template.md` — Implementation plan template

## File Locations

| Task | File |
|------|------|
| Add command | `package.json` + `src/extension.ts` |
| Add keyboard shortcut | `package.json` |
| Add config option | `package.json` |
| Modify editor UI | `src/webview/editor.ts` + `src/webview/editor.css` |
| Style | `src/webview/editor.css` |
| Toolbar button | `src/webview/BubbleMenuView.ts` |
| TipTap extension | `src/webview/extensions/` |
| Document sync | `src/editor/MarkdownEditorProvider.ts` |
| Knowledge Graph | `src/features/fluxflow/` |
| Draw.io Integration | `src/webview/extensions/drawio.ts` |
| Dependencies | Update `THIRD_PARTY_LICENSES.md` if adding/removing |

## Key Principles

- **spec.md** = business problem + success criteria (NO tech)
- **plan.md** = architecture + files + approach (NO user stories)
- **Code** = TDD (RED test → GREEN code → all 1000+ pass)
- **Tests** = add regression test when fixing bugs
- **Git** = commit to main directly: `spec(NNN)`, `plan(NNN)`, `feat(NNN)`, `fix(NNN)` — no branching

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan: specs/041-open-as-rich-text-button/plan.md
<!-- SPECKIT END -->
