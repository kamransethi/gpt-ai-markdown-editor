# Task: Webview Status Bar

## 1. Task Metadata

- **Task name:** Webview Status Bar
- **Slug:** 050-webview-status-bar
- **Status:** planned
- **Created:** 2026-05-17
- **Last updated:** 2026-05-17

---

## 2. Context & Problem

**Current state:**
- Git status and word counts are displayed in the native VS Code status bar.

**Why it matters:**
- The new architecture brings the status bar *inside* the webview at the bottom.

---

## 3. Desired Outcome & Scope

**Success criteria:**
- Status bar at the bottom of the webview showing: Docs count, Night mode, Settings, Git Changes, Commit, Synced Last, History.
- Bidirectional messaging for Git state updates between webview and extension host.

---

## 6. Work Breakdown

- [ ] **Phase 1: StatusBar Component**
  - Build UI using Tailwind and `@phosphor-icons/react`.
- [ ] **Phase 2: Git Integration Bridge**
  - Extension host listens to `repo.state.onDidChange()` and sends updates.
- [ ] **Phase 3: Actions**
  - Implement Night mode toggle, Commit dialog, and History view triggers.
