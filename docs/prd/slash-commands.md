# Slash Commands

## Overview

The slash commands domain captures the command palette-like entry experience for inserting content while typing. It covers how users discover and activate slash commands, how the editor presents file and image pickers, and the performance expectations of this inline command system.

## User Scenarios

1. **Slash command discovery**: Given a user typing `/`, when the slash command menu appears, then available commands are displayed clearly and intuitively.
2. **Image insert command**: Given a user chooses the image command, when they select a file, then that image is inserted into the document at the cursor location.
3. **File insert command**: Given a user chooses a file command, when they select a file, then the document receives a markdown reference to that file path.
4. **Responsive performance**: Given a user is typing quickly, when the slash command menu is active, then the command registry remains responsive and does not trigger expensive re-renders.

## Functional Requirements

- **SL-001**: The system MUST provide a slash command registry that is discoverable from inline typing.
- **SL-002**: The system MUST support file and image insertion commands via slash menu actions.
- **SL-003**: The system MUST display an active preview of the selected file or image path while the command is pending insertion.
- **SL-004**: The system SHOULD cache command options locally to keep menu interaction fast.
- **SL-005**: The system SHOULD avoid canceling or re-opening the menu unnecessarily during selection.

## Business Rules

- Slash command behavior MUST not require users to leave the editor to insert files or images.
- Performance-sensitive operations SHALL be cached or throttled to keep the command menu responsive.
- The chosen file or image path SHALL be inserted exactly where the cursor or command placeholder exists.
- The slash command registry SHALL support extension over time without breaking existing commands.

## Out of Scope

- Keyboard shortcut definitions outside the slash command menu.
- Non-inline command experiences such as panels or separate toolbars.
- Provider-specific command logic not related to file/image insertion.

## Spec History

<!-- AUTO-GENERATED: do not edit manually -->
| Spec | Summary | Date |
|------|---------|------|
| [026-slash-command-refactor](../../specs/archive/026-slash-command-refactor/) | Refactor slash command registry and improve menu performance | — |
| [034-file-image-slash-cmd](../../specs/034-file-image-slash-cmd/) | Fix image slash command and add file slash command preview | — |

## Pending Review

<!-- Items here need a human to update prose sections above -->
- [ ] Confirm whether slash command performance should be captured as a separate non-functional requirement in SL-004.
