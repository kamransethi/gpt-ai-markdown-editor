# [Draw.io](http://Draw.io)

<!-- prd-last-spec: 021 -->

## Overview

The Draw.io domain covers the user experience around diagram images in Flux Flow documents. It focuses on how diagram files are represented, opened, and edited from within the markdown editor.

## User Scenarios

1. **Open Draw.io diagrams**: Given a `.drawio.svg` image in a document, when the user double-clicks it, then it opens in a diagram editor or the default handler for that file type.
2. **Preserve diagram content**: Given a diagram image in the document, when it is saved and reopened, then the image remains intact and editable through the supported flow.
3. **Diagram file awareness**: Given a diagram image node, when the user interacts with it, then the interface recognizes it as a diagram asset rather than a standard image.

## Functional Requirements

- **DIO-001**: The system MUST identify `.drawio.svg` images as diagram assets.
- **DIO-002**: The system MUST allow double-clicking diagram images to open them in the appropriate editor.
- **DIO-003**: The system SHOULD preserve diagram metadata and file path when the image is inserted.
- **DIO-004**: The system SHOULD avoid treating diagram images as regular raster images in the editor workflow.

## Business Rules

- Diagram images MUST remain editable through the designated diagram flow.
- Opening a diagram MUST not lose the original file path or content structure.
- Diagram handling SHALL be consistent across saves, loads, and editor sessions.
- General image actions SHALL continue to work for diagram files unless a diagram-specific action is used.

## Out of Scope

- In-app diagram editing UI beyond launching the external or dedicated diagram handler.
- Non-`.drawio.svg` diagram formats.
- Diagram export formats beyond the existing markdown image reference model.

## Spec History

<!-- AUTO-GENERATED: do not edit manually -->


| Spec                                                                    | Summary                                                                        | Date |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---- |
| [021-drawio-double-click](../../specs/archive/021-drawio-double-click/) | Open `.drawio.svg` files in Draw.io or the default handler when double-clicked | —    |


## Pending Review

<!-- Items here need a human to update prose sections above -->


- Confirm whether diagram images should be treated as a unique asset type for context menus as well as double-click behavior.