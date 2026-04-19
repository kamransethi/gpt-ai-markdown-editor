---
description: Execute the implementation planning workflow using the plan template to generate design artifacts.
handoffs: 
  - label: Create Tasks
    prompt: Code the plan and run tests. Create a todo list of tasks to complete the implementation
agents: ["*"]
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Pre-Execution Checks

**Check for extension hooks (before planning)**:
- Check if `.specify/extensions.yml` exists in the project root.
- If it exists, read it and look for entries under the `hooks.before_plan` key
- If the YAML cannot be parsed or is invalid, skip hook checking silently and continue normally
- Filter out hooks where `enabled` is explicitly `false`. Treat hooks without an `enabled` field as enabled by default.
- For each remaining hook, do **not** attempt to interpret or evaluate hook `condition` expressions:
  - If the hook has no `condition` field, or it is null/empty, treat the hook as executable
  - If the hook defines a non-empty `condition`, skip the hook and leave condition evaluation to the HookExecutor implementation
- For each executable hook, output the following based on its `optional` flag:
  - **Optional hook** (`optional: true`):
    ```
    ## Extension Hooks

    **Optional Pre-Hook**: {extension}
    Command: `/{command}`
    Description: {description}

    Prompt: {prompt}
    To execute: `/{command}`
    ```
  - **Mandatory hook** (`optional: false`):
    ```
    ## Extension Hooks

    **Automatic Pre-Hook**: {extension}
    Executing: `/{command}`
    EXECUTE_COMMAND: {command}

    Wait for the result of the hook command before proceeding to the Outline.
    ```
- If no hooks are registered or `.specify/extensions.yml` does not exist, skip silently

## Outline

1. **Setup**: Run `.specify/scripts/bash/setup-plan.sh --json` from repo root and parse JSON for FEATURE_SPEC, IMPL_PLAN, SPECS_DIR, BRANCH.

2. **Read context**: Read FEATURE_SPEC and `.specify/memory/constitution.md`.

3. **Generate plan.md**: Fill in the plan-template.md structure with concrete details from the spec:
   - **Summary**: 2-3 sentences on what's being built and the core technical approach
   - **Stack**: Exact versions from `.specify/memory/constitution.md` and `package.json` (no NEEDS CLARIFICATION — look it up)
   - **Phases**: 2-3 phases, each with exact file paths (CREATE/MODIFY) and test count
   - **Files table**: Every file touched, action, one-line purpose
   - **Key Risks**: 2-4 real risks with root causes and concrete mitigations
   - **Implementation Decisions**: 2-3 of the most impactful architectural choices where multiple valid approaches exist — NOT obvious choices. Present each as a checkbox list with a clear recommendation and one-line rationale.

4. **Write plan.md**: Save to IMPL_PLAN path.

5. **Present decisions to user**: Show the Implementation Decisions section and ask the user to confirm or challenge them before coding starts. Say: "Plan ready. Confirm these decisions or let me know if you'd change anything — then I'll start coding."

6. **Check for extension hooks (after planning)**: Follow the same hook-checking pattern as Pre-Execution Checks, using `hooks.after_plan`.

## Key rules

- **spec.md is the source of truth** — don't invent requirements not in the spec
- **plan.md is tech-only** — no user stories, no business context, just architecture
- **No extra files** — do not generate research.md, data-model.md, contracts/, or quickstart.md
- **Stack is known** — read `package.json` and constitution.md; never ask about language/framework
- **Decisions only** — only put things in Implementation Decisions if there is genuine tradeoff; skip if obvious
- Always use absolute paths
