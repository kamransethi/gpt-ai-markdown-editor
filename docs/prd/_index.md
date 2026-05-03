# Flux Flow Product Requirements Documents

This folder contains business-oriented product requirement documents for the Flux Flow editor. Each file describes a stable product domain in plain English, without implementation details.

## Purpose

- Capture what the product must do from a user and business perspective.
- Organize features by domain rather than by spec number.
- Maintain a machine-managed history of related specs so the PRD remains current.

## How to use these files

- **Overview**: describes the product capability and the user value.
- **User Scenarios**: outlines the important, stable user journeys for that domain.
- **Functional Requirements**: captures the business-required behaviors in measurable terms.
- **Business Rules**: defines invariants and constraints that must remain true.
- **Out of Scope**: declares what this domain does not cover.
- **Spec History**: auto-generated index of specs that touched this domain.
- **Pending Review**: agent-managed flags for human review when behavior may have changed.

## Source of truth

PRD files are authoritative for what the product does and why. Specs are authoritative for what a specific change does. If a spec and a PRD disagree, a human must reconcile the difference.

## Domain files

- [`editor-core.md`](editor-core.md) — Core editing and document experience
- [`tables.md`](tables.md) — Table authoring and Markdown compatibility
- [`ai-features.md`](ai-features.md) — AI-based authoring and refinement features
- [`images.md`](images.md) — Image handling, editing, and image AI workflows
- [`slash-commands.md`](slash-commands.md) — Slash command entry and picker behavior
- [`frontmatter.md`](frontmatter.md) — YAML frontmatter editing and validation
- [`navigation.md`](navigation.md) — Document navigation and heading discovery
- [`configuration.md`](configuration.md) — User configuration, settings, and environment
- [`knowledge-graph.md`](knowledge-graph.md) — Knowledge graph and semantic workspace search
- [`drawio.md`](drawio.md) — Draw.io diagram interaction
- [`export.md`](export.md) — Markdown export quality and compatibility
- [`plugin-system.md`](plugin-system.md) — Plugin extension points and third-party integration

## Notes

- Not every spec becomes a PRD entry. Engineering, build, or toolchain-only changes are excluded.
- Legacy specs that lack inline metadata are supported through `docs/prd/spec-domain-map.md`.
- Every PRD file contains an auto-generated history table. Do not edit the `Spec History` tables manually.
