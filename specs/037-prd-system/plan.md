# Implementation Plan: PRD Documentation System

**Folder**: `specs/037-prd-system/plan.md` | **Date**: 2026-05-03 | **Spec**: *(no spec — this is a documentation initiative)*  
**Status**: Approved ✅

---

## Summary

We are creating a living `docs/prd/` folder containing 12 domain-organized product requirement documents written in BSA (Business Systems Analyst) style — plain English, no tech details, no implementation specifics. Each file describes what a feature area does and why it exists, with stable numbered functional requirements. A machine-maintained **Spec History** table in each file tracks which specs touched that domain. A new agent skill (`speckit-prd-update`) automates keeping the index current after each spec is archived.

This is executed in 5 sequential phases. Phases 2–4 are the "donkey work" suitable for a lesser model working file-by-file. Phase 5 is agent infrastructure.

---

## Source of Truth Rule

> **PRD files are authoritative for what the product does and why.**  
> Specs are authoritative for what a specific change was.  
> If a spec contradicts a PRD's prose, a human must reconcile. The PRD wins by default unless the spec was an intentional product behavior change.

---

## Domain Map

| PRD File | Domain | Covers Specs (by number) |
|---|---|---|
| `editor-core.md` | Core editing capabilities, document lifecycle, drag-drop, webview | 001, 002, 004, 005, 007, 008, 020, 022, 025, 031, 032 |
| `tables.md` | Table editing, GFM compat, bullets in cells, compression | 013, 029, 030, 033 |
| `ai-features.md` | AI Refine, LLM provider selection, custom prompts, Copilot fallback | 005, 010, 011, 015, 022, 027 |
| `images.md` | Image insert, paste, drag-drop, AI ask, context menu, drawio images | 011, 016, 020, 021, 034, 035 |
| `slash-commands.md` | Slash command registry, file/image pickers, performance | 026, 034 |
| `frontmatter.md` | YAML frontmatter panel, button, validation | 007, 008 |
| `navigation.md` | TOC panel, search/filter, heading navigation | 014 |
| `configuration.md` | Settings panel, default viewer, LLM config, media paths, config folder | 001, 006, 010, 015, 016, 017, 024 |
| `knowledge-graph.md` | FluxFlow semantic search, indexing, graph chat, bug fixes | 023, 024, 027 |
| `drawio.md` | Draw.io diagram integration, double-click launch | 021 |
| `export.md` | Markdown export quality, Pandoc compat, compression, token efficiency | 013, 019, 029, 030 |
| `plugin-system.md` | Third-party plugin architecture, toolbar/menu extension points | 003 |

*Dev-tooling specs (009, 012, 019, 025, 031, 032, 036) are engineering artifacts and do not get PRD files.*

---

## PRD File Anatomy

Every PRD file has exactly **three zones**. Zones 1 and 3 are human-authored. Zone 2 is machine-maintained.

```
## Overview                         ← ZONE 1 START (human prose, stable)
## User Scenarios
## Functional Requirements
## Business Rules
## Out of Scope                      ← ZONE 1 END

## Spec History                      ← ZONE 2 (append-only, agent-managed)
<!-- AUTO-GENERATED: do not edit manually -->

## Pending Review                    ← ZONE 3 (agent writes, human clears)
```

### Zone 1 — Human Prose

| Section | Content |
|---|---|
| **Overview** | 2–3 sentences: what this capability is, what user problem it solves |
| **User Scenarios** | The permanent, stable user journeys for this domain. Written once, updated only when product behavior materially changes. Use Given/When/Then format. |
| **Functional Requirements** | Domain-scoped FR codes (e.g. `TBL-001` for tables, `AI-001` for ai-features). "The system MUST / SHOULD" language. Technology-agnostic. |
| **Business Rules** | Invariants that must always hold regardless of implementation. Constraints, edge cases, behaviors that can never be violated. |
| **Out of Scope** | What this domain deliberately does NOT cover. Prevents scope creep and confusion with adjacent domains. |

### Zone 2 — Spec History (machine-maintained)

```markdown
## Spec History
<!-- AUTO-GENERATED: do not edit manually -->
| Spec | Summary | Date |
|------|---------|------|
| [033-table-cell-bullet-serialization](../../specs/archive/033-table-cell-bullet-serialization/) | Bullets in table cells rendered as text prefixes for GFM compatibility | 2025-xx |
```

Rules: append-only, never delete rows, relative links to spec folder, one row per spec, no duplicates.

### Zone 3 — Pending Review (agent-flagged, human-cleared)

```markdown
## Pending Review
<!-- Items here need a human to update prose sections above -->
- [ ] Spec 033 changed bullet behavior in cells — verify FR-TBL-003 still accurate
```

Agent adds items here when a new spec appears to change *existing* behavior (not just add new). Human deletes the checklist item once they've reviewed and updated Zone 1 prose if needed.

---

## FR Code Prefixes

| Domain | Prefix |
|---|---|
| editor-core | `EC-` |
| tables | `TBL-` |
| ai-features | `AI-` |
| images | `IMG-` |
| slash-commands | `SL-` |
| frontmatter | `FM-` |
| navigation | `NAV-` |
| configuration | `CFG-` |
| knowledge-graph | `KG-` |
| drawio | `DIO-` |
| export | `EXP-` |
| plugin-system | `PLG-` |

---

## Phases

**Phase 1 — Scaffold**: Create `docs/prd/` folder structure with `_index.md` and 12 empty PRD files with correct zone headers and placeholder sections. No prose content yet — just structure.

- Files: CREATE `docs/prd/_index.md`, CREATE all 12 domain `.md` files
- Tests: None — verify files exist and contain correct section headers

**Phase 2 — Prose Drafting (one domain at a time)**: For each PRD file, read the relevant specs listed in the Domain Map, then draft Zone 1 prose (Overview, User Scenarios, FRs, Business Rules, Out of Scope). Work domain-by-domain in this order: `editor-core`, `tables`, `ai-features`, `images`, `slash-commands`, `frontmatter`, `navigation`, `configuration`, `knowledge-graph`, `drawio`, `export`, `plugin-system`.

- Files: MODIFY all 12 domain `.md` files (populate Zone 1 only)
- Tests: None — human review required after each file

**Phase 3 — Spec History Population**: For each archived spec, determine its PRD domains (from the Domain Map), and append one row per domain to the relevant file's `## Spec History` table. Active specs (034, 035, 036) are included; archived specs (001–033) are included. Populate in ascending spec number order.

- Files: MODIFY all 12 domain `.md` files (populate Zone 2)
- Tests: None — verify row counts match expected per domain

**Phase 4 — Tag Existing Specs**: Add a `**PRD Domains**:` line to the header section of all 36 existing `spec.md` files. This tag is the trigger used by the auto-update skill. Place it after the **Status** line (or after **Created** if no Status line exists).

Format:
```markdown
**PRD Domains**: `tables`, `export`
```

- Files: MODIFY all 36 `spec.md` files (add one line each)
- Tests: None — verify tag present in each file

**Phase 5 — Auto-Update Skill**: Create the `speckit-prd-update` skill and register it so it can be invoked as `/speckit.prd.update`. The skill scans specs, finds new entries not yet in any PRD's Spec History, appends them, and flags Pending Review items.

- Files: CREATE `.agents/skills/speckit-prd-update/SKILL.md`
- Tests: None — manual invocation test

---

## Files

| File | Action | Purpose |
|------|--------|---------|
| `docs/prd/_index.md` | CREATE | Domain registry, source-of-truth rule, link map to all 12 PRD files |
| `docs/prd/editor-core.md` | CREATE | Core editing, document lifecycle, drag-drop, webview capabilities |
| `docs/prd/tables.md` | CREATE | Table editing, GFM compat, bullets in cells, compression |
| `docs/prd/ai-features.md` | CREATE | AI Refine, LLM provider, custom prompts, Copilot fallback |
| `docs/prd/images.md` | CREATE | Image insert/paste/drag, AI ask, context menu, draw.io images |
| `docs/prd/slash-commands.md` | CREATE | Slash command registry, file/image pickers |
| `docs/prd/frontmatter.md` | CREATE | YAML frontmatter panel, inline button, validation |
| `docs/prd/navigation.md` | CREATE | TOC panel, heading search/filter |
| `docs/prd/configuration.md` | CREATE | Settings panel, LLM config, media paths, config folder |
| `docs/prd/knowledge-graph.md` | CREATE | FluxFlow semantic search, indexing, graph chat |
| `docs/prd/drawio.md` | CREATE | Draw.io diagram integration |
| `docs/prd/export.md` | CREATE | Markdown export, Pandoc compat, compression |
| `docs/prd/plugin-system.md` | CREATE | Third-party plugin architecture |
| All 36 `spec.md` files | MODIFY | Add `**PRD Domains**:` tag line |
| `.agents/skills/speckit-prd-update/SKILL.md` | CREATE | Agent skill for auto-updating Spec History tables |

---

## `speckit-prd-update` Skill Behavior

When invoked as `/speckit.prd.update`:

1. **Discover specs**: Scan `specs/` and `specs/archive/` for all `spec.md` files that contain a `**PRD Domains**:` tag.
2. **Parse domains**: Extract the domain list from each spec's tag line.
3. **Check current state**: For each (spec, domain) pair, check whether that spec already has a row in the domain file's `## Spec History` table.
4. **Append missing rows**: For each (spec, domain) pair not yet in the table, append one row with: relative link to spec folder, one-sentence summary (derived from the spec's title + description), and date (today's date or spec creation date if available).
5. **Flag behavior changes**: If the spec's title contains "BUG", "fix", "regression", "refactor", or "remove", add a `## Pending Review` item in each affected PRD file noting that existing FRs may need review.
6. **Report**: Print a summary of how many rows were added and how many pending review flags were set.

The skill does **not** modify Zone 1 prose. It does **not** delete any existing rows or flags.

---

## Key Risks

| Risk | Cause | Mitigation |
|------|-------|-----------|
| PRD prose becomes stale | Specs change behavior without triggering PRD update | `## Pending Review` flags + source-of-truth rule in `_index.md` |
| Duplicate Spec History rows | Auto-update runs multiple times | Skill checks for existing rows before appending |
| Domain boundaries are ambiguous | Some specs span many domains | Domain Map is the canonical assignment; `_index.md` documents the rule |
| Phase 2 prose quality varies | Written by a lesser model | Human review gate after each domain file; Pending Review flags catch gaps |
| Tag format inconsistency | Lesser model formats tag differently | Skill parses backtick-wrapped comma-separated values; documents exact format |

---

## Implementation Decisions

*All pre-decided. No confirmation needed.*

**Decision 1 — Folder location**: `docs/prd/` not `prd/` at root.
- [x] **A**: `docs/prd/` — consistent with where documentation naturally lives; keeps root clean.
- [ ] **B**: `prd/` at root.
- Chosen: **A**

**Decision 2 — Tag placement in spec.md files**: After `**Status**:` line (or `**Created**:` if no Status).
- [x] **A**: Inline in existing header block — discoverable, consistent, minimal footprint.
- [ ] **B**: New dedicated section at bottom of spec.
- Chosen: **A** — keeps header as single source of spec metadata.

**Decision 3 — Spec History date source**: Use the folder number as a proxy for sequence; use file creation date if available, otherwise leave as `—`.
- [x] **A**: Best-effort date from spec content or `—` if unknown.
- [ ] **B**: Require explicit date in every row.
- Chosen: **A** — don't block bootstrapping on missing metadata.

**Decision 4 — Dev-tooling specs**: Excluded from PRD domain files.
- [x] **A**: No PRD file for engineering/tooling-only specs (009, 012, 019, 025, 031, 032, 036).
- [ ] **B**: Include a `dev-tooling.md` PRD file.
- Chosen: **A** — PRD is a product artifact, not an engineering changelog.
