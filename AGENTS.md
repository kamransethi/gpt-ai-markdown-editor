# Development Workflow

**Single-dev workflow**: Spec → Plan → Code → Test

## Commands You Use

| Command | What | When |
|---------|------|------|
| `/speckit.specify "problem"` | Generate spec.md from description | Start a feature/bug |
| `/speckit.plan` | Generate plan.md from approved spec | After spec is finalized |
| `/speckit.clarify "question"` | Get clarification on ambiguous spec points | If spec is unclear |

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
| Dependencies | Update `THIRD_PARTY_LICENSES.md` if adding/removing |

## Key Principles

- **spec.md** = business problem + success criteria (NO tech)
- **plan.md** = architecture + files + approach (NO user stories)
- **Code** = TDD (RED test → GREEN code → all 828 pass)
- **Tests** = add regression test when fixing bugs
- **Git** = commit to main directly: `spec(NNN)`, `plan(NNN)`, `feat(NNN)`, `fix(NNN)` — no branching