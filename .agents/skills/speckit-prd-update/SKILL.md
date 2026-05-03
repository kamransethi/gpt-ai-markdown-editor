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

## Behavior

1. Scan `specs/` and `specs/archive/` for all `spec.md` files.
2. For each spec, first look for a `**PRD Domains**:` metadata tag in the file header. If none exists, consult `docs/prd/spec-domain-map.md` for a legacy mapping.
3. Normalize the domain list as comma-separated values inside backticks.
4. For each spec/domain pair, determine whether the spec already appears in the corresponding PRD file's `## Spec History` table.
5. If not present, append a row to the `## Spec History` table with:
   - Spec link: relative path from `docs/prd/` into the spec folder
   - Summary: one sentence derived from the spec title and build description
   - Date: `—` when no reliable date is available
6. If a spec title or description suggests behavior change or bug fixes, add a checklist item to `## Pending Review` in each affected PRD file.
7. Do not modify any Zone 1 prose sections.
8. Do not delete or reorder existing history rows or pending review items.

## Output

- A concise status summary of specs processed, rows added, and review flags created.
- No extra content beyond the status summary unless the user asks for a diff or details.
