---
name: "speckit-prd-update"
description: "Update PRD product requirement documents with newly archived specs and flag reviews when behavior may have changed."
compatibility: "Requires spec-kit project structure with .specify/ directory"
metadata:
  author: "github-spec-kit"
  source: "custom/prd-update"
---

## User Input

```text
$ARGUMENTS
```

You MUST consider the user input before proceeding (if not empty).

## Efficiency Rules (read these before doing anything)

- **Read only lines 1–8 of each spec file** — the header block contains all needed metadata (`**PRD Domains**:`, `**Created**:`, title). Never read the full spec body.
- **Read only lines 1–3 of each PRD file first** to extract `<!-- prd-last-spec: NNN -->`. If the spec number being evaluated is ≤ NNN for every domain it maps to, skip that spec entirely — it is already recorded.
- **Only read the `## Spec History` section of a PRD** (from that heading to `## Pending Review`) when you have confirmed a new row must be appended. Never read Zone 1 prose sections.
- **Consult `docs/prd/spec-domain-map.md` only for specs that lack an inline `**PRD Domains**:` tag** — do not load it speculatively.
- After appending rows, update the `<!-- prd-last-spec: NNN -->` watermark in each modified PRD to reflect the new highest spec number recorded.

## Behavior

1. Use `file_search` to get all `spec.md` paths under `specs/` and `specs/archive/`. Extract the numeric prefix from each folder name.
2. For each PRD file in `docs/prd/`, read **lines 1–3 only** to get its `<!-- prd-last-spec: NNN -->` watermark.
3. For each spec, read **lines 1–8 only**. Extract `**PRD Domains**:` if present. If absent, look up the spec folder in `docs/prd/spec-domain-map.md`.
4. Skip any spec whose number is ≤ the watermark of every PRD domain it maps to.
5. For remaining (new) specs, read the `## Spec History` to `## Pending Review` slice of each affected PRD and append a row:
   - Spec link: relative path from `docs/prd/` into the spec folder
   - Summary: one sentence derived from the spec title and header description
   - Date: use `**Created**:` value from header if available, else `—`
6. If the spec title or header description suggests a behavior change or bug fix, add a checklist item to `## Pending Review` in each affected PRD file.
7. Update `<!-- prd-last-spec: NNN -->` in each modified PRD to the new highest spec number recorded for that file.
8. Do not modify any Zone 1 prose sections (Overview, User Scenarios, Functional Requirements, Business Rules, Out of Scope).
9. Do not delete or reorder existing history rows or pending review items.

## Output

- A concise status summary of specs processed, rows added, and review flags created.
- No extra content beyond the status summary unless the user asks for a diff or details.
