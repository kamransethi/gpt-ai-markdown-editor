# Task: Tailwind + CSS Token Migration

## 1. Task Metadata

- **Task name:** Tailwind + CSS Token Migration (Foundation)
- **Slug:** 047-tailwind-css-migration
- **Status:** planned
- **Created:** 2026-05-17
- **Last updated:** 2026-05-17

---

## 2. Context & Problem

**Current state:**
- The project relies on a monolithic `editor.css` (~4,700 lines) file for all webview styling.
- Future tracks (like the app shell, sidebar, and status bar) require a component-driven styling approach.

**Pain points:**
- Difficult to maintain and scale complex UI using vanilla CSS alone.
- Lack of a centralized token system that bridges VS Code themes and our UI.

**Why it matters:**
- Tailwind v4 will provide the foundation for quickly building the full Tolaria-style app shell.
- A CSS variable bridge will cleanly map `--vscode-*` variables to our internal semantic tokens.

---

## 3. Desired Outcome & Scope

**Success criteria:**
- Tailwind v4 is successfully integrated via esbuild and PostCSS.
- `src/webview/theme.css` maps `--vscode-*` variables to Tailwind theme tokens.
- Existing `editor.css` is incrementally migrated to use Tailwind utility classes.
- A new user setting `fluxflow.editorFont` allows switching between Charter/Georgia and Inter.

**In scope:**
- Adding Tailwind v4 and PostCSS to the build process.
- Creating the CSS variable bridge (`theme.css`).
- Migrating `editor.css` section by section.
- Adding the VS Code setting for the editor font.

**Out of scope:**
- Building the app shell or sidebar (covered in other specs).

---

## 4. UX & Behavior

**Behavior rules:**
- The editor font should default to Charter/Georgia (serif) but allow Inter (sans-serif) as an option.
- UI chrome must always use Inter.
- Existing UI should look identical, just powered by Tailwind utilities.

---

## 5. Technical Plan

**Key changes:**
- `scripts/build-webview.js` – Add PostCSS step for Tailwind v4.
- `src/webview/theme.css` – New file for CSS variable bridge.
- `src/webview/editor.css` – Migrate sections to Tailwind classes.
- `package.json` – Add `fluxflow.editorFont` setting.

---

## 6. Work Breakdown

- [ ] **Phase 1: Build Setup**
  - Add Tailwind v4 to esbuild via `@tailwindcss/postcss`.
- [ ] **Phase 2: CSS Token Bridge**
  - Create `theme.css` with semantic variables.
- [ ] **Phase 3: Font Setting**
  - Add `fluxflow.editorFont` to `package.json` and handle it in the extension.
- [ ] **Phase 4: Migration**
  - Incrementally convert `editor.css` to Tailwind.
