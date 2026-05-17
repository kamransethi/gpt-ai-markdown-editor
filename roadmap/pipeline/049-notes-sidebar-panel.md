# Task: Notes Sidebar Panel

## 1. Task Metadata

- **Task name:** Notes Sidebar Panel
- **Slug:** 049-notes-sidebar-panel
- **Status:** planned
- **Created:** 2026-05-17
- **Last updated:** 2026-05-17

---

## 2. Context & Problem

**Current state:**
- Navigation relies entirely on the VS Code native explorer.

**Why it matters:**
- The Tolaria design requires an integrated sidebar with Favorites, Views, Types, and Folders, plus a Notes list.

---

## 3. Desired Outcome & Scope

**Success criteria:**
- Sidebar and Notes List components adapted from Tolaria.
- `FoamNote` extended with `type` and `preview` fields.
- `@dnd-kit/core` and `@phosphor-icons/react` integrated.

**In scope:**
- Adapting Tolaria React components.
- Connecting components to VS Code data (Workspace folders, Foam adapter).

---

## 6. Work Breakdown

- [ ] **Phase 1: Data Model Updates**
  - Add `type` and `preview` to FoamNote.
- [ ] **Phase 2: Notes List**
  - Implement NoteItem and SearchPanel.
- [ ] **Phase 3: Sidebar Sections**
  - Implement Favorites, FolderTree, and drag-and-drop reordering.
