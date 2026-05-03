# Images

## Overview

The images domain covers how users add, manage, and interact with images in Flux Flow documents. It includes image insertion, paste behavior, drag-and-drop handling, AI-assisted image queries, context menu actions, and diagram image workflows.

## User Scenarios

1. **Image insertion and paste**: Given a user pasting or inserting an image, when the image is added, then the system uses configured media paths and stores the image in the active repository location.
2. **Context-sensitive image actions**: Given an image in the editor, when the user invokes a context menu, then they can edit, copy, reveal, or ask AI about the image.
3. **File and image slash commands**: Given a user typing a slash command, when they request an image or file insert, then the editor opens the correct picker and inserts the selected resource.
4. **Diagram image editing**: Given a `.drawio.svg` diagram image, when the user double-clicks it, then it opens in an appropriate diagram editor flow.

## Functional Requirements

- **IMG-001**: The system MUST allow images to be inserted or pasted using configured media settings.
- **IMG-002**: The system MUST provide a context menu for image-specific actions, including edit, reveal, copy, and AI ask operations.
- **IMG-003**: The system MUST support image-aware slash commands that insert images from a picker into the document.
- **IMG-004**: The system SHOULD retain image metadata and file path context when rendering previews or building image-related queries.
- **IMG-005**: The system SHOULD enable diagram image workflows for `.drawio.svg` files that preserve their editability.

## Business Rules

- Image actions MUST preserve the original image path and not alter the source file unless the user explicitly requests it.
- Image insertion MUST follow the active media path configuration for both paste and manual selection.
- Image context menus SHALL be available for any image element in the document, not only hover overlays.
- Diagram image edit actions SHALL open the appropriate editor or handler for the image file type.

## Out of Scope

- Non-editor image generation or editing services outside the document workflow.
- Complex image transformation workflows such as cropping or in-app photo editing.
- Image storage backend details beyond application-level media path configuration.

## Spec History

<!-- AUTO-GENERATED: do not edit manually -->
| Spec | Summary | Date |
|------|---------|------|
| [011-image-ai-ask](../../specs/archive/011-image-ai-ask/) | Add image AI Ask workflows for images in the editor | — |
| [016-attachment_image_config](../../specs/archive/016-attachment_image_config/) | Display and configure media path settings during paste and image insert | — |
| [020-file-drag-drop](../../specs/archive/020-file-drag-drop/) | Support drag-and-drop insertion of files, including non-image references | — |
| [021-drawio-double-click](../../specs/archive/021-drawio-double-click/) | Open `.drawio.svg` images in a diagram editor when double-clicked | — |
| [034-file-image-slash-cmd](../../specs/034-file-image-slash-cmd/) | Add file and image slash commands with active path preview | — |
| [035-image-context-menu](../../specs/035-image-context-menu/) | Provide a right-click image context menu for edit and AI actions | — |
| [038-unified-ai-webview-markdown](../../specs/038-unified-ai-webview-markdown/) | Unify AI image analysis and document explanation results in the same webview panel | — |

## Pending Review

<!-- Items here need a human to update prose sections above -->
- [ ] Confirm whether the image AI ask workflow should be described as part of images or AI features in user scenarios.
