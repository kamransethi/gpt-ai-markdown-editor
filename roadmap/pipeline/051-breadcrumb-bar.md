# Task: Breadcrumb Bar

## 1. Task Metadata

- **Task name:** Breadcrumb Bar
- **Slug:** 051-breadcrumb-bar
- **Status:** planned
- **Created:** 2026-05-17
- **Last updated:** 2026-05-17

---

## 2. Context & Problem

**Current state:**
- The formatting toolbar is right-aligned, but the left side is empty.

**Why it matters:**
- Tolaria features a breadcrumb/title bar indicating the current note title, type, and path.

---

## 3. Desired Outcome & Scope

**Success criteria:**
- BreadcrumbBar component implemented on the top-left of the editor area.
- Formatting toolbar remains unchanged on the right.

---

## 6. Work Breakdown

- [ ] **Phase 1: UI Implementation**
  - Adapt `BreadcrumbBar.tsx` from Tolaria.
- [ ] **Phase 2: Data Binding**
  - Connect current note title and path from the active document state.
