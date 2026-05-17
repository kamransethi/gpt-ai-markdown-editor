# Task: Webview App Shell

## 1. Task Metadata

- **Task name:** Webview App Shell Foundation
- **Slug:** 048-webview-app-shell
- **Status:** planned
- **Created:** 2026-05-17
- **Last updated:** 2026-05-17

---

## 2. Context & Problem

**Current state:**
- The webview only contains the TipTap editor.
- The extension works on a per-file basis, opening new tabs for different files.

**Pain points:**
- Cannot have a full-app experience with sidebars and navigation inside a single webview.

**Why it matters:**
- To achieve the Tolaria design language, we need a singleton app shell containing the sidebar, notes list, editor, and status bar.

---

## 3. Desired Outcome & Scope

**Success criteria:**
- A singleton `vscode.window.createWebviewPanel` is implemented.
- The webview layout is restructured to support `[Sidebar] | [Notes List] | [Editor]`.
- Internal navigation between notes within the webview without opening new VS Code tabs.

**In scope:**
- Refactoring `MarkdownEditorProvider` or creating a new Singleton panel for the App.
- Layout scaffolding using Tailwind.

**Out of scope:**
- Filling in the actual sidebar and notes list data (Track C full).

---

## 4. Technical Plan

**Key changes:**
- `src/extension.ts` – Add "Flux Flow: Open App" command to open the singleton panel.
- `src/editor/AppPanel.ts` (or similar) – Manage the singleton webview and route saves to correct `TextDocument`.
- `src/webview/chrome/Layout.tsx` – React-based or vanilla DOM layout shell.

---

## 6. Work Breakdown

- [ ] **Phase 1: Singleton Webview Panel**
  - Implement the panel and command.
- [ ] **Phase 2: Internal Navigation Logic**
  - Handle `NAVIGATE_TO_NOTE` and `LOAD_NOTE_CONTENT` messages.
- [ ] **Phase 3: VS Code Dirty State Sync**
  - Background `openTextDocument` tracking for active internal notes.
