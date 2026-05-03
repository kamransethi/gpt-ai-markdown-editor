# Configuration

## Overview

The configuration domain captures how users view and change Flux Flow settings. It includes default markdown viewer preferences, AI provider setup, media path management, and environment configuration that affects the editor experience.

## User Scenarios

1. **Set default markdown viewer**: Given a user installing the extension, when they choose to adopt Flux Flow, then their markdown preview preference is updated and remembered.
2. **Configure AI provider**: Given a user wants AI features, when they open settings, then they can choose between providers and configure model endpoints.
3. **Adjust media paths**: Given a user pastes or inserts media, when they review the dialog, then they can select the media base path and destination folder.
4. **Use stable config storage**: Given a user’s workspace and machine, when the application writes configuration data, then it is stored in a consistent, stable location.

## Functional Requirements

- **CFG-001**: The system MUST allow users to set Flux Flow as the default markdown viewer and remember that choice.
- **CFG-002**: The system MUST provide a configuration experience for selecting LLM providers and managing endpoint settings.
- **CFG-003**: The system MUST expose media path configuration options when inserting images or attachments.
- **CFG-004**: The system SHOULD store Flux Flow-specific configuration in a stable, dedicated folder.
- **CFG-005**: The system SHOULD present configuration changes in a non-modal, discoverable settings interface.

## Business Rules

- Configuration changes MUST be persisted across sessions.
- User choices for default viewer and AI provider MUST be respected until changed explicitly.
- Media path selection SHALL not break existing document references.
- Stable config storage SHALL avoid scattering Flux Flow data across unrelated folders.

## Out of Scope

- General VS Code settings that are unrelated to Flux Flow-specific behavior.
- Low-level file system caching strategies.
- Non-user-facing environment variables.

## Spec History

<!-- AUTO-GENERATED: do not edit manually -->
| Spec | Summary | Date |
|------|---------|------|
| [001-default-markdown-viewer](../../specs/archive/001-default-markdown-viewer/) | Prompt users to choose Flux Flow as the default markdown viewer | — |
| [006-BUG-viewer-prompt-persistence](../../specs/archive/006-BUG-viewer-prompt-persistence/) | Fix prompt persistence for default markdown viewer selection | — |
| [010-llm-provider-selection](../../specs/archive/010-llm-provider-selection/) | Add selection and configuration of LLM providers and endpoints | — |
| [015-graceful-copilot-fallback](../../specs/archive/015-graceful-copilot-fallback/) | Add graceful fallback and provider availability handling | — |
| [016-attachment_image_config](../../specs/archive/016-attachment_image_config/) | Expose image and attachment media path settings during paste and insert | — |
| [017-system_config](../../specs/archive/017-system_config/) | Provide a dedicated system configuration panel for Flux Flow settings | — |
| [024-fluxflow-config-folder](../../specs/archive/024-fluxflow-config-folder/) | Centralize Flux Flow data in a stable config folder | — |

## Pending Review

<!-- Items here need a human to update prose sections above -->
- [ ] Review whether CFG-002 needs to explicitly cover Ollama provider selection UI trends.
