# Instructions for AI Agents

> **Project:** VS Code WYSIWYG Markdown Editor (medium.com-style reading/writing experience)
> **Core value:** Write markdown naturally—focus on content, not syntax
> **Source of Truth:** Code + tests → `.specify/memory/constitution.md` → this file

This project uses [GitHub Spec Kit](https://github.com/github/spec-kit) for Spec-Driven Development. Use `/speckit.*` commands for the full workflow.

- **Project principles & constraints:** See `.specify/memory/constitution.md`
- **Feature specs:** Use `/speckit.specify` to create new feature specs
- **Planning:** Use `/speckit.plan` → `/speckit.tasks` → `/speckit.implement`

---

## Quick Reference: File Locations

| Task                  | File                                         |
| --------------------- | -------------------------------------------- |
| Add command           | `package.json` + `src/extension.ts`          |
| Add keyboard shortcut | `package.json`                               |
| Add config option     | `package.json`                               |
| Modify editor UI      | `src/webview/editor.ts` + `src/webview/editor.css` |
| Style changes         | `src/webview/editor.css`                     |
| Add toolbar button    | `src/webview/BubbleMenuView.ts`              |
| Add TipTap extension  | `src/webview/extensions/`                    |
| Update document sync  | `src/editor/MarkdownEditorProvider.ts`       |

## Key Technical Decisions

| Decision         | Choice                        | Why                                               |
| ---------------- | ----------------------------- | ------------------------------------------------- |
| Editor Provider  | `CustomTextEditorProvider`    | Text-based, VS Code handles save/undo, better Git |
| Editor Framework | TipTap (over raw ProseMirror) | Easier API, rich extensions, markdown built-in    |
| Document Sync    | Full replacement              | Simpler, VS Code handles internal diffing         |
| Sync Debounce    | 500ms                         | Balance responsiveness vs. performance            |
| Body Font        | Serif (Charter/Georgia)       | Prose, not code; matches premium editors          |

## Git Rules

- **Never commit or push** — User must review first
- **Use `git mv`** for renaming/moving tracked files (preserves history)
- If adding/removing dependencies, update `THIRD_PARTY_LICENSES.md`

### Refactoring Roadmap

1. Remove redundant hacks (e.g. `markdownInputRules.ts`).
2. Migrate global DOM manipulation out of `editor.ts` and into proper ProseMirror internal `NodeView` components (e.g. Image Resizing handles).
3. Decouple Message Handling: Move extension-specific message handling into `addProseMirrorPlugins` within the extension itself, limiting the footprint inside the main `editor.ts` switch statement.